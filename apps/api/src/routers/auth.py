from fastapi import APIRouter, Depends, status
from supabase import Client

from src.controller import auth as auth_controller
from src.core.rate_limit import auth_rate_limit
from src.core.security import CurrentUser, get_current_user
from src.core.supabase import get_supabase
from src.models.auth import (
    AuthResponse,
    LoginRequest,
    SignupRequest,
    UserProfile,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(auth_rate_limit)],
)
def signup(payload: SignupRequest, supabase: Client = Depends(get_supabase)):
    return auth_controller.register(supabase, payload)


@router.post(
    "/login",
    response_model=AuthResponse,
    dependencies=[Depends(auth_rate_limit)],
)
def login(payload: LoginRequest, supabase: Client = Depends(get_supabase)):
    return auth_controller.login(supabase, payload)


@router.get("/me", response_model=UserProfile)
def me(user: CurrentUser = Depends(get_current_user)):
    return UserProfile(id=user.id, email=user.email, created_at=user.created_at)
