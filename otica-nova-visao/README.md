# Ótica Nova Visão — landing page

Página única, estática (HTML + CSS + JS puro, sem dependências). Abra `index.html` no navegador.

## O que editar antes de publicar

1. **Objeto `CONFIG`** no fim do `index.html`: WhatsApp (só números com DDD), telefone exibido, endereço, horário, Instagram, `temExameDeVista` e `fazEntrega`. Enquanto algo estiver como `[...]`, aparece um aviso amarelo no topo da página.
2. **`[CIDADE]`** no `<title>`, na meta description, no Open Graph e no selo do hero.
3. **`[URL-DO-SITE]`** nas tags Open Graph, mais uma imagem 1200x630 em `fotos/og.jpg`.
4. **Fotos**: coloque as fotos reais em `fotos/` (WebP, ~900px de largura) e troque os `src` marcados com `TROCAR FOTO`. Se uma foto não carregar, aparece um placeholder laranja no lugar.
5. **Destaques**: os cards usam ilustrações SVG de formatos de armação. Troque cada `<svg>` por `<img src="fotos/destaque-N.webp">`.
6. **Depoimentos**: seção comentada no HTML. Só ative com depoimentos reais e autorizados.

Todos os botões com `data-wa` viram link do WhatsApp automaticamente. `data-wa="texto"` define a mensagem pré-pronta daquele botão; `data-wa` vazio usa `CONFIG.mensagemPadrao`.
