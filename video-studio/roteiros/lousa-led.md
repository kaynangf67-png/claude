# Roteiro de testes: lousa mágica de LED (Mercado Livre + TikTok Shop)

Versão para o usuário (Google Docs): "Roteiros de gravação – Lousa de LED (Mercado Livre + TikTok Shop)"
https://docs.google.com/document/d/1N9N2Hwebv5zU0TVjt7UqJPdJ4YOWwmeifiY-vlEi5Jc/edit

Modelado do roteiro original em inglês (presente de Natal, traço que brilha, "never asking for my
iPad", abajur, apaga e usa de novo). 20 takes de narração + 8 cenas de vídeo sem fala.
**Não usar o vídeo baixado do TikTok (@pxqhl, marca GOMYMO, personagem Bluey)**: só referência.

## Como o material chega

- **Áudio**: takes anunciados em voz alta antes de cada um ("GANCHO MERCADO UM", "CORPO DOIS",
  "CTA TIKTOK TRÊS"...). "DE NOVO" = repetiu; usar a última tomada.
- **Cenas** (vídeo mudo, ~5 s cada): 1 traço acendendo perto da lente · 2 decalcando · 3 desenho
  pronto aceso · 4 apagando com paninho · 5 lousa limpa acesa (abajur) · 6 celular deixado de lado ·
  7 caixa abrindo · 8 tela do anúncio (só Mercado Livre).

## Takes

| Rótulo falado | Fala | Cena |
|---|---|---|
| GANCHO MERCADO UM | Achei no Mercado Livre o presente de Natal que criança quer de verdade. | 3 |
| GANCHO MERCADO DOIS | Se seu filho vive grudado no celular, olha o que eu achei no Mercado Livre. | 6 |
| GANCHO MERCADO TRÊS | Olha isso: cada traço acende no escuro. Achei no Mercado Livre. | 1 |
| GANCHO MERCADO QUATRO | Esse brinquedo barato do Mercado Livre fez meu filho largar o celular. | 2 |
| GANCHO TIKTOK UM | Esse é o presente de Natal que criança quer de verdade, e usa. | 3 |
| GANCHO TIKTOK DOIS | Se seu filho vive grudado no celular, olha isso aqui. | 6 |
| GANCHO TIKTOK TRÊS | Olha isso: cada traço acende no escuro. | 1 |
| GANCHO TIKTOK QUATRO | Meu filho largou o celular por causa disso aqui. | 2 |
| CORPO UM | É uma lousa de LED. Cada traço acende colorido e à noite parece mágica. Acabou, passa um paninho e desenha de novo. E depois ainda vira uma luzinha de abajur. | 1, 4, 5 |
| CORPO DOIS | Meu filho fica um tempão desenhando e nem pede mais o celular. Ajuda na coordenação, na criatividade, e eu ganho um sossego. | 2, 6 |
| CORPO TRÊS | Em vez de ficar comprando papel e caneta toda hora, essa aqui você apaga e usa de novo quantas vezes quiser. Não precisa ficar repondo nada. | 4 |
| CORPO QUATRO | Serve pra Natal, aniversário, pra dar pros primos. Vem na caixinha bonita, é só embrulhar. | 7 |
| CTA MERCADO UM | Vou deixar o link aqui embaixo. Garante antes do Natal. | 3 |
| CTA MERCADO DOIS | Tá com preço bom no Mercado Livre. Clica no link e garante o seu. | 8 |
| CTA MERCADO TRÊS | Chega rapidinho e com frete grátis. Link aqui embaixo. | 7 |
| CTA MERCADO QUATRO | Se eu fosse você, levava dois: um pra presentear. Link aqui embaixo. | 3 |
| CTA TIKTOK UM | Toca no carrinho aqui embaixo e garante antes do Natal. | 3 |
| CTA TIKTOK DOIS | Tá com desconto aqui no TikTok Shop. Toca no carrinho e garante o seu. | 1 |
| CTA TIKTOK TRÊS | Toca no carrinho aqui embaixo pra ver as cores e os modelos. | 3 |
| CTA TIKTOK QUATRO | Se eu fosse você, levava dois: um pra presentear. Toca no carrinho aqui embaixo. | 7 |

Corpos servem às duas plataformas. Vídeos de TikTok Shop nunca usam takes/cena "MERCADO" (cena 8).

## Montagem (rodadas, por plataforma)

1. Ganchos 1–4 + Corpo 1 + CTA 1 → 4 vídeos.
2. Gancho vencedor + Corpos 1–4 + CTA 1 → 4 vídeos.
3. Gancho e corpo vencedores + CTAs 1–4 → 4 vídeos.

Edição: narração por cima das cenas (corte da cena acompanha a fala), legenda pequena, sem emojis,
-14 LUFS. Para cada vídeo, nomear `lousa-<ml|tt>-g<n>-c<n>-a<n>.mp4`.

---

# Variante: roteiro gringo traduzido (vídeo único por plataforma)

Google Docs: "Roteiro gringo traduzido – Lousa de LED (Mercado Livre + TikTok Shop)"
https://docs.google.com/document/d/1HzQ4u-bfCkOZTxeWl8X6zaqBNQp5-l0idmXeDieGJAU/edit

Mesmas 16 frases do viral gringo, na mesma ordem. Áudio: "VERSÃO MERCADO" + roteiro inteiro, depois
"VERSÃO TIKTOK" + só as frases 1, 14 e 16. "DE NOVO" = repete só aquela frase (usar a última).
Montagem: 2 vídeos (ML e TT); no TT trocar as frases 1, 14 e 16 pelas da versão TikTok e não usar a
tela do anúncio. Cortes no ritmo do original (uma cena por frase), sem respiros, legenda pequena.

## Narrações recebidas (27/10) — áudios .m4a separados, um por take, sem rótulo falado

Arquivos chegam como `GANHO_1_MERCADO_LIVRE.m4a`, `gancho_2_tiktokshop.m4a`, `CORPO_1.m4a`, `cta_1.m4a`
(cta sem plataforma no nome = Mercado Livre). Limpos (supressão de ruído do app), -17 a -24 LUFS: tratar
cada um com o corte de pausas + 1,15x + -14 LUFS do `montar.py` antes de montar.

Fala real ≠ roteiro em vários takes (legenda segue o que foi dito):
- G TT1: "Esse daqui, sem dúvida, é o melhor presente de Natal que o seu filho pode ganhar." G TT4 (improvisado)
  é quase igual: "…foi o melhor presente que meu filho poderia ganhar no Natal."
- Arquivo `gancho_3_Tiktok_shop` tem o texto do G TT4 do roteiro ("Meu filho largou o celular por causa desse quadro aqui").
- CTA ML2 "preço muito bom… frete grátis… antes que acabe o estoque"; ML3 "Chegou em menos de uma semana e eu já vou
  pedir mais dois"; ML4 "tão barato que dá até pra revender".
- CTA TT2 "Acabou de entrar em oferta aqui no TikTok Shop…"; CTA TT3 fala "link aqui embaixo" e "promoção" (inadequado
  para TikTok Shop: pedir regravação).
- Faltam: G ML3, G TT3 do roteiro ("cada traço acende no escuro"), CTA TT4 e as 8 cenas em vídeo.
- Correção de legenda: "abaju" → "abajur"; "acaba o estoque" → "acabe o estoque".
