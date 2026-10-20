import { expect, test } from "@playwright/test";

test("landing page presents the product without fabricated claims", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Defina o objetivo");
  await expect(page.getByText("Estrutura ilustrativa, ainda não validada comercialmente")).toBeVisible();
  await expect(page.getByRole("link", { name: "Criar conta" }).first()).toHaveAttribute("href", "/signup");
});

test("landing page has no horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("protected routes redirect to setup when Supabase is not configured @unconfigured", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByText("Não configurado").first()).toBeVisible();
});

test("login shows setup guidance instead of pretending to work @unconfigured", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Autenticação não configurada")).toBeVisible();
  await page.getByLabel("E-mail").fill("a@b.com");
  await page.getByLabel("Senha").fill("12345678");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("A autenticação não está configurada neste servidor")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("protected routes redirect to login when signed out @full", async ({ page }) => {
  await page.goto("/missions");
  await expect(page).toHaveURL(/\/login\?next=%2Fmissions/);
});
