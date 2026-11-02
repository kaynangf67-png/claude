"""
test_live.py — roda na SUA máquina, não no servidor.
Abre o Chrome visível, navega na Safirion, detecta seletores,
testa o data feed e valida todo o pipeline antes de rodar o bot real.
"""

import asyncio
import sys
import os
import json
from datetime import datetime
from colorama import Fore, Style, init as colorama_init
colorama_init(autoreset=True)

sys.path.insert(0, os.path.dirname(__file__))
from config import BROKER_URL, EMAIL, PASSWORD, ASSET, ENTRY_AMOUNT
from data_feed import fetch_m1
from indicators import analyze


SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

SEL_CANDIDATES_CALL = [
    'button.call-btn', 'button[data-direction="call"]',
    '.btn-up', '.call', '[class*="call"]',
    'button:has-text("CALL")', 'button:has-text("CIMA")',
    'button:has-text("COMPRA")', 'button:has-text("UP")',
    '[class*="green"][class*="btn"]',
]
SEL_CANDIDATES_PUT = [
    'button.put-btn', 'button[data-direction="put"]',
    '.btn-down', '.put', '[class*="put"]',
    'button:has-text("PUT")', 'button:has-text("BAIXO")',
    'button:has-text("VENDA")', 'button:has-text("DOWN")',
    '[class*="red"][class*="btn"]',
]
SEL_CANDIDATES_AMOUNT = [
    'input[data-testid="amount"]',
    '.trade-amount input',
    'input[placeholder*="alor"]',
    'input[placeholder*="mount"]',
    'input[placeholder*="1000"]',
    'input[type="number"]',
]


def ok(msg):  print(f"{Fore.GREEN}  ✓ {msg}{Style.RESET_ALL}")
def fail(msg):print(f"{Fore.RED}  ✗ {msg}{Style.RESET_ALL}")
def info(msg):print(f"{Fore.CYAN}  · {msg}{Style.RESET_ALL}")
def hdr(msg): print(f"\n{Fore.YELLOW}{'─'*50}\n  {msg}\n{'─'*50}{Style.RESET_ALL}")


async def find_selector(page, candidates: list[str]) -> str | None:
    for sel in candidates:
        try:
            count = await page.locator(sel).count()
            if count > 0:
                return sel
        except Exception:
            pass
    return None


async def screenshot(page, name: str):
    path = os.path.join(SCREENSHOT_DIR, f"{name}.png")
    await page.screenshot(path=path, full_page=False)
    info(f"Screenshot → screenshots/{name}.png")
    return path


async def run():
    from playwright.async_api import async_playwright

    results = {
        "timestamp": datetime.now().isoformat(),
        "data_feed": False,
        "indicators": None,
        "browser_launch": False,
        "site_load": False,
        "login": False,
        "selectors": {},
    }

    # ── 1. DATA FEED ──────────────────────────────────────────
    hdr("1 · DATA FEED M1")
    try:
        df = fetch_m1(ASSET, bars=100)
        ok(f"{len(df)} velas M1 recebidas para {ASSET}")
        results["data_feed"] = True

        r = analyze(df)
        results["indicators"] = r
        sig_str = r["signal"] or "AGUARDANDO"
        color = Fore.GREEN if r["signal"] == "CALL" else (Fore.RED if r["signal"] == "PUT" else Fore.WHITE)
        print(f"  {color}Sinal atual: {sig_str}  score: {r['score']}/5{Style.RESET_ALL}")
        for reason in r["reasons"]:
            info(reason)
    except Exception as e:
        fail(f"Data feed: {e}")

    # ── 2. BROWSER ────────────────────────────────────────────
    hdr("2 · BROWSER + SAFIRION")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        results["browser_launch"] = True
        ok("Chrome iniciado")

        ctx  = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        page = await ctx.new_page()

        # navega
        try:
            resp = await page.goto(BROKER_URL, wait_until="domcontentloaded", timeout=20_000)
            await page.wait_for_timeout(2000)
            status = resp.status if resp else "?"
            title  = await page.title()
            ok(f"Site carregado — status {status}  título: '{title}'")
            results["site_load"] = True
            await screenshot(page, "01_home")
        except Exception as e:
            fail(f"Não foi possível carregar {BROKER_URL}: {e}")
            await browser.close()
            _report(results)
            return

        # ── 3. LOGIN ──────────────────────────────────────────
        hdr("3 · LOGIN")
        if EMAIL == "SEU_EMAIL_AQUI":
            info("Credenciais não configuradas — pulando login (edite config.py)")
        else:
            try:
                email_sel = await find_selector(page, [
                    'input[type="email"]','input[name="email"]','input[placeholder*="mail"]',
                ])
                pwd_sel = await find_selector(page, [
                    'input[type="password"]','input[name="password"]',
                ])
                btn_sel = await find_selector(page, [
                    'button[type="submit"]','input[type="submit"]',
                    'button:has-text("Entrar")','button:has-text("Login")','button:has-text("Acessar")',
                ])
                if email_sel and pwd_sel:
                    await page.locator(email_sel).first.fill(EMAIL)
                    await page.wait_for_timeout(300)
                    await page.locator(pwd_sel).first.fill(PASSWORD)
                    await page.wait_for_timeout(300)
                    if btn_sel:
                        await page.locator(btn_sel).first.click()
                        await page.wait_for_load_state("networkidle", timeout=15_000)
                        await page.wait_for_timeout(2000)
                        await screenshot(page, "02_after_login")
                        ok("Login enviado")
                        results["login"] = True
                    else:
                        fail("Botão de login não encontrado")
                else:
                    fail(f"Campos de login não encontrados (email={email_sel}, pwd={pwd_sel})")
            except Exception as e:
                fail(f"Erro no login: {e}")

        # ── 4. DETECTA SELETORES DE TRADING ───────────────────
        hdr("4 · DETECÇÃO DE SELETORES")
        await screenshot(page, "03_trading_page")

        call_sel   = await find_selector(page, SEL_CANDIDATES_CALL)
        put_sel    = await find_selector(page, SEL_CANDIDATES_PUT)
        amount_sel = await find_selector(page, SEL_CANDIDATES_AMOUNT)

        results["selectors"] = {
            "call":   call_sel,
            "put":    put_sel,
            "amount": amount_sel,
        }

        if call_sel:   ok(f"Botão CALL → '{call_sel}'")
        else:          fail("Botão CALL não detectado automaticamente")
        if put_sel:    ok(f"Botão PUT  → '{put_sel}'")
        else:          fail("Botão PUT não detectado automaticamente")
        if amount_sel: ok(f"Campo valor → '{amount_sel}'")
        else:          fail("Campo de valor não detectado automaticamente")

        # ── 5. HTML DUMP para debug manual ────────────────────
        html = await page.content()
        dump_path = os.path.join(SCREENSHOT_DIR, "page_dump.html")
        with open(dump_path, "w", encoding="utf-8") as f:
            f.write(html)
        info(f"HTML salvo → screenshots/page_dump.html (inspecione para seletores)")

        await page.wait_for_timeout(3000)
        await browser.close()

    # ── 6. RELATÓRIO ──────────────────────────────────────────
    _report(results)


def _report(results: dict):
    hdr("RELATÓRIO FINAL")
    checks = [
        ("Data feed M1",      results["data_feed"]),
        ("Browser Chrome",    results["browser_launch"]),
        ("Site Safirion",     results["site_load"]),
        ("Login",             results["login"]),
        ("Seletor CALL",      bool(results["selectors"].get("call"))),
        ("Seletor PUT",       bool(results["selectors"].get("put"))),
        ("Seletor valor",     bool(results["selectors"].get("amount"))),
    ]
    all_ok = all(v for _, v in checks)
    for label, passed in checks:
        (ok if passed else fail)(label)

    if all_ok:
        print(f"\n{Fore.GREEN}  TUDO OK — rode 'python main.py' para iniciar o bot.{Style.RESET_ALL}")
    else:
        failed = [l for l, v in checks if not v]
        print(f"\n{Fore.YELLOW}  Pendente: {', '.join(failed)}{Style.RESET_ALL}")
        if not results["selectors"].get("call"):
            print(f"{Fore.WHITE}  → Abra screenshots/page_dump.html, inspecione os botões")
            print(f"     e atualize SEL_CALL_BTN/SEL_PUT_BTN em config.py{Style.RESET_ALL}")

    report_path = os.path.join(os.path.dirname(__file__), "test_report.json")
    with open(report_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\n  Relatório JSON → test_report.json")


if __name__ == "__main__":
    asyncio.run(run())
