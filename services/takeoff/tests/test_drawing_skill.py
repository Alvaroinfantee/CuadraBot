from __future__ import annotations

import hashlib
import json
import shutil
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

import pytest
from pypdf import PdfWriter

import app.drawing_skill as drawing_skill
from app.drawing_skill import (
    EXPECTED_SKILL_SHA256,
    DrawingSkillError,
    prepare_drawing_index,
    validate_drawing_index,
    validate_skill_bundle,
    validate_takeoff_index_alignment,
)
from app.models import TakeoffDocument


SERVICE_DIR = Path(__file__).resolve().parent.parent
SKILL_DIR = SERVICE_DIR / "skills" / "analyze-building-drawings"


@pytest.mark.skipif(
    drawing_skill.os.name != "nt",
    reason="Windows external-tool path limit",
)
def test_windows_renderer_rejects_an_overlong_staging_path() -> None:
    staging = Path("C:/") / ("x" * 230)

    with pytest.raises(DrawingSkillError, match="TAKEOFF_DATA_DIR"):
        drawing_skill._require_renderable_staging_path(
            staging,
            source_sha256="a" * 64,
        )


def make_job(tmp_path: Path) -> tuple[Path, Path, str]:
    job_dir = tmp_path / "job"
    inputs_dir = job_dir / "inputs"
    work_dir = job_dir / "work"
    inputs_dir.mkdir(parents=True)
    work_dir.mkdir()
    drawings = inputs_dir / "drawings.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=100)
    writer.write(str(drawings))
    digest = hashlib.sha256(drawings.read_bytes()).hexdigest()
    return job_dir, drawings, digest


def write_starter_index(output_dir: Path, drawings: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    page_dir = output_dir / "pages" / "drawings-test-0001"
    page_dir.mkdir(parents=True)
    (output_dir / "contact-sheets").mkdir()
    wiki_dir = output_dir / "wiki"
    wiki_dir.mkdir()

    image_relative = Path("pages") / "drawings-test-0001" / "page-0001.png"
    text_relative = Path("pages") / "drawings-test-0001" / "page-0001.txt"
    words_relative = (
        Path("pages") / "drawings-test-0001" / "page-0001.words.json"
    )
    (output_dir / image_relative).write_bytes(
        b"\x89PNG\r\n\x1a\nminimal-test-image"
    )
    (output_dir / text_relative).write_text("E-101\nLighting plan\n", encoding="utf-8")
    (output_dir / words_relative).write_text(
        json.dumps(
            {
                "source_pdf": str(drawings.resolve()),
                "source_page": 1,
                "page_width_points": 200,
                "page_height_points": 100,
                "words": [],
            }
        ),
        encoding="utf-8",
    )
    (output_dir / "DRAWINGS.md").write_text(
        "# Drawing Set Index\n", encoding="utf-8"
    )
    (wiki_dir / "index.md").write_text("# Drawing Topics\n", encoding="utf-8")

    source_hash = hashlib.sha256(drawings.read_bytes()).hexdigest()
    database = sqlite3.connect(output_dir / "drawings.db")
    try:
        database.executescript(
            (SKILL_DIR / "references" / "schema.sql").read_text(
                encoding="utf-8"
            )
        )
        database.execute(
            """
            INSERT INTO source_files
                (path, filename, sha256, page_count, ingested_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (str(drawings.resolve()), drawings.name, source_hash, 1, "test"),
        )
        database.execute(
            """
            INSERT INTO sheets (
                source_file_id, source_page, sheet_number, title,
                image_path, text_path, words_path, extraction_mode
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                1,
                1,
                "E-101",
                "Lighting plan",
                str(image_relative),
                str(text_relative),
                str(words_relative),
                "vector-text",
            ),
        )
        database.executemany(
            "INSERT INTO metadata(key, value) VALUES (?, ?)",
            [
                ("schema_version", "1"),
                ("created_at", "test"),
                ("output_directory", str(output_dir.resolve())),
                ("source_count", "1"),
                ("page_count", "1"),
            ],
        )
        database.commit()
    finally:
        database.close()

    manifest = {
        "created_at": "test",
        "output_directory": str(output_dir.resolve()),
        "sources": [
            {
                "filename": drawings.name,
                "path": str(drawings.resolve()),
                "sha256": source_hash,
                "page_count": 1,
            }
        ],
        "pages": [
            {
                "filename": drawings.name,
                "source_page": 1,
                "sheet_number": "E-101",
                "title": "Lighting plan",
                "image_path": str(image_relative),
                "text_path": str(text_relative),
                "words_path": str(words_relative),
                "extraction_mode": "vector-text",
            }
        ],
        "errors": ["One recoverable extraction warning"],
    }
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest), encoding="utf-8"
    )


def fake_skill_subprocess(drawings: Path, *, validator_code: int = 1):
    calls: list[list[str]] = []

    def fake_run(command: list[str], **_kwargs: object):
        calls.append(command)
        script = Path(command[1]).name
        if script == "prepare_drawings.py":
            output_dir = Path(command[command.index("--output") + 1])
            write_starter_index(output_dir, drawings)
            return subprocess.CompletedProcess(command, 0, "prepared", "")
        if script == "validate_index.py":
            stderr = (
                "WARNING: 1 page(s) remain pending review\n"
                if validator_code == 1
                else "validator failed\n"
            )
            return subprocess.CompletedProcess(
                command,
                validator_code,
                "Drawing index validation\n",
                stderr,
            )
        raise AssertionError(f"unexpected command: {command}")

    return calls, fake_run


def make_takeoff(source_hash: str) -> TakeoffDocument:
    return TakeoffDocument.model_validate(
        {
            "source": {"sha256": source_hash, "page_count": 1},
            "legend_entries": [
                {
                    "legend_entry_id": "LEGEND-HM01",
                    "code": "HM01",
                    "description": "Test fixture",
                    "page": 1,
                    "sheet": "E-101",
                    "bbox": {"x0": 5, "y0": 5, "x1": 15, "y1": 15},
                }
            ],
            "assets": [
                {
                    "unit_id": "HM01-001",
                    "legend_entry_id": "LEGEND-HM01",
                    "measurement_kind": "count",
                    "code": "HM01",
                    "description": "Test fixture",
                    "page": 1,
                    "sheet": "E-101",
                    "area_code": "L1",
                    "area": "Level 1",
                    "level": "1",
                    "method": "symbol count",
                    "confidence": "high",
                    "x": 50,
                    "y": 50,
                    "quantity": 1,
                    "unit": "EA",
                }
            ],
            "unresolved_symbols": [],
            "by_code": [
                {
                    "legend_entry_id": "LEGEND-HM01",
                    "code": "HM01",
                    "description": "Test fixture",
                    "measurement_kind": "count",
                    "unit": "EA",
                    "quantity": 1,
                }
            ],
            "by_area": [
                {
                    "area_code": "L1",
                    "legend_entry_id": "LEGEND-HM01",
                    "code": "HM01",
                    "description": "Test fixture",
                    "measurement_kind": "count",
                    "unit": "EA",
                    "quantity": 1,
                }
            ],
            "limitations": [],
        }
    )


def populate_aligned_index(database_path: Path) -> tuple[int, int]:
    database = sqlite3.connect(database_path)
    try:
        database.execute(
            "UPDATE sheets SET review_status='visually-reviewed', "
            "revision='0', issue_status='issued'"
        )
        legend_evidence_id = database.execute(
            """
            INSERT INTO evidence (
                sheet_id, evidence_kind, citation_label, bbox_json,
                visual_checked, created_at
            ) VALUES (1, 'legend', 'E-101, source PDF p.1', ?, 1, 'test')
            """,
            (json.dumps({"x0": 5, "y0": 5, "x1": 15, "y1": 15}),),
        ).lastrowid
        asset_evidence_id = database.execute(
            """
            INSERT INTO evidence (
                sheet_id, evidence_kind, citation_label, bbox_json,
                visual_checked, created_at
            ) VALUES (1, 'geometry', 'E-101, source PDF p.1', ?, 1, 'test')
            """,
            (json.dumps({"x0": 50, "y0": 50, "x1": 50, "y1": 50}),),
        ).lastrowid
        legend_id = database.execute(
            """
            INSERT INTO objects (canonical_key, object_type, name)
            VALUES ('legend.LEGEND-HM01', 'legend', 'HM01')
            """
        ).lastrowid
        asset_id = database.execute(
            """
            INSERT INTO objects (canonical_key, object_type, name)
            VALUES ('asset.HM01-001', 'fixture-instance', 'HM01-001')
            """
        ).lastrowid
        database.execute(
            """
            INSERT INTO facts (
                object_id, topic, property, raw_value, method,
                confidence, evidence_id
            ) VALUES (?, 'electrical', 'legend_code', 'HM01', 'explicit',
                      'high', ?)
            """,
            (legend_id, legend_evidence_id),
        )
        database.execute(
            """
            INSERT INTO facts (
                object_id, topic, property, raw_value, numeric_value,
                normalized_unit, method, confidence, evidence_id
            ) VALUES (?, 'electrical', 'quantity', '1 EA', 1, 'EA',
                      'counted', 'high', ?)
            """,
            (asset_id, asset_evidence_id),
        )
        database.execute(
            """
            INSERT INTO relationships (
                source_object_id, relationship_type, target_object_id,
                evidence_id, confidence
            ) VALUES (?, 'instance-of', ?, ?, 'high')
            """,
            (asset_id, legend_id, asset_evidence_id),
        )
        database.commit()
        return int(legend_evidence_id), int(asset_evidence_id)
    finally:
        database.close()


def test_prepares_fresh_index_and_verified_discoverable_skill(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job_dir, drawings, source_hash = make_job(tmp_path)
    calls, fake_run = fake_skill_subprocess(drawings)
    monkeypatch.setattr("app.drawing_skill._run_bounded", fake_run)

    result = prepare_drawing_index(
        job_dir=job_dir,
        drawings_path=drawings,
        expected_sha256=source_hash,
    )

    assert result.index_dir == (job_dir / "work" / "drawing-index").resolve()
    assert result.skill_dir == (
        job_dir / ".agents" / "skills" / "analyze-building-drawings"
    ).resolve()
    assert result.skill_sha256 == EXPECTED_SKILL_SHA256
    assert validate_skill_bundle(result.skill_dir) == EXPECTED_SKILL_SHA256
    assert result.source_sha256 == source_hash
    assert result.source_page_count == 1
    assert result.validation.validator_exit_code == 1
    assert result.validation.source_count == 1
    assert result.validation.page_count == 1
    assert result.validation.pending_pages == 1
    assert result.validation.visually_reviewed_pages == 0
    assert result.validation.object_count == 0
    assert result.validation.fact_count == 0
    assert result.validation.evidence_count == 0
    assert "One recoverable extraction warning" in result.warnings
    assert "1 page(s) remain pending review" in result.warnings
    assert [Path(call[1]).name for call in calls] == [
        "prepare_drawings.py",
        "validate_index.py",
    ]
    assert not list((job_dir / "work").glob(".drawing-index-staging-*"))


def test_post_model_validation_returns_structured_coverage(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job_dir, drawings, source_hash = make_job(tmp_path)
    _calls, fake_run = fake_skill_subprocess(drawings)
    monkeypatch.setattr("app.drawing_skill._run_bounded", fake_run)
    result = prepare_drawing_index(
        job_dir=job_dir,
        drawings_path=drawings,
        expected_sha256=source_hash,
    )

    populate_aligned_index(result.database_path)

    validation = validate_drawing_index(result)

    assert validation.pending_pages == 0
    assert validation.visually_reviewed_pages == 1
    assert validation.unknown_revision_pages == 0
    assert validation.object_count == 2
    assert validation.fact_count == 2
    assert validation.evidence_count == 2
    assert validation.unverified_facts == 0

    alignment = validate_takeoff_index_alignment(
        result, make_takeoff(source_hash)
    )
    assert alignment.legend_objects == 1
    assert alignment.asset_objects == 1
    assert alignment.quantity_facts == 1
    assert alignment.instance_relationships == 1

    database = sqlite3.connect(result.database_path)
    try:
        database.execute("DELETE FROM relationships")
        database.commit()
    finally:
        database.close()
    with pytest.raises(DrawingSkillError, match="instance-of relationship"):
        validate_takeoff_index_alignment(result, make_takeoff(source_hash))


def test_alignment_rejects_asset_evidence_with_wrong_geometry(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job_dir, drawings, source_hash = make_job(tmp_path)
    _calls, fake_run = fake_skill_subprocess(drawings)
    monkeypatch.setattr("app.drawing_skill._run_bounded", fake_run)
    result = prepare_drawing_index(
        job_dir=job_dir,
        drawings_path=drawings,
        expected_sha256=source_hash,
    )
    _legend_evidence_id, asset_evidence_id = populate_aligned_index(
        result.database_path
    )
    database = sqlite3.connect(result.database_path)
    try:
        database.execute(
            "UPDATE evidence SET bbox_json=? WHERE id=?",
            (
                json.dumps(
                    {"x0": 49, "y0": 49, "x1": 51, "y1": 51}
                ),
                asset_evidence_id,
            ),
        )
        database.commit()
    finally:
        database.close()

    with pytest.raises(DrawingSkillError, match="bbox-aligned quantity"):
        validate_takeoff_index_alignment(result, make_takeoff(source_hash))


def test_alignment_rejects_legend_without_bbox_aligned_fact(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job_dir, drawings, source_hash = make_job(tmp_path)
    _calls, fake_run = fake_skill_subprocess(drawings)
    monkeypatch.setattr("app.drawing_skill._run_bounded", fake_run)
    result = prepare_drawing_index(
        job_dir=job_dir,
        drawings_path=drawings,
        expected_sha256=source_hash,
    )
    legend_evidence_id, _asset_evidence_id = populate_aligned_index(
        result.database_path
    )
    database = sqlite3.connect(result.database_path)
    try:
        database.execute(
            "UPDATE evidence SET bbox_json=? WHERE id=?",
            (
                json.dumps({"x0": 4, "y0": 5, "x1": 15, "y1": 15}),
                legend_evidence_id,
            ),
        )
        database.commit()
    finally:
        database.close()

    with pytest.raises(DrawingSkillError, match="bbox-aligned legend_code"):
        validate_takeoff_index_alignment(result, make_takeoff(source_hash))


def test_source_hash_is_checked_before_starting_subprocess(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job_dir, drawings, _source_hash = make_job(tmp_path)

    def unexpected_run(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("subprocess must not start")

    monkeypatch.setattr("app.drawing_skill._run_bounded", unexpected_run)
    with pytest.raises(DrawingSkillError, match="does not match the job"):
        prepare_drawing_index(
            job_dir=job_dir,
            drawings_path=drawings,
            expected_sha256="0" * 64,
        )


def test_oversized_page_is_rejected_before_rasterization(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    job_dir, drawings, _source_hash = make_job(tmp_path)
    writer = PdfWriter()
    writer.add_blank_page(width=50_000, height=50_000)
    writer.write(str(drawings))
    source_hash = hashlib.sha256(drawings.read_bytes()).hexdigest()

    def unexpected_run(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("rasterizer must not start")

    monkeypatch.setattr("app.drawing_skill._run_bounded", unexpected_run)

    with pytest.raises(DrawingSkillError, match="too large to rasterize"):
        prepare_drawing_index(
            job_dir=job_dir,
            drawings_path=drawings,
            expected_sha256=source_hash,
        )


def test_250_arch_d_pages_fit_the_bounded_180_dpi_pixel_budget(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    drawings = tmp_path / "supported-250-pages.pdf"
    writer = PdfWriter()
    for _page in range(250):
        writer.add_blank_page(width=24 * 72, height=36 * 72)
    writer.write(str(drawings))

    class DiskUsage:
        free = 10 * 1024**3

    monkeypatch.setattr(
        "app.drawing_skill.shutil.disk_usage", lambda _path: DiskUsage()
    )

    assert drawing_skill._preflight_drawing_render(
        drawings,
        work_dir=tmp_path,
        dpi=180,
    ) == 250


def test_aggregate_rasterization_budget_remains_bounded(
    tmp_path: Path,
) -> None:
    drawings = tmp_path / "over-pixel-budget.pdf"
    writer = PdfWriter()
    for _page in range(286):
        writer.add_blank_page(width=24 * 72, height=36 * 72)
    writer.write(str(drawings))

    with pytest.raises(
        DrawingSkillError, match="aggregate rasterization limit"
    ):
        drawing_skill._preflight_drawing_render(
            drawings,
            work_dir=tmp_path,
            dpi=180,
        )


def test_manifest_asset_path_escape_is_rejected(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job_dir, drawings, source_hash = make_job(tmp_path)
    _calls, fake_run = fake_skill_subprocess(drawings)
    monkeypatch.setattr("app.drawing_skill._run_bounded", fake_run)
    result = prepare_drawing_index(
        job_dir=job_dir,
        drawings_path=drawings,
        expected_sha256=source_hash,
    )
    manifest = json.loads(result.manifest_path.read_text(encoding="utf-8"))
    manifest["pages"][0]["text_path"] = "../outside.txt"
    result.manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    with pytest.raises(DrawingSkillError, match="escapes the index"):
        validate_drawing_index(result)


def test_validator_exit_two_is_fatal(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job_dir, drawings, source_hash = make_job(tmp_path)
    _calls, fake_run = fake_skill_subprocess(drawings)
    monkeypatch.setattr("app.drawing_skill._run_bounded", fake_run)
    result = prepare_drawing_index(
        job_dir=job_dir,
        drawings_path=drawings,
        expected_sha256=source_hash,
    )
    _calls, failing_validator = fake_skill_subprocess(
        drawings, validator_code=2
    )
    monkeypatch.setattr("app.drawing_skill._run_bounded", failing_validator)

    with pytest.raises(DrawingSkillError, match="exit status 2"):
        validate_drawing_index(result)


def test_real_vendored_validator_warning_exit_is_accepted(tmp_path: Path) -> None:
    job_dir, drawings, _source_hash = make_job(tmp_path)
    skill_dir = (
        job_dir / ".agents" / "skills" / "analyze-building-drawings"
    )
    shutil.copytree(SKILL_DIR, skill_dir)
    index_dir = job_dir / "work" / "drawing-index"
    write_starter_index(index_dir, drawings)

    validation = validate_drawing_index(index_dir, timeout_seconds=30)

    assert validation.validator_exit_code == 1
    assert validation.pending_pages == 1
    assert any("pending review" in warning for warning in validation.warnings)


def test_image_only_page_accepts_the_preprocessor_empty_text_file(
    tmp_path: Path,
) -> None:
    job_dir, drawings, _source_hash = make_job(tmp_path)
    skill_dir = (
        job_dir / ".agents" / "skills" / "analyze-building-drawings"
    )
    shutil.copytree(SKILL_DIR, skill_dir)
    index_dir = job_dir / "work" / "drawing-index"
    write_starter_index(index_dir, drawings)

    manifest_path = index_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["pages"][0]["extraction_mode"] = "image-only"
    text_path = index_dir / manifest["pages"][0]["text_path"]
    text_path.write_text("", encoding="utf-8")
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    database = sqlite3.connect(index_dir / "drawings.db")
    try:
        database.execute(
            "UPDATE sheets SET extraction_mode='image-only' WHERE id=1"
        )
        database.commit()
    finally:
        database.close()

    validation = validate_drawing_index(index_dir, timeout_seconds=30)

    assert validation.image_only_pages == 1


def test_preprocessor_timeout_is_bounded_and_staging_is_removed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job_dir, drawings, source_hash = make_job(tmp_path)

    def timed_out(command: list[str], **_kwargs: object) -> None:
        raise DrawingSkillError("drawing skill preprocessing exceeded the 1-second timeout")

    monkeypatch.setattr("app.drawing_skill._run_bounded", timed_out)
    with pytest.raises(DrawingSkillError, match="exceeded the 1-second timeout"):
        prepare_drawing_index(
            job_dir=job_dir,
            drawings_path=drawings,
            expected_sha256=source_hash,
            timeout_seconds=1,
        )

    assert not (job_dir / "work" / "drawing-index").exists()
    assert not list((job_dir / "work").glob(".drawing-index-staging-*"))


def test_bounded_subprocess_timeout_kills_descendants(tmp_path: Path) -> None:
    marker = tmp_path / "descendant-survived.txt"
    child = (
        "import time; from pathlib import Path; "
        f"time.sleep(3); Path({str(marker)!r}).write_text('survived')"
    )
    parent = (
        "import subprocess, sys, time; "
        f"subprocess.Popen([sys.executable, '-c', {child!r}]); "
        "time.sleep(30)"
    )

    with pytest.raises(DrawingSkillError, match="exceeded the 1-second timeout"):
        drawing_skill._run_bounded(
            [sys.executable, "-c", parent],
            cwd=tmp_path,
            timeout_seconds=1,
            label="process-tree test",
        )

    time.sleep(4)
    assert not marker.exists()


def test_bundle_validation_rejects_unexpected_files(tmp_path: Path) -> None:
    copied = tmp_path / "skill"
    shutil.copytree(SKILL_DIR, copied)
    assert validate_skill_bundle(copied) == EXPECTED_SKILL_SHA256
    (copied / "unexpected.txt").write_text("unexpected", encoding="utf-8")

    with pytest.raises(DrawingSkillError, match="unexpected unexpected.txt"):
        validate_skill_bundle(copied)
