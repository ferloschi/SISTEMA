"""Authentication module for Dra. Brinquinho.

Single admin user. Credentials loaded from environment:
- ADMIN_EMAIL          (string)
- ADMIN_PASSWORD_HASH  (bcrypt hash of the admin password)
- JWT_SECRET           (random secret, ≥32 chars)

When the admin changes email/password in-app, the override is persisted
in MongoDB `admin_overrides` collection and takes precedence over .env.
"""
from __future__ import annotations

import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr


JWT_ALGORITHM = "HS256"
JWT_EXP_HOURS = 8


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class HashPasswordPayload(BaseModel):
    password: str


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str


class ChangeEmailPayload(BaseModel):
    current_password: str
    new_email: EmailStr


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str


class MeResponse(BaseModel):
    email: str
    source: str  # "env" or "db"


# ---------------------------------------------------------------------------
# Crypto helpers
# ---------------------------------------------------------------------------
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET", "")
    if not secret or len(secret) < 16:
        raise HTTPException(
            status_code=500,
            detail="JWT_SECRET não configurado no .env (use uma string aleatória ≥32 caracteres).",
        )
    return secret


def create_access_token(email: str) -> str:
    payload = {
        "sub": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada. Faça login novamente.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido.")


# ---------------------------------------------------------------------------
# Credentials resolver (DB override > env)
# ---------------------------------------------------------------------------
async def get_current_credentials(db) -> dict:
    """Return the active admin credentials (DB override if present, else env)."""
    override = await db.admin_overrides.find_one({"_id": "admin"}, {"_id": 0})
    if override and override.get("email") and override.get("password_hash"):
        return {
            "email": (override["email"] or "").lower().strip(),
            "password_hash": override["password_hash"],
            "source": "db",
        }
    env_email = os.environ.get("ADMIN_EMAIL", "").lower().strip()
    env_hash = os.environ.get("ADMIN_PASSWORD_HASH", "")
    if not env_email or not env_hash:
        raise HTTPException(
            status_code=500,
            detail=(
                "ADMIN_EMAIL e ADMIN_PASSWORD_HASH não configurados no .env. "
                "Use POST /api/auth/hash-password para gerar o hash."
            ),
        )
    return {"email": env_email, "password_hash": env_hash, "source": "env"}


# ---------------------------------------------------------------------------
# Dependency
# ---------------------------------------------------------------------------
security = HTTPBearer(auto_error=False)


def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """FastAPI dependency: ensures a valid JWT and returns the admin email."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    payload = decode_token(credentials.credentials)
    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Token inválido.")
    return email


# ---------------------------------------------------------------------------
# Router factory
# ---------------------------------------------------------------------------
def build_auth_router(db) -> APIRouter:
    """Return an APIRouter mounted at /auth (parent prefixes with /api)."""
    router = APIRouter(prefix="/auth", tags=["auth"])

    @router.post("/hash-password")
    async def hash_password_endpoint(payload: HashPasswordPayload):
        """Helper: generate a bcrypt hash for a plain password.

        Use ONCE to fill ADMIN_PASSWORD_HASH in .env. Not a protected route
        because it doesn't reveal any secret — it only hashes whatever you send.
        """
        if not payload.password or len(payload.password) < 4:
            raise HTTPException(
                status_code=400, detail="Senha precisa ter pelo menos 4 caracteres."
            )
        return {"hash": hash_password(payload.password)}

    @router.post("/login", response_model=TokenResponse)
    async def login(payload: LoginPayload):
        creds = await get_current_credentials(db)
        if (payload.email or "").lower().strip() != creds["email"]:
            raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
        if not verify_password(payload.password, creds["password_hash"]):
            raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
        token = create_access_token(creds["email"])
        return TokenResponse(access_token=token, email=creds["email"])

    @router.get("/me", response_model=MeResponse)
    async def me(_email: str = Depends(require_auth)):
        creds = await get_current_credentials(db)
        return MeResponse(email=creds["email"], source=creds["source"])

    @router.post("/change-password")
    async def change_password(
        payload: ChangePasswordPayload, _email: str = Depends(require_auth)
    ):
        creds = await get_current_credentials(db)
        if not verify_password(payload.current_password, creds["password_hash"]):
            raise HTTPException(status_code=400, detail="Senha atual incorreta.")
        if len(payload.new_password) < 6:
            raise HTTPException(
                status_code=400,
                detail="A nova senha precisa ter ao menos 6 caracteres.",
            )
        new_hash = hash_password(payload.new_password)
        await db.admin_overrides.update_one(
            {"_id": "admin"},
            {
                "$set": {
                    "email": creds["email"],
                    "password_hash": new_hash,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
            upsert=True,
        )
        return {"ok": True, "message": "Senha alterada com sucesso."}

    @router.post("/change-email")
    async def change_email(
        payload: ChangeEmailPayload, _email: str = Depends(require_auth)
    ):
        creds = await get_current_credentials(db)
        if not verify_password(payload.current_password, creds["password_hash"]):
            raise HTTPException(status_code=400, detail="Senha atual incorreta.")
        new_email = (payload.new_email or "").lower().strip()
        await db.admin_overrides.update_one(
            {"_id": "admin"},
            {
                "$set": {
                    "email": new_email,
                    "password_hash": creds["password_hash"],
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
            upsert=True,
        )
        # Token previously issued is still valid for its TTL; client should re-login.
        return {"ok": True, "message": "E-mail atualizado com sucesso.", "email": new_email}

    @router.post("/reset-to-env")
    async def reset_to_env(_email: str = Depends(require_auth)):
        """Discard DB overrides and go back to .env credentials."""
        await db.admin_overrides.delete_one({"_id": "admin"})
        return {"ok": True, "message": "Credenciais resetadas para o valor do .env."}

    return router
