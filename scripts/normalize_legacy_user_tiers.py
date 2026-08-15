"""Normalize legacy unverified Basic/Pro accounts to the default Free plan.

Run without arguments for a read-only preview. Pass ``--apply`` to update the
configured MongoDB database. Verified mobile IAP tiers are never modified.
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import (
    close_mongodb_connection,
    connect_to_mongodb,
    get_collection,
)
from app.models.base import utc_now
from app.models.user import UserTier, UserTierSource, UserTierStatus
from app.services.users import USERS_COLLECTION


LEGACY_UNVERIFIED_FILTER = {
    "tier": {"$in": [UserTier.BASIC.value, UserTier.PRO.value]},
    "tier_source": {"$ne": UserTierSource.MOBILE_IAP.value},
}


async def normalize_legacy_tiers(*, apply_changes: bool) -> None:
    await connect_to_mongodb()
    try:
        users = get_collection(USERS_COLLECTION)
        legacy_count = await users.count_documents(LEGACY_UNVERIFIED_FILTER)
        print(f"Legacy unverified paid-tier users: {legacy_count}")

        if not apply_changes:
            print("Preview only. Re-run with --apply to normalize these users to Free.")
            return

        result = await users.update_many(
            LEGACY_UNVERIFIED_FILTER,
            {
                "$set": {
                    "tier": UserTier.FREE.value,
                    "tier_source": UserTierSource.DEFAULT.value,
                    "tier_status": UserTierStatus.FREE.value,
                    "tier_started_at": None,
                    "tier_expires_at": None,
                    "tier_product_id": None,
                    "tier_store": None,
                    "tier_auto_renews": False,
                    "tier_updated_at": utc_now(),
                }
            },
        )
        print(f"Normalized users: {result.modified_count}")
    finally:
        await close_mongodb_connection()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply the normalization. Without this flag the script is read-only.",
    )
    args = parser.parse_args()
    asyncio.run(normalize_legacy_tiers(apply_changes=args.apply))


if __name__ == "__main__":
    main()
