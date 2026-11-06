"""Daily Risk Manager 2x0: autoridade final sobre qualquer entrada.

Como funciona:
- O estado do dia é RECALCULADO a partir dos fatos gravados (resultados confirmados e operações vivas), não de um
  contador solto. Reiniciar o servidor ou fechar o painel não muda nada: os fatos estão no banco.
- RECONCILIATION_REQUIRED é "grudento": só sai por reconcile(), e só se não houver pendência.
- Toda mudança acontece numa transação com a linha do dia travada (SELECT ... FOR UPDATE) e versão incrementada
  com checagem (CAS). Cada transição é gravada em agent_events.
- Uma operação só existe quando a corretora confirma a posição. Autorização expirada/rejeitada libera a vaga.
- Resultado líquido > 0 é vitória; zero ou negativo é derrota (trava o dia).
"""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Callable

import psycopg
from psycopg.rows import dict_row

from app.core.contracts import ENTRY_ALLOWED_STATES, Decision, RiskState, SymbolSpec, TradeAuthorization
from app.core.sessions import trading_day
from app.engines.risk_manager.sizing import ExecCosts, size_position, validate_levels

AUTH_TTL = timedelta(seconds=90)
LIVE_AUTH = ("ISSUED", "PICKED_UP")


class RiskError(RuntimeError):
    pass


class ConcurrencyError(RiskError):
    """Outra transação mudou o estado do dia no meio do caminho."""


@dataclass(frozen=True)
class Decision2x0:
    authorized: bool
    reason: str
    authorization: TradeAuthorization | None = None
    state: RiskState | None = None


def derive_state(outcomes: list[str], active_sequence: int | None) -> RiskState:
    """Estado a partir dos fatos do dia. outcomes: WIN/LOSS das operações encerradas, em ordem."""
    if "LOSS" in outcomes:
        return RiskState.DAILY_LOCKED
    wins = outcomes.count("WIN")
    if wins >= 2:
        return RiskState.TARGET_REACHED
    if active_sequence == 1:
        return RiskState.FIRST_TRADE_ACTIVE
    if active_sequence == 2:
        return RiskState.SECOND_TRADE_ACTIVE
    return RiskState.FIRST_WIN if wins == 1 else RiskState.READY


class RiskManagerService:
    def __init__(self, database_url: str, *, max_risk_brl: float = 5.0,
                 clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc)):
        self.url = database_url.replace("postgresql+psycopg://", "postgresql://")
        self.max_risk_brl = max_risk_brl
        self.clock = clock

    # ---------- infraestrutura ----------

    def _conn(self) -> psycopg.Connection:
        return psycopg.connect(self.url, row_factory=dict_row)

    @staticmethod
    def _event(cur, account_id, day, kind, actor, frm=None, to=None, payload=None):
        cur.execute("""insert into agent_events(account_id,trading_day,kind,from_state,to_state,actor,payload)
                       values (%s,%s,%s,%s,%s,%s,%s)""",
                    (account_id, day, kind, frm, to, actor, json.dumps(payload or {}, default=str)))

    def _ensure_day(self, cur, account_id, day: date) -> None:
        """Cria o dia se não existir. Se houver posição aberta ou ordem incerta de um dia anterior,
        o novo dia nasce em RECONCILIATION_REQUIRED (virada com pendência)."""
        cur.execute("insert into daily_sessions(account_id,trading_day) values (%s,%s) on conflict do nothing",
                    (account_id, day))
        cur.execute("select 1 from daily_risk_states where account_id=%s and trading_day=%s", (account_id, day))
        if cur.fetchone():
            return
        pending = self._carryover(cur, account_id, day)
        state = RiskState.RECONCILIATION_REQUIRED if pending else RiskState.READY
        cur.execute("""insert into daily_risk_states(account_id,trading_day,state,reconciliation_reason)
                       values (%s,%s,%s,%s) on conflict do nothing""", (account_id, day, state.value, pending))
        if cur.rowcount:
            self._event(cur, account_id, day, "DAY_OPENED", "risk_manager", None, state.value, {"pendencia": pending})

    @staticmethod
    def _carryover(cur, account_id, day) -> str | None:
        cur.execute("""select count(*) n from positions p join trade_authorizations a using (authorization_id)
                       where p.account_id=%s and p.status='OPEN' and a.trading_day < %s""", (account_id, day))
        if cur.fetchone()["n"]:
            return "Posição aberta vinda do dia anterior: resolver e reconciliar antes de novas entradas."
        cur.execute("""select count(*) n from orders o join trade_authorizations a using (authorization_id)
                       where a.account_id=%s and o.status='UNKNOWN' and a.trading_day < %s""", (account_id, day))
        if cur.fetchone()["n"]:
            return "Ordem com resultado incerto vinda do dia anterior."
        return None

    def _lock(self, cur, account_id, day) -> dict:
        self._ensure_day(cur, account_id, day)
        cur.execute("select * from daily_risk_states where account_id=%s and trading_day=%s for update",
                    (account_id, day))
        return cur.fetchone()

    def _facts(self, cur, account_id, day) -> tuple[list[str], int | None, int, int, int, float]:
        cur.execute("""select tr.outcome, tr.net_result_brl from trade_results tr
                       join positions p on p.id = tr.position_id
                       join trade_authorizations a on a.authorization_id = p.authorization_id
                       where a.account_id=%s and a.trading_day=%s order by a.sequence""", (account_id, day))
        rows = cur.fetchall()
        outcomes = [r["outcome"] for r in rows]
        net = float(sum(r["net_result_brl"] for r in rows))
        cur.execute("""select a.sequence from trade_authorizations a
                       left join positions p on p.authorization_id = a.authorization_id
                       left join trade_results tr on tr.position_id = p.id
                       where a.account_id=%s and a.trading_day=%s
                         and (a.status in ('ISSUED','PICKED_UP') or (a.status='EXECUTED' and tr.position_id is null))
                       order by a.sequence desc limit 1""", (account_id, day))
        r = cur.fetchone()
        cur.execute("select count(*) n from trade_authorizations where account_id=%s and trading_day=%s and status='EXECUTED'",
                    (account_id, day))
        taken = cur.fetchone()["n"]
        return outcomes, (r["sequence"] if r else None), taken, outcomes.count("WIN"), outcomes.count("LOSS"), net

    def _save(self, cur, row: dict, new_state: RiskState, actor: str, kind: str, payload: dict | None = None,
              reason: str | None = None) -> RiskState:
        a, d = row["account_id"], row["trading_day"]
        outcomes, _, taken, wins, losses, net = self._facts(cur, a, d)
        cur.execute("""update daily_risk_states set state=%s, trades_taken=%s, wins=%s, losses=%s, net_result_brl=%s,
                         reconciliation_reason=%s, version=version+1, updated_at=now()
                       where account_id=%s and trading_day=%s and version=%s""",
                    (new_state.value, taken, wins, losses, net, reason, a, d, row["version"]))
        if cur.rowcount != 1:
            raise ConcurrencyError("O estado do dia mudou durante a operação; nada foi alterado.")
        if new_state.value != row["state"] or kind != "STATE_TRANSITION":
            self._event(cur, a, d, kind, actor, row["state"], new_state.value, payload)
        return new_state

    def _recompute(self, cur, row: dict, actor: str, kind: str = "STATE_TRANSITION", payload: dict | None = None) -> RiskState:
        if row["state"] == RiskState.RECONCILIATION_REQUIRED.value:
            return self._save(cur, row, RiskState.RECONCILIATION_REQUIRED, actor, kind, payload, row["reconciliation_reason"])
        outcomes, active, *_ = self._facts(cur, row["account_id"], row["trading_day"])
        return self._save(cur, row, derive_state(outcomes, active), actor, kind, payload)

    def _expire_stale(self, cur, account_id, now) -> None:
        """Autorização ISSUED vencida e nunca pega pelo EA: expira e libera a vaga. PICKED_UP vencida NÃO
        expira sozinha (a ordem pode ter sido enviada): isso é caso de reconciliação."""
        cur.execute("""update trade_authorizations set status='EXPIRED'
                       where account_id=%s and status='ISSUED' and expires_at <= %s
                       returning trading_day, authorization_id""", (account_id, now))
        for r in cur.fetchall():
            row = self._lock(cur, account_id, r["trading_day"])
            self._recompute(cur, row, "risk_manager", "AUTHORIZATION_EXPIRED", {"authorization_id": r["authorization_id"]})

    # ---------- leitura ----------

    def today(self, account_id) -> dict:
        now = self.clock()
        day = trading_day(now)
        with self._conn() as c, c.cursor() as cur:
            self._expire_stale(cur, account_id, now)
            self._ensure_day(cur, account_id, day)
            cur.execute("select * from daily_risk_states where account_id=%s and trading_day=%s", (account_id, day))
            st = cur.fetchone()
            cur.execute("select entries_paused, emergency_stop, emergency_reason from accounts where id=%s", (account_id,))
            acc = cur.fetchone()
        return {**st, **acc, "trading_day": day.isoformat(),
                "entries_allowed": st["state"] in {s.value for s in ENTRY_ALLOWED_STATES}
                and not acc["entries_paused"] and not acc["emergency_stop"]}

    # ---------- autorização ----------

    def authorize(self, *, account_id, signal_id, spec: SymbolSpec, costs: ExecCosts, fx_to_brl: float,
                  news_blocked: bool = False) -> Decision2x0:
        now = self.clock()
        day = trading_day(now)
        with self._conn() as c, c.cursor() as cur:
            self._expire_stale(cur, account_id, now)
            row = self._lock(cur, account_id, day)
            state = RiskState(row["state"])

            def deny(reason: str) -> Decision2x0:
                self._event(cur, account_id, day, "AUTHORIZATION_DENIED", "risk_manager", state.value, state.value,
                            {"signal_id": str(signal_id), "motivo": reason})
                return Decision2x0(False, reason, None, state)

            cur.execute("select account_mode, entries_paused, emergency_stop from accounts where id=%s for update",
                        (account_id,))
            acc = cur.fetchone()
            if acc is None:
                raise RiskError("Conta inexistente.")
            if acc["account_mode"] != "DEMO":
                return deny("Somente conta DEMO é aceita nesta versão.")
            if acc["emergency_stop"]:
                return deny("Botão de emergência ativo: novas entradas bloqueadas.")
            if acc["entries_paused"]:
                return deny("Novas entradas pausadas pelo painel.")
            if state not in ENTRY_ALLOWED_STATES:
                return deny(f"Estado {state.value}: o 2x0 não permite nova entrada agora.")
            if news_blocked:
                return deny("Janela de notícia de alto impacto.")
            cur.execute("select count(*) n from positions where account_id=%s and status='OPEN'", (account_id,))
            if cur.fetchone()["n"]:
                return deny("Já existe posição aberta nesta conta.")
            cur.execute("select count(*) n from trade_authorizations where account_id=%s and status in ('ISSUED','PICKED_UP')",
                        (account_id,))
            if cur.fetchone()["n"]:
                return deny("Já existe autorização pendente nesta conta.")

            cur.execute("""select s.*, ast.symbol from trading_signals s
                           join technical_analyses t on t.id = s.analysis_id join assets ast on ast.id = t.asset_id
                           where s.id=%s""", (signal_id,))
            sig = cur.fetchone()
            if sig is None:
                return deny("Sinal inexistente.")
            if sig["valid_until"] is not None and sig["valid_until"] <= now:
                return deny("Sinal vencido.")
            if not spec.symbol.upper().startswith(sig["symbol"]):
                return deny(f"Símbolo da corretora ({spec.symbol}) não corresponde ao sinal ({sig['symbol']}).")
            direction = Decision(sig["decision"])
            entry, sl, tp = (float(sig[k]) if sig[k] is not None else float("nan")
                             for k in ("reference_price", "stop_loss", "take_profit"))
            bad = validate_levels(direction, entry, sl, tp)
            if bad:
                return deny(bad)
            size = size_position(spec=spec, entry=entry, stop=sl, costs=costs, fx_to_brl=fx_to_brl,
                                 max_risk_brl=self.max_risk_brl)
            if not size.ok:
                return deny(size.reason)

            outcomes, _, *_ = self._facts(cur, account_id, day)
            seq = len(outcomes) + 1
            if seq > 2:
                return deny("Limite de duas operações no dia.")
            auth_id = uuid.uuid4()
            expires = now + AUTH_TTL
            cur.execute("""insert into trade_authorizations(authorization_id,account_id,trading_day,sequence,signal_id,symbol,
                             direction,volume_lots,stop_loss,take_profit,planned_risk_brl,expires_at)
                           values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                        (auth_id, account_id, day, seq, signal_id, spec.symbol, direction.value, size.lots, sl, tp,
                         size.planned_risk_brl, expires))
            new_state = self._recompute(cur, row, "risk_manager", "AUTHORIZATION_ISSUED",
                                        {"authorization_id": str(auth_id), "lots": size.lots, "risco_brl": size.planned_risk_brl})
            auth = TradeAuthorization(str(auth_id), str(signal_id), spec.symbol, direction, size.lots, sl, tp,
                                      size.planned_risk_brl, expires, "DEMO")
            return Decision2x0(True, size.reason, auth, new_state)

    # ---------- eventos de execução (vindos do EA na Fase 4) ----------

    def _auth_row(self, cur, authorization_id) -> dict:
        cur.execute("select * from trade_authorizations where authorization_id=%s for update", (authorization_id,))
        a = cur.fetchone()
        if a is None:
            raise RiskError("Autorização inexistente.")
        return a

    def mark_picked_up(self, authorization_id) -> bool:
        """O EA pegou a autorização. Só funciona uma vez e só antes de vencer (idempotência)."""
        with self._conn() as c, c.cursor() as cur:
            cur.execute("""update trade_authorizations set status='PICKED_UP'
                           where authorization_id=%s and status='ISSUED' and expires_at > %s""",
                        (authorization_id, self.clock()))
            return cur.rowcount == 1

    def on_order_rejected(self, authorization_id, *, retcode: int | None, message: str) -> RiskState:
        """Corretora rejeitou com certeza (nenhuma posição): a vaga é liberada."""
        with self._conn() as c, c.cursor() as cur:
            a = self._auth_row(cur, authorization_id)
            if a["status"] not in LIVE_AUTH:
                raise RiskError(f"Autorização em {a['status']} não pode ser rejeitada.")
            cur.execute("update trade_authorizations set status='REJECTED' where authorization_id=%s", (authorization_id,))
            cur.execute("""insert into orders(authorization_id,status,broker_retcode,broker_message) values (%s,'REJECTED',%s,%s)
                           on conflict (authorization_id) do update set status='REJECTED', broker_retcode=excluded.broker_retcode,
                           broker_message=excluded.broker_message""", (authorization_id, retcode, message))
            row = self._lock(cur, a["account_id"], a["trading_day"])
            return self._recompute(cur, row, "ea", "ORDER_REJECTED", {"authorization_id": str(authorization_id), "retcode": retcode})

    def on_order_uncertain(self, authorization_id, *, reason: str) -> RiskState:
        """Timeout ou resposta incerta: não sabemos se a posição existe. Bloqueia até reconciliar."""
        with self._conn() as c, c.cursor() as cur:
            a = self._auth_row(cur, authorization_id)
            cur.execute("""insert into orders(authorization_id,status,broker_message) values (%s,'UNKNOWN',%s)
                           on conflict (authorization_id) do update set status='UNKNOWN', broker_message=excluded.broker_message""",
                        (authorization_id, reason))
            return self._require_reconciliation(cur, a["account_id"], a["trading_day"], f"Ordem incerta: {reason}", "ea")

    def on_position_opened(self, authorization_id, *, position_ticket: str, deal_ticket: str, price: float,
                           volume_lots: float, commission: float, opened_at: datetime) -> RiskState:
        """Confirmação REAL da corretora (deal + posição). Repetir o mesmo aviso não duplica nada."""
        with self._conn() as c, c.cursor() as cur:
            a = self._auth_row(cur, authorization_id)
            cur.execute("select broker_position_ticket from positions where authorization_id=%s", (authorization_id,))
            existing = cur.fetchone()
            row = self._lock(cur, a["account_id"], a["trading_day"])
            if existing:
                if existing["broker_position_ticket"] != position_ticket:
                    return self._require_reconciliation(cur, a["account_id"], a["trading_day"],
                                                        "Mesma autorização reportada com outra posição.", "ea", row)
                return RiskState(row["state"])  # aviso repetido: idempotente
            if volume_lots > float(a["volume_lots"]) + 1e-9:
                return self._require_reconciliation(cur, a["account_id"], a["trading_day"],
                                                    f"Volume executado {volume_lots} acima do autorizado {a['volume_lots']}.", "ea", row)
            if a["status"] not in ("ISSUED", "PICKED_UP", "EXECUTED"):
                return self._require_reconciliation(cur, a["account_id"], a["trading_day"],
                                                    f"Posição aberta para autorização em {a['status']}.", "ea", row)
            cur.execute("update trade_authorizations set status='EXECUTED' where authorization_id=%s", (authorization_id,))
            cur.execute("""insert into orders(authorization_id,status,sent_at) values (%s,'ACCEPTED',%s)
                           on conflict (authorization_id) do update set status='ACCEPTED'
                           returning id""", (authorization_id, opened_at))
            order_id = cur.fetchone()["id"]
            cur.execute("""insert into executions(order_id,broker_deal_ticket,kind,price,volume_lots,commission,executed_at)
                           values (%s,%s,'ENTRY',%s,%s,%s,%s)""", (order_id, deal_ticket, price, volume_lots, commission, opened_at))
            cur.execute("""insert into positions(account_id,authorization_id,broker_position_ticket,status,opened_at)
                           values (%s,%s,%s,'OPEN',%s)""", (a["account_id"], authorization_id, position_ticket, opened_at))
            return self._recompute(cur, row, "ea", "POSITION_OPENED", {"authorization_id": str(authorization_id), "ticket": position_ticket})

    def on_position_closed(self, authorization_id, *, deal_ticket: str, price: float, gross_result: float,
                           costs: float, fx_to_brl: float, closed_at: datetime) -> RiskState:
        """Fechamento confirmado. O resultado conta no DIA DA OPERAÇÃO, mesmo que feche depois da virada."""
        if fx_to_brl <= 0:
            raise RiskError("Conversão para BRL inválida.")
        with self._conn() as c, c.cursor() as cur:
            a = self._auth_row(cur, authorization_id)
            cur.execute("select * from positions where authorization_id=%s for update", (authorization_id,))
            p = cur.fetchone()
            row = self._lock(cur, a["account_id"], a["trading_day"])
            if p is None:
                return self._require_reconciliation(cur, a["account_id"], a["trading_day"],
                                                    "Fechamento recebido sem posição registrada.", "ea", row)
            cur.execute("select 1 from trade_results where position_id=%s", (p["id"],))
            if cur.fetchone():
                return RiskState(row["state"])  # já registrado: idempotente
            net_acct = gross_result - costs
            net_brl = round(net_acct * fx_to_brl, 2)
            outcome = "WIN" if net_brl > 0 else "LOSS"
            cur.execute("select id from orders where authorization_id=%s", (authorization_id,))
            order_id = cur.fetchone()["id"]
            cur.execute("""insert into executions(order_id,broker_deal_ticket,kind,price,volume_lots,commission,executed_at)
                           select %s,%s,'EXIT',%s,e.volume_lots,0,%s from executions e where e.order_id=%s and e.kind='ENTRY'
                           on conflict (broker_deal_ticket) do nothing""", (order_id, deal_ticket, price, closed_at, order_id))
            cur.execute("update positions set status='CLOSED', closed_at=%s where id=%s", (closed_at, p["id"]))
            cur.execute("""insert into trade_results(position_id,gross_result,costs,net_result_account_ccy,fx_to_brl,net_result_brl,
                             outcome,confirmed_by_broker) values (%s,%s,%s,%s,%s,%s,%s,true)""",
                        (p["id"], gross_result, costs, net_acct, fx_to_brl, net_brl, outcome))
            return self._recompute(cur, row, "ea", "POSITION_CLOSED",
                                   {"authorization_id": str(authorization_id), "resultado_brl": net_brl, "outcome": outcome})

    # ---------- reconciliação ----------

    def _require_reconciliation(self, cur, account_id, day, reason, actor, row=None) -> RiskState:
        row = row or self._lock(cur, account_id, day)
        st = self._save(cur, row, RiskState.RECONCILIATION_REQUIRED, actor, "RECONCILIATION_REQUIRED", {"motivo": reason}, reason)
        # o dia de hoje também precisa parar, se for outro
        today = trading_day(self.clock())
        if today != day:
            trow = self._lock(cur, account_id, today)
            if trow["state"] != RiskState.RECONCILIATION_REQUIRED.value:
                self._save(cur, trow, RiskState.RECONCILIATION_REQUIRED, actor, "RECONCILIATION_REQUIRED",
                           {"motivo": reason, "dia_origem": str(day)}, reason)
        return st

    def require_reconciliation(self, account_id, reason: str, actor: str = "risk_manager") -> RiskState:
        with self._conn() as c, c.cursor() as cur:
            return self._require_reconciliation(cur, account_id, trading_day(self.clock()), reason, actor)

    def resolve_uncertain_order(self, authorization_id, *, position_exists: bool, actor: str) -> None:
        """Resultado da verificação na corretora para uma ordem incerta (feita pelo EA ou pelo operador)."""
        with self._conn() as c, c.cursor() as cur:
            a = self._auth_row(cur, authorization_id)
            cur.execute("select status from orders where authorization_id=%s for update", (authorization_id,))
            o = cur.fetchone()
            if not o or o["status"] != "UNKNOWN":
                raise RiskError("Não há ordem incerta para esta autorização.")
            if position_exists:
                raise RiskError("Se a posição existe, registre-a com on_position_opened (com os tickets reais).")
            cur.execute("update orders set status='REJECTED', broker_message='sem posição na corretora' where authorization_id=%s",
                        (authorization_id,))
            cur.execute("update trade_authorizations set status='CANCELLED' where authorization_id=%s and status in ('ISSUED','PICKED_UP')",
                        (authorization_id,))
            self._event(cur, a["account_id"], a["trading_day"], "UNCERTAIN_ORDER_RESOLVED", actor, None, None,
                        {"authorization_id": str(authorization_id), "posicao_existe": False})

    def reconcile(self, account_id, actor: str) -> tuple[bool, str]:
        """Sai de RECONCILIATION_REQUIRED se não sobrar pendência. Vale para hoje e para dias anteriores travados."""
        now = self.clock()
        today = trading_day(now)
        with self._conn() as c, c.cursor() as cur:
            self._expire_stale(cur, account_id, now)
            cur.execute("""select count(*) n from orders o join trade_authorizations a using (authorization_id)
                           where a.account_id=%s and o.status='UNKNOWN'""", (account_id,))
            if cur.fetchone()["n"]:
                return False, "Ainda existe ordem com resultado incerto."
            cur.execute("""select count(*) n from trade_authorizations where account_id=%s and status='PICKED_UP'
                           and expires_at <= %s""", (account_id, now))
            if cur.fetchone()["n"]:
                return False, "Autorização entregue ao EA sem confirmação: verifique a corretora."
            cur.execute("""select count(*) n from positions p join trade_authorizations a using (authorization_id)
                           where p.account_id=%s and p.status='OPEN' and a.trading_day < %s""", (account_id, today))
            if cur.fetchone()["n"]:
                return False, "Posição de um dia anterior ainda aberta."
            self._ensure_day(cur, account_id, today)
            cur.execute("""select trading_day from daily_risk_states where account_id=%s and state='RECONCILIATION_REQUIRED'
                           order by trading_day""", (account_id,))
            days = [r["trading_day"] for r in cur.fetchall()]
            for d in days:
                row = self._lock(cur, account_id, d)
                outcomes, active, *_ = self._facts(cur, account_id, d)
                self._save(cur, row, derive_state(outcomes, active), actor, "RECONCILED", {"dia": str(d)})
            return True, f"Reconciliado ({len(days)} dia(s))."

    # ---------- controles do painel ----------

    def _control(self, account_id, actor: str, kind: str, sql: str, params: tuple, payload: dict) -> None:
        with self._conn() as c, c.cursor() as cur:
            cur.execute(sql, params)
            if cur.rowcount != 1:
                raise RiskError("Conta inexistente.")
            self._event(cur, account_id, trading_day(self.clock()), kind, actor, None, None, payload)

    def pause(self, account_id, actor: str) -> None:
        self._control(account_id, actor, "ENTRIES_PAUSED", "update accounts set entries_paused=true where id=%s", (account_id,), {})

    def resume(self, account_id, actor: str) -> None:
        self._control(account_id, actor, "ENTRIES_RESUMED", "update accounts set entries_paused=false where id=%s", (account_id,), {})

    def emergency_stop(self, account_id, actor: str, reason: str) -> None:
        """Bloqueia novas entradas na hora. NÃO fecha posições: isso é outro comando, com confirmação explícita."""
        self._control(account_id, actor, "EMERGENCY_STOP",
                      "update accounts set emergency_stop=true, emergency_reason=%s where id=%s", (reason, account_id),
                      {"motivo": reason})

    def clear_emergency(self, account_id, actor: str) -> None:
        self._control(account_id, actor, "EMERGENCY_CLEARED",
                      "update accounts set emergency_stop=false, emergency_reason=null where id=%s", (account_id,), {})
