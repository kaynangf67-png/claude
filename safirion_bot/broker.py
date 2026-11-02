"""
Automação de entrada na Safirion via Playwright.
Login único — entradas subsequentes reutilizam a sessão.
"""

import asyncio
import re
from playwright.async_api import async_playwright, Page, Browser
from colorama import Fore, Style
from config import (
    BROKER_URL, EMAIL, PASSWORD, ENTRY_AMOUNT, EXPIRY_MINUTES,
    SEL_EMAIL, SEL_PASSWORD, SEL_LOGIN_BTN,
    SEL_AMOUNT, SEL_CALL_BTN, SEL_PUT_BTN, SEL_EXPIRY
)


class SafirionBot:
    def __init__(self):
        self._pw       = None
        self._browser: Browser | None = None
        self._page:    Page    | None = None
        self._logged   = False

    async def start(self, headless: bool = False):
        self._pw      = await async_playwright().start()
        import shutil, os
        # detecta binário disponível no ambiente
        candidates = [
            "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome",
            "/opt/pw-browsers/chromium/chrome-linux/chrome",
            shutil.which("chromium") or "",
            shutil.which("google-chrome") or "",
        ]
        exe = next((p for p in candidates if p and os.path.isfile(p)), None)
        launch_opts: dict = {
            "headless": headless,
            "args": ["--no-sandbox", "--disable-dev-shm-usage",
                     "--disable-blink-features=AutomationControlled"],
        }
        if exe:
            launch_opts["executable_path"] = exe
        self._browser = await self._pw.chromium.launch(**launch_opts)
        ctx = await self._browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        self._page = await ctx.new_page()
        print(f"{Fore.CYAN}[BOT] Navegador iniciado.{Style.RESET_ALL}")

    async def login(self):
        page = self._page
        print(f"{Fore.YELLOW}[BOT] Fazendo login...{Style.RESET_ALL}")
        await page.goto(BROKER_URL, wait_until="networkidle", timeout=30_000)
        await page.wait_for_timeout(1500)

        # preenche email
        await page.locator(SEL_EMAIL).first.fill(EMAIL)
        await page.wait_for_timeout(300)

        # preenche senha
        await page.locator(SEL_PASSWORD).first.fill(PASSWORD)
        await page.wait_for_timeout(300)

        # clica login
        await page.locator(SEL_LOGIN_BTN).first.click()
        await page.wait_for_load_state("networkidle", timeout=20_000)
        await page.wait_for_timeout(2000)

        self._logged = True
        print(f"{Fore.GREEN}[BOT] Login OK — sessão ativa.{Style.RESET_ALL}")

    async def _set_amount(self):
        page = self._page
        try:
            field = page.locator(SEL_AMOUNT).first
            await field.triple_click()
            await field.fill(str(ENTRY_AMOUNT))
        except Exception as e:
            print(f"{Fore.RED}[BOT] Erro ao definir valor: {e}{Style.RESET_ALL}")

    async def _set_expiry(self):
        page = self._page
        try:
            sel = page.locator(SEL_EXPIRY).first
            count = await sel.count()
            if count:
                await sel.select_option(label=f"{EXPIRY_MINUTES}m")
        except Exception:
            pass  # alguns brokers já têm expiração selecionada via UI

    async def enter(self, direction: str) -> bool:
        """direction: 'CALL' ou 'PUT'"""
        if not self._logged:
            await self.login()

        page = self._page
        await self._set_amount()
        await self._set_expiry()
        await page.wait_for_timeout(400)

        btn_sel = SEL_CALL_BTN if direction == "CALL" else SEL_PUT_BTN
        try:
            btn = page.locator(btn_sel).first
            await btn.wait_for(state="visible", timeout=5000)
            await btn.click()
            print(
                f"{Fore.GREEN if direction == 'CALL' else Fore.RED}"
                f"[BOT] ENTRADA {direction} — R$ {ENTRY_AMOUNT:,.0f}{Style.RESET_ALL}"
            )
            return True
        except Exception as e:
            print(f"{Fore.RED}[BOT] Falha na entrada: {e}{Style.RESET_ALL}")
            return False

    async def screenshot(self, path: str = "last_entry.png"):
        await self._page.screenshot(path=path, full_page=False)

    async def close(self):
        if self._browser:
            await self._browser.close()
        if self._pw:
            await self._pw.stop()
