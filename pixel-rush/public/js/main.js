import { App } from './ui.js';

const app = new App();
window.__app = app; // útil para depuração e testes automatizados
app.init().catch((e) => {
  document.getElementById('ui').innerHTML = `<div class="card" style="margin:40px auto;max-width:520px"><h2>Não foi possível iniciar</h2><p>${String(e.message).replace(/</g, '&lt;')}</p></div>`;
});
