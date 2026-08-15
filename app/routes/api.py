from fastapi import APIRouter

from app.routes import admin, auth, communications, events, flyers, guests, plans, pricing

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(communications.router)
api_router.include_router(events.router)
api_router.include_router(flyers.router)
api_router.include_router(pricing.router)
api_router.include_router(guests.router)
api_router.include_router(plans.router)
api_router.include_router(admin.router)


@api_router.get("/health", tags=["Health"])
async def api_health() -> dict[str, str]:
    """Aggregate health check for the API."""
    return {"status": "ok"}
