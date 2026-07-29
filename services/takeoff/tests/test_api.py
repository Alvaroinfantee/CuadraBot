from __future__ import annotations

import io
import hashlib
import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient
from pypdf import PdfWriter

os.environ.setdefault("TAKEOFF_ENV", "test")

from app.config import Settings
from app.main import create_app
from app.models import (
    ArtifactInfo,
    JobRecord,
    JobStatus,
    RequestedScope,
    WorkflowKind,
)


def pdf_bytes() -> bytes:
    stream = io.BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=100)
    writer.write(stream)
    return stream.getvalue()


def settings(tmp_path: Path) -> Settings:
    return Settings(
        data_dir=tmp_path / "data",
        codex_bin=sys.executable,
        default_model="gpt-5.6-sol",
        max_upload_bytes=10_000_000,
        max_total_upload_bytes=10_000_000,
        service_api_token="service-secret",
        max_workers=1,
        environment="test",
    )


def test_service_auth_and_replay_submission(tmp_path: Path) -> None:
    app = create_app(settings(tmp_path))
    submitted: list[str] = []
    app.state.manager.submit = (
        lambda record, **kwargs: submitted.append(record.id)
    )
    client = TestClient(app)
    files = {
        "drawings_pdf": ("drawing.pdf", pdf_bytes(), "application/pdf"),
        "takeoff_json": (
            "takeoff.json",
            b'{"source": {}, "assets": []}',
            "application/json",
        ),
    }

    unauthorized = client.post("/v1/jobs", files=files)
    assert unauthorized.status_code == 401

    response = client.post(
        "/v1/jobs",
        files=files,
        data={
            "freeSample": "true",
            "workflowKind": "legend_fixture_takeoff_v1",
            "requestedScopes": ["fixture_counts", "cable_runs"],
            "instructions": "Count only mapped electrical symbols.",
        },
        headers={"Authorization": "Bearer service-secret"},
    )
    assert response.status_code == 202
    assert response.json()["job_id"] in submitted
    stored = app.state.store.load(response.json()["job_id"])
    assert stored.free_sample is True
    assert (
        stored.workflow_kind
        == WorkflowKind.legend_fixture_takeoff_v1
    )
    assert stored.requested_scopes == [
        RequestedScope.fixture_counts,
        RequestedScope.cable_runs,
    ]
    assert (
        stored.customer_instructions
        == "Count only mapped electrical symbols."
    )


def test_codex_job_requires_api_key(tmp_path: Path) -> None:
    app = create_app(settings(tmp_path))
    client = TestClient(app)
    response = client.post(
        "/v1/jobs",
        files={
            "drawings_pdf": (
                "drawing.pdf",
                pdf_bytes(),
                "application/pdf",
            )
        },
        headers={"Authorization": "Bearer service-secret"},
    )
    assert response.status_code == 400
    assert "X-Codex-API-Key" in response.json()["detail"]


def test_production_requires_service_token(tmp_path: Path) -> None:
    production = Settings(
        data_dir=tmp_path / "data",
        codex_bin=sys.executable,
        default_model="gpt-5.6-sol",
        max_upload_bytes=10_000_000,
        max_total_upload_bytes=10_000_000,
        service_api_token=None,
        max_workers=1,
        environment="production",
    )

    try:
        create_app(production)
    except RuntimeError as exc:
        assert "TAKEOFF_SERVICE_API_TOKEN" in str(exc)
    else:
        raise AssertionError("production app started without a service token")


def test_total_upload_limit_is_enforced(tmp_path: Path) -> None:
    limited = Settings(
        data_dir=tmp_path / "data",
        codex_bin=sys.executable,
        default_model="gpt-5.6-sol",
        max_upload_bytes=10_000_000,
        max_total_upload_bytes=len(pdf_bytes()),
        service_api_token="service-secret",
        max_workers=1,
        environment="test",
    )
    app = create_app(limited)
    app.state.manager.submit = lambda *_args, **_kwargs: None
    client = TestClient(app)

    response = client.post(
        "/v1/jobs",
        files={
            "drawings_pdf": ("drawing.pdf", pdf_bytes(), "application/pdf"),
            "takeoff_json": ("takeoff.json", b"{}", "application/json"),
        },
        headers={"Authorization": "Bearer service-secret"},
    )

    assert response.status_code == 413
    assert "combined upload" in response.json()["detail"]


def test_readiness_checks_runtime_dependencies(tmp_path: Path) -> None:
    app = create_app(settings(tmp_path))
    response = TestClient(app).get("/readyz")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "checks": {"data_dir": "ok", "codex": "ok"},
    }


def test_instruction_limit_and_authenticated_terminal_delete(
    tmp_path: Path,
) -> None:
    configured = settings(tmp_path)
    configured = Settings(
        **{
            **configured.__dict__,
            "max_instructions_chars": 10,
        }
    )
    app = create_app(configured)
    app.state.manager.submit = lambda *_args, **_kwargs: None
    client = TestClient(app)
    response = client.post(
        "/v1/jobs",
        files={
            "drawings_pdf": (
                "drawing.pdf",
                pdf_bytes(),
                "application/pdf",
            ),
            "takeoff_json": (
                "takeoff.json",
                b"{}",
                "application/json",
            ),
        },
        data={"instructions": "x" * 11},
        headers={"Authorization": "Bearer service-secret"},
    )
    assert response.status_code == 400
    assert "normalized characters" in response.json()["detail"]

    app.state.store.create(
        JobRecord(
            id="deletable",
            status=JobStatus.completed,
            model=configured.default_model,
        )
    )
    unauthorized = client.delete("/v1/jobs/deletable")
    assert unauthorized.status_code == 401
    deleted = client.delete(
        "/v1/jobs/deletable",
        headers={"Authorization": "Bearer service-secret"},
    )
    assert deleted.status_code == 204
    assert not app.state.store.job_dir("deletable").exists()


def test_artifact_download_rejects_symlink_after_completion(
    tmp_path: Path,
) -> None:
    app = create_app(settings(tmp_path))
    outside = tmp_path / "outside.json"
    outside.write_text('{"secret":"not downloadable"}', encoding="utf-8")
    payload = outside.read_bytes()
    record = JobRecord(
        id="artifactjob",
        status=JobStatus.completed,
        model="gpt-5.6-sol",
        artifacts={
            "takeoff.json": ArtifactInfo(
                name="takeoff",
                filename="takeoff.json",
                media_type="application/json",
                bytes=len(payload),
                sha256=hashlib.sha256(payload).hexdigest(),
                download_url=(
                    "/v1/jobs/artifactjob/artifacts/takeoff.json"
                ),
            )
        },
    )
    job_dir = app.state.store.create(record)
    (job_dir / "artifacts" / "takeoff.json").symlink_to(outside)

    response = TestClient(app).get(
        "/v1/jobs/artifactjob/artifacts/takeoff.json",
        headers={"Authorization": "Bearer service-secret"},
    )

    assert response.status_code == 410
    assert response.json()["detail"] == "Artifact is missing"
