import uuid
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from fastapi import UploadFile

from app.core.database import get_collection
from app.models.canvas import CanvasLayer
from app.models.event import EventType
from app.models.flyer import FlyerConfiguration, FlyerConfigurationUpdate, FlyerRecord, QrBounds
from app.models.schemas.flyer_templates import FlyerTemplate, TemplateCategory
from app.models.user import User
from app.services.storage import (
    LOCAL_FLYER_UPLOAD_ROOT,
    delete_stored_asset,
    store_flyer_asset,
)

FLYERS_COLLECTION = "flyers"
UPLOAD_ROOT = LOCAL_FLYER_UPLOAD_ROOT


def _serialize_flyer(document: dict[str, Any]) -> FlyerRecord:
    document["_id"] = str(document["_id"])
    document["owner_id"] = str(document["owner_id"])
    if document.get("event_id"):
        document["event_id"] = str(document["event_id"])
    return FlyerRecord.model_validate(document)


async def save_flyer_upload(
    *,
    owner: User,
    upload: UploadFile,
    configuration: FlyerConfiguration,
    event_id: str | None = None,
) -> FlyerRecord:
    if owner.id is None:
        raise ValueError("Owner must have a persisted identifier.")

    suffix = upload.filename.rsplit(".", 1)[-1] if upload.filename and "." in upload.filename else "png"
    suffix = f".{suffix.lstrip('.')}"
    filename = f"{uuid.uuid4().hex}{suffix}"
    content = await upload.read()
    storage_asset = store_flyer_asset(
        owner_id=owner.id,
        filename=filename,
        content=content,
        content_type=upload.content_type,
    )
    if event_id is not None and not ObjectId.is_valid(event_id):
        raise ValueError("Event identifier is invalid.")

    payload = {
        "owner_id": ObjectId(owner.id),
        "event_id": ObjectId(event_id) if event_id else None,
        "image_filename": filename,
        "image_url": storage_asset.public_url,
        "storage_provider": storage_asset.provider,
        "storage_bucket": storage_asset.bucket,
        "storage_path": storage_asset.object_path,
        "configuration": configuration.model_dump(mode="json"),
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    result = await get_collection(FLYERS_COLLECTION).insert_one(payload)
    document = await get_collection(FLYERS_COLLECTION).find_one({"_id": result.inserted_id})
    assert document is not None
    return _serialize_flyer(document)


async def delete_event_flyer_assets(
    *,
    event_id: str,
    owner_id: str,
    primary_flyer_id: str | None,
    design_layers: list[CanvasLayer],
) -> int:
    event_object_id = ObjectId(event_id)
    owner_object_id = ObjectId(owner_id)
    clauses: list[dict[str, Any]] = [{"event_id": event_object_id}]

    if primary_flyer_id and ObjectId.is_valid(primary_flyer_id):
        clauses.append({"_id": ObjectId(primary_flyer_id)})

    image_urls = {
        layer.imageUrl
        for layer in design_layers
        if layer.type == "image" and layer.imageUrl
    }
    if image_urls:
        clauses.append({"image_url": {"$in": list(image_urls)}})

    collection = get_collection(FLYERS_COLLECTION)
    documents = await collection.find(
        {"owner_id": owner_object_id, "$or": clauses}
    ).to_list(length=None)

    for document in documents:
        delete_stored_asset(
            provider=document.get("storage_provider", "local"),
            bucket=document.get("storage_bucket"),
            object_path=document.get("storage_path")
            or f"{owner_id}/{document.get('image_filename', '')}",
        )

    if documents:
        await collection.delete_many(
            {"_id": {"$in": [document["_id"] for document in documents]}}
        )
    return len(documents)


async def get_flyer_by_id(flyer_id: str, owner_id: str | None = None) -> FlyerRecord | None:
    if not ObjectId.is_valid(flyer_id):
        return None

    query: dict[str, Any] = {"_id": ObjectId(flyer_id)}
    if owner_id is not None:
        query["owner_id"] = ObjectId(owner_id)

    document = await get_collection(FLYERS_COLLECTION).find_one(query)
    if document is None:
        return None
    return _serialize_flyer(document)


async def update_flyer_configuration(
    flyer_id: str,
    owner_id: str,
    update: FlyerConfigurationUpdate,
) -> FlyerRecord | None:
    flyer = await get_flyer_by_id(flyer_id, owner_id)
    if flyer is None:
        return None

    merged = flyer.configuration.model_dump()
    patch = update.model_dump(exclude_none=True)
    merged.update(patch)

    await get_collection(FLYERS_COLLECTION).update_one(
        {"_id": ObjectId(flyer_id), "owner_id": ObjectId(owner_id)},
        {
            "$set": {
                "configuration": merged,
                "updated_at": datetime.now(UTC),
            }
        },
    )
    return await get_flyer_by_id(flyer_id, owner_id)


async def attach_flyer_to_event(flyer_id: str, owner_id: str, event_id: str) -> FlyerRecord | None:
    if not ObjectId.is_valid(event_id):
        return None

    result = await get_collection(FLYERS_COLLECTION).update_one(
        {"_id": ObjectId(flyer_id), "owner_id": ObjectId(owner_id)},
        {
            "$set": {
                "event_id": ObjectId(event_id),
                "updated_at": datetime.now(UTC),
            }
        },
    )
    if result.matched_count == 0:
        return None
    return await get_flyer_by_id(flyer_id, owner_id)


async def attach_design_layer_flyers_to_event(
    *,
    event_id: str,
    owner_id: str,
    design_layers: list[CanvasLayer],
) -> int:
    if not ObjectId.is_valid(event_id):
        return 0

    image_urls = {
        layer.imageUrl
        for layer in design_layers
        if layer.type == "image" and layer.imageUrl
    }
    if not image_urls:
        return 0

    result = await get_collection(FLYERS_COLLECTION).update_many(
        {
            "owner_id": ObjectId(owner_id),
            "image_url": {"$in": list(image_urls)},
        },
        {
            "$set": {
                "event_id": ObjectId(event_id),
                "updated_at": datetime.now(UTC),
            }
        },
    )
    return result.modified_count


def default_qr_bounds(image_width: int, image_height: int) -> QrBounds:
    size = min(image_width, image_height) * 0.18
    return QrBounds(
        x=round(image_width * 0.65, 2),
        y=round(image_height * 0.72, 2),
        width=round(size, 2),
        height=round(size, 2),
    )

TEMPLATES_COLLECTION = "flyer_templates"


async def list_flyer_templates_async(
    *,
    category: TemplateCategory | None = None,
    event_type: EventType | None = None,
) -> list[FlyerTemplate]:
    """Return templates from MongoDB using optional category and event-type filters."""
    query: dict[str, str] = {}

    if category is not None:
        query["category"] = category.value

    if event_type is not None:
        query["event_type"] = event_type.value

    documents = (
        await get_collection(TEMPLATES_COLLECTION)
        .find(query)
        .sort([("category", 1), ("title", 1)])
        .to_list(length=None)
    )

    return [
        FlyerTemplate.model_validate(document)
        for document in documents
    ]


async def get_all_templates() -> list[FlyerTemplate]:
    """Return every template from MongoDB."""
    documents = (
        await get_collection(TEMPLATES_COLLECTION)
        .find()
        .sort([("category", 1), ("title", 1)])
        .to_list(length=None)
    )

    return [
        FlyerTemplate.model_validate(document)
        for document in documents
    ]


async def create_template(
    data: FlyerTemplate,
) -> FlyerTemplate:
    """Create a template using its stable public id."""
    collection = get_collection(TEMPLATES_COLLECTION)

    existing = await collection.find_one({"id": data.id})
    if existing is not None:
        raise ValueError(
            f"A template with id '{data.id}' already exists."
        )

    document = data.model_dump(mode="json")
    await collection.insert_one(document)

    return data


async def update_template(
    template_id: str,
    data: FlyerTemplate,
) -> FlyerTemplate | None:
    """Update an existing template by its stable public id."""
    document = data.model_dump(mode="json")
    document["id"] = template_id

    result = await get_collection(TEMPLATES_COLLECTION).update_one(
        {"id": template_id},
        {"$set": document},
    )

    if result.matched_count == 0:
        return None

    return FlyerTemplate.model_validate(document)


async def delete_template(
    template_id: str,
) -> bool:
    """Delete a template by its stable public id."""
    result = await get_collection(TEMPLATES_COLLECTION).delete_one(
        {"id": template_id}
    )

    return result.deleted_count > 0