"""Train the four models and write every artifact (ARCHITECTURE DF-5).

Run from backend/:  python -m ml.train
"""

import json
import platform
import time
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path

import joblib

from ml.config import (
    ARTIFACTS_DIR,
    DATA_PATH,
    DECISION_THRESHOLD,
    EXCLUDED_COLUMNS,
    FEATURE_GROUPS,
    GLOBAL_IMPORTANCE_TOP,
    HOLDOUT_SLOTS,
    N_REPEATS,
    N_SPLITS,
    QUICK_CONTROL_COUNT,
    SEED,
    TARGET_IDS,
    TARGETS,
)
from ml.dataset import (
    assert_no_leakage,
    build_feature_schema,
    build_reference_values,
    build_samples,
    file_sha256,
    load_dataset,
    select_holdout,
    training_rows,
)
from ml.evaluate import cross_validate, select_model, write_plots
from ml.explain import TargetExplainer, global_importance
from ml.models import MODEL_LABELS, SHAP_UNITS, make_pipeline
from ml.preprocessing import transformed_to_feature

MANIFEST_LIBRARIES = ("scikit-learn", "shap", "pandas", "numpy", "joblib")
METRIC_DECIMALS = 4


def write_json(path: Path, payload) -> None:
    text = json.dumps(payload, indent=2, ensure_ascii=False)
    path.write_text(text + "\n", encoding="utf-8", newline="\n")


def _rounded(metrics: dict) -> dict:
    return {
        model: {name: {k: round(v, METRIC_DECIMALS) for k, v in stat.items()} for name, stat in scores.items()}
        for model, scores in metrics.items()
    }


def quick_controls(importance: dict[str, list[dict]], feature_ids: list[str]) -> list[str]:
    """BR-9: the features with the highest mean importance share across the targets."""
    shares = [{item["feature"]: item["share"] for item in ranking} for ranking in importance.values()]
    mean_share = {feature: sum(s[feature] for s in shares) / len(shares) for feature in feature_ids}
    # Stable sort: equal scores keep the schema order.
    return sorted(feature_ids, key=lambda feature: -mean_share[feature])[:QUICK_CONTROL_COUNT]


def train(
    data_path: Path = DATA_PATH, artifacts_dir: Path = ARTIFACTS_DIR, n_repeats: int = N_REPEATS
) -> dict:
    """Run the whole pipeline; returns the manifest."""
    started = time.perf_counter()
    dataset = load_dataset(data_path)
    # BR-2: checked first, so nothing is computed from a label column and nothing is written.
    assert_no_leakage(dataset.feature_ids)
    holdout_rows = select_holdout(dataset.labels)
    rows = training_rows(dataset, holdout_rows)
    schema = build_feature_schema(dataset, rows)
    reference_values = build_reference_values(dataset, rows)
    features = dataset.features.loc[rows]

    data_sha256 = file_sha256(data_path)
    trained_at = datetime.now(timezone.utc).replace(microsecond=0)
    model_version = f"{trained_at:%Y%m%dT%H%MZ}-{data_sha256[:7]}"

    models_dir = artifacts_dir / "models"
    plots_dir = artifacts_dir / "plots"
    models_dir.mkdir(parents=True, exist_ok=True)
    plots_dir.mkdir(parents=True, exist_ok=True)

    print(f"Training rows: {len(rows)} · held-out samples: {len(holdout_rows)} · inputs: {len(schema)}")
    target_metrics, importance = {}, {}
    for target in TARGETS:
        labels = dataset.labels.loc[rows, target.id]
        validation = cross_validate(features, labels, schema, n_repeats=n_repeats)
        selected, reason = select_model(validation.metrics)

        pipeline = make_pipeline(selected, schema).fit(features, labels)
        preprocessor = pipeline.named_steps["preprocess"]
        bundle = {
            "target": target.id,
            "model_type": selected,
            "pipeline": pipeline,
            "feature_ids": dataset.feature_ids,
            "transformed_to_feature": transformed_to_feature(preprocessor),
            "shap_units": SHAP_UNITS[selected],
            "shap_background": (
                preprocessor.transform(features) if selected == "logistic_regression" else None
            ),
            "sklearn_version": version("scikit-learn"),
        }
        assert_no_leakage(bundle["feature_ids"])
        joblib.dump(bundle, models_dir / f"{target.id}.joblib")

        grouped, _ = TargetExplainer(bundle, schema, reference_values).grouped_shap(features)
        importance[target.id] = global_importance(grouped, dataset.feature_ids)

        positives = int(labels.sum())
        target_metrics[target.id] = {
            "n_positive": positives,
            "n_negative": len(labels) - positives,
            "prevalence": round(positives / len(labels), METRIC_DECIMALS),
            "selected_model": selected,
            "selection_reason": reason,
            "candidates": _rounded(validation.metrics),
            "global_importance": [
                {"feature": item["feature"], "share": round(item["share"], METRIC_DECIMALS)}
                for item in importance[target.id][:GLOBAL_IMPORTANCE_TOP]
            ],
            "plots": write_plots(plots_dir, target, labels, validation, selected),
        }
        auc = validation.metrics[selected]["roc_auc"]
        print(
            f"  {target.id}: {MODEL_LABELS[selected]} — ROC-AUC {auc['mean']:.3f} ± {auc['std']:.3f} "
            f"({reason})"
        )

    write_json(
        artifacts_dir / "feature_schema.json",
        {
            "features": schema,
            "feature_groups": list(FEATURE_GROUPS),
            "quick_controls": quick_controls(importance, dataset.feature_ids),
            "excluded_columns": list(EXCLUDED_COLUMNS),
            "dropped_features": list(dataset.dropped),
        },
    )
    write_json(artifacts_dir / "samples.json", {"samples": build_samples(dataset, holdout_rows)})
    write_json(artifacts_dir / "reference_values.json", reference_values)
    write_json(
        artifacts_dir / "metrics.json",
        {
            "model_version": model_version,
            "validation": {
                "scheme": "repeated_stratified_kfold",
                "n_splits": N_SPLITS,
                "n_repeats": n_repeats,
                "seed": SEED,
                "n_rows": len(rows),
                "decision_threshold": DECISION_THRESHOLD,
                "preprocessing_inside_folds": True,
                "excluded_columns": list(EXCLUDED_COLUMNS),
                "holdout_note": (
                    f"{len(HOLDOUT_SLOTS)} sample patients were held out by a fixed rule (seed {SEED}) "
                    "before any training; they are not used for cross-validation or the final fit."
                ),
            },
            "targets": target_metrics,
        },
    )
    manifest = {
        "model_version": model_version,
        "trained_at": f"{trained_at:%Y-%m-%dT%H:%M:%SZ}",
        "data_file": data_path.name,
        "data_sha256": data_sha256,
        "seed": SEED,
        "python": platform.python_version(),
        "libraries": {name: version(name) for name in MANIFEST_LIBRARIES},
        "targets": list(TARGET_IDS),
    }
    # Written last: the API treats the manifest as the sign that the artifacts are complete.
    write_json(artifacts_dir / "manifest.json", manifest)
    print(f"Wrote artifacts to {artifacts_dir} in {time.perf_counter() - started:.0f} s · {model_version}")
    return manifest


if __name__ == "__main__":
    train()
