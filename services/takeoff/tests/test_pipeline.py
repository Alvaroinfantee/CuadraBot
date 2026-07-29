from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from pypdf import PdfWriter

from app.config import Settings
from app.models import JobRecord, JobStatus
from app.pipeline import PipelineManager
from app.store import JobStore


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_replay_pipeline_creates_audited_pdf(tmp_path: Path) -> None:
    settings = Settings(
        data_dir=tmp_path / "data",
        codex_bin=sys.executable,
        default_model="gpt-5.6-sol",
        max_upload_bytes=10_000_000,
        max_total_upload_bytes=10_000_000,
        service_api_token=None,
        max_workers=1,
        environment="test",
    )
    store = JobStore(settings.data_dir / "jobs")
    record = JobRecord(
        id="replayjob",
        status=JobStatus.queued,
        model=settings.default_model,
    )
    job_dir = store.create(record)
    source_pdf = job_dir / "inputs" / "drawings.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=100)
    writer.write(str(source_pdf))

    replay = job_dir / "inputs" / "replay_takeoff.json"
    replay.write_text(
        json.dumps(
            {
                "source": {
                    "sha256": sha256(source_pdf),
                    "page_count": 1
                },
                "assets": [
                    {
                        "unit_id": "TEST-TC-001-0001",
                        "code": "TC",
                        "description": "Test receptacle",
                        "page": 1,
                        "sheet": "E-101",
                        "area_code": "L1-A",
                        "area": "Level 1 - Area A",
                        "level": "1",
                        "method": "counted",
                        "confidence": "medium",
                        "x": 75,
                        "y": 40
                    }
                ],
                "by_code": [{"code": "TC", "quantity": 1}],
                "by_area": [{"area_code": "L1-A", "quantity": 1}],
                "limitations": []
            }
        ),
        encoding="utf-8",
    )

    manager = PipelineManager(settings, store)
    manager._run("replayjob", None, replay, None)
    completed = store.load("replayjob")

    assert completed.status == JobStatus.completed
    assert completed.metrics["annotated_units"] == 1
    assert "annotated_drawings.pdf" in completed.artifacts
    assert (
        job_dir / "artifacts" / "annotated_drawings.pdf"
    ).stat().st_size > source_pdf.stat().st_size


def test_pipeline_keeps_diagnostics_private_and_public_error_generic(
    tmp_path: Path,
) -> None:
    settings = Settings(
        data_dir=tmp_path / "data",
        codex_bin=sys.executable,
        default_model="gpt-5.6-sol",
        max_upload_bytes=10_000_000,
        max_total_upload_bytes=10_000_000,
        service_api_token=None,
        max_workers=1,
        environment="test",
    )
    store = JobStore(settings.data_dir / "jobs")
    job_dir = store.create(
        JobRecord(
            id="failingjob",
            status=JobStatus.queued,
            model=settings.default_model,
        )
    )
    manager = PipelineManager(settings, store)

    manager._run("failingjob", None, None, None)

    failed = store.load("failingjob")
    assert failed.status == JobStatus.failed
    assert failed.error_code == "processing_failed"
    assert failed.retriable is True
    assert "drawings.pdf" not in failed.error
    diagnostic = job_dir / "work" / "pipeline-error.log"
    assert diagnostic.is_file()
    assert "drawings.pdf is missing" in diagnostic.read_text()
    assert "pipeline-error.log" not in failed.artifacts
