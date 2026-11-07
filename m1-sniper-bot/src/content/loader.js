// Content scripts clássicos não podem usar `import` estático; carregamos o
// módulo principal da própria extensão (web_accessible_resources).
(async () => {
  if (window.__m1SniperLoaded) return;
  window.__m1SniperLoaded = true;
  try {
    const { start } = await import(chrome.runtime.getURL('src/content/main.js'));
    start();
  } catch (e) {
    console.error('[M1 SNIPER BOT] falha ao iniciar', e);
  }
})();
