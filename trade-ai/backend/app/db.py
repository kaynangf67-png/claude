"""Persistência (PostgreSQL em produção, SQLite em desenvolvimento)."""

from __future__ import annotations

import json
import time
from typing import Any

from sqlalchemy import (JSON, BigInteger, Boolean, Float, Integer, String, Text, UniqueConstraint,
                        create_engine, select)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


class TradeRow(Base):
    """Toda operação simulada, de demo ou de backtest. `mode` nunca mistura as duas."""

    __tablename__ = "trades"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mode: Mapped[str] = mapped_column(String(16), index=True)  # demo | backtest
    run_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    signal_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    asset_key: Mapped[str] = mapped_column(String(120), index=True)
    symbol: Mapped[str] = mapped_column(String(60))
    market: Mapped[str] = mapped_column(String(20))
    source: Mapped[str] = mapped_column(String(30))
    data_is_live: Mapped[bool] = mapped_column(Boolean)
    direction: Mapped[str] = mapped_column(String(8))  # long | short
    qty: Mapped[float] = mapped_column(Float)
    entry: Mapped[float] = mapped_column(Float)
    stop: Mapped[float] = mapped_column(Float)
    target: Mapped[float] = mapped_column(Float)
    opened_at: Mapped[float] = mapped_column(Float)
    closed_at: Mapped[float | None] = mapped_column(Float, nullable=True)
    exit: Mapped[float | None] = mapped_column(Float, nullable=True)
    exit_reason: Mapped[str | None] = mapped_column(String(40), nullable=True)
    pnl: Mapped[float | None] = mapped_column(Float, nullable=True)
    r_multiple: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(12), index=True)  # aberta | fechada
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)

    def to_dict(self) -> dict:
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class SignalRow(Base):
    __tablename__ = "signals"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    asset_key: Mapped[str] = mapped_column(String(120), index=True)
    created_at: Mapped[float] = mapped_column(Float, index=True)
    status: Mapped[str] = mapped_column(String(16))
    payload: Mapped[dict] = mapped_column(JSON)


class BacktestRunRow(Base):
    __tablename__ = "backtest_runs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_key: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[float] = mapped_column(Float)
    bars: Mapped[int] = mapped_column(Integer)
    summary: Mapped[dict] = mapped_column(JSON)


class CandleRow(Base):
    """Candles fechados recebidos por webhook/importação, para sobreviver a reinícios."""

    __tablename__ = "candles"
    __table_args__ = (UniqueConstraint("asset_key", "time"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_key: Mapped[str] = mapped_column(String(120), index=True)
    symbol: Mapped[str] = mapped_column(String(60))
    market: Mapped[str] = mapped_column(String(20))
    source: Mapped[str] = mapped_column(String(30))
    time: Mapped[int] = mapped_column(BigInteger)
    open: Mapped[float] = mapped_column(Float)
    high: Mapped[float] = mapped_column(Float)
    low: Mapped[float] = mapped_column(Float)
    close: Mapped[float] = mapped_column(Float)
    volume: Mapped[float] = mapped_column(Float)


class KVRow(Base):
    __tablename__ = "kv"
    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[float] = mapped_column(Float)


class EventLogRow(Base):
    __tablename__ = "event_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    at: Mapped[float] = mapped_column(Float, index=True)
    kind: Mapped[str] = mapped_column(String(40))
    message: Mapped[str] = mapped_column(Text)


def make_engine(url: str | None = None):
    url = url or settings.database_url
    kwargs: dict[str, Any] = {"future": True}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    return create_engine(url, **kwargs)


class Database:
    def __init__(self, url: str | None = None) -> None:
        self.engine = make_engine(url)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(self.engine, expire_on_commit=False)

    def session(self) -> Session:
        return self.Session()

    def kv_get(self, key: str, default: Any = None) -> Any:
        with self.session() as s:
            row = s.get(KVRow, key)
            return json.loads(row.value) if row else default

    def kv_set(self, key: str, value: Any) -> None:
        with self.session() as s:
            row = s.get(KVRow, key)
            if row:
                row.value, row.updated_at = json.dumps(value), time.time()
            else:
                s.add(KVRow(key=key, value=json.dumps(value), updated_at=time.time()))
            s.commit()

    def log(self, kind: str, message: str) -> None:
        with self.session() as s:
            s.add(EventLogRow(at=time.time(), kind=kind, message=message))
            s.commit()

    def save_candles(self, asset_key: str, symbol: str, market: str, source: str, candles: list) -> None:
        if not candles:
            return
        with self.session() as s:
            existing = set(s.scalars(select(CandleRow.time).where(
                CandleRow.asset_key == asset_key, CandleRow.time.in_([c.time for c in candles]))))
            for c in candles:
                if c.time in existing:
                    continue
                s.add(CandleRow(asset_key=asset_key, symbol=symbol, market=market, source=source, time=c.time,
                                open=c.open, high=c.high, low=c.low, close=c.close, volume=c.volume))
            s.commit()

    def load_candles(self, source: str) -> dict[str, list[CandleRow]]:
        out: dict[str, list[CandleRow]] = {}
        with self.session() as s:
            for row in s.scalars(select(CandleRow).where(CandleRow.source == source).order_by(CandleRow.time)):
                out.setdefault(row.asset_key, []).append(row)
        return out
