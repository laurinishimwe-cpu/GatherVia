from collections.abc import AsyncGenerator
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings

_client: AsyncIOMotorClient | None = None
_database: AsyncIOMotorDatabase | None = None


async def connect_to_mongodb() -> None:
    """Initialize the MongoDB client and verify connectivity."""
    global _client, _database

    _client = AsyncIOMotorClient(
        settings.mongodb_url,
        maxPoolSize=10,
        minPoolSize=1,
        serverSelectionTimeoutMS=5000,
    )
    _database = _client[settings.database_name]

    await _client.admin.command("ping")


async def close_mongodb_connection() -> None:
    """Close the MongoDB client and release connection pool resources."""
    global _client, _database

    if _client is not None:
        _client.close()
        _client = None
        _database = None


def get_database() -> AsyncIOMotorDatabase:
    """Return the active MongoDB database instance."""
    if _database is None:
        raise RuntimeError(
            "MongoDB is not initialized. Ensure the application lifespan has started."
        )
    return _database


async def get_db() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    """FastAPI dependency that yields the MongoDB database instance."""
    yield get_database()


def get_collection(name: str) -> Any:
    """Return a MongoDB collection by name."""
    return get_database()[name]
