"""Vercel serverless entry point.

This thin wrapper lets Vercel's Python runtime find the FastAPI app.
The real application lives in ``app/main.py``; this file just re-exports
the ``app`` instance so Vercel can detect it at ``api/index.py``.
"""
from app.main import app  # noqa: F401
