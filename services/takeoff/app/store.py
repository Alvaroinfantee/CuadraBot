from __future__ import annotations

import json
import os
import shutil
import stat
import threading
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .models import JobRecord, JobStatus


class JobStore:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()

    def job_dir(self, job_id: str) -> Path:
        path = (self.root / job_id).resolve()
        if path.parent != self.root.resolve():
            raise ValueError("Invalid job id")
        return path

    def create(self, record: JobRecord) -> Path:
        with self._lock:
            job_dir = self.job_dir(record.id)
            (job_dir / "inputs").mkdir(parents=True, exist_ok=False)
            (job_dir / "work").mkdir()
            (job_dir / "artifacts").mkdir()
            self.save(record)
            return job_dir

    def save(self, record: JobRecord) -> None:
        with self._lock:
            job_dir = self.job_dir(record.id)
            job_dir.mkdir(parents=True, exist_ok=True)
            target = job_dir / "job.json"
            temporary = job_dir / f".job-{uuid.uuid4().hex}.tmp"
            payload = (
                json.dumps(
                    record.model_dump(mode="json"),
                    indent=2,
                    ensure_ascii=False,
                )
                + "\n"
            )
            descriptor = os.open(
                temporary,
                os.O_WRONLY | os.O_CREAT | os.O_EXCL
                | getattr(os, "O_NOFOLLOW", 0),
                0o600,
            )
            try:
                with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                    handle.write(payload)
                    handle.flush()
                    os.fsync(handle.fileno())
                os.replace(temporary, target)
            finally:
                temporary.unlink(missing_ok=True)

    def load(self, job_id: str) -> JobRecord:
        target = self.job_dir(job_id) / "job.json"
        try:
            metadata = target.lstat()
        except FileNotFoundError:
            raise FileNotFoundError(job_id)
        if target.is_symlink() or not stat.S_ISREG(metadata.st_mode):
            raise ValueError("Invalid job record")
        return JobRecord.model_validate_json(
            target.read_text(encoding="utf-8")
        )

    def update(self, job_id: str, **changes: object) -> JobRecord:
        with self._lock:
            record = self.load(job_id)
            updated = record.model_copy(update=changes)
            self.save(updated)
            return updated

    def list_records(
        self, statuses: set[JobStatus] | None = None
    ) -> list[JobRecord]:
        records: list[JobRecord] = []
        with self._lock:
            for child in sorted(self.root.iterdir()):
                if child.is_symlink() or not child.is_dir():
                    continue
                try:
                    record = self.load(child.name)
                except (FileNotFoundError, ValueError):
                    continue
                if statuses is None or record.status in statuses:
                    records.append(record)
        return records

    def delete(self, job_id: str) -> None:
        with self._lock:
            job_dir = self.job_dir(job_id)
            if job_dir.is_symlink() or not job_dir.is_dir():
                raise FileNotFoundError(job_id)
            if not (job_dir / "job.json").is_file():
                raise FileNotFoundError(job_id)
            shutil.rmtree(job_dir)

    def cleanup_expired(
        self,
        retention_days: int,
        *,
        now: datetime | None = None,
    ) -> list[str]:
        cutoff = (now or datetime.now(timezone.utc)) - timedelta(
            days=retention_days
        )
        deleted: list[str] = []
        terminal = {JobStatus.completed, JobStatus.failed}
        for record in self.list_records(terminal):
            timestamp = record.completed_at or record.created_at
            try:
                finished = datetime.fromisoformat(timestamp)
            except ValueError:
                continue
            if finished.tzinfo is None:
                finished = finished.replace(tzinfo=timezone.utc)
            if finished < cutoff:
                self.delete(record.id)
                deleted.append(record.id)
        return deleted
