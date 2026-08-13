from __future__ import annotations

import hashlib
import hmac
import json
import math
import os
import re
import shutil
import signal
import sqlite3
import stat
import subprocess
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any
from urllib.parse import quote

from pypdf import PdfReader

from .models import TakeoffAsset, TakeoffDocument
from .validation import MAX_JSON_BYTES, MAX_PDF_BYTES, require_regular_file


SKILL_NAME = "analyze-building-drawings"
SKILL_INSTALL_RELATIVE = Path(".agents") / "skills" / SKILL_NAME
INDEX_RELATIVE = Path("work") / "drawing-index"
VENDORED_SKILL_DIR = (
    Path(__file__).resolve().parent.parent / "skills" / SKILL_NAME
)

EXPECTED_SKILL_FILES = {
    "SKILL.md": (
        "aca2b68d935f1bc27a5cfe0039d5e4bc83ec1e0a384edfbcae051c38bbf60615"
    ),
    "agents/openai.yaml": (
        "b53f7ba81929dc3932d6f394e8d466109e40ed2bc865df07e2940a1d5370b961"
    ),
    "references/indexing-guide.md": (
        "b0e16276517d3f450d6cd0f846b0dd61c962c05c7bf4ef211332fae804353e4e"
    ),
    "references/schema.sql": (
        "98185a695728cc4225e9f4d4f2f98555e6c558c4099cebd494ca213f4d2706ac"
    ),
    "scripts/check_environment.py": (
        "30541eea35bd0da492e4985f94d82cae24ca0e4f72fcef1d60ec9f0d445c28eb"
    ),
    "scripts/prepare_drawings.py": (
        "9b9cc21966de3fa7bfe93b1e52d6c414647c2f0d2797b04ce8be2c8856a415c9"
    ),
    "scripts/requirements.txt": (
        "f9c0de4620fc0226cbe21e26afb6d8644e2926d9cc1b801e7cff37908da11544"
    ),
    "scripts/validate_index.py": (
        "d3e554aa5a1ba8affe3645c1757c01b274081a5ea014187bd3b7490dfec5bc1c"
    ),
}
EXPECTED_SKILL_SHA256 = (
    "b6a46fb755e93ac63ada01db2612c22050b89beb2317ddf4a6f1541ce58ffd73"
)

MAX_INDEX_FILES = 25_000
MAX_INDEX_TOTAL_BYTES = 2 * 1024**3
MAX_INDEX_DATABASE_BYTES = 250 * 1024**2
MAX_INDEX_TEXT_BYTES = 50 * 1024**2
MAX_INDEX_IMAGE_BYTES = 250 * 1024**2
# Structural ceiling for parsing/manifest validation.  The public workflow has
# a smaller 250-page product limit, while the pixel, disk, and timeout budgets
# below remain the authoritative processing limits for any accepted set.
MAX_INDEX_PAGES = 5_000
MAX_RENDER_PAGE_PIXELS = 100_000_000
# 250 ARCH-D (24 x 36 inch) sheets at 180 DPI require just under 7 billion
# pixels.  Keep enough headroom for that supported case without removing the
# cumulative resource bound.
MAX_RENDER_TOTAL_PIXELS = 8_000_000_000
MIN_RENDER_SCRATCH_BYTES = 100 * 1024**2
MAX_WARNING_COUNT = 10_000
MAX_WARNING_CHARS = 4_000
MAX_TIMEOUT_SECONDS = 21_600
WINDOWS_EXTERNAL_TOOL_PATH_LIMIT = 248
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
EVIDENCE_BBOX_TOLERANCE = 1e-4
EXTRACTION_MODES = {
    "vector-text",
    "ocr",
    "mixed",
    "image-only",
    "unknown",
}


class DrawingSkillError(RuntimeError):
    """The vendored drawing skill or one of its generated indexes is unsafe."""


@dataclass(frozen=True)
class DrawingIndexValidation:
    validator_exit_code: int
    source_count: int
    page_count: int
    pending_pages: int
    text_reviewed_pages: int
    visually_reviewed_pages: int
    image_only_pages: int
    unknown_revision_pages: int
    object_count: int
    fact_count: int
    evidence_count: int
    low_confidence_facts: int
    unverified_facts: int
    open_references: int
    open_conflicts: int
    warnings: tuple[str, ...]


@dataclass(frozen=True)
class DrawingSkillIndex:
    index_dir: Path
    skill_dir: Path
    manifest_path: Path
    database_path: Path
    drawings_markdown_path: Path
    source_sha256: str
    source_page_count: int
    skill_sha256: str
    validation: DrawingIndexValidation

    @property
    def validator_exit_code(self) -> int:
        return self.validation.validator_exit_code

    @property
    def warnings(self) -> tuple[str, ...]:
        return self.validation.warnings


@dataclass(frozen=True)
class DrawingIndexAlignment:
    legend_objects: int
    asset_objects: int
    quantity_facts: int
    instance_relationships: int


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _require_timeout(value: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise DrawingSkillError("timeout_seconds must be an integer")
    if value < 1 or value > MAX_TIMEOUT_SECONDS:
        raise DrawingSkillError(
            f"timeout_seconds must be between 1 and {MAX_TIMEOUT_SECONDS}"
        )
    return value


def _require_directory(path: Path, *, label: str) -> Path:
    try:
        metadata = path.lstat()
    except FileNotFoundError as exc:
        raise DrawingSkillError(f"{label} is missing") from exc
    if path.is_symlink() or not stat.S_ISDIR(metadata.st_mode):
        raise DrawingSkillError(f"{label} must be a non-symlink directory")
    return path.resolve(strict=True)


def _ensure_direct_child_directory(
    parent: Path,
    name: str,
    *,
    label: str,
) -> Path:
    resolved_parent = _require_directory(parent, label=f"{label} parent")
    path = resolved_parent / name
    try:
        path.mkdir(mode=0o700)
    except FileExistsError:
        return _require_directory(path, label=label)
    return _require_directory(path, label=label)


def _fresh_direct_child_directory(
    parent: Path,
    prefix: str,
    *,
    label: str,
) -> Path:
    resolved_parent = _require_directory(parent, label=f"{label} parent")
    for _attempt in range(10):
        candidate = resolved_parent / f"{prefix}{uuid.uuid4().hex}"
        try:
            candidate.mkdir(mode=0o700)
        except FileExistsError:
            continue
        return _require_directory(candidate, label=label)
    raise DrawingSkillError(f"could not create a fresh {label}")


def _safe_remove_owned_tree(path: Path, *, parent: Path) -> None:
    try:
        metadata = path.lstat()
    except FileNotFoundError:
        return
    resolved_parent = _require_directory(parent, label="cleanup parent")
    if path.parent.resolve(strict=True) != resolved_parent:
        raise DrawingSkillError("refusing to clean a directory outside the job")
    if path.is_symlink() or not stat.S_ISDIR(metadata.st_mode):
        raise DrawingSkillError("refusing to clean a non-directory job path")
    shutil.rmtree(path)


def _bundle_files(root: Path) -> dict[str, Path]:
    resolved_root = _require_directory(root, label="drawing skill bundle")
    files: dict[str, Path] = {}
    for candidate in resolved_root.rglob("*"):
        metadata = candidate.lstat()
        if candidate.is_symlink():
            raise DrawingSkillError("drawing skill bundle contains a symlink")
        if stat.S_ISDIR(metadata.st_mode):
            continue
        if not stat.S_ISREG(metadata.st_mode):
            raise DrawingSkillError(
                "drawing skill bundle contains a special file"
            )
        relative = candidate.relative_to(resolved_root).as_posix()
        files[relative] = candidate
    return files


def validate_skill_bundle(skill_dir: Path = VENDORED_SKILL_DIR) -> str:
    files = _bundle_files(skill_dir)
    if set(files) != set(EXPECTED_SKILL_FILES):
        missing = sorted(set(EXPECTED_SKILL_FILES) - set(files))
        unexpected = sorted(set(files) - set(EXPECTED_SKILL_FILES))
        details: list[str] = []
        if missing:
            details.append("missing " + ", ".join(missing))
        if unexpected:
            details.append("unexpected " + ", ".join(unexpected))
        raise DrawingSkillError(
            "drawing skill bundle file set is invalid ("
            + "; ".join(details)
            + ")"
        )

    tree_digest = hashlib.sha256()
    for relative in sorted(files):
        observed = _sha256_file(files[relative])
        expected = EXPECTED_SKILL_FILES[relative]
        if not hmac.compare_digest(observed, expected):
            raise DrawingSkillError(
                f"drawing skill bundle hash mismatch for {relative}"
            )
        tree_digest.update(relative.encode("utf-8"))
        tree_digest.update(b"\0")
        tree_digest.update(observed.encode("ascii"))
        tree_digest.update(b"\n")
    bundle_hash = tree_digest.hexdigest()
    if not hmac.compare_digest(bundle_hash, EXPECTED_SKILL_SHA256):
        raise DrawingSkillError("drawing skill bundle tree hash is invalid")
    return bundle_hash


def _copy_file_exclusive(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor = os.open(
        destination,
        os.O_WRONLY
        | os.O_CREAT
        | os.O_EXCL
        | getattr(os, "O_NOFOLLOW", 0),
        0o600,
    )
    try:
        with source.open("rb") as reader, os.fdopen(descriptor, "wb") as writer:
            descriptor = -1
            shutil.copyfileobj(reader, writer, length=1024 * 1024)
            writer.flush()
            os.fsync(writer.fileno())
    finally:
        if descriptor >= 0:
            os.close(descriptor)


def _stage_skill(job_dir: Path) -> tuple[Path, str]:
    bundle_hash = validate_skill_bundle(VENDORED_SKILL_DIR)
    resolved_job = _require_directory(job_dir, label="job directory")
    agents_dir = _ensure_direct_child_directory(
        resolved_job,
        ".agents",
        label="job skill directory",
    )
    skills_dir = _ensure_direct_child_directory(
        agents_dir,
        "skills",
        label="job skills directory",
    )
    destination = skills_dir / SKILL_NAME
    if destination.exists() or destination.is_symlink():
        raise DrawingSkillError(
            "job-local drawing skill destination must be fresh"
        )
    staging = _fresh_direct_child_directory(
        skills_dir,
        f".{SKILL_NAME}-staging-",
        label="drawing skill staging directory",
    )
    try:
        source_files = _bundle_files(VENDORED_SKILL_DIR)
        for relative in sorted(source_files):
            _copy_file_exclusive(
                source_files[relative],
                staging / Path(PurePosixPath(relative)),
            )
        observed = validate_skill_bundle(staging)
        if not hmac.compare_digest(observed, bundle_hash):
            raise DrawingSkillError("job-local drawing skill copy is invalid")
        os.replace(staging, destination)
    except Exception:
        _safe_remove_owned_tree(staging, parent=skills_dir)
        raise
    return _require_directory(destination, label="job-local drawing skill"), bundle_hash


def _subprocess_environment() -> dict[str, str]:
    allowed = {
        "PATH",
        "PATHEXT",
        "SYSTEMROOT",
        "WINDIR",
        "COMSPEC",
        "TEMP",
        "TMP",
        "TMPDIR",
        "LANG",
        "LC_ALL",
    }
    return {key: value for key, value in os.environ.items() if key in allowed}


def _run_bounded(
    command: list[str],
    *,
    cwd: Path,
    timeout_seconds: int,
    label: str,
) -> subprocess.CompletedProcess[str]:
    timeout = _require_timeout(timeout_seconds)
    try:
        process_options: dict[str, Any] = {
            "cwd": cwd,
            "env": _subprocess_environment(),
            "stdout": subprocess.PIPE,
            "stderr": subprocess.PIPE,
            "text": True,
            "encoding": "utf-8",
            "errors": "replace",
        }
        if os.name == "nt":
            process_options["creationflags"] = getattr(
                subprocess,
                "CREATE_NEW_PROCESS_GROUP",
                0,
            )
        else:
            process_options["start_new_session"] = True
        process = subprocess.Popen(
            command,
            **process_options,
        )
    except OSError as exc:
        raise DrawingSkillError(f"{label} could not be started") from exc
    try:
        stdout, stderr = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        if os.name == "nt":
            try:
                subprocess.run(
                    [
                        "taskkill",
                        "/PID",
                        str(process.pid),
                        "/T",
                        "/F",
                    ],
                    env=_subprocess_environment(),
                    capture_output=True,
                    timeout=15,
                    check=False,
                )
            except (OSError, subprocess.TimeoutExpired):
                process.kill()
        else:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except (OSError, ProcessLookupError):
                process.kill()
        try:
            process.communicate(timeout=15)
        except subprocess.TimeoutExpired:
            process.kill()
            process.communicate()
        raise DrawingSkillError(
            f"{label} exceeded the {timeout}-second timeout"
        ) from exc
    return subprocess.CompletedProcess(
        command,
        process.returncode,
        stdout,
        stderr,
    )


def _require_renderable_staging_path(
    staging: Path,
    *,
    source_sha256: str,
) -> None:
    if os.name != "nt":
        return
    probe = (
        staging
        / "pages"
        / f"drawings-{source_sha256[:10]}-0001"
        / "page-0001.png"
    )
    if len(str(probe)) >= WINDOWS_EXTERNAL_TOOL_PATH_LIMIT:
        raise DrawingSkillError(
            "drawing index path is too long for the Windows PDF renderer; "
            "configure TAKEOFF_DATA_DIR to a shorter absolute path"
        )


def _preflight_drawing_render(
    drawings: Path,
    *,
    work_dir: Path,
    dpi: int,
) -> int:
    try:
        reader = PdfReader(str(drawings), strict=False)
        page_count = len(reader.pages)
    except Exception as exc:
        raise DrawingSkillError(
            "drawings.pdf cannot be inspected before rasterization"
        ) from exc
    if not 1 <= page_count <= MAX_INDEX_PAGES:
        raise DrawingSkillError(
            f"drawings.pdf must contain between 1 and {MAX_INDEX_PAGES} pages"
        )

    total_pixels = 0
    for page_number, page in enumerate(reader.pages, start=1):
        try:
            # The preprocessor renders with pdftoppm -cropbox, matching the
            # visible page coordinate space used by annotations and takeoff
            # geometry.  Crop-box offsets do not affect the pixel count.
            width_points = float(page.cropbox.width)
            height_points = float(page.cropbox.height)
        except (TypeError, ValueError, OverflowError) as exc:
            raise DrawingSkillError(
                f"drawings.pdf page {page_number} has invalid dimensions"
            ) from exc
        if (
            not math.isfinite(width_points)
            or not math.isfinite(height_points)
            or width_points <= 0
            or height_points <= 0
        ):
            raise DrawingSkillError(
                f"drawings.pdf page {page_number} has invalid dimensions"
            )
        width_pixels = math.ceil(width_points * dpi / 72)
        height_pixels = math.ceil(height_points * dpi / 72)
        page_pixels = width_pixels * height_pixels
        if page_pixels > MAX_RENDER_PAGE_PIXELS:
            raise DrawingSkillError(
                f"drawings.pdf page {page_number} is too large to rasterize"
            )
        total_pixels += page_pixels
        if total_pixels > MAX_RENDER_TOTAL_PIXELS:
            raise DrawingSkillError(
                "drawings.pdf exceeds the aggregate rasterization limit"
            )

    required_scratch = (
        min(total_pixels * 4, MAX_INDEX_TOTAL_BYTES)
        + drawings.stat().st_size
        + MIN_RENDER_SCRATCH_BYTES
    )
    try:
        available_scratch = shutil.disk_usage(work_dir).free
    except OSError as exc:
        raise DrawingSkillError(
            "drawing index scratch capacity could not be checked"
        ) from exc
    if available_scratch < required_scratch:
        raise DrawingSkillError(
            "insufficient scratch space for drawing rasterization"
        )
    return page_count


def _diagnostic_tail(completed: subprocess.CompletedProcess[str]) -> str:
    combined = "\n".join(
        value.strip()
        for value in (completed.stderr, completed.stdout)
        if value and value.strip()
    )
    if not combined:
        return "no diagnostic output"
    return combined[-4_000:]


def _json_object(path: Path, *, max_bytes: int) -> dict[str, Any]:
    metadata = path.lstat()
    if path.is_symlink() or not stat.S_ISREG(metadata.st_mode):
        raise DrawingSkillError(f"{path.name} must be a non-symlink file")
    if metadata.st_size < 1 or metadata.st_size > max_bytes:
        raise DrawingSkillError(f"{path.name} has an invalid size")

    def reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise DrawingSkillError(
                    f"{path.name} contains duplicate JSON key {key!r}"
                )
            result[key] = value
        return result

    try:
        payload = json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=reject_duplicate_keys,
            parse_constant=lambda value: (_ for _ in ()).throw(
                DrawingSkillError(
                    f"{path.name} contains invalid number {value}"
                )
            ),
        )
    except DrawingSkillError:
        raise
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise DrawingSkillError(f"{path.name} is not valid UTF-8 JSON") from exc
    if not isinstance(payload, dict):
        raise DrawingSkillError(f"{path.name} must contain a JSON object")
    return payload


def _relative_asset_path(value: object, *, field: str) -> Path:
    if not isinstance(value, str) or not value.strip() or "\x00" in value:
        raise DrawingSkillError(f"manifest {field} must be a relative path")
    normalized = value.replace("\\", "/")
    posix = PurePosixPath(normalized)
    windows = PureWindowsPath(value)
    if (
        posix.is_absolute()
        or windows.is_absolute()
        or windows.drive
        or any(part in {"", ".", ".."} for part in posix.parts)
    ):
        raise DrawingSkillError(f"manifest {field} escapes the index")
    return Path(*posix.parts)


def _require_index_file(
    root: Path,
    relative: Path,
    *,
    max_bytes: int,
    label: str,
    allow_empty: bool = False,
) -> Path:
    resolved_root = _require_directory(root, label="drawing index")
    candidate = resolved_root / relative
    current = resolved_root
    for part in relative.parts[:-1]:
        current = current / part
        _require_directory(current, label=f"{label} parent")
    try:
        metadata = candidate.lstat()
    except FileNotFoundError as exc:
        raise DrawingSkillError(f"{label} is missing") from exc
    if candidate.is_symlink() or not stat.S_ISREG(metadata.st_mode):
        raise DrawingSkillError(f"{label} must be a non-symlink regular file")
    resolved = candidate.resolve(strict=True)
    if not resolved.is_relative_to(resolved_root):
        raise DrawingSkillError(f"{label} resolves outside the index")
    minimum_bytes = 0 if allow_empty else 1
    if metadata.st_size < minimum_bytes or metadata.st_size > max_bytes:
        raise DrawingSkillError(f"{label} has an invalid or excessive size")
    return resolved


def _validate_index_tree(index_dir: Path) -> None:
    resolved = _require_directory(index_dir, label="drawing index")
    file_count = 0
    total_bytes = 0
    for candidate in resolved.rglob("*"):
        metadata = candidate.lstat()
        if candidate.is_symlink():
            raise DrawingSkillError("drawing index contains a symlink")
        if stat.S_ISDIR(metadata.st_mode):
            continue
        if not stat.S_ISREG(metadata.st_mode):
            raise DrawingSkillError("drawing index contains a special file")
        file_count += 1
        total_bytes += metadata.st_size
        if file_count > MAX_INDEX_FILES:
            raise DrawingSkillError("drawing index contains too many files")
        if total_bytes > MAX_INDEX_TOTAL_BYTES:
            raise DrawingSkillError("drawing index exceeds its size limit")


def _validated_job_layout(index_dir: Path) -> tuple[Path, Path, Path]:
    resolved_index = _require_directory(index_dir, label="drawing index")
    work_dir = _require_directory(resolved_index.parent, label="job work directory")
    if resolved_index.name != INDEX_RELATIVE.name or work_dir.name != "work":
        raise DrawingSkillError(
            "drawing index must be the exact job work/drawing-index directory"
        )
    job_dir = _require_directory(work_dir.parent, label="job directory")
    inputs_dir = _require_directory(job_dir / "inputs", label="job inputs directory")
    skill_dir = _require_directory(
        job_dir / SKILL_INSTALL_RELATIVE,
        label="job-local drawing skill",
    )
    return job_dir, inputs_dir, skill_dir


def _strict_manifest_and_database(
    index_dir: Path,
    *,
    expected_source_sha256: str | None,
) -> tuple[dict[str, int], list[str], str, int]:
    _validate_index_tree(index_dir)
    _job_dir, inputs_dir, _skill_dir = _validated_job_layout(index_dir)
    drawings = require_regular_file(
        inputs_dir / "drawings.pdf",
        allowed_parent=inputs_dir,
        max_bytes=MAX_PDF_BYTES,
        magic=b"%PDF-",
    )
    actual_source_sha256 = _sha256_file(drawings)
    if expected_source_sha256 is not None and not hmac.compare_digest(
        actual_source_sha256, expected_source_sha256
    ):
        raise DrawingSkillError("drawing source SHA-256 changed after preprocessing")

    manifest_path = _require_index_file(
        index_dir,
        Path("manifest.json"),
        max_bytes=MAX_JSON_BYTES,
        label="drawing index manifest",
    )
    _require_index_file(
        index_dir,
        Path("DRAWINGS.md"),
        max_bytes=MAX_INDEX_TEXT_BYTES,
        label="drawing index register",
    )
    _require_index_file(
        index_dir,
        Path("wiki") / "index.md",
        max_bytes=MAX_INDEX_TEXT_BYTES,
        label="drawing index wiki",
    )
    database_path = _require_index_file(
        index_dir,
        Path("drawings.db"),
        max_bytes=MAX_INDEX_DATABASE_BYTES,
        label="drawing index database",
    )
    manifest = _json_object(manifest_path, max_bytes=MAX_JSON_BYTES)
    if manifest.get("output_directory") != str(index_dir.resolve(strict=True)):
        raise DrawingSkillError("manifest output_directory does not match the index")

    sources = manifest.get("sources")
    pages = manifest.get("pages")
    errors = manifest.get("errors")
    if not isinstance(sources, list) or len(sources) != 1:
        raise DrawingSkillError("manifest must contain exactly one source PDF")
    if not isinstance(pages, list) or not 1 <= len(pages) <= MAX_INDEX_PAGES:
        raise DrawingSkillError("manifest contains an invalid page list")
    if not isinstance(errors, list) or len(errors) > MAX_WARNING_COUNT:
        raise DrawingSkillError("manifest contains an invalid warnings list")
    manifest_warnings: list[str] = []
    for warning in errors:
        if not isinstance(warning, str) or len(warning) > MAX_WARNING_CHARS:
            raise DrawingSkillError("manifest contains an invalid warning")
        manifest_warnings.append(warning)

    source = sources[0]
    if not isinstance(source, dict):
        raise DrawingSkillError("manifest source entry must be an object")
    source_hash = source.get("sha256")
    source_pages = source.get("page_count")
    source_path = source.get("path")
    if not isinstance(source_hash, str) or not SHA256_PATTERN.fullmatch(source_hash):
        raise DrawingSkillError("manifest source SHA-256 is invalid")
    if not hmac.compare_digest(source_hash, actual_source_sha256):
        raise DrawingSkillError("manifest source SHA-256 does not match drawings.pdf")
    if (
        isinstance(source_pages, bool)
        or not isinstance(source_pages, int)
        or source_pages != len(pages)
    ):
        raise DrawingSkillError("manifest source page count is invalid")
    if source.get("filename") != drawings.name:
        raise DrawingSkillError("manifest source filename is invalid")
    if not isinstance(source_path, str):
        raise DrawingSkillError("manifest source path is invalid")
    try:
        recorded_source = Path(source_path).resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise DrawingSkillError("manifest source path cannot be resolved") from exc
    if recorded_source != drawings:
        raise DrawingSkillError("manifest source path is outside the job input")

    page_assets: dict[int, tuple[str, str, str, str]] = {}
    for page in pages:
        if not isinstance(page, dict):
            raise DrawingSkillError("manifest page entry must be an object")
        page_number = page.get("source_page")
        if (
            isinstance(page_number, bool)
            or not isinstance(page_number, int)
            or not 1 <= page_number <= source_pages
            or page_number in page_assets
        ):
            raise DrawingSkillError("manifest contains an invalid source page")
        if page.get("filename") != drawings.name:
            raise DrawingSkillError("manifest page filename is invalid")
        extraction_mode = page.get("extraction_mode")
        if extraction_mode not in EXTRACTION_MODES:
            raise DrawingSkillError("manifest extraction mode is invalid")

        text_relative = _relative_asset_path(
            page.get("text_path"), field="text_path"
        )
        words_relative = _relative_asset_path(
            page.get("words_path"), field="words_path"
        )
        image_relative = _relative_asset_path(
            page.get("image_path"), field="image_path"
        )
        text_path = _require_index_file(
            index_dir,
            text_relative,
            max_bytes=MAX_INDEX_TEXT_BYTES,
            label=f"page {page_number} text",
            allow_empty=extraction_mode == "image-only",
        )
        words_path = _require_index_file(
            index_dir,
            words_relative,
            max_bytes=MAX_JSON_BYTES,
            label=f"page {page_number} words",
        )
        image_path = _require_index_file(
            index_dir,
            image_relative,
            max_bytes=MAX_INDEX_IMAGE_BYTES,
            label=f"page {page_number} image",
        )
        if image_path.suffix.lower() != ".png":
            raise DrawingSkillError("manifest page image must be PNG")
        with image_path.open("rb") as image_handle:
            if image_handle.read(8) != b"\x89PNG\r\n\x1a\n":
                raise DrawingSkillError("manifest page image has invalid content")
        words = _json_object(words_path, max_bytes=MAX_JSON_BYTES)
        if words.get("source_page") != page_number:
            raise DrawingSkillError("positioned words source page is invalid")
        if words.get("source_pdf") != str(drawings):
            raise DrawingSkillError("positioned words source path is invalid")
        for dimension in ("page_width_points", "page_height_points"):
            value = words.get(dimension)
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(float(value))
                or float(value) <= 0
            ):
                raise DrawingSkillError(
                    f"positioned words {dimension} is invalid"
                )
        if not isinstance(words.get("words"), list):
            raise DrawingSkillError("positioned words list is invalid")
        page_assets[page_number] = (
            str(text_relative),
            str(words_relative),
            str(image_relative),
            str(extraction_mode),
        )
    if set(page_assets) != set(range(1, source_pages + 1)):
        raise DrawingSkillError("manifest page sequence is incomplete")

    uri_path = quote(database_path.as_posix(), safe="/:")
    try:
        connection = sqlite3.connect(
            f"file:{uri_path}?mode=ro&immutable=1",
            uri=True,
        )
        connection.execute("PRAGMA query_only = ON")
        connection.execute("PRAGMA trusted_schema = OFF")
        integrity = connection.execute("PRAGMA integrity_check").fetchone()
        if not integrity or integrity[0] != "ok":
            raise DrawingSkillError("drawing index database integrity check failed")
        if connection.execute("PRAGMA foreign_key_check").fetchone() is not None:
            raise DrawingSkillError("drawing index database has foreign-key errors")
        required_tables = {
            "metadata",
            "source_files",
            "sheets",
            "evidence",
            "objects",
            "facts",
            "relationships",
            "wiki_topics",
            "wiki_entries",
            "unresolved_references",
            "conflicts",
        }
        observed_tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_schema WHERE type='table'"
            )
        }
        if not required_tables.issubset(observed_tables):
            raise DrawingSkillError("drawing index database schema is incomplete")
        schema_version = connection.execute(
            "SELECT value FROM metadata WHERE key='schema_version'"
        ).fetchone()
        if schema_version != ("1",):
            raise DrawingSkillError("drawing index schema version is unsupported")
        database_output = connection.execute(
            "SELECT value FROM metadata WHERE key='output_directory'"
        ).fetchone()
        if database_output != (str(index_dir.resolve(strict=True)),):
            raise DrawingSkillError(
                "database output_directory does not match the index"
            )

        database_sources = connection.execute(
            "SELECT path, filename, sha256, page_count FROM source_files"
        ).fetchall()
        if database_sources != [
            (str(drawings), drawings.name, actual_source_sha256, source_pages)
        ]:
            raise DrawingSkillError("database source record is invalid")
        database_pages = connection.execute(
            """
            SELECT source_page, text_path, words_path, image_path,
                   extraction_mode
            FROM sheets
            ORDER BY source_page
            """
        ).fetchall()
        expected_pages = [
            (page, *page_assets[page]) for page in range(1, source_pages + 1)
        ]
        if database_pages != expected_pages:
            raise DrawingSkillError(
                "database sheet assets do not match the manifest"
            )

        def scalar(query: str) -> int:
            row = connection.execute(query).fetchone()
            if row is None:
                raise DrawingSkillError("drawing index database query failed")
            return int(row[0])

        counts = {
            "source_count": scalar("SELECT COUNT(*) FROM source_files"),
            "page_count": scalar("SELECT COUNT(*) FROM sheets"),
            "pending_pages": scalar(
                "SELECT COUNT(*) FROM sheets WHERE review_status='pending'"
            ),
            "text_reviewed_pages": scalar(
                "SELECT COUNT(*) FROM sheets "
                "WHERE review_status='text-reviewed'"
            ),
            "visually_reviewed_pages": scalar(
                "SELECT COUNT(*) FROM sheets "
                "WHERE review_status='visually-reviewed'"
            ),
            "image_only_pages": scalar(
                "SELECT COUNT(*) FROM sheets "
                "WHERE extraction_mode='image-only'"
            ),
            "unknown_revision_pages": scalar(
                """
                SELECT COUNT(*) FROM sheets
                WHERE COALESCE(TRIM(revision), '') = ''
                  AND COALESCE(TRIM(issue_status), '') = ''
                """
            ),
            "object_count": scalar("SELECT COUNT(*) FROM objects"),
            "fact_count": scalar("SELECT COUNT(*) FROM facts"),
            "evidence_count": scalar("SELECT COUNT(*) FROM evidence"),
            "low_confidence_facts": scalar(
                "SELECT COUNT(*) FROM facts WHERE confidence='low'"
            ),
            "unverified_facts": scalar(
                """
                SELECT COUNT(*)
                FROM facts f
                JOIN evidence e ON e.id=f.evidence_id
                WHERE e.visual_checked=0
                """
            ),
            "open_references": scalar(
                "SELECT COUNT(*) FROM unresolved_references "
                "WHERE status='open'"
            ),
            "open_conflicts": scalar(
                "SELECT COUNT(*) FROM conflicts WHERE status='open'"
            ),
        }
    except DrawingSkillError:
        raise
    except sqlite3.Error as exc:
        raise DrawingSkillError("drawing index database is malformed") from exc
    finally:
        if "connection" in locals():
            connection.close()

    if (
        counts["pending_pages"]
        + counts["text_reviewed_pages"]
        + counts["visually_reviewed_pages"]
        != counts["page_count"]
    ):
        raise DrawingSkillError("drawing index review counts do not reconcile")
    return counts, manifest_warnings, actual_source_sha256, source_pages


def _validator_warnings(completed: subprocess.CompletedProcess[str]) -> list[str]:
    warnings: list[str] = []
    for stream in (completed.stderr, completed.stdout):
        for line in (stream or "").splitlines():
            stripped = line.strip()
            if stripped.startswith("WARNING:"):
                warning = stripped.removeprefix("WARNING:").strip()
                if warning and warning not in warnings:
                    warnings.append(warning[:MAX_WARNING_CHARS])
    return warnings


def validate_drawing_index(
    index_or_dir: DrawingSkillIndex | Path,
    *,
    timeout_seconds: int = 300,
) -> DrawingIndexValidation:
    timeout = _require_timeout(timeout_seconds)
    if isinstance(index_or_dir, DrawingSkillIndex):
        index_dir = index_or_dir.index_dir
        expected_source_sha256 = index_or_dir.source_sha256
    else:
        index_dir = Path(index_or_dir)
        expected_source_sha256 = None
    index_dir = _require_directory(index_dir, label="drawing index")
    _job_dir, _inputs_dir, skill_dir = _validated_job_layout(index_dir)
    validate_skill_bundle(skill_dir)
    counts, manifest_warnings, source_hash, source_pages = (
        _strict_manifest_and_database(
            index_dir,
            expected_source_sha256=expected_source_sha256,
        )
    )
    if isinstance(index_or_dir, DrawingSkillIndex):
        if source_pages != index_or_dir.source_page_count:
            raise DrawingSkillError("drawing source page count changed")
        if not hmac.compare_digest(source_hash, index_or_dir.source_sha256):
            raise DrawingSkillError("drawing source hash changed")

    validator = skill_dir / "scripts" / "validate_index.py"
    completed = _run_bounded(
        [sys.executable, str(validator), str(index_dir)],
        cwd=index_dir.parent,
        timeout_seconds=timeout,
        label="drawing index validation",
    )
    if completed.returncode not in {0, 1}:
        raise DrawingSkillError(
            "drawing index validator failed with exit status "
            f"{completed.returncode}: {_diagnostic_tail(completed)}"
        )
    warnings = list(manifest_warnings)
    for warning in _validator_warnings(completed):
        if warning not in warnings:
            warnings.append(warning)
    return DrawingIndexValidation(
        validator_exit_code=completed.returncode,
        warnings=tuple(warnings),
        **counts,
    )


def _evidence_bbox(
    raw_value: object,
    *,
    label: str,
) -> tuple[float, float, float, float]:
    if not isinstance(raw_value, str) or not raw_value.strip():
        raise DrawingSkillError(f"{label} is missing bbox_json")

    def reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise DrawingSkillError(
                    f"{label} bbox_json contains duplicate key {key!r}"
                )
            result[key] = value
        return result

    try:
        payload = json.loads(
            raw_value,
            object_pairs_hook=reject_duplicate_keys,
            parse_constant=lambda value: (_ for _ in ()).throw(
                DrawingSkillError(
                    f"{label} bbox_json contains invalid number {value}"
                )
            ),
        )
    except DrawingSkillError:
        raise
    except (TypeError, json.JSONDecodeError) as exc:
        raise DrawingSkillError(f"{label} bbox_json is invalid") from exc
    if not isinstance(payload, dict):
        raise DrawingSkillError(f"{label} bbox_json must be an object")
    if "bbox" in payload:
        payload = payload["bbox"]
        if not isinstance(payload, dict):
            raise DrawingSkillError(f"{label} bbox_json bbox must be an object")

    coordinates: list[float] = []
    for key in ("x0", "y0", "x1", "y1"):
        value = payload.get(key)
        if (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(float(value))
            or float(value) < 0
            or float(value) > 10_000_000
        ):
            raise DrawingSkillError(
                f"{label} bbox_json contains invalid {key}"
            )
        coordinates.append(float(value))
    x0, y0, x1, y1 = coordinates
    if x1 < x0 or y1 < y0:
        raise DrawingSkillError(f"{label} bbox_json has inverted bounds")
    return x0, y0, x1, y1


def _geometry_bbox(asset: TakeoffAsset) -> tuple[float, float, float, float]:
    if asset.bbox is not None:
        return (
            float(asset.bbox.x0),
            float(asset.bbox.y0),
            float(asset.bbox.x1),
            float(asset.bbox.y1),
        )
    if asset.x is not None and asset.y is not None:
        return float(asset.x), float(asset.y), float(asset.x), float(asset.y)
    if asset.path:
        xs = [float(point.x) for point in asset.path]
        ys = [float(point.y) for point in asset.path]
        return min(xs), min(ys), max(xs), max(ys)
    raise DrawingSkillError(f"{asset.unit_id} has no indexable geometry")


def _bbox_matches(
    raw_value: object,
    expected: tuple[float, float, float, float],
    *,
    label: str,
) -> bool:
    observed = _evidence_bbox(raw_value, label=label)
    return all(
        math.isclose(
            actual,
            required,
            rel_tol=1e-9,
            abs_tol=EVIDENCE_BBOX_TOLERANCE,
        )
        for actual, required in zip(observed, expected)
    )


def validate_takeoff_index_alignment(
    index_or_dir: DrawingSkillIndex | Path,
    takeoff: TakeoffDocument,
) -> DrawingIndexAlignment:
    if not isinstance(takeoff, TakeoffDocument):
        raise DrawingSkillError("takeoff must be a validated TakeoffDocument")
    if isinstance(index_or_dir, DrawingSkillIndex):
        index_dir = index_or_dir.index_dir
        expected_source_sha256 = index_or_dir.source_sha256
    else:
        index_dir = Path(index_or_dir)
        expected_source_sha256 = takeoff.source.sha256
    index_dir = _require_directory(index_dir, label="drawing index")
    _counts, _warnings, source_hash, source_pages = (
        _strict_manifest_and_database(
            index_dir,
            expected_source_sha256=expected_source_sha256,
        )
    )
    if (
        not hmac.compare_digest(source_hash, takeoff.source.sha256)
        or source_pages != takeoff.source.page_count
    ):
        raise DrawingSkillError(
            "drawing index source does not match the validated takeoff"
        )

    legend_keys = {
        entry.legend_entry_id: f"legend.{entry.legend_entry_id}"
        for entry in takeoff.legend_entries
    }
    asset_keys = {
        asset.unit_id: f"asset.{asset.unit_id}" for asset in takeoff.assets
    }
    database_path = index_dir / "drawings.db"
    uri_path = quote(database_path.resolve(strict=True).as_posix(), safe="/:")
    try:
        connection = sqlite3.connect(
            f"file:{uri_path}?mode=ro&immutable=1",
            uri=True,
        )
        connection.execute("PRAGMA query_only = ON")
        connection.execute("PRAGMA trusted_schema = OFF")
        object_rows = connection.execute(
            "SELECT id, canonical_key FROM objects"
        ).fetchall()
        object_ids = {
            str(canonical_key): int(object_id)
            for object_id, canonical_key in object_rows
        }

        missing_legends = sorted(set(legend_keys.values()) - set(object_ids))
        if missing_legends:
            raise DrawingSkillError(
                "drawing index is missing canonical legend object(s): "
                + ", ".join(missing_legends[:20])
            )
        missing_assets = sorted(set(asset_keys.values()) - set(object_ids))
        if missing_assets:
            raise DrawingSkillError(
                "drawing index is missing canonical asset object(s): "
                + ", ".join(missing_assets[:20])
            )

        legend_fact_rows = connection.execute(
            """
            SELECT o.canonical_key, f.raw_value, f.method,
                   e.evidence_kind, e.bbox_json, e.visual_checked,
                   s.source_page, s.sheet_number
            FROM facts f
            JOIN objects o ON o.id=f.object_id
            JOIN evidence e ON e.id=f.evidence_id
            JOIN sheets s ON s.id=e.sheet_id
            WHERE f.property='legend_code'
            """
        ).fetchall()
        legend_facts: dict[str, list[tuple[object, ...]]] = {}
        for row in legend_fact_rows:
            legend_facts.setdefault(str(row[0]), []).append(tuple(row[1:]))
        for entry in takeoff.legend_entries:
            legend_key = legend_keys[entry.legend_entry_id]
            expected_bbox = (
                float(entry.bbox.x0),
                float(entry.bbox.y0),
                float(entry.bbox.x1),
                float(entry.bbox.y1),
            )
            matching_legend_facts = []
            for row in legend_facts.get(legend_key, []):
                (
                    raw_value,
                    method,
                    evidence_kind,
                    bbox_json,
                    visual_checked,
                    source_page,
                    sheet_number,
                ) = row
                bbox_aligned = _bbox_matches(
                    bbox_json,
                    expected_bbox,
                    label=f"{legend_key} legend evidence",
                )
                if (
                    raw_value == entry.code
                    and method == "explicit"
                    and evidence_kind == "legend"
                    and visual_checked == 1
                    and source_page == entry.page
                    and sheet_number == entry.sheet
                    and bbox_aligned
                ):
                    matching_legend_facts.append(row)
            if not matching_legend_facts:
                raise DrawingSkillError(
                    "drawing index has no source-backed, bbox-aligned "
                    f"legend_code fact for {legend_key}"
                )

        quantity_rows = connection.execute(
            """
            SELECT o.canonical_key, f.numeric_value, f.normalized_unit,
                   e.visual_checked, s.source_page, s.sheet_number,
                   e.id, e.bbox_json
            FROM facts f
            JOIN objects o ON o.id=f.object_id
            JOIN evidence e ON e.id=f.evidence_id
            JOIN sheets s ON s.id=e.sheet_id
            WHERE f.property='quantity'
            """
        ).fetchall()
        quantities_by_asset: dict[str, list[tuple[object, ...]]] = {}
        for (
            canonical_key,
            numeric_value,
            normalized_unit,
            visual_checked,
            source_page,
            sheet_number,
            evidence_id,
            bbox_json,
        ) in quantity_rows:
            quantities_by_asset.setdefault(str(canonical_key), []).append(
                (
                    numeric_value,
                    normalized_unit,
                    visual_checked,
                    source_page,
                    sheet_number,
                    evidence_id,
                    bbox_json,
                )
            )

        relationship_rows = connection.execute(
            """
            SELECT source.canonical_key, target.canonical_key,
                   r.evidence_id, s.source_page, s.sheet_number
            FROM relationships r
            JOIN objects source ON source.id=r.source_object_id
            JOIN objects target ON target.id=r.target_object_id
            LEFT JOIN evidence e ON e.id=r.evidence_id
            LEFT JOIN sheets s ON s.id=e.sheet_id
            WHERE r.relationship_type='instance-of'
            """
        ).fetchall()
        relationships = {
            (
                str(source_key),
                str(target_key),
                evidence_id,
                source_page,
                sheet_number,
            )
            for (
                source_key,
                target_key,
                evidence_id,
                source_page,
                sheet_number,
            ) in relationship_rows
        }

        matched_facts = 0
        matched_relationships = 0
        for asset in takeoff.assets:
            asset_key = asset_keys[asset.unit_id]
            expected_bbox = _geometry_bbox(asset)
            matching_facts = []
            for row in quantities_by_asset.get(asset_key, []):
                bbox_aligned = _bbox_matches(
                    row[6],
                    expected_bbox,
                    label=f"{asset_key} quantity evidence",
                )
                if (
                    not isinstance(row[0], bool)
                    and isinstance(row[0], (int, float))
                    and math.isfinite(float(row[0]))
                    and math.isclose(
                        float(row[0]),
                        asset.quantity,
                        rel_tol=1e-9,
                        abs_tol=1e-6,
                    )
                    and row[1] == asset.unit
                    and row[2] == 1
                    and row[3] == asset.page
                    and row[4] == asset.sheet
                    and bbox_aligned
                ):
                    matching_facts.append(row)
            if not matching_facts:
                raise DrawingSkillError(
                    "drawing index has no source-backed, bbox-aligned "
                    "quantity fact/evidence "
                    f"for {asset_key}"
                )
            matched_facts += 1
            matching_evidence_ids = {row[5] for row in matching_facts}

            legend_key = legend_keys[asset.legend_entry_id]
            if not any(
                source_key == asset_key
                and target_key == legend_key
                and evidence_id in matching_evidence_ids
                and source_page == asset.page
                and sheet_number == asset.sheet
                for (
                    source_key,
                    target_key,
                    evidence_id,
                    source_page,
                    sheet_number,
                ) in relationships
            ):
                raise DrawingSkillError(
                    f"drawing index has no evidenced instance-of relationship "
                    f"from {asset_key} to {legend_key}"
                )
            matched_relationships += 1
    except DrawingSkillError:
        raise
    except sqlite3.Error as exc:
        raise DrawingSkillError(
            "drawing index alignment query failed"
        ) from exc
    finally:
        if "connection" in locals():
            connection.close()

    return DrawingIndexAlignment(
        legend_objects=len(legend_keys),
        asset_objects=len(asset_keys),
        quantity_facts=matched_facts,
        instance_relationships=matched_relationships,
    )


def _normalize_output_directory(index_dir: Path) -> None:
    manifest_path = index_dir / "manifest.json"
    manifest = _json_object(manifest_path, max_bytes=MAX_JSON_BYTES)
    manifest["output_directory"] = str(index_dir.resolve(strict=True))
    replacement = index_dir / f".manifest-{uuid.uuid4().hex}.json"
    descriptor = os.open(
        replacement,
        os.O_WRONLY
        | os.O_CREAT
        | os.O_EXCL
        | getattr(os, "O_NOFOLLOW", 0),
        0o600,
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            descriptor = -1
            json.dump(manifest, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(replacement, manifest_path)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        replacement.unlink(missing_ok=True)

    database_path = index_dir / "drawings.db"
    try:
        connection = sqlite3.connect(database_path)
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute(
            "INSERT OR REPLACE INTO metadata(key, value) VALUES (?, ?)",
            ("output_directory", str(index_dir.resolve(strict=True))),
        )
        connection.commit()
    except sqlite3.Error as exc:
        raise DrawingSkillError(
            "could not normalize drawing index output metadata"
        ) from exc
    finally:
        if "connection" in locals():
            connection.close()


def prepare_drawing_index(
    *,
    job_dir: Path,
    drawings_path: Path,
    expected_sha256: str,
    python_executable: str | None = None,
    timeout_seconds: int = 1_800,
    dpi: int = 180,
    ocr: str = "auto",
) -> DrawingSkillIndex:
    timeout = _require_timeout(timeout_seconds)
    if not isinstance(expected_sha256, str):
        raise DrawingSkillError("expected_sha256 must be a SHA-256 string")
    expected_sha256 = expected_sha256.strip().lower()
    if not SHA256_PATTERN.fullmatch(expected_sha256):
        raise DrawingSkillError("expected_sha256 must be a lowercase SHA-256")
    if isinstance(dpi, bool) or not isinstance(dpi, int) or not 72 <= dpi <= 600:
        raise DrawingSkillError("dpi must be an integer between 72 and 600")
    if ocr not in {"auto", "always", "never"}:
        raise DrawingSkillError("ocr must be auto, always, or never")

    resolved_job = _require_directory(Path(job_dir), label="job directory")
    inputs_dir = _require_directory(
        resolved_job / "inputs", label="job inputs directory"
    )
    work_dir = _require_directory(resolved_job / "work", label="job work directory")
    drawings = require_regular_file(
        Path(drawings_path),
        allowed_parent=inputs_dir,
        max_bytes=MAX_PDF_BYTES,
        magic=b"%PDF-",
    )
    source_hash = _sha256_file(drawings)
    if not hmac.compare_digest(source_hash, expected_sha256):
        raise DrawingSkillError("drawing source SHA-256 does not match the job")
    preflight_page_count = _preflight_drawing_render(
        drawings,
        work_dir=work_dir,
        dpi=dpi,
    )

    final_index = work_dir / INDEX_RELATIVE.name
    if final_index.exists() or final_index.is_symlink():
        raise DrawingSkillError("drawing index destination must be fresh")
    skill_dir, skill_hash = _stage_skill(resolved_job)
    staging = _fresh_direct_child_directory(
        work_dir,
        ".drawing-index-staging-",
        label="drawing index staging directory",
    )
    created_final = False
    try:
        _require_renderable_staging_path(
            staging,
            source_sha256=source_hash,
        )
        executable = str(Path(python_executable).resolve(strict=True)) if (
            python_executable
        ) else sys.executable
        preparer = skill_dir / "scripts" / "prepare_drawings.py"
        completed = _run_bounded(
            [
                executable,
                str(preparer),
                str(drawings),
                "--output",
                str(staging),
                "--dpi",
                str(dpi),
                "--ocr",
                ocr,
            ],
            cwd=resolved_job,
            timeout_seconds=timeout,
            label="drawing skill preprocessing",
        )
        if completed.returncode != 0:
            raise DrawingSkillError(
                "drawing skill preprocessing failed with exit status "
                f"{completed.returncode}: {_diagnostic_tail(completed)}"
            )
        if final_index.exists() or final_index.is_symlink():
            raise DrawingSkillError("drawing index destination is no longer fresh")
        os.replace(staging, final_index)
        created_final = True
        _normalize_output_directory(final_index)
        validation = validate_drawing_index(
            final_index,
            timeout_seconds=min(timeout, 300),
        )
        if validation.page_count != preflight_page_count:
            raise DrawingSkillError(
                "drawing index page count changed after rasterization"
            )
        result = DrawingSkillIndex(
            index_dir=final_index.resolve(strict=True),
            skill_dir=skill_dir,
            manifest_path=(final_index / "manifest.json").resolve(strict=True),
            database_path=(final_index / "drawings.db").resolve(strict=True),
            drawings_markdown_path=(final_index / "DRAWINGS.md").resolve(
                strict=True
            ),
            source_sha256=source_hash,
            source_page_count=validation.page_count,
            skill_sha256=skill_hash,
            validation=validation,
        )
        return result
    except Exception:
        if created_final:
            _safe_remove_owned_tree(final_index, parent=work_dir)
        else:
            _safe_remove_owned_tree(staging, parent=work_dir)
        raise
