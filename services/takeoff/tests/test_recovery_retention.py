from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.config import Settings
from app.models import JobRecord, JobStatus
from app.pipeline import PipelineManager
from app.store import JobStore


def settings(tmp_path: Path) -> Settings:
    return Settings(
        data_dir=tmp_path / "data",
        codex_bin="codex",
        default_model="gpt-5.6-sol",
        max_upload_bytes=10_000,
        max_total_upload_bytes=10_000,
        service_api_token="service-secret",
        max_workers=1,
        environment="test",
        retention_days=7,
    )


def test_restart_fails_codex_job_without_persisting_a_key(
    tmp_path: Path,
) -> None:
    configured = settings(tmp_path)
    store = JobStore(configured.data_dir / "jobs")
    job_dir = store.create(
        JobRecord(
            id="interruptedcodex",
            status=JobStatus.running,
            model=configured.default_model,
        )
    )
    (job_dir / "work" / "codex-events.jsonl").write_text(
        json.dumps(
            {
                "type": "turn.completed",
                "usage": {
                    "input_tokens": 1_000,
                    "cached_input_tokens": 200,
                    "output_tokens": 100,
                    "reasoning_output_tokens": 25,
                },
            }
        )
        + "\n",
        encoding="utf-8",
    )
    manager = PipelineManager(configured, store)

    result = manager.recover_pending()

    recovered = store.load("interruptedcodex")
    assert result == {"recovered": 0, "failed": 1}
    assert recovered.status == JobStatus.failed
    assert recovered.retriable is True
    assert recovered.error_code == "processor_restarted"
    assert recovered.processor_usage is not None
    assert recovered.processor_usage.input_tokens == 1_000
    assert recovered.processor_usage.estimated_cost_usd == 0.0071
    assert (
        recovered.processor_usage.estimated_cost_usd_all_input_uncached
        == 0.008
    )
    assert "credential" in recovered.error
    persisted = (
        configured.data_dir
        / "jobs"
        / "interruptedcodex"
        / "job.json"
    ).read_text()
    assert "api" not in persisted.lower()


def test_restart_requeues_replay_once(tmp_path: Path) -> None:
    configured = settings(tmp_path)
    store = JobStore(configured.data_dir / "jobs")
    job_dir = store.create(
        JobRecord(
            id="interruptedreplay",
            status=JobStatus.running,
            model=configured.default_model,
        )
    )
    (job_dir / "inputs" / "replay_takeoff.json").write_text(
        "{}", encoding="utf-8"
    )
    manager = PipelineManager(configured, store)
    submitted: list[tuple[str, object]] = []

    def fake_submit(record: JobRecord, **kwargs: object) -> bool:
        submitted.append((record.id, kwargs["codex_api_key"]))
        return True

    manager.submit = fake_submit
    result = manager.recover_pending()

    assert result == {"recovered": 1, "failed": 0}
    assert submitted == [("interruptedreplay", None)]
    assert store.load("interruptedreplay").stage == "recovery_queued"


def test_retention_deletes_only_expired_terminal_exact_job_dirs(
    tmp_path: Path,
) -> None:
    store = JobStore(tmp_path / "jobs")
    now = datetime.now(timezone.utc)
    old = (now - timedelta(days=8)).isoformat()
    recent = (now - timedelta(days=1)).isoformat()
    for job_id, status, completed_at in (
        ("oldcompleted", JobStatus.completed, old),
        ("recentfailed", JobStatus.failed, recent),
        ("oldrunning", JobStatus.running, old),
    ):
        store.create(
            JobRecord(
                id=job_id,
                status=status,
                model="gpt-5.6-sol",
                completed_at=completed_at,
            )
        )
    outside = tmp_path / "outside"
    outside.mkdir()
    (store.root / "malicious").symlink_to(outside, target_is_directory=True)

    deleted = store.cleanup_expired(7, now=now)

    assert deleted == ["oldcompleted"]
    assert not (store.root / "oldcompleted").exists()
    assert (store.root / "recentfailed").exists()
    assert (store.root / "oldrunning").exists()
    assert outside.exists()
