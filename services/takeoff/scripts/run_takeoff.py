#!/usr/bin/env python3
from __future__ import annotations

import argparse
import getpass
import json
import os
import sys
import time
from pathlib import Path

import httpx
import uvicorn

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def api_key_from_environment(name: str) -> str:
    value = os.environ.get(name)
    if value:
        return value
    if sys.stdin.isatty():
        return getpass.getpass(f"{name}: ")
    raise SystemExit(
        f"{name} is not set. Export it or run interactively to enter it."
    )


def open_files(paths: list[Path]) -> list[object]:
    return [path.open("rb") for path in paths]


def submit(args: argparse.Namespace) -> None:
    drawing = args.drawings.resolve()
    paths = [drawing]
    if args.template:
        paths.append(args.template.resolve())
    if args.prices:
        paths.append(args.prices.resolve())
    handles = open_files(paths)
    try:
        index = 0
        files: dict[str, tuple[str, object, str]] = {
            "drawings_pdf": (
                drawing.name,
                handles[index],
                "application/pdf",
            )
        }
        index += 1
        if args.template:
            files["template_xlsx"] = (
                args.template.name,
                handles[index],
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            index += 1
        if args.prices:
            files["price_database_xlsx"] = (
                args.prices.name,
                handles[index],
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        headers = {
            "X-Codex-API-Key": api_key_from_environment(args.key_env)
        }
        service_token = os.environ.get(args.service_token_env)
        if service_token:
            headers["Authorization"] = f"Bearer {service_token}"
        response = httpx.post(
            f"{args.url.rstrip('/')}/v1/jobs",
            files=files,
            data={
                "instructions": args.instructions,
                "model": args.model,
            },
            headers=headers,
            timeout=None,
        )
        response.raise_for_status()
        payload = response.json()
        print(json.dumps(payload, indent=2))
        if args.wait:
            wait_for_job(
                args.url,
                payload["job_id"],
                service_token,
                args.poll_seconds,
            )
    finally:
        for handle in handles:
            handle.close()


def wait_for_job(
    url: str,
    job_id: str,
    service_token: str | None,
    poll_seconds: float,
) -> None:
    headers = (
        {"Authorization": f"Bearer {service_token}"}
        if service_token
        else {}
    )
    while True:
        response = httpx.get(
            f"{url.rstrip('/')}/v1/jobs/{job_id}",
            headers=headers,
            timeout=60,
        )
        response.raise_for_status()
        payload = response.json()
        print(
            f"{payload['status']:>9}  {payload['progress']:>3}%  "
            f"{payload['stage']}"
        )
        if payload["status"] in {"completed", "failed"}:
            print(json.dumps(payload, indent=2))
            if payload["status"] == "failed":
                raise SystemExit(1)
            return
        time.sleep(poll_seconds)


def wait_command(args: argparse.Namespace) -> None:
    wait_for_job(
        args.url,
        args.job_id,
        os.environ.get(args.service_token_env),
        args.poll_seconds,
    )


def serve(args: argparse.Namespace) -> None:
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(
        description="Run or call the drawing takeoff microservice."
    )
    subparsers = result.add_subparsers(dest="command", required=True)

    serve_parser = subparsers.add_parser("serve")
    serve_parser.add_argument("--host", default="127.0.0.1")
    serve_parser.add_argument("--port", type=int, default=8000)
    serve_parser.add_argument("--reload", action="store_true")
    serve_parser.set_defaults(func=serve)

    submit_parser = subparsers.add_parser("submit")
    submit_parser.add_argument("--url", default="http://127.0.0.1:8000")
    submit_parser.add_argument("--drawings", type=Path, required=True)
    submit_parser.add_argument("--template", type=Path)
    submit_parser.add_argument("--prices", type=Path)
    submit_parser.add_argument(
        "--instructions",
        default=(
            "Count electrical items by area, assign a unique code to every "
            "placement, preserve the template fields, and apply defensible "
            "DOP prices when the price database is supplied."
        ),
    )
    submit_parser.add_argument("--model", default="gpt-5.6-sol")
    submit_parser.add_argument("--key-env", default="CODEX_API_KEY")
    submit_parser.add_argument(
        "--service-token-env", default="TAKEOFF_SERVICE_API_TOKEN"
    )
    submit_parser.add_argument("--wait", action="store_true")
    submit_parser.add_argument("--poll-seconds", type=float, default=5)
    submit_parser.set_defaults(func=submit)

    wait_parser = subparsers.add_parser("wait")
    wait_parser.add_argument("job_id")
    wait_parser.add_argument("--url", default="http://127.0.0.1:8000")
    wait_parser.add_argument(
        "--service-token-env", default="TAKEOFF_SERVICE_API_TOKEN"
    )
    wait_parser.add_argument("--poll-seconds", type=float, default=5)
    wait_parser.set_defaults(func=wait_command)
    return result


if __name__ == "__main__":
    arguments = parser().parse_args()
    arguments.func(arguments)
