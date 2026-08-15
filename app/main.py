from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import close_mongodb_connection, connect_to_mongodb
from app.routes.api import api_router
from app.services.auth_sessions import ensure_auth_session_indexes


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Manage application startup and shutdown lifecycle events."""
    await connect_to_mongodb()
    await ensure_auth_session_indexes()
    yield
    await close_mongodb_connection()


def create_app() -> FastAPI:
    """Application factory for the events management API."""
    application = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(api_router)

    return application


app = create_app()
