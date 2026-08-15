from app.models.schemas.pricing import (
    PricingQuoteRequest,
    PricingQuoteResponse,
    ProFeature,
    TierDefinition,
)

PRO_FEATURE_MATRIX: list[ProFeature] = [
    ProFeature(
        key="deep_analytics",
        label="Deep analytical log details",
        description="Access granular check-in timelines, entrance breakdowns, and exportable audit trails.",
        min_capacity=51,
    ),
    ProFeature(
        key="duplicate_scan_alerts",
        label="Real-time multi-doorman duplicate scanning alerts",
        description="Instant security notifications when the same QR badge is scanned at multiple entrances.",
        min_capacity=51,
    ),
    ProFeature(
        key="full_profile_visibility",
        label="Full profile field visibility settings",
        description="Configure complete guest profile exposure for authorized staff beyond masked defaults.",
        min_capacity=101,
    ),
]

TIER_DEFINITIONS: list[TierDefinition] = [
    TierDefinition(
        key="basic",
        label="Basic",
        min_capacity=1,
        max_capacity=50,
        base_fee=49.0,
        price_per_guest=2.0,
    ),
    TierDefinition(
        key="pro",
        label="Pro",
        min_capacity=51,
        max_capacity=250,
        base_fee=149.0,
        price_per_guest=1.75,
    ),
    TierDefinition(
        key="enterprise",
        label="Enterprise",
        min_capacity=251,
        max_capacity=5000,
        base_fee=399.0,
        price_per_guest=1.25,
    ),
]


def resolve_tier(guest_capacity: int) -> TierDefinition:
    for tier in TIER_DEFINITIONS:
        if tier.min_capacity <= guest_capacity <= tier.max_capacity:
            return tier
    return TIER_DEFINITIONS[-1]


def calculate_quote(request: PricingQuoteRequest) -> PricingQuoteResponse:
    tier = resolve_tier(request.guest_capacity)
    total_price = round(tier.base_fee + (tier.price_per_guest * request.guest_capacity), 2)
    unlocked = [
        feature
        for feature in PRO_FEATURE_MATRIX
        if request.guest_capacity >= feature.min_capacity
    ]

    return PricingQuoteResponse(
        guest_capacity=request.guest_capacity,
        tier=tier.key,
        tier_label=tier.label,
        base_fee=tier.base_fee,
        price_per_guest=tier.price_per_guest,
        total_price=total_price,
        unlocked_pro_features=unlocked,
    )


def get_tier_matrix() -> dict[str, object]:
    return {
        "tiers": [tier.model_dump() for tier in TIER_DEFINITIONS],
        "pro_features": [feature.model_dump() for feature in PRO_FEATURE_MATRIX],
    }
