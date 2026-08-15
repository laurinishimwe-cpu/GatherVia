from fastapi import APIRouter, Depends, HTTPException, status
from app.core.deps_admin import require_admin
from app.models.user import User
from app.models.schemas.flyer_templates import FlyerTemplate
from app.services.flyers import (
    get_all_templates,
    create_template,
    update_template,
    delete_template,
)

router = APIRouter(prefix="/admin/templates", tags=["Admin Templates"], redirect_slashes=False)

@router.get("", response_model=list[FlyerTemplate])
async def list_templates(current_user: User = Depends(require_admin)):
    return await get_all_templates()

@router.post("", response_model=FlyerTemplate, status_code=201)
async def add_template(payload: FlyerTemplate, current_user: User = Depends(require_admin)):
    return await create_template(payload)

@router.put("/{template_id}", response_model=FlyerTemplate)
async def edit_template(template_id: str, payload: FlyerTemplate, current_user: User = Depends(require_admin)):
    updated = await update_template(template_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Template not found")
    return updated

@router.delete("/{template_id}")
async def remove_template(template_id: str, current_user: User = Depends(require_admin)):
    deleted = await delete_template(template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"status": "ok"}

@router.post(
    "",
    response_model=FlyerTemplate,
    status_code=status.HTTP_201_CREATED,
)
async def add_template(
    payload: FlyerTemplate,
    current_user: User = Depends(require_admin),
):
    del current_user

    try:
        return await create_template(payload)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error