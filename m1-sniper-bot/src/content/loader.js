// Content scripts clássicos não podem usar `import` estático; carregamos o
// módulo principal da própria extensão (web_accessible_resources).
// Se o painel já existe (ex.: clique no ícone), apenas mostra/oculta.
(async () => {
  const wantToggle = window.__m1SniperWantToggle === true;
  window.__m1SniperWantToggle = false;
  if (window.__m1SniperLoaded) {
    if (wantToggle && typeof window.__m1SniperToggle === 'function') window.__m1SniperToggle();
    return;
  }
  window.__m1SniperLoaded = true;
  try {
    const { start } = await import(chrome.runtime.getURL('src/content/main.js'));
    await start();
  } catch (e) {
    window.__m1SniperLoaded = false;
    console.error('[M1 SNIPER BOT] falha ao iniciar', e);
  }
})();
