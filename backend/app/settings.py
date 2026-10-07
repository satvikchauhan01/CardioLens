"""Environment configuration (ARCHITECTURE §9)."""

import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_ARTIFACTS_DIR = BACKEND_DIR / "artifacts"
DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173"
MAX_BODY_BYTES = 16 * 1024


@dataclass(frozen=True)
class Settings:
    allowed_origins: tuple[str, ...]
    artifacts_dir: Path

    @property
    def artifacts_label(self) -> str:
        """Path shown in user-facing messages."""
        if self.artifacts_dir == DEFAULT_ARTIFACTS_DIR:
            return "backend/artifacts"
        return self.artifacts_dir.as_posix()


def load_settings() -> Settings:
    origins = os.environ.get("ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS)
    artifacts_dir = os.environ.get("ARTIFACTS_DIR")
    return Settings(
        allowed_origins=tuple(o.strip() for o in origins.split(",") if o.strip()),
        artifacts_dir=Path(artifacts_dir).resolve() if artifacts_dir else DEFAULT_ARTIFACTS_DIR,
    )
