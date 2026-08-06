from __future__ import annotations

import hmac
import importlib
import os
import shutil
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import (
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse, JSONResponse, Response

from .codex_runner import normalize_customer_instructions
from .config import SETTINGS, Settings
from .drawing_skill import DrawingSkillError, validate_skill_bundle
from .models import (
    AnalysisProfile,
    JobRecord,
    JobSubmission,
    JobStatus,
    RequestedScope,
    SUPPORTED_TAKEOFF_MODELS,
    WorkflowKind,
)
from .pipeline import PipelineManager, sha256_file
from .store import JobStore
from .validation import (
    MAX_JSON_BYTES,
    MAX_PDF_BYTES,
    MAX_WORKBOOK_BYTES,
    require_regular_file,
)


def drawing_runtime_dependencies_ready() -> bool:
    try:
        importlib.import_module("pdfplumber")
        importlib.import_module("PIL.Image")
    except (ImportError, OSError):
        return False
    return True


async def save_upload(
    upload: UploadFile,
    destination: Path,
    *,
    max_bytes: int,
    remaining_total_bytes: int,
) -> int:
    destination.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    try:
        with destination.open("wb") as handle:
            while chunk := await upload.read(8 * 1024**2):
                written += len(chunk)
                if written > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        detail=f"{upload.filename} exceeds the upload limit",
                    )
                if written > remaining_total_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        detail="The combined upload exceeds the total upload limit",
                    )
                handle.write(chunk)
    finally:
        await upload.close()
    if written == 0:
        destination.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{upload.filename} is empty",
        )
    return written


def validate_magic(path: Path, expected: str) -> None:
    with path.open("rb") as handle:
        prefix = handle.read(8)
    if expected == "pdf" and not prefix.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400, detail="drawings_pdf is not a PDF"
        )
    if expected == "xlsx" and not prefix.startswith(b"PK"):
        raise HTTPException(
            status_code=400, detail=f"{path.name} is not an XLSX file"
        )
    if expected == "json":
        try:
            path.read_text(encoding="utf-8")
        except UnicodeDecodeError as exc:
            raise HTTPException(
                status_code=400, detail=f"{path.name} is not UTF-8 JSON"
            ) from exc


def create_app(settings: Settings = SETTINGS) -> FastAPI:
    settings.validate_runtime()
    store = JobStore(settings.data_dir / "jobs")
    manager = PipelineManager(settings, store)

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        application.state.retention_cleanup = store.cleanup_expired(
            settings.retention_days
        )
        application.state.startup_recovery = manager.recover_pending()
        yield

    app = FastAPI(
        title="Drawing Takeoff Microservice",
        version="1.1.0",
        description=(
            "Codex-powered construction drawing takeoff with Excel and "
            "annotated-PDF audit artifacts."
        ),
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.store = store
    app.state.manager = manager

    def require_service_token(
        authorization: Annotated[str | None, Header()] = None,
    ) -> None:
        expected = settings.service_api_token
        if not expected:
            if settings.allows_unauthenticated_requests:
                return
            raise HTTPException(status_code=503, detail="Service auth unavailable")
        supplied = authorization or ""
        if not hmac.compare_digest(supplied, f"Bearer {expected}"):
            raise HTTPException(status_code=401, detail="Unauthorized")

    @app.get("/healthz")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/readyz")
    def readiness() -> JSONResponse:
        data_ready = (
            settings.data_dir.is_dir()
            and os.access(settings.data_dir, os.R_OK | os.W_OK | os.X_OK)
        )
        codex_ready = (
            shutil.which(settings.codex_bin) is not None
            if Path(settings.codex_bin).name == settings.codex_bin
            else Path(settings.codex_bin).is_file()
            and os.access(settings.codex_bin, os.X_OK)
        )
        poppler_ready = shutil.which("pdftoppm") is not None
        drawing_python_ready = drawing_runtime_dependencies_ready()
        try:
            validate_skill_bundle()
            drawing_skill_ready = True
        except (DrawingSkillError, OSError):
            drawing_skill_ready = False
        ready = (
            data_ready
            and codex_ready
            and poppler_ready
            and drawing_python_ready
            and drawing_skill_ready
        )
        return JSONResponse(
            status_code=200 if ready else 503,
            content={
                "status": "ready" if ready else "not_ready",
                "checks": {
                    "data_dir": "ok" if data_ready else "unavailable",
                    "codex": "ok" if codex_ready else "unavailable",
                    "pdftoppm": "ok" if poppler_ready else "unavailable",
                    "drawing_python": (
                        "ok" if drawing_python_ready else "unavailable"
                    ),
                    "drawing_skill": (
                        "ok" if drawing_skill_ready else "unavailable"
                    ),
                },
            },
        )

    @app.post(
        "/v1/jobs",
        response_model=JobSubmission,
        status_code=status.HTTP_202_ACCEPTED,
    )
    async def create_job(
        drawings_pdf: Annotated[UploadFile, File()],
        template_xlsx: Annotated[UploadFile | None, File()] = None,
        price_database_xlsx: Annotated[UploadFile | None, File()] = None,
        takeoff_json: Annotated[UploadFile | None, File()] = None,
        workbook_result: Annotated[UploadFile | None, File()] = None,
        instructions: Annotated[str, Form()] = "",
        analysis_profile: Annotated[
            AnalysisProfile,
            Form(alias="analysisProfile"),
        ] = AnalysisProfile.analyze_building_drawings_v1,
        workflow_kind: Annotated[
            WorkflowKind,
            Form(alias="workflowKind"),
        ] = WorkflowKind.legend_fixture_takeoff_v1,
        requested_scopes: Annotated[
            list[RequestedScope] | None,
            Form(alias="requestedScopes"),
        ] = None,
        free_sample: Annotated[bool, Form(alias="freeSample")] = False,
        model: Annotated[str | None, Form()] = None,
        x_codex_api_key: Annotated[
            str | None, Header(alias="X-Codex-API-Key")
        ] = None,
        authorization: Annotated[str | None, Header()] = None,
    ) -> JobSubmission:
        require_service_token(authorization)
        selected_model = (model or settings.default_model).strip().lower()
        if selected_model not in SUPPORTED_TAKEOFF_MODELS:
            raise HTTPException(
                status_code=400,
                detail="Unsupported model for takeoff cost accounting",
            )
        try:
            normalized_instructions = normalize_customer_instructions(
                instructions,
                max_chars=settings.max_instructions_chars,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        selected_scopes = requested_scopes or [RequestedScope.fixture_counts]
        if len(selected_scopes) != len(set(selected_scopes)):
            raise HTTPException(
                status_code=400,
                detail="requestedScopes values must be unique",
            )
        if takeoff_json is None and not x_codex_api_key:
            raise HTTPException(
                status_code=400,
                detail=(
                    "X-Codex-API-Key is required unless takeoff_json replay "
                    "data is supplied"
                ),
            )
        if workbook_result is not None and takeoff_json is None:
            raise HTTPException(
                status_code=400,
                detail="workbook_result is only accepted with takeoff_json",
            )

        job_id = uuid.uuid4().hex
        record = JobRecord(
            id=job_id,
            status=JobStatus.queued,
            model=selected_model,
            analysis_profile=analysis_profile,
            workflow_kind=workflow_kind,
            requested_scopes=selected_scopes,
            customer_instructions=normalized_instructions,
            free_sample=free_sample,
        )
        job_dir = store.create(record)
        inputs_dir = job_dir / "inputs"
        saved: list[Path] = []
        total_bytes = 0
        try:
            drawing_path = inputs_dir / "drawings.pdf"
            total_bytes += await save_upload(
                drawings_pdf,
                drawing_path,
                max_bytes=settings.max_upload_bytes,
                remaining_total_bytes=(
                    settings.max_total_upload_bytes - total_bytes
                ),
            )
            saved.append(drawing_path)
            validate_magic(drawing_path, "pdf")

            optional_uploads = [
                (template_xlsx, inputs_dir / "template.xlsx", "xlsx"),
                (
                    price_database_xlsx,
                    inputs_dir / "prices.xlsx",
                    "xlsx",
                ),
                (
                    takeoff_json,
                    inputs_dir / "replay_takeoff.json",
                    "json",
                ),
                (
                    workbook_result,
                    inputs_dir / "replay_workbook.xlsx",
                    "xlsx",
                ),
            ]
            for upload, destination, expected in optional_uploads:
                if upload is None:
                    continue
                total_bytes += await save_upload(
                    upload,
                    destination,
                    max_bytes=settings.max_upload_bytes,
                    remaining_total_bytes=(
                        settings.max_total_upload_bytes - total_bytes
                    ),
                )
                saved.append(destination)
                validate_magic(destination, expected)
            inputs = {
                path.name: sha256_file(path)
                for path in sorted(saved)
            }
            store.update(job_id, inputs=inputs)
        except Exception:
            shutil.rmtree(job_dir, ignore_errors=True)
            raise

        replay_path = inputs_dir / "replay_takeoff.json"
        replay_workbook_path = inputs_dir / "replay_workbook.xlsx"
        manager.submit(
            store.load(job_id),
            codex_api_key=x_codex_api_key,
            replay_takeoff=replay_path if replay_path.exists() else None,
            replay_workbook=(
                replay_workbook_path
                if replay_workbook_path.exists()
                else None
            ),
        )
        return JobSubmission(
            job_id=job_id,
            status=JobStatus.queued,
            status_url=f"/v1/jobs/{job_id}",
        )

    @app.get("/v1/jobs/{job_id}", response_model=JobRecord)
    def get_job(
        job_id: str,
        authorization: Annotated[str | None, Header()] = None,
    ) -> JobRecord:
        require_service_token(authorization)
        try:
            return store.load(job_id)
        except (FileNotFoundError, ValueError) as exc:
            raise HTTPException(status_code=404, detail="Job not found") from exc

    @app.get("/v1/jobs/{job_id}/artifacts/{filename}")
    def get_artifact(
        job_id: str,
        filename: str,
        authorization: Annotated[str | None, Header()] = None,
    ) -> FileResponse:
        require_service_token(authorization)
        if Path(filename).name != filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        try:
            record = store.load(job_id)
        except (FileNotFoundError, ValueError) as exc:
            raise HTTPException(status_code=404, detail="Job not found") from exc
        artifact = record.artifacts.get(filename)
        if artifact is None:
            raise HTTPException(status_code=404, detail="Artifact not found")
        path = store.job_dir(job_id) / "artifacts" / filename
        limits = {
            ".pdf": MAX_PDF_BYTES,
            ".xlsx": MAX_WORKBOOK_BYTES,
            ".json": MAX_JSON_BYTES,
        }
        try:
            regular = require_regular_file(
                path,
                allowed_parent=store.job_dir(job_id) / "artifacts",
                max_bytes=limits.get(path.suffix.lower(), MAX_JSON_BYTES),
            )
        except (FileNotFoundError, ValueError):
            raise HTTPException(status_code=410, detail="Artifact is missing")
        if (
            regular.stat().st_size != artifact.bytes
            or sha256_file(regular) != artifact.sha256
        ):
            raise HTTPException(
                status_code=410, detail="Artifact integrity check failed"
            )
        return FileResponse(
            regular,
            media_type=artifact.media_type,
            filename=artifact.filename,
        )

    @app.delete("/v1/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_job(
        job_id: str,
        authorization: Annotated[str | None, Header()] = None,
    ) -> Response:
        require_service_token(authorization)
        try:
            record = store.load(job_id)
        except (FileNotFoundError, ValueError) as exc:
            raise HTTPException(status_code=404, detail="Job not found") from exc
        if manager.is_active(job_id) or record.status not in {
            JobStatus.completed,
            JobStatus.failed,
        }:
            raise HTTPException(
                status_code=409,
                detail="Only inactive completed or failed jobs can be deleted",
            )
        store.delete(job_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return app


app = create_app()
