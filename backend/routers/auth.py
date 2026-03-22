from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import hashlib, hmac, uuid

from database import get_db
from models.user import User
from config import settings

router = APIRouter(tags=["auth"])
security = HTTPBearer()


# ── Simple SHA-256 password hashing (avoids passlib/bcrypt version issues) ────
def hash_password(password: str) -> str:
    """Hash password using HMAC-SHA256 with the JWT secret as salt."""
    return hmac.new(
        settings.JWT_SECRET_KEY.encode(),
        password.encode(),
        hashlib.sha256,
    ).hexdigest()


def verify_password(plain: str, hashed: str) -> bool:
    return hmac.compare_digest(hash_password(plain), hashed)


# ── JWT helpers ───────────────────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    import json, base64, time
    payload = {**data}
    exp = time.time() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)).total_seconds()
    payload["exp"] = exp
    header = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').rstrip(b"=").decode()
    body   = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    sig_input = f"{header}.{body}"
    sig = hmac.new(settings.JWT_SECRET_KEY.encode(), sig_input.encode(), hashlib.sha256).hexdigest()
    sig_b64 = base64.urlsafe_b64encode(bytes.fromhex(sig)).rstrip(b"=").decode()
    return f"{header}.{body}.{sig_b64}"


def decode_access_token(token: str) -> dict:
    import json, base64, time
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("invalid token")
        header, body, sig_b64 = parts
        sig_input = f"{header}.{body}"
        expected_sig = hmac.new(settings.JWT_SECRET_KEY.encode(), sig_input.encode(), hashlib.sha256).hexdigest()
        expected_sig_b64 = base64.urlsafe_b64encode(bytes.fromhex(expected_sig)).rstrip(b"=").decode()
        if not hmac.compare_digest(sig_b64, expected_sig_b64):
            raise ValueError("signature mismatch")
        padding = 4 - len(body) % 4
        payload = json.loads(base64.urlsafe_b64decode(body + "=" * padding))
        if payload.get("exp", 0) < time.time():
            raise ValueError("token expired")
        return payload
    except Exception as e:
        raise ValueError(f"invalid token: {e}")


# ── Pydantic models ───────────────────────────────────────────────────────────
class SignupRequest(BaseModel):
    email: str
    password: str
    name: str
    monthly_income: Optional[float] = 0
    risk_tolerance: Optional[str] = "moderate"


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict


# ── Dependency ────────────────────────────────────────────────────────────────
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if not user_id:
            raise exc
    except Exception:
        raise exc

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise exc
    return user


# ── Routes ────────────────────────────────────────────────────────────────────
@router.post("/signup", response_model=TokenResponse)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        id=str(uuid.uuid4()),
        email=req.email,
        password_hash=hash_password(req.password),
        name=req.name,
        monthly_income=req.monthly_income or 0,
        risk_tolerance=req.risk_tolerance or "moderate",
    )
    db.add(user)
    await db.flush()

    token = create_access_token({"sub": user.id})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "monthly_income": float(user.monthly_income or 0),
            "risk_tolerance": user.risk_tolerance,
        },
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user.id})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "monthly_income": float(user.monthly_income or 0),
            "risk_tolerance": user.risk_tolerance,
        },
    )


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "monthly_income": float(current_user.monthly_income or 0),
        "risk_tolerance": current_user.risk_tolerance,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


@router.put("/me")
async def update_me(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    for key, val in data.items():
        if hasattr(current_user, key) and key not in ("id", "password_hash", "created_at"):
            setattr(current_user, key, val)
    db.add(current_user)
    return {"message": "Updated successfully"}
