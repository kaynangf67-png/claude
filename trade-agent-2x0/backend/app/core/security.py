"""Senhas (scrypt) e tokens de sessão assinados (HMAC-SHA256), só com a biblioteca padrão.

- Senha: scrypt com sal aleatório; comparação em tempo constante.
- Token: payload JSON (usuário, papel, expiração, id único) + assinatura HMAC com AUTH_SECRET.
  Sem AUTH_SECRET o login fica desligado (nunca há segredo padrão embutido no código).
- Limite de tentativas de login por IP em memória (suficiente para um processo; Fase 10 revisa).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from collections import defaultdict, deque

SCRYPT = dict(n=2**14, r=8, p=1, dklen=32)
TOKEN_TTL_S = 8 * 3600


def hash_password(password: str) -> str:
    if len(password) < 10:
        raise ValueError("A senha precisa ter pelo menos 10 caracteres.")
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, **SCRYPT)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(dk).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_b64, dk_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        dk = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt_b64), **SCRYPT)
        return hmac.compare_digest(dk, base64.b64decode(dk_b64))
    except (ValueError, TypeError):
        return False


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def issue_token(secret: str, user_id: str, role: str, now: float | None = None) -> str:
    now = time.time() if now is None else now
    body = _b64(json.dumps({"sub": user_id, "role": role, "exp": int(now + TOKEN_TTL_S), "jti": secrets.token_hex(8)}).encode())
    sig = _b64(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def read_token(secret: str, token: str, now: float | None = None) -> dict | None:
    try:
        body, sig = token.split(".")
    except ValueError:
        return None
    expected = _b64(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        data = json.loads(_unb64(body))
    except (ValueError, json.JSONDecodeError):
        return None
    if data.get("exp", 0) < (time.time() if now is None else now):
        return None
    return data


class RateLimiter:
    def __init__(self, limit: int, window_s: float):
        self.limit, self.window = limit, window_s
        self.hits: dict[str, deque] = defaultdict(deque)

    def allow(self, key: str, now: float | None = None) -> bool:
        now = time.monotonic() if now is None else now
        q = self.hits[key]
        while q and q[0] <= now - self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        return True
