from __future__ import annotations

import hashlib
import json
import os
import shutil
import stat
import threading
import traceback
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .annotations import annotate_pdf
from .codex_runner import collect_codex_usage, run_codex
from .config import Settings
from .drawing_skill import (
    DrawingIndexAlignment,
    DrawingIndexValidation,
    DrawingSkillIndex,
    prepare_drawing_index,
    validate_drawing_index,
    validate_takeoff_index_alignment,
)
from .models import (
    ArtifactInfo,
    JobRecord,
    JobStatus,
    ProcessorUsage,
    RequestedScope,
    utc_now,
)
from .store import JobStore
from .validation import (
    MAX_JSON_BYTES,
    MAX_PDF_BYTES,
    MAX_WORKBOOK_BYTES,
    reject_secret_material,
    require_regular_file,
    validate_json_artifact,
    validate_pdf_artifact,
    validate_takeoff_artifact,
    validate_workbook_artifact,
    validate_xlsx_container,
)
from .workbook import build_takeoff_workbook


MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".xlsx": (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ),
    ".json": "application/json",
}


def _openai_service_tier(record: JobRecord) -> str:
    return "priority" if record.free_sample else "default"


def sha256_file(path: Path, chunk_size: int = 8 * 1024**2) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def prepare_owned_output(path: Path, parent: Path) -> None:
    parent_metadata = parent.lstat()
    if parent.is_symlink() or not stat.S_ISDIR(parent_metadata.st_mode):
        raise ValueError("Output directory must be a non-symlink directory")
    if path.parent.resolve(strict=True) != parent.resolve(strict=True):
        raise ValueError("Output path is outside its owned directory")
    try:
        metadata = path.lstat()
    except FileNotFoundError:
        return
    if stat.S_ISREG(metadata.st_mode) or stat.S_ISLNK(metadata.st_mode):
        path.unlink()
        return
    raise ValueError(f"Refusing to replace non-file output {path.name}")


def write_private_diagnostic(path: Path, content: str) -> None:
    prepare_owned_output(path, path.parent)
    descriptor = os.open(
        path,
        os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0),
        0o600,
    )
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write(content)


def _drawing_index_metrics(
    validation: DrawingIndexValidation,
) -> dict[str, object]:
    return {
        "validator_exit_code": validation.validator_exit_code,
        "sources": validation.source_count,
        "pages": validation.page_count,
        "visually_reviewed_pages": validation.visually_reviewed_pages,
        "text_reviewed_pages": validation.text_reviewed_pages,
        "pending_pages": validation.pending_pages,
        "image_only_pages": validation.image_only_pages,
        "unknown_revision_pages": validation.unknown_revision_pages,
        "objects": validation.object_count,
        "facts": validation.fact_count,
        "evidence": validation.evidence_count,
        "low_confidence_facts": validation.low_confidence_facts,
        "unverified_facts": validation.unverified_facts,
        "open_references": validation.open_references,
        "open_conflicts": validation.open_conflicts,
        "warning_count": len(validation.warnings),
    }


def _require_completed_drawing_index(
    validation: DrawingIndexValidation,
    *,
    mapped_assets: int,
) -> None:
    if validation.pending_pages or validation.text_reviewed_pages:
        raise ValueError(
            "The drawing skill did not visually review every source page"
        )
    if validation.visually_reviewed_pages != validation.page_count:
        raise ValueError(
            "The drawing skill page-review totals do not reconcile"
        )
    if mapped_assets and not all(
        (
            validation.object_count,
            validation.fact_count,
            validation.evidence_count,
        )
    ):
        raise ValueError(
            "The drawing skill index has mapped takeoff assets without "
            "object, fact, and evidence records"
        )


def _record_drawing_skill_provenance(
    methodology_path: Path,
    *,
    artifacts_dir: Path,
    profile: str,
    drawing_index: DrawingSkillIndex,
    validation: DrawingIndexValidation,
    alignment: DrawingIndexAlignment,
) -> None:
    raw = validate_json_artifact(methodology_path, artifacts_dir)
    if not isinstance(raw, dict):
        raise ValueError("methodology.json must contain a JSON object")
    raw["analysis_skill"] = {
        "profile": profile,
        "name": "analyze-building-drawings",
        "skill_sha256": drawing_index.skill_sha256,
        "source_sha256": drawing_index.source_sha256,
        "preprocessing": {"dpi": 180, "ocr": "auto"},
        "index_validation": {
            **_drawing_index_metrics(validation),
            "warnings": list(validation.warnings),
        },
        "takeoff_alignment": {
            "legend_objects": alignment.legend_objects,
            "asset_objects": alignment.asset_objects,
            "quantity_facts": alignment.quantity_facts,
            "instance_relationships": alignment.instance_relationships,
        },
    }
    prepare_owned_output(methodology_path, artifacts_dir)
    methodology_path.write_text(
        json.dumps(raw, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


class PipelineManager:
    def __init__(self, settings: Settings, store: JobStore):
        self.settings = settings
        self.store = store
        self.executor = ThreadPoolExecutor(max_workers=settings.max_workers)
        self._active: set[str] = set()
        self._active_lock = threading.Lock()

    def submit(
        self,
        record: JobRecord,
        *,
        codex_api_key: str | None,
        replay_takeoff: Path | None = None,
        replay_workbook: Path | None = None,
    ) -> bool:
        with self._active_lock:
            if record.id in self._active:
                return False
            self._active.add(record.id)
        future = self.executor.submit(
            self._run,
            record.id,
            codex_api_key,
            replay_takeoff,
            replay_workbook,
        )
        future.add_done_callback(
            lambda _future, job_id=record.id: self._discard_active(job_id)
        )
        return True

    def _discard_active(self, job_id: str) -> None:
        with self._active_lock:
            self._active.discard(job_id)

    def is_active(self, job_id: str) -> bool:
        with self._active_lock:
            return job_id in self._active

    def recover_pending(self) -> dict[str, int]:
        recovered = 0
        failed = 0
        pending = self.store.list_records(
            {JobStatus.queued, JobStatus.running}
        )
        for record in pending:
            job_dir = self.store.job_dir(record.id)
            inputs_dir = job_dir / "inputs"
            replay_takeoff = inputs_dir / "replay_takeoff.json"
            replay_workbook = inputs_dir / "replay_workbook.xlsx"
            if replay_takeoff.is_file() and not replay_takeoff.is_symlink():
                reset = self.store.update(
                    record.id,
                    status=JobStatus.queued,
                    started_at=None,
                    completed_at=None,
                    stage="recovery_queued",
                    progress=0,
                    error=None,
                    error_code=None,
                    retriable=False,
                )
                if self.submit(
                    reset,
                    codex_api_key=None,
                    replay_takeoff=replay_takeoff,
                    replay_workbook=(
                        replay_workbook
                        if replay_workbook.is_file()
                        and not replay_workbook.is_symlink()
                        else None
                    ),
                ):
                    recovered += 1
                continue
            processor_usage = record.processor_usage or self._usage_from_events(
                job_dir,
                model=record.model,
                service_tier=_openai_service_tier(record),
            )
            self.store.update(
                record.id,
                status=JobStatus.failed,
                completed_at=utc_now(),
                stage="restart_requires_resubmit",
                error=(
                    "The processor restarted before analysis completed. "
                    "Retry this job so a new single-use analysis credential "
                    "can be supplied."
                ),
                error_code="processor_restarted",
                retriable=True,
                processor_usage=processor_usage,
            )
            failed += 1
        return {"recovered": recovered, "failed": failed}

    @staticmethod
    def _usage_from_events(
        job_dir: Path,
        *,
        model: str,
        service_tier: str = "default",
    ) -> ProcessorUsage | None:
        metrics = collect_codex_usage(
            job_dir / "work" / "codex-events.jsonl",
            model=model,
            service_tier=service_tier,
        )
        return PipelineManager._validated_usage(metrics)

    @staticmethod
    def _validated_usage(
        metrics: dict[str, object],
    ) -> ProcessorUsage | None:
        if not metrics:
            return None
        try:
            return ProcessorUsage.model_validate(metrics)
        except ValueError:
            return None

    def _artifact(self, job_id: str, path: Path) -> ArtifactInfo:
        artifacts_dir = self.store.job_dir(job_id) / "artifacts"
        limits = {
            ".pdf": MAX_PDF_BYTES,
            ".xlsx": MAX_WORKBOOK_BYTES,
            ".json": MAX_JSON_BYTES,
        }
        regular = require_regular_file(
            path,
            allowed_parent=artifacts_dir,
            max_bytes=limits.get(path.suffix.lower(), MAX_JSON_BYTES),
        )
        return ArtifactInfo(
            name=regular.stem,
            filename=regular.name,
            media_type=MEDIA_TYPES.get(
                regular.suffix.lower(), "application/octet-stream"
            ),
            bytes=regular.stat().st_size,
            sha256=sha256_file(regular),
            download_url=f"/v1/jobs/{job_id}/artifacts/{regular.name}",
        )

    def _run(
        self,
        job_id: str,
        codex_api_key: str | None,
        replay_takeoff: Path | None,
        replay_workbook: Path | None,
    ) -> None:
        job_dir = self.store.job_dir(job_id)
        inputs_dir = job_dir / "inputs"
        artifacts_dir = job_dir / "artifacts"
        processor_usage: ProcessorUsage | None = None
        drawing_index: DrawingSkillIndex | None = None
        drawing_index_validation: DrawingIndexValidation | None = None
        drawing_index_alignment: DrawingIndexAlignment | None = None
        try:
            record = self.store.update(
                job_id,
                status=JobStatus.running,
                started_at=utc_now(),
                stage="drawing_indexing"
                if replay_takeoff is None
                else "replay_validation",
                progress=10,
                processor_usage=None,
            )
            drawings = inputs_dir / "drawings.pdf"
            takeoff_path = artifacts_dir / "takeoff.json"
            workbook_path = artifacts_dir / "takeoff.xlsx"
            methodology_path = artifacts_dir / "methodology.json"
            require_regular_file(
                drawings,
                allowed_parent=inputs_dir,
                max_bytes=MAX_PDF_BYTES,
                magic=b"%PDF-",
            )
            source_hash = sha256_file(drawings)
            for input_workbook in (
                inputs_dir / "template.xlsx",
                inputs_dir / "prices.xlsx",
            ):
                if input_workbook.exists():
                    validate_xlsx_container(input_workbook, inputs_dir)

            if replay_takeoff is not None:
                replay_takeoff = require_regular_file(
                    replay_takeoff,
                    allowed_parent=inputs_dir,
                    max_bytes=MAX_JSON_BYTES,
                )
                validate_json_artifact(replay_takeoff, inputs_dir)
                prepare_owned_output(takeoff_path, artifacts_dir)
                shutil.copy2(replay_takeoff, takeoff_path)
                if replay_workbook is not None:
                    replay_workbook = validate_xlsx_container(
                        replay_workbook, inputs_dir
                    )
                    prepare_owned_output(workbook_path, artifacts_dir)
                    shutil.copy2(replay_workbook, workbook_path)
                prepare_owned_output(methodology_path, artifacts_dir)
                methodology_path.write_text(
                    json.dumps(
                        {
                            "mode": "replay",
                            "source": str(replay_takeoff),
                            "note": (
                                "Codex analysis skipped; deterministic "
                                "validation and annotation stages executed."
                            ),
                        },
                        indent=2,
                    )
                    + "\n",
                    encoding="utf-8",
                )
            else:
                if not codex_api_key:
                    raise ValueError(
                        "X-Codex-API-Key is required for a Codex analysis job"
                    )
                drawing_index = prepare_drawing_index(
                    job_dir=job_dir,
                    drawings_path=drawings,
                    expected_sha256=source_hash,
                    dpi=180,
                    ocr="auto",
                )
                self.store.update(
                    job_id,
                    stage="codex_analysis",
                    progress=25,
                )
                codex_outcome = run_codex(
                    codex_bin=self.settings.codex_bin,
                    job_dir=job_dir,
                    api_key=codex_api_key,
                    model=record.model,
                    instructions=record.customer_instructions,
                    has_template=(inputs_dir / "template.xlsx").exists(),
                    has_prices=(inputs_dir / "prices.xlsx").exists(),
                    analysis_profile=record.analysis_profile,
                    analysis_skill_dir=drawing_index.skill_dir,
                    drawing_index_dir=drawing_index.index_dir,
                    analysis_skill_sha256=drawing_index.skill_sha256,
                    workflow_kind=record.workflow_kind,
                    requested_scopes=record.requested_scopes,
                    service_tier=_openai_service_tier(record),
                )
                processor_usage = self._validated_usage(
                    codex_outcome.metrics
                )

            self.store.update(
                job_id,
                stage="takeoff_validation",
                progress=70,
            )
            takeoff, actual_pages = validate_takeoff_artifact(
                takeoff_path,
                drawings_path=drawings,
                artifacts_dir=artifacts_dir,
                inputs_dir=inputs_dir,
            )
            if takeoff.source.sha256 != source_hash:
                raise ValueError(
                    "takeoff.json source SHA-256 does not match the uploaded PDF"
                )
            if drawing_index is not None:
                drawing_index_validation = validate_drawing_index(
                    drawing_index
                )
                _require_completed_drawing_index(
                    drawing_index_validation,
                    mapped_assets=len(takeoff.assets),
                )
                drawing_index_alignment = validate_takeoff_index_alignment(
                    drawing_index,
                    takeoff,
                )
                _record_drawing_skill_provenance(
                    methodology_path,
                    artifacts_dir=artifacts_dir,
                    profile=record.analysis_profile.value,
                    drawing_index=drawing_index,
                    validation=drawing_index_validation,
                    alignment=drawing_index_alignment,
                )
            if (
                any(
                    asset.measurement_kind == "count"
                    for asset in takeoff.assets
                )
                and RequestedScope.fixture_counts
                not in record.requested_scopes
            ):
                raise ValueError(
                    "takeoff.json contains fixture counts outside the trusted "
                    "requested scopes"
                )
            if (
                any(
                    asset.measurement_kind == "linear"
                    for asset in takeoff.assets
                )
                and RequestedScope.cable_runs not in record.requested_scopes
            ):
                raise ValueError(
                    "takeoff.json contains linear runs outside the trusted "
                    "requested scopes"
                )
            use_canonical_workbook = (
                not (inputs_dir / "template.xlsx").exists()
                and replay_workbook is None
            )
            if use_canonical_workbook:
                prepare_owned_output(workbook_path, artifacts_dir)
                build_takeoff_workbook(takeoff, workbook_path)
            if replay_takeoff is None or workbook_path.exists():
                validate_workbook_artifact(
                    workbook_path,
                    takeoff=takeoff,
                    artifacts_dir=artifacts_dir,
                )
            validate_json_artifact(methodology_path, artifacts_dir)
            if codex_api_key:
                reject_secret_material(takeoff_path, secret=codex_api_key)
                reject_secret_material(
                    methodology_path, secret=codex_api_key
                )
                reject_secret_material(workbook_path, secret=codex_api_key)

            self.store.update(
                job_id,
                stage="pdf_annotation",
                progress=82,
            )
            annotated_path = artifacts_dir / "annotated_drawings.pdf"
            prepare_owned_output(annotated_path, artifacts_dir)
            summary = annotate_pdf(
                drawings,
                annotated_path,
                takeoff.assets,
                sample_watermark=record.free_sample,
            )
            if (
                summary.skipped_asset_count
                or summary.annotated_asset_count != len(takeoff.assets)
            ):
                raise ValueError(
                    "Annotation coverage is incomplete: "
                    f"{summary.annotated_asset_count} of "
                    f"{len(takeoff.assets)} placements were annotated"
                )
            audit_path = artifacts_dir / "annotation_audit.json"
            prepare_owned_output(audit_path, artifacts_dir)
            audit_path.write_text(
                summary.model_dump_json(indent=2) + "\n",
                encoding="utf-8",
            )
            validate_pdf_artifact(
                annotated_path,
                artifacts_dir=artifacts_dir,
                expected_pages=actual_pages,
                expected_annotation_ids={
                    asset.unit_id for asset in takeoff.assets
                },
            )
            validate_json_artifact(audit_path, artifacts_dir)

            candidates = [
                takeoff_path,
                methodology_path,
                annotated_path,
                audit_path,
            ]
            if workbook_path.exists():
                candidates.append(workbook_path)
            artifact_map = {
                path.name: self._artifact(job_id, path)
                for path in candidates
            }
            mapped_assets = len(takeoff.assets)
            unresolved_symbols = len(takeoff.unresolved_symbols)
            legend_coverage_denominator = mapped_assets + unresolved_symbols
            linear_quantity_by_unit: dict[str, float] = {}
            for asset in takeoff.assets:
                if asset.measurement_kind != "linear":
                    continue
                linear_quantity_by_unit[asset.unit] = (
                    linear_quantity_by_unit.get(asset.unit, 0)
                    + asset.quantity
                )
            metrics = {
                "pages": actual_pages,
                "counted_units": mapped_assets,
                "count_placements": sum(
                    asset.measurement_kind == "count"
                    for asset in takeoff.assets
                ),
                "linear_runs": sum(
                    asset.measurement_kind == "linear"
                    for asset in takeoff.assets
                ),
                "linear_path_points": sum(
                    len(asset.path or [])
                    for asset in takeoff.assets
                    if asset.measurement_kind == "linear"
                ),
                "linear_quantity_by_unit": linear_quantity_by_unit,
                "annotated_units": summary.annotated_asset_count,
                "skipped_annotations": summary.skipped_asset_count,
                "unique_codes": len({asset.code for asset in takeoff.assets}),
                "legend_entries": len(takeoff.legend_entries),
                "mapped_assets": mapped_assets,
                "unresolved_symbols": unresolved_symbols,
                "legend_coverage_percent": (
                    mapped_assets / legend_coverage_denominator * 100
                    if legend_coverage_denominator
                    else 100.0
                ),
            }
            if (
                drawing_index is not None
                and drawing_index_validation is not None
                and drawing_index_alignment is not None
            ):
                metrics["analysis_profile"] = record.analysis_profile.value
                metrics["analysis_skill_sha256"] = drawing_index.skill_sha256
                metrics["drawing_index"] = _drawing_index_metrics(
                    drawing_index_validation
                )
                metrics["drawing_index_alignment"] = {
                    "legend_objects": drawing_index_alignment.legend_objects,
                    "asset_objects": drawing_index_alignment.asset_objects,
                    "quantity_facts": drawing_index_alignment.quantity_facts,
                    "instance_relationships": (
                        drawing_index_alignment.instance_relationships
                    ),
                }
            self.store.update(
                job_id,
                status=JobStatus.completed,
                completed_at=utc_now(),
                stage="completed",
                progress=100,
                artifacts=artifact_map,
                metrics=metrics,
                processor_usage=(
                    processor_usage if replay_takeoff is None else None
                ),
                error=None,
                error_code=None,
                retriable=False,
            )
        except Exception:
            error_path = job_dir / "work" / "pipeline-error.log"
            diagnostic = traceback.format_exc()
            if codex_api_key:
                diagnostic = diagnostic.replace(
                    codex_api_key, "[REDACTED]"
                )
            write_private_diagnostic(error_path, diagnostic)
            if replay_takeoff is None and processor_usage is None:
                failed_record = self.store.load(job_id)
                processor_usage = self._usage_from_events(
                    job_dir,
                    model=failed_record.model,
                    service_tier=_openai_service_tier(failed_record),
                )
            self.store.update(
                job_id,
                status=JobStatus.failed,
                completed_at=utc_now(),
                stage="failed",
                error=(
                    "Takeoff processing failed. Retry the job or contact "
                    f"support with job ID {job_id}."
                ),
                error_code="processing_failed",
                retriable=True,
                processor_usage=processor_usage,
            )
