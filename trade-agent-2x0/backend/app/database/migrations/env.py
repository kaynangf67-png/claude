import os

from alembic import context
from sqlalchemy import create_engine

url = os.environ.get("DATABASE_URL")
if not url:
    raise RuntimeError("Defina DATABASE_URL para rodar as migrations.")
if url.startswith("postgres://"):
    url = "postgresql+psycopg://" + url[len("postgres://"):]
elif url.startswith("postgresql://"):
    url = "postgresql+psycopg://" + url[len("postgresql://"):]

with create_engine(url).connect() as conn:
    context.configure(connection=conn, target_metadata=None, transaction_per_migration=True)
    with context.begin_transaction():
        context.run_migrations()
    conn.commit()
