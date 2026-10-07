"""FastAPI application factory: CORS, body size limit, error envelope, health."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.settings import MAX_BODY_BYTES, Settings, load_settings

# API_CONTRACT §1: the only codes the error envelope may carry (D-038).
ERROR_CODES = {
    404: "NOT_FOUND",
    405: "NOT_FOUND",
    413: "PAYLOAD_TOO_LARGE",
    422: "VALIDATION_ERROR",
    503: "MODEL_UNAVAILABLE",
}
PAYLOAD_TOO_LARGE_MESSAGE = f"Request body is larger than {MAX_BODY_BYTES // 1024} KB."
INTERNAL_ERROR_MESSAGE = "Something went wrong on the server."


def error_response(
    status_code: int,
    message: str,
    details: list[dict] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    error: dict = {"code": ERROR_CODES.get(status_code, "INTERNAL_ERROR"), "message": message}
    if details is not None:
        error["details"] = details
    return JSONResponse(status_code=status_code, content={"error": error}, headers=headers)


class BodySizeLimitMiddleware:
    """Reject request bodies above max_bytes with 413, with or without Content-Length."""

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        too_large = error_response(413, PAYLOAD_TOO_LARGE_MESSAGE)
        declared = dict(scope["headers"]).get(b"content-length", b"")
        if declared.isdigit() and int(declared) > self.max_bytes:
            await too_large(scope, receive, send)
            return

        # The limit is small, so the body is buffered here and replayed to the app.
        body = b""
        more_body = True
        while more_body:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body += message.get("body", b"")
            if len(body) > self.max_bytes:
                await too_large(scope, receive, send)
                return
            more_body = message.get("more_body", False)

        replayed = False

        async def replay() -> Message:
            nonlocal replayed
            if replayed:
                return await receive()
            replayed = True
            return {"type": "http.request", "body": body, "more_body": False}

        await self.app(scope, replay, send)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return error_response(exc.status_code, str(exc.detail), headers=exc.headers)


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    # Body-level problems only; per-feature validation (BR-13) is added in T4.3.
    details = [
        {
            "field": "features",
            "issue": "missing" if error["type"] == "missing" else "wrong_type",
            "message": error["msg"],
        }
        for error in exc.errors()
    ]
    return error_response(422, "The request body is not valid.", details)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Uvicorn logs the traceback; the response body never contains it.
    return error_response(500, INTERNAL_ERROR_MESSAGE)


def unavailable_reason(settings: Settings) -> str:
    """Why the models are not ready. Replaced by the artifact registry in T4.1."""
    if not (settings.artifacts_dir / "manifest.json").is_file():
        return f"Artifacts not found in {settings.artifacts_label}. Run: python -m ml.train"
    return "Artifacts found, but model loading is not implemented yet (BUILD_MAP T4.1)."


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()

    # No interactive docs: Swagger UI and ReDoc load their assets from a CDN (D-007).
    app = FastAPI(title="CardioLens API", docs_url=None, redoc_url=None, openapi_url=None)

    # The last middleware added is the outermost, so CORS headers reach 413 responses too.
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=MAX_BODY_BYTES)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        allow_credentials=False,
    )

    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    @app.get("/api/health")
    def health() -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unavailable",
                "models_loaded": False,
                "model_version": None,
                "reason": unavailable_reason(settings),
            },
        )

    return app


app = create_app()
