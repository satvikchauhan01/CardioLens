"""Loads the trained artifacts once at startup (ARCHITECTURE DF-6); read-only afterwards."""

import json
from dataclasses import dataclass
from importlib.metadata import version
from pathlib import Path

import joblib
from sklearn.pipeline import Pipeline

from app.schemas import MetaResponse, MetricsResponse, SamplesResponse
from app.settings import Settings
from ml.config import (
    DATASET_CITATION,
    DATASET_LICENSE,
    DATASET_NAME,
    DATASET_URL,
    DECISION_THRESHOLD,
    RISK_LEVELS,
    TARGET_IDS,
    TARGETS,
)
from ml.dataset import assert_no_leakage
from ml.explain import TargetExplainer


class ArtifactsUnavailable(Exception):
    """The artifacts are missing or unusable. The message is safe to show to the user."""


@dataclass(frozen=True)
class Registry:
    model_version: str
    features: list[dict]  # FeatureSchema entries, in schema order
    pipelines: dict[str, Pipeline]
    explainers: dict[str, TargetExplainer]
    meta: MetaResponse
    samples: SamplesResponse
    metrics: MetricsResponse


def _read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _build_meta(manifest: dict, schema: dict, metrics: dict, samples: list, bundles: dict) -> MetaResponse:
    n_train = metrics["validation"]["n_rows"]
    return MetaResponse(
        model_version=manifest["model_version"],
        trained_at=manifest["trained_at"],
        dataset={
            "name": DATASET_NAME,
            "citation": DATASET_CITATION,
            "license": DATASET_LICENSE,
            "url": DATASET_URL,
            "n_total": n_train + len(samples),
            "n_train": n_train,
            "n_holdout": len(samples),
        },
        targets=[
            {
                "id": target.id,
                "label": target.label,
                "short_label": target.short_label,
                "kind": target.kind,
                "description": target.description,
                "model_type": bundles[target.id]["model_type"],
                "shap_units": bundles[target.id]["shap_units"],
            }
            for target in TARGETS
        ],
        feature_groups=schema["feature_groups"],
        features=schema["features"],
        quick_controls=schema["quick_controls"],
        decision_threshold=DECISION_THRESHOLD,
        risk_levels=list(RISK_LEVELS),
        excluded_columns=schema["excluded_columns"],
        dropped_features=schema["dropped_features"],
    )


def load_registry(settings: Settings) -> Registry:
    """Load and check every artifact; raises ArtifactsUnavailable with the reason."""
    directory, label = settings.artifacts_dir, settings.artifacts_label
    retrain = "Run: python -m ml.train"
    if not (directory / "manifest.json").is_file():
        raise ArtifactsUnavailable(f"Artifacts not found in {label}. {retrain}")

    try:
        manifest = _read_json(directory / "manifest.json")
        trained_with = manifest["libraries"]["scikit-learn"]
    except (ValueError, KeyError, TypeError) as error:
        raise ArtifactsUnavailable(f"The manifest in {label} is unreadable. {retrain}") from error
    installed = version("scikit-learn")
    if trained_with != installed:
        # Pickled scikit-learn models are only safe to load with the version that wrote them.
        raise ArtifactsUnavailable(
            f"The models were trained with scikit-learn {trained_with}, but {installed} is installed. "
            f"Install the pinned versions (pip install -r requirements.txt) or retrain. {retrain}"
        )

    try:
        schema = _read_json(directory / "feature_schema.json")
        samples = _read_json(directory / "samples.json")["samples"]
        metrics = _read_json(directory / "metrics.json")
        reference_values = _read_json(directory / "reference_values.json")
        feature_ids = [entry["id"] for entry in schema["features"]]
        assert_no_leakage(feature_ids)
        if list(metrics["targets"]) != list(TARGET_IDS):
            raise ValueError("metrics do not cover every target")

        bundles = {}
        for target in TARGET_IDS:
            bundle = joblib.load(directory / "models" / f"{target}.joblib")
            if bundle["target"] != target or bundle["feature_ids"] != feature_ids:
                raise ValueError(f"model bundle for {target} does not match the feature schema")
            bundles[target] = bundle

        return Registry(
            model_version=manifest["model_version"],
            features=schema["features"],
            pipelines={target: bundle["pipeline"] for target, bundle in bundles.items()},
            explainers={
                target: TargetExplainer(bundle, schema["features"], reference_values)
                for target, bundle in bundles.items()
            },
            meta=_build_meta(manifest, schema, metrics, samples, bundles),
            samples=SamplesResponse(
                samples=[
                    {key: value for key, value in sample.items() if key != "source_row"}
                    for sample in samples
                ]
            ),
            metrics=MetricsResponse(**metrics),
        )
    except Exception as error:
        # Deliberately broad: whatever goes wrong while loading, the artifacts cannot be served.
        raise ArtifactsUnavailable(
            f"Artifacts in {label} are incomplete or unreadable ({type(error).__name__}). {retrain}"
        ) from error
