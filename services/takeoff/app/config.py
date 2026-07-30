from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


DEVELOPMENT_ENVIRONMENTS = frozenset({"dev", "development", "test"})
DEFAULT_UPLOAD_LIMIT_BYTES = 250 * 1024**2
DEFAULT_RETENTION_DAYS = 7
DEFAULT_MAX_INSTRUCTIONS_CHARS = 4_000


def _path_env(name: str, default: str) -> Path:
    return Path(os.environ.get(name, default)).expanduser().resolve()


def _positive_int_env(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc
    if value < 1:
        raise RuntimeError(f"{name} must be greater than zero")
    return value


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    codex_bin: str
    default_model: str
    max_upload_bytes: int
    max_total_upload_bytes: int
    service_api_token: str | None
    max_workers: int
    environment: str
    retention_days: int = DEFAULT_RETENTION_DAYS
    max_instructions_chars: int = DEFAULT_MAX_INSTRUCTIONS_CHARS

    @property
    def allows_unauthenticated_requests(self) -> bool:
        return self.environment in DEVELOPMENT_ENVIRONMENTS

    def validate_runtime(self) -> None:
        if not self.allows_unauthenticated_requests and not self.service_api_token:
            raise RuntimeError(
                "TAKEOFF_SERVICE_API_TOKEN is required unless TAKEOFF_ENV is "
                "explicitly set to dev, development, or test"
            )

    @classmethod
    def from_env(cls) -> "Settings":
        environment = os.environ.get("TAKEOFF_ENV", "production").strip().lower()
        service_api_token = (
            os.environ.get("TAKEOFF_SERVICE_API_TOKEN", "").strip() or None
        )
        return cls(
            data_dir=_path_env("TAKEOFF_DATA_DIR", "./data"),
            codex_bin=os.environ.get("CODEX_BIN", "codex"),
            default_model=os.environ.get(
                "TAKEOFF_CODEX_MODEL", "gpt-5.6-sol"
            ),
            max_upload_bytes=_positive_int_env(
                "TAKEOFF_MAX_UPLOAD_BYTES", DEFAULT_UPLOAD_LIMIT_BYTES
            ),
            max_total_upload_bytes=_positive_int_env(
                "TAKEOFF_MAX_TOTAL_UPLOAD_BYTES",
                DEFAULT_UPLOAD_LIMIT_BYTES,
            ),
            service_api_token=service_api_token,
            max_workers=_positive_int_env(
                "TAKEOFF_MAX_WORKERS",
                1,
            ),
            retention_days=_positive_int_env(
                "TAKEOFF_RETENTION_DAYS",
                DEFAULT_RETENTION_DAYS,
            ),
            max_instructions_chars=_positive_int_env(
                "TAKEOFF_MAX_INSTRUCTIONS_CHARS",
                DEFAULT_MAX_INSTRUCTIONS_CHARS,
            ),
            environment=environment,
        )


SETTINGS = Settings.from_env()
