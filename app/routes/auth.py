from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials

from app.core.deps import bearer_scheme, get_current_user
from app.core.security import ACCESS_TOKEN_EXPIRE_MINUTES, create_access_token, decode_access_token
from app.models.schemas.auth import (
    AuthSessionResponse,
    HistoricEventResponse,
    LanguagePreferenceRequest,
    LoginRequest,
    RegisterRequest,
    RefreshTokenRequest,
    SSOAssertionRequest,
    TokenResponse,
    UserResponse,
)
from app.models.event import Event
from app.models.user import AuthProvider, User
from app.models.schemas.auth import UpdateProfileRequest,ChangePasswordRequest
from app.services.google_auth import verify_google_access_token 
from app.services.users import (
    authenticate_manual_user,
    get_user_event_history,
    register_manual_user,
    set_user_language,
    upsert_sso_user,
    change_user_password,
    update_user_profile,
    get_user_by_id,
)
from app.services.auth_sessions import (
    AuthSessionError,
    create_refresh_session,
    list_user_sessions,
    revoke_refresh_session,
    revoke_user_session_by_id,
    revoke_user_sessions,
    rotate_refresh_session,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _build_token(user: User, refresh_token: str | None = None) -> TokenResponse:
    """Generate a JWT access token for the given user."""
    assert user.id is not None
    token = create_access_token(
        subject=user.id,
        extra_claims={"tier": user.tier, "email": user.email},
    )
    return TokenResponse(
        access_token=token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        refresh_token=refresh_token,
    )


async def _issue_session_token(user: User, request: Request) -> TokenResponse:
    assert user.id is not None
    session = await create_refresh_session(
        user.id,
        client_kind=request.headers.get("x-client-platform", "api"),
        installation_id=request.headers.get("x-installation-id"),
        user_agent=request.headers.get("user-agent"),
    )
    return _build_token(user, session.refresh_token)


async def _user_from_legacy_access_token(
    credentials: HTTPAuthorizationCredentials | None,
) -> User | None:
    """Allow one-time migration while an older client's JWT is still valid."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError:
        return None
    user_id = payload.get("sub")
    return await get_user_by_id(str(user_id)) if user_id else None


def _build_history_response(event: Event) -> HistoricEventResponse:
    """Convert an Event model into a lightweight history response."""
    assert event.id is not None
    return HistoricEventResponse(
        id=event.id,
        slug=event.slug,
        title=event.title,
        event_type=event.event_type,
        event_date=event.event_date,
        created_at=event.created_at,
        ui_language=event.configuration.ui_language,
    )


async def _build_user_response(user: User) -> UserResponse:
    """Build the full user profile response including event history."""
    assert user.id is not None
    history = await get_user_event_history(user.id)
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        auth_provider=user.auth_provider,
        auth_providers=user.auth_providers or [user.auth_provider],
        has_password=user.hashed_password is not None,
        tier=user.tier,
        preferred_language=user.preferred_language,
        needs_language_selection=user.preferred_language is None,
        historic_events=[_build_history_response(event) for event in history],
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, request: Request) -> TokenResponse:
    try:
        user = await register_manual_user(
            email=str(payload.email),
            password=payload.password,
            full_name=payload.full_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return await _issue_session_token(user, request)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request) -> TokenResponse:
    user = await authenticate_manual_user(str(payload.email), payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    return await _issue_session_token(user, request)


@router.post("/google", response_model=TokenResponse)
async def login_with_google(payload: SSOAssertionRequest, request: Request) -> TokenResponse:
    # Verify the Google token and extract real user info
    try:
        user_info = await verify_google_access_token(payload.provider_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    user = await upsert_sso_user(
        email=user_info["email"],
        full_name=user_info["full_name"],
        auth_provider=AuthProvider.GOOGLE,
    )
    return await _issue_session_token(user, request)


@router.post("/microsoft", response_model=TokenResponse)
async def login_with_microsoft(payload: SSOAssertionRequest, request: Request) -> TokenResponse:
    # Microsoft SSO is not yet implemented – this route is a placeholder.
    # For now, we accept the provider_token but do not validate it.
    # Replace this logic with real verification when ready.
    user = await upsert_sso_user(
        email=payload.provider_token,  # temporary – will be replaced
        full_name="Microsoft User",
        auth_provider=AuthProvider.MICROSOFT,
    )
    return await _issue_session_token(user, request)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return await _build_user_response(current_user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(
    request: Request,
    payload: RefreshTokenRequest | None = None,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> TokenResponse:
    """Rotate a persistent session or migrate a still-valid legacy JWT."""
    if payload is not None:
        try:
            rotated = await rotate_refresh_session(
                payload.refresh_token,
                installation_id=request.headers.get("x-installation-id"),
            )
        except AuthSessionError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(exc),
            ) from exc
        current_user = await get_user_by_id(rotated.user_id)
        if current_user is None:
            await revoke_refresh_session(rotated.refresh_token, reason="user_missing")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found.",
            )
        return _build_token(current_user, rotated.refresh_token)

    current_user = await _user_from_legacy_access_token(credentials)
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid refresh session is required.",
        )
    return await _issue_session_token(current_user, request)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: RefreshTokenRequest | None = None) -> Response:
    if payload is not None:
        await revoke_refresh_session(payload.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(current_user: User = Depends(get_current_user)) -> Response:
    assert current_user.id is not None
    await revoke_user_sessions(current_user.id, reason="logout_all")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/sessions", response_model=list[AuthSessionResponse])
async def get_sessions(
    current_user: User = Depends(get_current_user),
) -> list[AuthSessionResponse]:
    assert current_user.id is not None
    documents = await list_user_sessions(current_user.id)
    return [
        AuthSessionResponse(
            id=str(document["_id"]),
            client_kind=str(document.get("client_kind", "unknown")),
            installation_id=document.get("installation_id"),
            user_agent=document.get("user_agent"),
            created_at=document["created_at"],
            last_used_at=document["last_used_at"],
            expires_at=document["expires_at"],
        )
        for document in documents
    ]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
) -> Response:
    assert current_user.id is not None
    removed = await revoke_user_session_by_id(current_user.id, session_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/history", response_model=list[HistoricEventResponse])
async def get_my_history(
    current_user: User = Depends(get_current_user),
) -> list[HistoricEventResponse]:
    assert current_user.id is not None
    history = await get_user_event_history(current_user.id)
    return [_build_history_response(event) for event in history]


@router.patch("/me/language", response_model=UserResponse)
async def update_my_language(
    payload: LanguagePreferenceRequest,
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    assert current_user.id is not None
    updated = await set_user_language(current_user.id, payload.language)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    return await _build_user_response(updated)




@router.patch("/me/profile", response_model=UserResponse)
async def update_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Update the authenticated user's display name."""
    assert current_user.id is not None
    updated = await update_user_profile(current_user.id, payload.full_name)
    if updated is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return await _build_user_response(updated)

@router.patch("/me/password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
):
    """Set a first password or change an existing password."""
    assert current_user.id is not None
    try:
        await change_user_password(
            current_user.id,
            payload.current_password,
            payload.new_password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    await revoke_user_sessions(current_user.id, reason="password_changed")
    return {"status": "ok"}

from app.core.deps_admin import ADMIN_EMAILS

@router.get("/me/is-admin")
async def check_is_admin(current_user: User = Depends(get_current_user)):
    return {"is_admin": current_user.email.lower() in ADMIN_EMAILS}
