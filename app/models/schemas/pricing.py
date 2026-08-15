from pydantic import BaseModel, Field


class ProFeature(BaseModel):
    """Single Pro-tier capability unlocked at higher capacity brackets."""

    key: str
    label: str
    description: str
    min_capacity: int = Field(..., ge=1)


class TierDefinition(BaseModel):
    """Pricing tier metadata."""

    key: str
    label: str
    min_capacity: int
    max_capacity: int
    base_fee: float
    price_per_guest: float


class PricingQuoteRequest(BaseModel):
    """Guest capacity input for dynamic tier calculation."""

    guest_capacity: int = Field(..., ge=1, le=5000)


class PricingQuoteResponse(BaseModel):
    """Calculated plan quote for a requested guest capacity."""

    guest_capacity: int
    tier: str
    tier_label: str
    base_fee: float
    price_per_guest: float
    total_price: float
    unlocked_pro_features: list[ProFeature]
