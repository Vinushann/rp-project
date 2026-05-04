"""Compatibility package for running the backend from the repository root.

This keeps `uvicorn app.main:app` working when the process starts in the
repository root by pointing the `app` package at `backend/app`.
"""

from __future__ import annotations

from pathlib import Path

_package_dir = Path(__file__).resolve().parent
_backend_app_dir = _package_dir.parent / "backend" / "app"

__path__ = [str(_package_dir), str(_backend_app_dir)]