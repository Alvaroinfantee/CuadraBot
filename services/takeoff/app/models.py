from __future__ import annotations

import math
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Literal

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


MAX_SAFE_JSON_INTEGER = 9_007_199_254_740_991
SUPPORTED_TAKEOFF_MODELS = frozenset(
    {"gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"}
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


class WorkflowKind(str, Enum):
    legend_fixture_takeoff_v1 = "legend_fixture_takeoff_v1"


class AnalysisProfile(str, Enum):
    analyze_building_drawings_v1 = (
        "analyze-building-drawings@2026-08-06"
    )


class RequestedScope(str, Enum):
    fixture_counts = "fixture_counts"
    cable_runs = "cable_runs"


class ArtifactInfo(BaseModel):
    name: str
    filename: str
    media_type: str
    bytes: int
    sha256: str
    download_url: str


class OpenAIRateSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    input: float = Field(gt=0, le=10_000, allow_inf_nan=False)
    cached_input: float = Field(gt=0, le=10_000, allow_inf_nan=False)
    cache_write: float = Field(gt=0, le=10_000, allow_inf_nan=False)
    output: float = Field(gt=0, le=10_000, allow_inf_nan=False)


class ProcessorUsage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1] = 1
    provider: Literal["openai"] = "openai"
    model: Literal[
        "gpt-5.6-sol",
        "gpt-5.6-terra",
        "gpt-5.6-luna",
    ]
    pricing_as_of: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    currency: Literal["USD"] = "USD"
    usage_turns: int = Field(ge=1, le=MAX_SAFE_JSON_INTEGER)
    input_tokens: int = Field(ge=0, le=MAX_SAFE_JSON_INTEGER)
    uncached_input_tokens: int = Field(ge=0, le=MAX_SAFE_JSON_INTEGER)
    cached_input_tokens: int = Field(ge=0, le=MAX_SAFE_JSON_INTEGER)
    cache_write_tokens: int = Field(ge=0, le=MAX_SAFE_JSON_INTEGER)
    output_tokens: int = Field(ge=0, le=MAX_SAFE_JSON_INTEGER)
    reasoning_output_tokens: int = Field(ge=0, le=MAX_SAFE_JSON_INTEGER)
    estimated_cost_usd: float = Field(
        ge=0,
        le=1_000_000,
        allow_inf_nan=False,
    )
    estimated_cost_usd_upper_bound: float | None = Field(
        default=None,
        ge=0,
        le=1_000_000,
        allow_inf_nan=False,
    )
    estimated_cost_usd_all_input_uncached: float = Field(
        ge=0,
        le=1_000_000,
        allow_inf_nan=False,
        description=(
            "Hypothetical base-price estimate treating every input token as "
            "uncached; not an invoice or actual billed cost."
        ),
    )
    estimated_cost_usd_all_input_uncached_upper_bound: float | None = Field(
        default=None,
        ge=0,
        le=1_000_000,
        allow_inf_nan=False,
        description=(
            "Hypothetical long-context upper-bound estimate with every input "
            "token treated as uncached; not an invoice or actual billed cost."
        ),
    )
    long_context_pricing_may_apply: bool
    rate_snapshot_usd_per_million: OpenAIRateSnapshot

    @model_validator(mode="after")
    def usage_totals_are_consistent(self) -> "ProcessorUsage":
        expected_uncached = max(
            self.input_tokens
            - self.cached_input_tokens
            - self.cache_write_tokens,
            0,
        )
        if self.uncached_input_tokens != expected_uncached:
            raise ValueError("uncached input tokens do not reconcile")
        if (
            self.uncached_input_tokens
            + self.cached_input_tokens
            + self.cache_write_tokens
            != self.input_tokens
        ):
            raise ValueError("input token categories do not reconcile")
        if self.reasoning_output_tokens > self.output_tokens:
            raise ValueError("reasoning output must be a subset of output")
        if self.long_context_pricing_may_apply:
            if self.estimated_cost_usd_upper_bound is None:
                raise ValueError("long-context usage requires an upper bound")
            if (
                self.estimated_cost_usd_all_input_uncached_upper_bound
                is None
            ):
                raise ValueError(
                    "long-context usage requires an all-uncached upper bound"
                )
            if (
                self.estimated_cost_usd_upper_bound
                < self.estimated_cost_usd
            ):
                raise ValueError("estimated cost upper bound is too small")
            if (
                self.estimated_cost_usd_all_input_uncached_upper_bound
                < self.estimated_cost_usd_all_input_uncached
            ):
                raise ValueError(
                    "all-uncached cost upper bound is too small"
                )
        elif (
            self.estimated_cost_usd_upper_bound is not None
            or self.estimated_cost_usd_all_input_uncached_upper_bound
            is not None
        ):
            raise ValueError("short-context usage must not include upper bounds")
        return self


class JobRecord(BaseModel):
    id: str
    status: JobStatus
    created_at: str = Field(default_factory=utc_now)
    started_at: str | None = None
    completed_at: str | None = None
    stage: str = "queued"
    progress: int = 0
    model: str
    analysis_profile: AnalysisProfile = (
        AnalysisProfile.analyze_building_drawings_v1
    )
    workflow_kind: WorkflowKind = WorkflowKind.legend_fixture_takeoff_v1
    requested_scopes: list[RequestedScope] = Field(
        default_factory=lambda: [RequestedScope.fixture_counts],
        min_length=1,
        max_length=2,
    )
    customer_instructions: str = Field(
        default="",
        validation_alias=AliasChoices(
            "customer_instructions",
            "instructions",
        ),
        serialization_alias="customer_instructions",
    )
    free_sample: bool = False
    inputs: dict[str, str] = Field(default_factory=dict)
    artifacts: dict[str, ArtifactInfo] = Field(default_factory=dict)
    error: str | None = None
    error_code: str | None = None
    retriable: bool = False
    metrics: dict[str, Any] = Field(default_factory=dict)
    processor_usage: ProcessorUsage | None = None

    @field_validator("requested_scopes")
    @classmethod
    def requested_scopes_are_unique(
        cls,
        values: list[RequestedScope],
    ) -> list[RequestedScope]:
        if len(values) != len(set(values)):
            raise ValueError("requested scopes must be unique")
        return values


class Point(BaseModel):
    model_config = ConfigDict(extra="forbid")

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


class LegendEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    legend_entry_id: str = Field(
        min_length=1,
        max_length=128,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    )
    code: str = Field(min_length=1, max_length=128)
    description: str = Field(min_length=1, max_length=1_000)
    page: int = Field(ge=1, le=10_000)
    sheet: str = Field(min_length=1, max_length=128)
    bbox: BoundingBox
    coordinate_space: Literal["pdf_display_points_top_left"] = (
        "pdf_display_points_top_left"
    )

    @field_validator(
        "legend_entry_id",
        "code",
        "description",
        "sheet",
        mode="before",
    )
    @classmethod
    def trim_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class CalibrationGeometry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: Point
    end: Point
    known_length: float = Field(
        gt=0,
        le=1_000_000_000,
        allow_inf_nan=False,
    )
    unit: Literal["m", "ft"]

    def displayed_length_points(self) -> float:
        return math.hypot(
            self.end.x - self.start.x,
            self.end.y - self.start.y,
        )

    @model_validator(mode="after")
    def require_nonzero_geometry(self) -> "CalibrationGeometry":
        if self.displayed_length_points() <= 0:
            raise ValueError(
                "calibration geometry must have positive displayed length"
            )
        return self


class StatedScaleRatio(BaseModel):
    model_config = ConfigDict(extra="forbid")

    paper_length: float = Field(
        gt=0,
        le=1_000_000,
        allow_inf_nan=False,
    )
    paper_unit: Literal["in", "mm"]
    real_length: float = Field(
        gt=0,
        le=1_000_000_000,
        allow_inf_nan=False,
    )
    real_unit: Literal["m", "ft"]

    def real_units_per_pdf_point(self) -> float:
        paper_inches = (
            self.paper_length
            if self.paper_unit == "in"
            else self.paper_length / 25.4
        )
        return self.real_length / (paper_inches * 72)


class ScaleEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["stated_scale", "calibrated_dimension"]
    page: int = Field(ge=1, le=10_000)
    sheet: str = Field(min_length=1, max_length=128)
    bbox: BoundingBox
    source_text: str = Field(min_length=1, max_length=1_000)
    real_units_per_pdf_point: float = Field(
        gt=0,
        le=1_000_000,
        allow_inf_nan=False,
    )
    unit: Literal["m", "ft"]
    calibration: CalibrationGeometry | None = None
    stated_ratio: StatedScaleRatio | None = None
    coordinate_space: Literal["pdf_display_points_top_left"] = (
        "pdf_display_points_top_left"
    )

    @field_validator("sheet", "source_text", mode="before")
    @classmethod
    def trim_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_independent_scale_derivation(self) -> "ScaleEvidence":
        if self.kind == "calibrated_dimension":
            if self.calibration is None or self.stated_ratio is not None:
                raise ValueError(
                    "calibrated scale evidence requires only calibration "
                    "geometry"
                )
            if self.calibration.unit != self.unit:
                raise ValueError(
                    "calibration and scale evidence units must match"
                )
            if not all(
                self.bbox.x0 <= point.x <= self.bbox.x1
                and self.bbox.y0 <= point.y <= self.bbox.y1
                for point in (
                    self.calibration.start,
                    self.calibration.end,
                )
            ):
                raise ValueError(
                    "calibration geometry must be inside its source bbox"
                )
        else:
            if self.stated_ratio is None or self.calibration is not None:
                raise ValueError(
                    "stated scale evidence requires only a stated ratio"
                )
            if self.stated_ratio.real_unit != self.unit:
                raise ValueError(
                    "stated ratio and scale evidence units must match"
                )

        derived = self.derived_real_units_per_pdf_point()
        if not math.isclose(
            self.real_units_per_pdf_point,
            derived,
            rel_tol=1e-6,
            abs_tol=1e-9,
        ):
            raise ValueError(
                "real_units_per_pdf_point does not match independently "
                "derived scale evidence"
            )
        return self

    def derived_real_units_per_pdf_point(self) -> float:
        if self.calibration is not None:
            return (
                self.calibration.known_length
                / self.calibration.displayed_length_points()
            )
        if self.stated_ratio is not None:
            return self.stated_ratio.real_units_per_pdf_point()
        raise ValueError("scale evidence has no derivation")


class UnresolvedSymbol(BaseModel):
    model_config = ConfigDict(extra="forbid")

    unresolved_symbol_id: str = Field(
        min_length=1,
        max_length=128,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    )
    page: int = Field(ge=1, le=10_000)
    sheet: str = Field(min_length=1, max_length=128)
    bbox: BoundingBox
    visible_label: str = Field(default="", max_length=500)
    candidate_code: str | None = Field(default=None, max_length=128)
    reason: str = Field(min_length=1, max_length=2_000)
    confidence: Literal["low"] = "low"
    coordinate_space: Literal["pdf_display_points_top_left"] = (
        "pdf_display_points_top_left"
    )

    @field_validator(
        "unresolved_symbol_id",
        "sheet",
        "visible_label",
        "candidate_code",
        "reason",
        mode="before",
    )
    @classmethod
    def trim_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class TakeoffAsset(BoundedExtraModel):
    unit_id: str = Field(
        min_length=1,
        max_length=128,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    )
    legend_entry_id: str = Field(
        min_length=1,
        max_length=128,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    )
    measurement_kind: Literal["count", "linear"] = "count"
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
    path: list[Point] | None = Field(
        default=None,
        min_length=2,
        max_length=10_000,
    )
    scale_evidence: ScaleEvidence | None = None
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
        "legend_entry_id",
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
    def validate_measurement_geometry(self) -> "TakeoffAsset":
        has_point = self.x is not None or self.y is not None
        if has_point and (self.x is None or self.y is None):
            raise ValueError("x and y must be supplied together")

        if self.measurement_kind == "count":
            if self.path is not None or self.scale_evidence is not None:
                raise ValueError(
                    "count assets cannot contain a path or scale evidence"
                )
            if self.quantity != 1 or self.unit != "EA":
                raise ValueError(
                    "count assets represent exactly one placement with "
                    "quantity 1 and unit EA"
                )
            if self.bbox is None and not has_point:
                raise ValueError("count assets require either bbox or x/y")
            if self.bbox is not None and has_point:
                raise ValueError("supply bbox or x/y for a count, not both")
            return self

        if self.bbox is not None or has_point:
            raise ValueError(
                "linear assets use path geometry instead of bbox or x/y"
            )
        if self.path is None or self.scale_evidence is None:
            raise ValueError(
                "linear assets require a path and explicit scale evidence"
            )
        if self.unit not in {"m", "ft"}:
            raise ValueError("linear assets use canonical unit m or ft")
        if self.scale_evidence.unit != self.unit:
            raise ValueError(
                "linear asset and scale evidence units must match"
            )
        if self.display_path_length_points() <= 0:
            raise ValueError("linear asset path must have positive length")
        return self

    def center(self) -> Point:
        if self.bbox is not None:
            return Point(
                x=(self.bbox.x0 + self.bbox.x1) / 2,
                y=(self.bbox.y0 + self.bbox.y1) / 2,
            )
        if self.x is not None and self.y is not None:
            return Point(x=self.x, y=self.y)
        if self.path:
            xs = [point.x for point in self.path]
            ys = [point.y for point in self.path]
            return Point(
                x=(min(xs) + max(xs)) / 2,
                y=(min(ys) + max(ys)) / 2,
            )
        raise ValueError(f"{self.unit_id} has no supported geometry")

    def display_path_length_points(self) -> float:
        if not self.path:
            return 0
        return sum(
            math.hypot(right.x - left.x, right.y - left.y)
            for left, right in zip(self.path, self.path[1:])
        )


class TakeoffSource(BoundedExtraModel):
    pdf: str | None = Field(default=None, max_length=500)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    page_count: int = Field(ge=1, le=10_000)


class TakeoffDocument(BoundedExtraModel):
    source: TakeoffSource
    legend_entries: list[LegendEntry] = Field(
        min_length=1,
        max_length=20_000,
    )
    assets: list[TakeoffAsset] = Field(max_length=200_000)
    unresolved_symbols: list[UnresolvedSymbol] = Field(max_length=50_000)
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

    @model_validator(mode="after")
    def validate_legend_mapping(self) -> "TakeoffDocument":
        legend_by_id: dict[str, LegendEntry] = {}
        for entry in self.legend_entries:
            if entry.legend_entry_id in legend_by_id:
                raise ValueError("legend_entry_id values must be unique")
            legend_by_id[entry.legend_entry_id] = entry

        asset_ids: set[str] = set()
        for asset in self.assets:
            if asset.unit_id in asset_ids:
                raise ValueError("unit_id values must be unique")
            asset_ids.add(asset.unit_id)
            entry = legend_by_id.get(asset.legend_entry_id)
            if entry is None:
                raise ValueError(
                    f"{asset.unit_id} references an unknown legend entry"
                )
            if asset.code != entry.code:
                raise ValueError(
                    f"{asset.unit_id} code differs from its legend entry"
                )
            if asset.description != entry.description:
                raise ValueError(
                    f"{asset.unit_id} description differs from its legend entry"
                )

        unresolved_ids: set[str] = set()
        for symbol in self.unresolved_symbols:
            if symbol.unresolved_symbol_id in unresolved_ids:
                raise ValueError(
                    "unresolved_symbol_id values must be unique"
                )
            if symbol.unresolved_symbol_id in asset_ids:
                raise ValueError(
                    "unresolved symbol IDs cannot also be counted assets"
                )
            unresolved_ids.add(symbol.unresolved_symbol_id)
        return self


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
