"""
Safirion Auto-Bot M1
────────────────────
Fluxo por vela:
  1. Aguarda fechamento da vela atual
  2. Baixa últimas 100 velas M1
  3. Roda análise de indicadores
  4. Se sinal ≥ MIN_SIGNALS → entra na PRÓXIMA vela com R$ 1.000
  5. Repete
"""

import asyncio
import time
from datetime import datetime, timezone
from colorama import Fore, Style, init as colorama_init

from config  import ASSET, ENTRY_AMOUNT
from data_feed  import fetch_m1, seconds_to_next_candle
from indicators import analyze
from broker     import SafirionBot

colorama_init(autoreset=True)

BANNER = f"""
{Fore.CYAN}╔══════════════════════════════════════════╗
║      SAFIRION AUTO-BOT  ·  M1            ║
║  Ativo: {ASSET:<8}  Entrada: R$ {ENTRY_AMOUNT:>7,.0f}   ║
╚══════════════════════════════════════════╝{Style.RESET_ALL}
"""

def log(msg: str, color: str = Fore.WHITE):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"{color}[{ts}] {msg}{Style.RESET_ALL}")


async def main():
    print(BANNER)
    bot = SafirionBot()
    await bot.start(headless=False)   # headless=True para rodar sem janela
    await bot.login()

    trade_count = 0
    win_count   = 0

    log("Monitorando mercado... aguardando próxima vela.", Fore.CYAN)

    while True:
        # ── espera até o fechamento da vela atual ──
        wait = seconds_to_next_candle()
        log(f"Próxima vela em {wait:.1f}s", Fore.WHITE)
        await asyncio.sleep(wait + 0.5)   # +0.5s para garantir fechamento

        # ── busca dados ──
        try:
            df = fetch_m1(ASSET, bars=100)
        except Exception as e:
            log(f"Erro ao buscar dados: {e}", Fore.RED)
            await asyncio.sleep(5)
            continue

        # ── análise ──
        result = analyze(df)
        signal  = result["signal"]
        score   = result["score"]
        reasons = result["reasons"]

        log(f"Análise: sinal={signal or 'AGUARDANDO'} | score={score}/5", Fore.YELLOW)
        for r in reasons:
            log(f"  · {r}", Fore.WHITE)

        # ── entrada na próxima vela ──
        if signal in ("CALL", "PUT"):
            color = Fore.GREEN if signal == "CALL" else Fore.RED
            log(f">>> SINAL {signal} CONFIRMADO — entrando na próxima vela!", color)

            # espera o início exato da próxima vela
            nxt = seconds_to_next_candle()
            log(f"Aguardando abertura da vela ({nxt:.1f}s)...", Fore.CYAN)
            await asyncio.sleep(nxt + 0.3)

            ok = await bot.enter(signal)
            if ok:
                trade_count += 1
                await bot.screenshot(f"entry_{trade_count:04d}_{signal}.png")
                log(f"Entrada #{trade_count} executada — {signal} R$ {ENTRY_AMOUNT:,.0f}", color)
        else:
            log("Sem confluência — aguardando próxima vela.", Fore.WHITE)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}[BOT] Encerrado pelo usuário.{Style.RESET_ALL}")
