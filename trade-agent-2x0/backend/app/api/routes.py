"""Rotas da Fase 2: login, estado 2x0 do dia e controles (pausa, retomada, emergência, reconciliação).

Permissões: viewer só lê; operator e admin controlam. Cada usuário só acessa as contas dele (admin acessa todas).
Nenhuma rota de ordem ou de fechamento de posição existe nesta fase.
"""
from __future__ import annotations

import os
from typing import Annotated

import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

from app.core.security import RateLimiter, issue_token, read_token, verify_password
from app.engines.risk_manager.service import RiskError, RiskManagerService

router = APIRouter(prefix="/api/v1")
login_limiter = RateLimiter(limit=5, window_s=60)


def _db_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise HTTPException(503, "Banco de dados não configurado.")
    return url.replace("postgresql+psycopg://", "postgresql://")


def _secret() -> str:
    s = os.environ.get("AUTH_SECRET")
    if not s or len(s) < 32:
        raise HTTPException(503, "Login desligado: AUTH_SECRET ausente ou curto (mínimo 32 caracteres).")
    return s


def risk_service() -> RiskManagerService:
    return RiskManagerService(_db_url(), max_risk_brl=float(os.environ.get("RISK_PER_TRADE_BRL") or 5))


class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=256)


class ReasonIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


def current_user(authorization: Annotated[str | None, Header()] = None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Não autenticado.")
    data = read_token(_secret(), authorization[7:])
    if not data:
        raise HTTPException(401, "Sessão inválida ou expirada.")
    with psycopg.connect(_db_url(), row_factory=dict_row) as c:
        u = c.execute("select id, role, active from users where id=%s", (data["sub"],)).fetchone()
    if not u or not u["active"]:
        raise HTTPException(401, "Usuário inativo.")
    return {"id": str(u["id"]), "role": u["role"]}


def _account_access(user: dict, account_id: str, write: bool) -> None:
    if write and user["role"] not in ("admin", "operator"):
        raise HTTPException(403, "Sem permissão para controlar o agente.")
    if user["role"] == "admin":
        return
    with psycopg.connect(_db_url()) as c:
        ok = c.execute("select 1 from accounts where id=%s and user_id=%s", (account_id, user["id"])).fetchone()
    if not ok:
        raise HTTPException(404, "Conta não encontrada.")


@router.post("/auth/login", tags=["autenticação"])
def login(body: LoginIn, request: Request) -> dict:
    ip = request.client.host if request.client else "?"
    if not login_limiter.allow(ip):
        raise HTTPException(429, "Muitas tentativas. Aguarde um minuto.")
    secret = _secret()
    with psycopg.connect(_db_url(), row_factory=dict_row) as c:
        u = c.execute("select id, role, active, password_hash from users where email=%s", (body.email.lower(),)).fetchone()
    if not u or not u["active"] or not verify_password(body.password, u["password_hash"]):
        raise HTTPException(401, "E-mail ou senha inválidos.")
    return {"token": issue_token(secret, str(u["id"]), u["role"]), "role": u["role"]}


@router.get("/accounts/{account_id}/risk/today", tags=["gerenciamento 2x0"])
def risk_today(account_id: str, user: dict = Depends(current_user)) -> dict:
    _account_access(user, account_id, write=False)
    try:
        return risk_service().today(account_id)
    except RiskError as e:
        raise HTTPException(400, str(e))


def _act(account_id: str, user: dict, fn) -> dict:
    _account_access(user, account_id, write=True)
    try:
        out = fn(risk_service(), f"user:{user['id']}")
    except RiskError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, **(out or {})}


@router.post("/accounts/{account_id}/control/pause", tags=["controles"])
def pause(account_id: str, user: dict = Depends(current_user)) -> dict:
    return _act(account_id, user, lambda s, actor: s.pause(account_id, actor))


@router.post("/accounts/{account_id}/control/resume", tags=["controles"])
def resume(account_id: str, user: dict = Depends(current_user)) -> dict:
    return _act(account_id, user, lambda s, actor: s.resume(account_id, actor))


@router.post("/accounts/{account_id}/control/emergency", tags=["controles"])
def emergency(account_id: str, body: ReasonIn, user: dict = Depends(current_user)) -> dict:
    return _act(account_id, user, lambda s, actor: s.emergency_stop(account_id, actor, body.reason))


@router.post("/accounts/{account_id}/control/emergency/clear", tags=["controles"])
def emergency_clear(account_id: str, user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "Só o administrador pode liberar a emergência.")
    return _act(account_id, user, lambda s, actor: s.clear_emergency(account_id, actor))


@router.post("/accounts/{account_id}/risk/reconcile", tags=["gerenciamento 2x0"])
def reconcile(account_id: str, user: dict = Depends(current_user)) -> dict:
    def run(s, actor):
        ok, msg = s.reconcile(account_id, actor)
        if not ok:
            raise HTTPException(409, msg)
        return {"message": msg}
    return _act(account_id, user, run)
