"""T4.1 to T4.4: the API served from the real artifacts."""

import json
import shutil
import time

import joblib
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.predictor import AGREEMENT_INTRO, agreement, risk_level
from app.settings import DEFAULT_ARTIFACTS_DIR, MAX_BODY_BYTES, Settings
from ml.config import (
    ARTIFACTS_DIR,
    DATASET_CITATION,
    EXCLUDED_COLUMNS,
    FEATURE_GROUPS,
    RISK_LEVELS,
    TARGET_IDS,
    TARGETS,
    VESSEL_IDS,
)

JSON = {"Content-Type": "application/json"}


def read(name: str):
    return json.loads((ARTIFACTS_DIR / name).read_text(encoding="utf-8"))


def app_for(artifacts_dir) -> TestClient:
    settings = Settings(allowed_origins=("http://localhost:5173",), artifacts_dir=artifacts_dir)
    return TestClient(create_app(settings))


@pytest.fixture(scope="module")
def client():
    return app_for(DEFAULT_ARTIFACTS_DIR)


@pytest.fixture(scope="module")
def meta(client):
    return client.get("/api/meta").json()


@pytest.fixture(scope="module")
def samples(client):
    return client.get("/api/samples").json()["samples"]


@pytest.fixture
def features(samples):
    """A valid request payload that a test may change freely."""
    return dict(samples[0]["features"])


def predict(client, features):
    return client.post("/api/predict", json={"features": features})


def details_of(response) -> list[dict]:
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    return error["details"]


# --- T4.1 registry, health, meta ---------------------------------------------------------------


def test_health_is_200_with_artifacts(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "models_loaded": True,
        "model_version": read("manifest.json")["model_version"],
    }


def test_library_mismatch_makes_the_service_unavailable(tmp_path):
    manifest = read("manifest.json")
    manifest["libraries"]["scikit-learn"] = "0.0.0"
    (tmp_path / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    client = app_for(tmp_path)

    health = client.get("/api/health")
    assert health.status_code == 503
    assert "trained with scikit-learn 0.0.0" in health.json()["reason"]
    assert "pip install -r requirements.txt" in health.json()["reason"]

    calls = [client.get(f"/api/{name}") for name in ("meta", "samples", "metrics")]
    calls.append(client.post("/api/predict", json={"features": {}}))
    for response in calls:
        assert response.status_code == 503
        assert response.json() == {
            "error": {"code": "MODEL_UNAVAILABLE", "message": health.json()["reason"]}
        }


def test_incomplete_artifacts_make_the_service_unavailable(tmp_path):
    shutil.copy(ARTIFACTS_DIR / "manifest.json", tmp_path / "manifest.json")
    response = app_for(tmp_path).get("/api/health")

    assert response.status_code == 503
    assert "incomplete or unreadable" in response.json()["reason"]
    assert response.json()["reason"].endswith("Run: python -m ml.train")


def test_meta_matches_the_contract(meta):
    schema = read("feature_schema.json")
    metrics = read("metrics.json")
    manifest = read("manifest.json")

    assert set(meta) == {
        "model_version", "trained_at", "dataset", "targets", "feature_groups", "features",
        "quick_controls", "decision_threshold", "risk_levels", "excluded_columns", "dropped_features",
    }
    assert (meta["model_version"], meta["trained_at"]) == (manifest["model_version"], manifest["trained_at"])
    assert meta["dataset"] == {
        "name": "extention of Z-Alizadeh sani dataset",
        "citation": DATASET_CITATION,
        "license": "CC BY 4.0",
        "url": "https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset",
        "n_total": 303,
        "n_train": 297,
        "n_holdout": 6,
    }
    assert [target["id"] for target in meta["targets"]] == list(TARGET_IDS)
    for target, expected in zip(meta["targets"], TARGETS):
        selected = metrics["targets"][expected.id]["selected_model"]
        assert target == {
            "id": expected.id,
            "label": expected.label,
            "short_label": expected.short_label,
            "kind": expected.kind,
            "description": expected.description,
            "model_type": selected,
            "shap_units": "probability" if selected == "random_forest" else "log_odds",
        }
    assert meta["features"] == schema["features"]
    assert meta["feature_groups"] == list(FEATURE_GROUPS)
    assert meta["quick_controls"] == schema["quick_controls"]
    assert meta["decision_threshold"] == 0.5
    assert meta["risk_levels"] == list(RISK_LEVELS)
    assert meta["excluded_columns"] == list(EXCLUDED_COLUMNS)
    assert meta["dropped_features"] == [{"source_column": "Exertional CP", "reason": "zero variance"}]


def test_meta_keeps_integers_as_integers(meta):
    age = next(feature for feature in meta["features"] if feature["id"] == "age")
    assert [type(age[key]) for key in ("min", "max", "step", "default")] == [int, int, int, int]


# --- T4.2 samples, metrics, plots --------------------------------------------------------------


def test_samples_match_the_contract(samples, meta):
    stored = read("samples.json")["samples"]
    feature_ids = [feature["id"] for feature in meta["features"]]

    assert [sample["id"] for sample in samples] == [f"sample-{letter}" for letter in "abcdef"]
    for sample, original in zip(samples, stored):
        assert set(sample) == {"id", "title", "subtitle", "features", "ground_truth", "note"}
        assert sample == {key: value for key, value in original.items() if key != "source_row"}
        assert list(sample["features"]) == feature_ids
        assert set(sample["ground_truth"]) == set(TARGET_IDS)


def test_metrics_are_served_as_written(client):
    assert client.get("/api/metrics").json() == read("metrics.json")


@pytest.mark.parametrize("target", TARGET_IDS)
@pytest.mark.parametrize("kind", ["roc", "calibration", "confusion"])
def test_plots_are_served(client, target, kind):
    response = client.get(f"/static/plots/{target}_{kind}.png")

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content == (ARTIFACTS_DIR / "plots" / f"{target}_{kind}.png").read_bytes()


@pytest.mark.parametrize("name", ["nope_roc.png", "cad_roc.jpg", "..%2Fmanifest.json", "CAD_ROC.png"])
def test_missing_plot_returns_404_envelope(client, name):
    response = client.get(f"/static/plots/{name}")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


# --- T4.3 predict ------------------------------------------------------------------------------


@pytest.mark.parametrize("index", range(6))
def test_each_sample_predicts(client, samples, meta, index):
    response = predict(client, samples[index]["features"])
    body = response.json()
    feature_ids = {feature["id"] for feature in meta["features"]}
    numeric = {feature["id"] for feature in meta["features"] if feature["type"] == "numeric"}
    model_type = {target["id"]: target["model_type"] for target in meta["targets"]}

    assert response.status_code == 200
    assert set(body) == {"model_version", "predictions", "agreement", "explanations"}
    assert body["model_version"] == meta["model_version"]
    assert list(body["predictions"]) == list(body["explanations"]) == list(TARGET_IDS)

    for target, prediction in body["predictions"].items():
        probability = prediction["probability"]
        assert 0 <= probability <= 1 and round(probability, 4) == probability
        assert prediction["predicted"] is (probability >= 0.5)
        assert prediction["risk_level"] == risk_level(probability)

    for target, explanation in body["explanations"].items():
        contributions = explanation["contributions"]
        assert explanation["model_type"] == model_type[target]
        assert {item["feature"] for item in contributions} == feature_ids
        assert len(contributions) == len(feature_ids)
        magnitudes = [abs(item["shap"]) for item in contributions]
        assert magnitudes == sorted(magnitudes, reverse=True)
        assert sum(abs(item["relative"]) for item in contributions) == pytest.approx(1, abs=0.005)
        assert explanation["output_value"] == pytest.approx(
            explanation["base_value"] + sum(item["shap"] for item in contributions), abs=1e-4
        )
        for item in contributions:
            assert item["value"] == samples[index]["features"][item["feature"]]
            assert (item["percentile"] is not None) == (item["feature"] in numeric)
        assert explanation["summary"].startswith("Factor")


def test_probabilities_come_from_the_saved_models(client, samples):
    body = predict(client, samples[0]["features"]).json()
    frame = pd.DataFrame([samples[0]["features"]])
    for target in TARGET_IDS:
        pipeline = joblib.load(ARTIFACTS_DIR / "models" / f"{target}.joblib")["pipeline"]
        expected = round(float(pipeline.predict_proba(frame)[0, 1]), 4)
        assert body["predictions"][target]["probability"] == expected


def test_predict_is_deterministic(client, features):
    assert predict(client, features).json() == predict(client, features).json()


def test_typical_values_and_range_limits_predict(client, meta):
    typical = {feature["id"]: feature["default"] for feature in meta["features"]}
    assert predict(client, typical).status_code == 200

    for limit in ("min", "max"):
        extreme = {
            feature["id"]: feature[limit] if feature["type"] == "numeric" else feature["default"]
            for feature in meta["features"]
        }
        assert predict(client, extreme).status_code == 200


def test_whole_number_sent_as_float_is_accepted(client, features):
    features["age"] = 60.0
    features["bmi"] = 25
    assert predict(client, features).status_code == 200


def test_agreement_follows_the_predictions(client, samples):
    for sample in samples:
        body = predict(client, sample["features"]).json()
        assert body["agreement"] == agreement(body["predictions"])


def _predictions(cad: bool, *vessels: bool) -> dict:
    flags = dict(zip(("cad", *VESSEL_IDS), (cad, *vessels)))
    return {target: {"predicted": flag} for target, flag in flags.items()}


def test_agreement_cases():
    assert agreement(_predictions(True, False, True, False)) == {"consistent": True, "message": None}
    assert agreement(_predictions(False, False, False, False)) == {"consistent": True, "message": None}
    assert agreement(_predictions(True, False, False, False)) == {
        "consistent": False,
        "message": f"{AGREEMENT_INTRO} Here, CAD is predicted but no single vessel reaches 50%.",
    }
    assert agreement(_predictions(False, False, False, True)) == {
        "consistent": False,
        "message": f"{AGREEMENT_INTRO} Here, a vessel reaches 50% but overall CAD is not predicted.",
    }


@pytest.mark.parametrize(
    ("probability", "level"),
    [(0.0, "low"), (0.3499, "low"), (0.35, "moderate"), (0.6499, "moderate"), (0.65, "high"), (1.0, "high")],
)
def test_risk_level_boundaries(probability, level):
    assert risk_level(probability) == level


# --- T4.4 validation (BR-13) -------------------------------------------------------------------

AGE_RANGE = "Must be between 30 and 86 (range seen in the dataset)."
BBB_ALLOWED = "Must be one of: None, LBBB, RBBB."


@pytest.mark.parametrize(
    ("field", "value", "issue", "message"),
    [
        ("age", None, "missing", "This value is required."),
        ("age", "58", "wrong_type", "Must be a number."),
        ("age", True, "wrong_type", "Must be a number."),
        ("age", [58], "wrong_type", "Must be a number."),
        ("dm", 1, "wrong_type", "Must be true or false."),
        ("dm", "true", "wrong_type", "Must be true or false."),
        ("bbb", 3, "wrong_type", BBB_ALLOWED),
        ("age", 58.5, "not_integer", "Must be a whole number."),
        ("age", 29, "out_of_range", AGE_RANGE),
        ("age", 87, "out_of_range", AGE_RANGE),
        ("age", 10**400, "out_of_range", AGE_RANGE),
        ("bmi", 10, "out_of_range", "Must be between 18.2 and 40.9 (range seen in the dataset)."),
        ("cr", 2.3, "out_of_range", "Must be between 0.5 and 2.2 (range seen in the dataset)."),
        ("bbb", "Other", "not_allowed", BBB_ALLOWED),
        ("bbb", "lbbb", "not_allowed", BBB_ALLOWED),
        ("vhd", "Critical", "not_allowed", "Must be one of: None, Mild, Moderate, Severe."),
    ],
)
def test_invalid_value_is_rejected(client, features, field, value, issue, message):
    features[field] = value
    response = client.post("/api/predict", content=json.dumps({"features": features}), headers=JSON)

    assert details_of(response) == [{"field": field, "issue": issue, "message": message}]
    assert response.json()["error"]["message"] == "1 input needs attention."


@pytest.mark.parametrize("literal", ["NaN", "Infinity", "-Infinity", "1e999"])
def test_non_finite_number_is_rejected(client, features, literal):
    features["bmi"] = "__NUMBER__"
    body = json.dumps({"features": features}).replace('"__NUMBER__"', literal)
    response = client.post("/api/predict", content=body, headers=JSON)

    assert details_of(response) == [
        {"field": "bmi", "issue": "not_finite", "message": "Must be a finite number."}
    ]


def test_missing_and_unknown_fields_are_rejected(client, features):
    del features["age"]
    features["cath"] = "CAD"
    features["zzz"] = 1

    assert details_of(predict(client, features)) == [
        {"field": "age", "issue": "missing", "message": "This value is required."},
        {"field": "cath", "issue": "unknown_field", "message": "Unknown field."},
        {"field": "zzz", "issue": "unknown_field", "message": "Unknown field."},
    ]


def test_all_problems_are_reported_together_in_schema_order(client, features, meta):
    features.update(age=200, sex="X", ef_tte="high", vhd=None)
    response = predict(client, features)
    details = details_of(response)
    order = [feature["id"] for feature in meta["features"]]

    assert [(item["field"], item["issue"]) for item in details] == [
        ("age", "out_of_range"), ("sex", "not_allowed"), ("ef_tte", "wrong_type"), ("vhd", "missing"),
    ]
    assert [item["field"] for item in details] == sorted((i["field"] for i in details), key=order.index)
    assert response.json()["error"]["message"] == "4 inputs need attention."


@pytest.mark.parametrize(
    ("body", "issue"),
    [
        ("{}", "missing"),
        ('{"features": []}', "wrong_type"),
        ('{"features": "x"}', "wrong_type"),
        ("[]", "wrong_type"),
        ("not json", "wrong_type"),
    ],
)
def test_body_level_problems_use_the_features_field(client, body, issue):
    details = details_of(client.post("/api/predict", content=body, headers=JSON))

    assert [(item["field"], item["issue"]) for item in details] == [("features", issue)]


def test_extra_top_level_key_is_rejected(client, features):
    response = client.post("/api/predict", json={"features": features, "patient_name": "x"})

    assert details_of(response) == [
        {
            "field": "features",
            "issue": "unknown_field",
            "message": "Unexpected field in the request body: patient_name.",
        }
    ]


def test_validation_errors_do_not_echo_the_values(client, features):
    features["sex"] = "private-value-123"
    assert "private-value-123" not in predict(client, features).text


def test_oversized_predict_body_returns_413(client, features):
    features["note"] = "x" * MAX_BODY_BYTES
    response = predict(client, features)

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_a_real_request_is_far_below_the_size_limit(features):
    assert len(json.dumps({"features": features})) < MAX_BODY_BYTES / 4


def test_predict_latency_is_reported(client, features, capsys):
    durations = []
    for _ in range(50):
        started = time.perf_counter()
        assert predict(client, features).status_code == 200
        durations.append((time.perf_counter() - started) * 1000)
    durations.sort()
    p95 = durations[int(0.95 * len(durations)) - 1]
    with capsys.disabled():
        print(f"\n[info] POST /api/predict over 50 calls: median {durations[25]:.0f} ms, p95 {p95:.0f} ms")

    # Informational against the 300 ms target (PRODUCT_SPEC §12); only a gross regression fails.
    assert p95 < 2000
