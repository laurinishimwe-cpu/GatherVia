from secrets import compare_digest
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.core.config import settings
from app.core.deps import get_current_user
from app.models.schemas.plans import (
    PlanCatalogResponse,
    RevenueCatWebhookRequest,
    SubscriptionStatusResponse,
    WebhookAcceptedResponse,
)
from app.models.user import User
from app.services.plans import (
    RevenueCatConfigurationError,
    RevenueCatSyncError,
    get_plan_catalog,
    get_subscription_status,
    process_revenuecat_webhook,
    sync_subscription_from_revenuecat,
)


router = APIRouter(prefix="/plans", tags=["Plans"])


@router.get("/catalog", response_model=PlanCatalogResponse)
async def read_plan_catalog() -> PlanCatalogResponse:
    return get_plan_catalog()


@router.get("/status", response_model=SubscriptionStatusResponse)
async def read_subscription_status(
    current_user: User = Depends(get_current_user),
) -> SubscriptionStatusResponse:
    return get_subscription_status(current_user)


@router.post("/sync", response_model=SubscriptionStatusResponse)
async def sync_subscription(
    current_user: User = Depends(get_current_user),
) -> SubscriptionStatusResponse:
    assert current_user.id is not None
    try:
        updated = await sync_subscription_from_revenuecat(current_user.id)
    except RevenueCatConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except RevenueCatSyncError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    return get_subscription_status(updated)


@router.post(
    "/revenuecat/webhook",
    response_model=WebhookAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def receive_revenuecat_webhook(
    payload: RevenueCatWebhookRequest,
    authorization: Annotated[str | None, Header()] = None,
) -> WebhookAcceptedResponse:
    expected = settings.revenuecat_webhook_authorization
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RevenueCat webhook authorization is not configured.",
        )
    if authorization is None or not compare_digest(
        authorization.encode("utf-8"),
        expected.encode("utf-8"),
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid RevenueCat webhook authorization.",
        )

    try:
        duplicate = await process_revenuecat_webhook(payload.event)
    except (RevenueCatConfigurationError, RevenueCatSyncError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    return WebhookAcceptedResponse(status="accepted", duplicate=duplicate)
