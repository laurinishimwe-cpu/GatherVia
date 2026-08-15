from __future__ import annotations

import argparse
import asyncio
import re
from collections import Counter
from pathlib import Path
import sys
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

# Add the project root so imports from "app" work.
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import settings


def get_collection(name: str):
    """Return the motor collection for the given name."""

    client = AsyncIOMotorClient(settings.mongodb_url)
    database = client[settings.database_name]
    return database[name]


TEMPLATES_COLLECTION = "flyer_templates"

VALID_CATEGORIES = {
    "wedding",
    "corporate",
    "birthday",
    "party",
    "conference",
    "gala",
    "other",
}

# Event types that have a single unambiguous gallery category.
EVENT_TYPE_CATEGORY_MAP = {
    "marriage": "wedding",
    "corporate": "corporate",
    "conference": "conference",
    "gala": "gala",
    "other": "other",
}

# Add exact template IDs here when a private template cannot be inferred safely.
# These mappings always take priority over keyword detection.
EXPLICIT_CATEGORY_BY_ID = {
    "private-neon-01": "birthday",
    "private-playful-03": "birthday",
    "private-soft-04": "birthday",
}

PRIVATE_CATEGORY_KEYWORDS = {
    "birthday": {
        "birthday",
        "bday",
        "cake",
        "candles",
        "turning",
        "years old",
        "born",
        "age",
    },
    "party": {
        "party",
        "night",
        "club",
        "dance",
        "dancing",
        "dj",
        "neon",
        "celebration",
        "cocktail",
    },
}


def normalize_text(value: Any) -> str:
    """Return a lowercase searchable string for migration matching."""

    if value is None:
        return ""

    text = str(value).strip().lower()
    return re.sub(r"\s+", " ", text)


def searchable_template_text(document: dict[str, Any]) -> str:
    """Combine fields that can safely describe the template's intent."""

    values = (
        document.get("id"),
        document.get("title"),
        document.get("description"),
        document.get("headline"),
        document.get("subheadline"),
    )

    return " ".join(
        normalized
        for value in values
        if (normalized := normalize_text(value))
    )


def infer_private_category(
    document: dict[str, Any],
) -> tuple[str | None, str]:
    """
    Infer birthday or party for a private-event template.

    The function only returns a category when one category has a clear,
    exclusive keyword match. Ambiguous templates remain unresolved.
    """

    template_id = normalize_text(document.get("id"))

    explicit_category = EXPLICIT_CATEGORY_BY_ID.get(template_id)

    if explicit_category:
        return explicit_category, "explicit template-id mapping"

    searchable_text = searchable_template_text(document)

    matches: dict[str, list[str]] = {}

    for category, keywords in PRIVATE_CATEGORY_KEYWORDS.items():
        matched_keywords = sorted(
            keyword
            for keyword in keywords
            if keyword in searchable_text
        )

        if matched_keywords:
            matches[category] = matched_keywords

    if len(matches) == 1:
        category, matched_keywords = next(iter(matches.items()))

        return (
            category,
            f"private-template keywords: {', '.join(matched_keywords)}",
        )

    if len(matches) > 1:
        details = "; ".join(
            f"{category}={','.join(keywords)}"
            for category, keywords in matches.items()
        )

        return None, f"ambiguous private template ({details})"

    return None, "private template has no decisive birthday/party keyword"


def infer_template_category(
    document: dict[str, Any],
) -> tuple[str | None, str]:
    """Return the category and the reason used to choose it."""

    event_type = normalize_text(document.get("event_type"))

    direct_category = EVENT_TYPE_CATEGORY_MAP.get(event_type)

    if direct_category:
        return direct_category, f"event_type={event_type}"

    if event_type == "private":
        return infer_private_category(document)

    return None, f"unsupported event_type={event_type or '<missing>'}"


async def migrate_template_categories(
    *,
    apply_changes: bool,
    overwrite_existing: bool,
) -> None:
    client = AsyncIOMotorClient(settings.mongodb_url)

    try:
        database = client[settings.database_name]
        collection = database[TEMPLATES_COLLECTION]

        documents = await collection.find({}).to_list(length=None)

        counters: Counter[str] = Counter()
        unresolved: list[dict[str, str]] = []

        print(
            f"Found {len(documents)} template document(s) "
            f"in '{TEMPLATES_COLLECTION}'."
        )
        print(
            "Mode:",
            "APPLY CHANGES" if apply_changes else "DRY RUN",
        )
        print("-" * 72)

        for document in documents:
            template_id = str(
                document.get("id") or document.get("_id")
            )

            current_category = normalize_text(
                document.get("category")
            )

            if (
                current_category in VALID_CATEGORIES
                and not overwrite_existing
            ):
                counters["unchanged"] += 1

                print(
                    f"[UNCHANGED] {template_id}: "
                    f"category={current_category}"
                )
                continue

            inferred_category, reason = (
                infer_template_category(document)
            )

            if inferred_category is None:
                counters["unresolved"] += 1

                unresolved.append(
                    {
                        "id": template_id,
                        "event_type": normalize_text(
                            document.get("event_type")
                        ),
                        "current_category": (
                            current_category or "<missing>"
                        ),
                        "reason": reason,
                    }
                )

                print(
                    f"[UNRESOLVED] {template_id}: {reason}"
                )
                continue

            if inferred_category == current_category:
                counters["unchanged"] += 1

                print(
                    f"[UNCHANGED] {template_id}: "
                    f"category={current_category}"
                )
                continue

            action = "UPDATE" if current_category else "ADD"

            print(
                f"[{action}] {template_id}: "
                f"{current_category or '<missing>'} "
                f"-> {inferred_category} ({reason})"
            )

            counters["planned"] += 1

            if not apply_changes:
                continue

            result = await collection.update_one(
                {
                    "_id": document["_id"],
                },
                {
                    "$set": {
                        "category": inferred_category,
                    }
                },
            )

            if result.modified_count == 1:
                counters["updated"] += 1
            else:
                counters["not_modified"] += 1

        print("-" * 72)
        print("Summary")
        print(
            f"  Existing valid categories: "
            f"{counters['unchanged']}"
        )
        print(
            f"  Planned category changes: "
            f"{counters['planned']}"
        )
        print(
            f"  Applied changes:          "
            f"{counters['updated']}"
        )
        print(
            f"  Not modified:             "
            f"{counters['not_modified']}"
        )
        print(
            f"  Unresolved templates:     "
            f"{counters['unresolved']}"
        )

        if unresolved:
            print("\nUnresolved templates")
            print("-" * 72)

            for item in unresolved:
                print(
                    f"- id={item['id']!r}, "
                    f"event_type={item['event_type']!r}, "
                    f"current_category="
                    f"{item['current_category']!r}"
                )
                print(
                    f"  reason: {item['reason']}"
                )

    finally:
        client.close()


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Add or correct flyer-template categories in MongoDB."
        )
    )

    parser.add_argument(
        "--apply",
        action="store_true",
        help=(
            "Write changes to MongoDB. Without this flag, "
            "the script performs a dry run."
        ),
    )

    parser.add_argument(
        "--overwrite-existing",
        action="store_true",
        help=(
            "Recalculate templates that already contain a valid category."
        ),
    )

    return parser.parse_args()


async def main() -> None:
    arguments = parse_arguments()

    await migrate_template_categories(
        apply_changes=arguments.apply,
        overwrite_existing=arguments.overwrite_existing,
    )


if __name__ == "__main__":
    asyncio.run(main())