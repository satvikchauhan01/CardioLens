"""T9.1: startup failures. The server starts anyway and answers 503 with a reason (API_CONTRACT §2)."""

import json
import shutil

import joblib
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.registry import ArtifactsUnavailable, load_registry
from app.settings import Settings
from ml.config import ARTIFACTS_DIR, TARGET_IDS

RETRAIN = "Run: python -m ml.train"


def settings_for(directory) -> Settings:
    return Settings(allowed_origins=("http://localhost:5173",), artifacts_dir=directory)


def edit_json(path, change) -> None:
    content = json.loads(path.read_text(encoding="utf-8"))
    change(content)
    path.write_text(json.dumps(content), encoding="utf-8")


def copy_models(directory, *targets: str) -> None:
    for target in targets:
        shutil.copy(ARTIFACTS_DIR / "models" / f"{target}.joblib", directory / "models")


@pytest.fixture
def artifacts(tmp_path):
    """A private copy of the real artifacts that a test may damage. Model files are added on request."""
    directory = tmp_path / "artifacts"
    shutil.copytree(ARTIFACTS_DIR, directory, ignore=shutil.ignore_patterns("models"))
    (directory / "models").mkdir()
    return directory


# --- each way the artifacts can be unusable ----------------------------------------------------


def label_column_among_the_inputs(directory):
    def add(schema):
        schema["features"].append({**schema["features"][0], "id": "lad", "source_column": "LAD"})

    edit_json(directory / "feature_schema.json", add)


def metrics_without_a_target(directory):
    edit_json(directory / "metrics.json", lambda metrics: metrics["targets"].pop("rca"))


def metrics_without_the_validation(directory):
    copy_models(directory, *TARGET_IDS)
    edit_json(directory / "metrics.json", lambda metrics: metrics.pop("validation"))


def truncated_samples(directory):
    (directory / "samples.json").write_text('{"samples": [', encoding="utf-8")


def missing_reference_values(directory):
    (directory / "reference_values.json").unlink()


def missing_model_file(directory):
    copy_models(directory, "cad")  # the next one, lad, is not there


def model_of_another_target(directory):
    shutil.copy(ARTIFACTS_DIR / "models" / "rca.joblib", directory / "models" / "cad.joblib")


def model_trained_on_other_inputs(directory):
    bundle = joblib.load(ARTIFACTS_DIR / "models" / "cad.joblib")
    bundle["feature_ids"] = bundle["feature_ids"][:-1]
    joblib.dump(bundle, directory / "models" / "cad.joblib")


def model_file_that_is_not_a_model(directory):
    (directory / "models" / "cad.joblib").write_bytes(b"not a model")


DAMAGE = [
    (label_column_among_the_inputs, "LeakageError"),
    (metrics_without_a_target, "ValueError"),
    (metrics_without_the_validation, "KeyError"),
    (truncated_samples, "JSONDecodeError"),
    (missing_reference_values, "FileNotFoundError"),
    (missing_model_file, "FileNotFoundError"),
    (model_of_another_target, "ValueError"),
    (model_trained_on_other_inputs, "ValueError"),
    (model_file_that_is_not_a_model, None),  # the exact error is joblib's business
]


@pytest.mark.parametrize("damage, error_name", DAMAGE, ids=[damage.__name__ for damage, _ in DAMAGE])
def test_unusable_artifacts_make_the_service_unavailable(artifacts, damage, error_name):
    damage(artifacts)
    client = TestClient(create_app(settings_for(artifacts)))

    health = client.get("/api/health")
    reason = health.json()["reason"]
    assert health.status_code == 503
    assert health.json() == {
        "status": "unavailable", "models_loaded": False, "model_version": None, "reason": reason,
    }
    assert reason.startswith(f"Artifacts in {artifacts.as_posix()} are incomplete or unreadable (")
    assert reason.endswith(RETRAIN)
    assert "Traceback" not in reason
    if error_name:
        assert f"({error_name})" in reason

    # Nothing is served from half-loaded artifacts: every data endpoint gives the same reason.
    calls = [client.get(f"/api/{name}") for name in ("meta", "samples", "metrics")]
    calls.append(client.post("/api/predict", json={"features": {}}))
    for response in calls:
        assert response.status_code == 503
        assert response.json() == {"error": {"code": "MODEL_UNAVAILABLE", "message": reason}}


@pytest.mark.parametrize("damage, error_name", DAMAGE, ids=[damage.__name__ for damage, _ in DAMAGE])
def test_loading_fails_with_one_error_type(artifacts, damage, error_name):
    damage(artifacts)

    with pytest.raises(ArtifactsUnavailable) as failure:
        load_registry(settings_for(artifacts))

    # The original error is kept as the cause for the server log, not put in the message.
    assert failure.value.__cause__ is not None
    if error_name:
        assert type(failure.value.__cause__).__name__ == error_name


def test_leakage_guard_runs_before_any_model_is_loaded(artifacts, monkeypatch):
    """BR-2 at startup: a schema with a label column is refused without unpickling anything."""
    label_column_among_the_inputs(artifacts)
    copy_models(artifacts, *TARGET_IDS)
    loaded = []
    monkeypatch.setattr("app.registry.joblib.load", lambda path: loaded.append(path))

    with pytest.raises(ArtifactsUnavailable, match="LeakageError"):
        load_registry(settings_for(artifacts))

    assert loaded == []


def test_scikit_learn_version_is_checked_before_any_model_is_loaded(artifacts, monkeypatch):
    def other_version(manifest):
        manifest["libraries"]["scikit-learn"] = "0.0.0"

    edit_json(artifacts / "manifest.json", other_version)
    copy_models(artifacts, *TARGET_IDS)
    loaded = []
    monkeypatch.setattr("app.registry.joblib.load", lambda path: loaded.append(path))

    with pytest.raises(ArtifactsUnavailable, match="trained with scikit-learn 0.0.0"):
        load_registry(settings_for(artifacts))

    assert loaded == []


def test_a_complete_copy_is_served(artifacts):
    """The control: the copy is only unusable in the tests above because of the damage done to it."""
    copy_models(artifacts, *TARGET_IDS)
    client = TestClient(create_app(settings_for(artifacts)))
    manifest = json.loads((ARTIFACTS_DIR / "manifest.json").read_text(encoding="utf-8"))

    assert client.get("/api/health").json() == {
        "status": "ok", "models_loaded": True, "model_version": manifest["model_version"],
    }
    sample = client.get("/api/samples").json()["samples"][0]
    assert client.post("/api/predict", json={"features": sample["features"]}).status_code == 200
    assert client.get("/static/plots/cad_roc.png").status_code == 200


def test_plots_folder_serves_only_plot_files(artifacts):
    """A startup failure does not turn the plots route into a way to read other artifact files."""
    client = TestClient(create_app(settings_for(artifacts)))

    assert client.get("/static/plots/cad_roc.png").status_code == 200
    for name in ("manifest.json", "..%2Fmanifest.json", "..%2Fmodels%2Fcad.joblib", "CAD_ROC.PNG", "cad_roc.png.bak"):
        response = client.get(f"/static/plots/{name}")
        assert response.status_code == 404
        assert response.json() == {"error": {"code": "NOT_FOUND", "message": "Not Found"}}
