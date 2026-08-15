from datetime import UTC, datetime
from typing import Annotated, Any

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_core import core_schema


class PyObjectId(str):
    """MongoDB ObjectId represented as a validated string."""

    @classmethod
    def __get_pydantic_core_schema__(
        cls,
        _source_type: Any,
        _handler: Any,
    ) -> core_schema.CoreSchema:
        return core_schema.no_info_after_validator_function(
            cls.validate,
            core_schema.str_schema(),
        )

    @classmethod
    def validate(cls, value: Any) -> str:
        if isinstance(value, ObjectId):
            return str(value)
        if not ObjectId.is_valid(value):
            raise ValueError("Invalid ObjectId.")
        return str(value)


ObjectIdStr = Annotated[PyObjectId, Field(description="MongoDB document identifier.")]


class MongoModel(BaseModel):
    """Base model configured for MongoDB document serialization."""

    model_config = ConfigDict(
        populate_by_name=True,
        str_strip_whitespace=True,
        use_enum_values=True,
        json_encoders={ObjectId: str, datetime: lambda value: value.isoformat()},
    )


def utc_now() -> datetime:
    """Return the current UTC timestamp."""
    return datetime.now(UTC)
