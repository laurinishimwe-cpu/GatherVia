from fastapi import APIRouter

from app.models.schemas.pricing import PricingQuoteRequest, PricingQuoteResponse
from app.services.pricing import calculate_quote, get_tier_matrix

router = APIRouter(prefix="/pricing", tags=["Pricing"])


@router.get("/tiers")
async def list_pricing_tiers() -> dict[str, object]:
    return get_tier_matrix()


@router.post("/quote", response_model=PricingQuoteResponse)
async def quote_pricing(payload: PricingQuoteRequest) -> PricingQuoteResponse:
    return calculate_quote(payload)
