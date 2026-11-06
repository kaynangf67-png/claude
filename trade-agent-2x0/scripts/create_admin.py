"""Cria (ou redefine) o usuário administrador. A senha é digitada no terminal e nunca aparece na tela.

Uso: DATABASE_URL=... python3 scripts/create_admin.py email@exemplo.com
"""
import getpass
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
import psycopg  # noqa: E402

from app.core.security import hash_password  # noqa: E402

email = sys.argv[1].lower()
pw = getpass.getpass("Senha do administrador (mín. 10 caracteres): ")
if pw != getpass.getpass("Repita: "):
    sys.exit("As senhas não conferem.")
with psycopg.connect(os.environ["DATABASE_URL"]) as c:
    c.execute("""insert into users(email,password_hash,role) values (%s,%s,'admin')
                 on conflict (email) do update set password_hash=excluded.password_hash, role='admin', active=true""",
              (email, hash_password(pw)))
print("Administrador salvo:", email)
