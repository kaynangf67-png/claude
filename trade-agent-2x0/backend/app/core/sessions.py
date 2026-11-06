"""Sessões de mercado calculadas pelo fuso de cada praça, nunca por horário fixo.

Londres 08:00–17:00 (Europe/London) e Nova York 08:00–17:00 (America/New_York), convertidas para
America/Sao_Paulo. Como cada praça muda de horário de verão em datas diferentes, o horário em Brasília
muda ao longo do ano; o zoneinfo cuida disso.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.config import OPERATING_TZ

LONDON = ZoneInfo("Europe/London")
NEW_YORK = ZoneInfo("America/New_York")
SESSION_HOURS = (time(8, 0), time(17, 0))


@dataclass(frozen=True)
class Window:
    name: str
    start: datetime  # America/Sao_Paulo
    end: datetime


def trading_day(now: datetime) -> date:
    """Dia operacional = data em America/Sao_Paulo."""
    if now.tzinfo is None:
        raise ValueError("datetime sem fuso")
    return now.astimezone(OPERATING_TZ).date()


def _window(name: str, tz: ZoneInfo, d: date) -> Window:
    s = datetime.combine(d, SESSION_HOURS[0], tz).astimezone(OPERATING_TZ)
    e = datetime.combine(d, SESSION_HOURS[1], tz).astimezone(OPERATING_TZ)
    return Window(name, s, e)


def sessions_for(d: date) -> list[Window]:
    """Londres, Nova York e a sobreposição das duas, no horário de Brasília. Fim de semana: nenhuma."""
    if d.weekday() >= 5:
        return []
    lon, ny = _window("Londres", LONDON, d), _window("Nova York", NEW_YORK, d)
    out = [lon, ny]
    s, e = max(lon.start, ny.start), min(lon.end, ny.end)
    if s < e:
        out.append(Window("Sobreposição Londres/Nova York", s, e))
    return out


def active_sessions(now: datetime) -> list[str]:
    local = now.astimezone(OPERATING_TZ)
    names = []
    for d in (local.date() - timedelta(days=1), local.date()):
        for w in sessions_for(d):
            if w.start <= local < w.end and w.name not in names:
                names.append(w.name)
    return names
