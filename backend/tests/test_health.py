"""T1.3: health endpoint, error envelope and body size limit."""

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.main import create_app
from app.settings import DEFAULT_ARTIFACTS_DIR, MAX_BODY_BYTES, Settings

ORIGIN = "http://localhost:5173"


def make_settings(artifacts_dir) -> Settings:
    return Settings(allowed_origins=(ORIGIN,), artifacts_dir=artifacts_dir)


@pytest.fixture
def app(tmp_path):
    return create_app(make_settings(tmp_path))


@pytest.fixture
def client(app):
    return TestClient(app)


def assert_envelope(response, status_code: int, code: str) -> dict:
    assert response.status_code == status_code
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    assert isinstance(body["error"]["message"], str) and body["error"]["message"]
    return body["error"]


def test_health_is_503_without_artifacts(client, tmp_path):
    response = client.get("/api/health")

    assert response.status_code == 503
    assert response.json() == {
        "status": "unavailable",
        "models_loaded": False,
        "model_version": None,
        "reason": f"Artifacts not found in {tmp_path.as_posix()}. Run: python -m ml.train",
    }


def test_default_artifacts_folder_is_named_by_its_repo_path():
    assert make_settings(DEFAULT_ARTIFACTS_DIR).artifacts_label == "backend/artifacts"


def test_health_stays_503_until_the_registry_exists(tmp_path):
    (tmp_path / "manifest.json").write_text("{}")
    response = TestClient(create_app(make_settings(tmp_path))).get("/api/health")

    assert response.status_code == 503
    assert response.json()["models_loaded"] is False


def test_unknown_route_returns_404_envelope(client):
    error = assert_envelope(client.get("/api/does-not-exist"), 404, "NOT_FOUND")
    assert set(error) == {"code", "message"}


def test_wrong_method_returns_405_envelope(client):
    assert_envelope(client.post("/api/health"), 405, "NOT_FOUND")


def test_interactive_docs_are_disabled(client):
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert_envelope(client.get(path), 404, "NOT_FOUND")


def test_oversized_body_returns_413(client):
    response = client.post("/api/predict", content=b"x" * (MAX_BODY_BYTES + 1))
    assert_envelope(response, 413, "PAYLOAD_TOO_LARGE")


def test_oversized_chunked_body_returns_413(client):
    def chunks():
        yield b"x" * MAX_BODY_BYTES
        yield b"x"

    response = client.post("/api/predict", content=chunks())
    assert "content-length" not in response.request.headers
    assert_envelope(response, 413, "PAYLOAD_TOO_LARGE")


def test_body_at_the_limit_reaches_the_app_intact(app):
    received = {}

    @app.post("/echo")
    async def echo(payload: dict) -> dict:
        received.update(payload)
        return {"ok": True}

    padding = "x" * (MAX_BODY_BYTES - len('{"pad":""}'))
    response = TestClient(app).post(
        "/echo", content=f'{{"pad":"{padding}"}}', headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 200
    assert received == {"pad": padding}


def test_invalid_body_returns_422_envelope(app):
    class Body(BaseModel):
        features: dict

    @app.post("/needs-body")
    def needs_body(body: Body) -> dict:
        return {}

    error = assert_envelope(TestClient(app).post("/needs-body", json={}), 422, "VALIDATION_ERROR")
    (detail,) = error["details"]
    assert (detail["field"], detail["issue"]) == ("features", "missing")
    assert isinstance(detail["message"], str) and detail["message"]


def test_unexpected_error_returns_500_without_traceback(app):
    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("secret internal detail")

    response = TestClient(app, raise_server_exceptions=False).get("/boom")

    assert_envelope(response, 500, "INTERNAL_ERROR")
    assert "secret internal detail" not in response.text
    assert "Traceback" not in response.text


def test_cors_allows_only_listed_origins(client):
    allowed = client.get("/api/health", headers={"Origin": ORIGIN})
    blocked = client.get("/api/health", headers={"Origin": "http://evil.example"})

    assert allowed.headers["access-control-allow-origin"] == ORIGIN
    assert "access-control-allow-origin" not in blocked.headers


def test_cors_headers_are_present_on_413(client):
    response = client.post(
        "/api/predict", content=b"x" * (MAX_BODY_BYTES + 1), headers={"Origin": ORIGIN}
    )

    assert response.status_code == 413
    assert response.headers["access-control-allow-origin"] == ORIGIN
