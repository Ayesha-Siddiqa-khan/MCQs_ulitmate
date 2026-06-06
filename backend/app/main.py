"""FastAPI app entry point."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import dashboard, materials, mistakes, question_sets, quiz_attempts
from app.api.routes import settings as settings_routes
from app.core.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s")
log = logging.getLogger("mcq-mentor")


def create_app() -> FastAPI:
    cfg = get_settings()
    app = FastAPI(
        title="MCQ Mentor API",
        version="0.1.0",
        description="Backend for the student MCQ practice & learning-loop platform.",
        docs_url="/docs",
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        log.exception("unhandled error on %s %s", request.method, request.url)
        return JSONResponse(status_code=500, content={"detail": "internal server error"})

    @app.get("/healthz", tags=["meta"])
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/", tags=["meta"])
    async def root() -> dict[str, str]:
        return {"name": "MCQ Mentor API", "docs": "/docs"}

    app.include_router(settings_routes.router)
    app.include_router(materials.router)
    app.include_router(question_sets.router)
    app.include_router(quiz_attempts.router)
    app.include_router(mistakes.router)
    app.include_router(dashboard.router)

    return app


app = create_app()
