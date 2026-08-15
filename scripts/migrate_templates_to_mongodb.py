import asyncio
import sys
from pathlib import Path

# Add the project root to the Python path so "app" can be found
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.data.templates import TEMPLATE_LIBRARY
from app.core.config import settings

async def migrate():
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    collection = db["flyer_templates"]

    # Clear existing custom templates (optional – comment out to keep them)
    # await collection.delete_many({})

    count = 0
    for category, templates in TEMPLATE_LIBRARY.items():
        for tpl in templates:
            # Convert each template to a dict and upsert by id
            await collection.replace_one(
                {"id": tpl.id},
                tpl.model_dump(by_alias=True),
                upsert=True,
            )
            count += 1

    print(f"Migrated {count} templates to MongoDB.")
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate())