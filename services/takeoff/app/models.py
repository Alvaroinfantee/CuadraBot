from __future__ import annotations

import math
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _bounded_extra_value(value: Any, *, depth: int = 0) -> Any:
    if depth > 5:
        raise ValueError("extra output metadata is nested too deeply")
    if value is None or isinstance(value, bool):
        return value
    if isinstance(value, str):
        if len(value) > 4_000:
            raise ValueError("extra output text exceeds 4000 characters")
        return value.strip()
    if isinstance(value, (int, float)):
        if not math.isfinite(float(value)):
            raise ValueError("extra output numbers must be finite")
        return value
    if isinstance(value, list):
        if len(value) > 10_000:
            raise ValueError("extra output lists are too large")
        return [
            _bounded_extra_value(item, depth=depth + 1) for item in value
        ]
    if isinstance(value, dict):
        if len(value) > 1_000:
            raise ValueError("extra output objects have too many fields")
        cleaned: dict[str, Any] = {}
        for key, item in value.items():
            if (
                not isinstance(key, str)
                or not key
                or key != key.strip()
                or len(key) > 128
            ):
                raise ValueError("extra output field names are invalid")
            cleaned[key] = _bounded_extra_value(item, depth=depth + 1)
        return cleaned
    raise ValueError("extra output metadata must be JSON-compatible")


class BoundedExtraModel(BaseModel):
    model_config = ConfigDict(extra="allow")

    @model_validator(mode="after")
    def validate_extra_output(self) -> "BoundedExtraModel":
        extras = self.__pydantic_extra__ or {}
        if len(extras) > 100:
            raise ValueError("output object has too many extra fields")
        for key, value in list(extras.items()):
            if not key or key != key.strip() or len(key) > 128:
                raise ValueError("extra output field names are invalid")
            extras[key] = _bounded_extra_value(value)
        return self


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class ArtifactInfo(BaseModel):
    name: str
    filename: str
    media_type: str
    bytes: int
    sha256: str
    download_url: str


class JobRecord(BaseModel):
    id: str
    status: JobStatus
    created_at: str = Field(default_factory=utc_now)
    started_at: str | None = None
    completed_at: str | None = None
    stage: str = "queued"
    progress: int = 0
    model: str
    instructions: str = ""
    free_sample: bool = False
    inputs: dict[str, str] = Field(default_factory=dict)
    artifacts: dict[str, ArtifactInfo] = Field(default_factory=dict)
    error: str | None = None
    error_code: str | None = None
    retriable: bool = False
    metrics: dict[str, Any] = Field(default_factory=dict)


class Point(BaseModel):
    x: float = Field(ge=0, le=10_000_000, allow_inf_nan=False)
    y: float = Field(ge=0, le=10_000_000, allow_inf_nan=False)


class BoundingBox(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x0: float = Field(ge=0, le=10_000_000, allow_inf_nan=False)
    y0: float = Field(ge=0, le=10_000_000, allow_inf_nan=False)
    x1: float = Field(gt=0, le=10_000_000, allow_inf_nan=False)
    y1: float = Field(gt=0, le=10_000_000, allow_inf_nan=False)

    @field_validator("x1")
    @classmethod
    def x1_after_x0(cls, value: float, info: Any) -> float:
        if "x0" in info.data and value <= info.data["x0"]:
            raise ValueError("x1 must be greater than x0")
        return value

    @field_validator("y1")
    @classmethod
    def y1_after_y0(cls, value: float, info: Any) -> float:
        if "y0" in info.data and value <= info.data["y0"]:
            raise ValueError("y1 must be greater than y0")
        return value


class TakeoffAsset(BoundedExtraModel):
    unit_id: str = Field(
        min_length=1,
        max_length=128,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    )
    code: str = Field(min_length=1, max_length=128)
    description: str = Field(min_length=1, max_length=1_000)
    page: int = Field(ge=1, le=10_000)
    sheet: str = Field(min_length=1, max_length=128)
    area_code: str = Field(min_length=1, max_length=128)
    area: str = Field(min_length=1, max_length=500)
    level: str = Field(min_length=1, max_length=128)
    method: str = Field(min_length=1, max_length=500)
    confidence: Literal["low", "medium", "high"]
    x: float | None = Field(
        default=None, ge=0, le=10_000_000, allow_inf_nan=False
    )
    y: float | None = Field(
        default=None, ge=0, le=10_000_000, allow_inf_nan=False
    )
    bbox: BoundingBox | None = None
    coordinate_space: Literal["pdf_display_points_top_left"] = (
        "pdf_display_points_top_left"
    )
    visible_label: str = Field(default="", max_length=500)
    notes: str = Field(default="", max_length=2_000)
    quantity: float = Field(
        default=1, gt=0, le=1_000_000_000, allow_inf_nan=False
    )
    unit: str = Field(default="EA", min_length=1, max_length=32)

    @field_validator(
        "unit_id",
        "code",
        "description",
        "sheet",
        "area_code",
        "area",
        "level",
        "method",
        "visible_label",
        "notes",
        "unit",
        mode="before",
    )
    @classmethod
    def trim_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def exactly_one_geometry(self) -> "TakeoffAsset":
        has_point = self.x is not None or self.y is not None
        if has_point and (self.x is None or self.y is None):
            raise ValueError("x and y must be supplied together")
        if self.bbox is None and not has_point:
            raise ValueError("either bbox or x/y is required")
        if self.bbox is not None and has_point:
            raise ValueError("supply bbox or x/y, not both")
        return self

    def center(self) -> Point:
        if self.bbox is not None:
            return Point(
                x=(self.bbox.x0 + self.bbox.x1) / 2,
                y=(self.bbox.y0 + self.bbox.y1) / 2,
            )
        if self.x is None or self.y is None:
            raise ValueError(f"{self.unit_id} has neither bbox nor x/y")
        return Point(x=self.x, y=self.y)


class TakeoffSource(BoundedExtraModel):
    pdf: str | None = Field(default=None, max_length=500)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    page_count: int = Field(ge=1, le=10_000)


class TakeoffDocument(BoundedExtraModel):
    source: TakeoffSource
    assets: list[TakeoffAsset] = Field(max_length=200_000)
    by_code: list[dict[str, Any]] = Field(
        default_factory=list, max_length=20_000
    )
    by_area: list[dict[str, Any]] = Field(
        default_factory=list, max_length=20_000
    )
    limitations: list[str] = Field(default_factory=list, max_length=200)

    @field_validator("limitations")
    @classmethod
    def bounded_limitations(cls, values: list[str]) -> list[str]:
        cleaned = []
        for value in values:
            text = value.strip()
            if not text or len(text) > 2_000:
                raise ValueError("limitations must be 1 to 2000 characters")
            cleaned.append(text)
        return cleaned


class JobSubmission(BaseModel):
    job_id: str
    status: JobStatus
    status_url: str


class AnnotationSummary(BaseModel):
    source_pdf: str
    output_pdf: str
    page_count: int
    asset_count: int
    annotated_asset_count: int
    skipped_asset_count: int
    codes: dict[str, int]


def artifact_path(job_dir: Path, filename: str) -> Path:
    resolved = (job_dir / "artifacts" / filename).resolve()
    artifacts_dir = (job_dir / "artifacts").resolve()
    if resolved.parent != artifacts_dir:
        raise ValueError("Artifact filename must not contain path separators")
    return resolved
