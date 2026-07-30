from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import pytest
from pypdf import PdfWriter

from app.config import Settings
from app.models import JobRecord, JobStatus, RequestedScope
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
        requested_scopes=[
            RequestedScope.fixture_counts,
            RequestedScope.cable_runs,
        ],
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
                "legend_entries": [
                    {
                        "legend_entry_id": "LEGEND-TC",
                        "code": "TC",
                        "description": "Test receptacle",
                        "page": 1,
                        "sheet": "E-001",
                        "bbox": {
                            "x0": 5,
                            "y0": 5,
                            "x1": 15,
                            "y1": 15
                        }
                    },
                    {
                        "legend_entry_id": "LEGEND-CBL",
                        "code": "CBL",
                        "description": "Type C cable",
                        "page": 1,
                        "sheet": "E-001",
                        "bbox": {
                            "x0": 20,
                            "y0": 5,
                            "x1": 30,
                            "y1": 15
                        }
                    }
                ],
                "assets": [
                    {
                        "unit_id": "TEST-TC-001-0001",
                        "legend_entry_id": "LEGEND-TC",
                        "measurement_kind": "count",
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
                    },
                    {
                        "unit_id": "TEST-CBL-001-0001",
                        "legend_entry_id": "LEGEND-CBL",
                        "measurement_kind": "linear",
                        "code": "CBL",
                        "description": "Type C cable",
                        "page": 1,
                        "sheet": "E-101",
                        "area_code": "L1-A",
                        "area": "Level 1 - Area A",
                        "level": "1",
                        "method": "scaled centerline",
                        "confidence": "high",
                        "path": [
                            {"x": 20, "y": 80},
                            {"x": 80, "y": 80}
                        ],
                        "scale_evidence": {
                            "kind": "calibrated_dimension",
                            "page": 1,
                            "sheet": "E-101",
                            "bbox": {
                                "x0": 160,
                                "y0": 5,
                                "x1": 195,
                                "y1": 20
                            },
                            "source_text": "15 ft calibration",
                            "real_units_per_pdf_point": 0.5,
                            "unit": "ft",
                            "calibration": {
                                "start": {"x": 160, "y": 10},
                                "end": {"x": 190, "y": 10},
                                "known_length": 15,
                                "unit": "ft"
                            }
                        },
                        "quantity": 30,
                        "unit": "ft"
                    }
                ],
                "unresolved_symbols": [
                    {
                        "unresolved_symbol_id": "UNRESOLVED-001",
                        "page": 1,
                        "sheet": "E-101",
                        "bbox": {
                            "x0": 120,
                            "y0": 60,
                            "x1": 130,
                            "y1": 70
                        },
                        "visible_label": "?",
                        "reason": "No defensible legend mapping.",
                        "confidence": "low"
                    }
                ],
                "by_code": [
                    {
                        "legend_entry_id": "LEGEND-TC",
                        "code": "TC",
                        "description": "Test receptacle",
                        "measurement_kind": "count",
                        "unit": "EA",
                        "quantity": 1
                    },
                    {
                        "legend_entry_id": "LEGEND-CBL",
                        "code": "CBL",
                        "description": "Type C cable",
                        "measurement_kind": "linear",
                        "unit": "ft",
                        "quantity": 30
                    }
                ],
                "by_area": [
                    {
                        "area_code": "L1-A",
                        "legend_entry_id": "LEGEND-TC",
                        "code": "TC",
                        "description": "Test receptacle",
                        "measurement_kind": "count",
                        "unit": "EA",
                        "quantity": 1
                    },
                    {
                        "area_code": "L1-A",
                        "legend_entry_id": "LEGEND-CBL",
                        "code": "CBL",
                        "description": "Type C cable",
                        "measurement_kind": "linear",
                        "unit": "ft",
                        "quantity": 30
                    }
                ],
                "limitations": []
            }
        ),
        encoding="utf-8",
    )

    manager = PipelineManager(settings, store)
    manager._run("replayjob", None, replay, None)
    completed = store.load("replayjob")

    assert completed.status == JobStatus.completed
    assert completed.metrics["annotated_units"] == 2
    assert completed.metrics["legend_entries"] == 2
    assert completed.metrics["mapped_assets"] == 2
    assert completed.metrics["unresolved_symbols"] == 1
    assert completed.metrics["legend_coverage_percent"] == pytest.approx(
        66.6666666667
    )
    assert completed.metrics["count_placements"] == 1
    assert completed.metrics["linear_runs"] == 1
    assert completed.metrics["linear_path_points"] == 2
    assert completed.metrics["linear_quantity_by_unit"] == {"ft": 30}
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
