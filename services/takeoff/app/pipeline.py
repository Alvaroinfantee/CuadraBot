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
from .codex_runner import run_codex
from .config import Settings
from .models import (
    ArtifactInfo,
    JobRecord,
    JobStatus,
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


MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".xlsx": (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ),
    ".json": "application/json",
}


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
            )
            failed += 1
        return {"recovered": recovered, "failed": failed}

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
        try:
            record = self.store.update(
                job_id,
                status=JobStatus.running,
                started_at=utc_now(),
                stage="codex_analysis"
                if replay_takeoff is None
                else "replay_validation",
                progress=10,
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
                run_codex(
                    codex_bin=self.settings.codex_bin,
                    job_dir=job_dir,
                    api_key=codex_api_key,
                    model=record.model,
                    instructions=record.instructions,
                    has_template=(inputs_dir / "template.xlsx").exists(),
                    has_prices=(inputs_dir / "prices.xlsx").exists(),
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
            source_hash = sha256_file(drawings)
            if takeoff.source.sha256 != source_hash:
                raise ValueError(
                    "takeoff.json source SHA-256 does not match the uploaded PDF"
                )
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
            metrics = {
                "pages": actual_pages,
                "counted_units": len(takeoff.assets),
                "annotated_units": summary.annotated_asset_count,
                "skipped_annotations": summary.skipped_asset_count,
                "unique_codes": len({asset.code for asset in takeoff.assets}),
            }
            self.store.update(
                job_id,
                status=JobStatus.completed,
                completed_at=utc_now(),
                stage="completed",
                progress=100,
                artifacts=artifact_map,
                metrics=metrics,
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
            )
