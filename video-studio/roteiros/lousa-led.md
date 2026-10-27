# Roteiro de testes: lousa mágica de LED (Mercado Livre)

4 ganchos × 4 corpos × 4 CTAs, gravados **num arquivo só**. O editor (Claude) encontra cada take
pelo nome falado antes dele e monta os vídeos de teste com `video-studio/pipeline/`.

## Como gravar o arquivo

1. Antes de cada take, diga o nome **devagar e claro**: "GANCHO UM", "CORPO DOIS", "CTA TRÊS"...
   Espere 1 segundo e fale o texto.
2. Errou? Diga **"DE NOVO"** e repita o take inteiro. O editor fica com a última tomada.
3. Câmera vertical, **produto colado na lente**, **ambiente escuro ou à meia-luz** (o LED é o show).
   Criança só aparece de mãos, sem rosto.
4. Cada take mostra a imagem que está na coluna "Imagem" enquanto você fala.
5. Ordem: G1–G4, C1–C4, A1–A4. Pode passar de 1 arquivo se precisar, mas mande todos juntos.
6. Arquivo original do celular (não pelo WhatsApp).

## Ganchos (≤ 3 s, todos citam o Mercado Livre)

| | Fala | Imagem |
|---|---|---|
| G1 · Natal | "Achei no Mercado Livre o presente de Natal que criança quer de verdade." | Lousa acesa no escuro, colada na câmera |
| G2 · Celular | "Se seu filho vive grudado no celular, olha o que eu achei no Mercado Livre." | Celular sendo deixado de lado, lousa acendendo |
| G3 · Mágica | "Olha isso: cada traço acende no escuro. Achei no Mercado Livre." | Traço sendo desenhado bem perto da lente |
| G4 · Barato | "Esse brinquedo barato do Mercado Livre fez meu filho largar o celular." | Mãos da criança desenhando |

## Corpos (10–15 s)

| | Fala | Imagem |
|---|---|---|
| C1 · Como funciona | "É uma lousa de LED. Cada traço acende colorido e à noite parece mágica. Acabou, passa um paninho e desenha de novo. E depois ainda vira uma luzinha de abajur." | Desenhando → apagando → lousa acesa no quarto |
| C2 · Pais | "Meu filho fica um tempão desenhando e nem pede mais o celular. Ajuda na coordenação, na criatividade, e eu ganho um sossego." | Mãos da criança, celular de lado |
| C3 · Custo-benefício | "Em vez de ficar comprando papel e caneta toda hora, essa aqui você apaga e usa de novo quantas vezes quiser. Não precisa ficar repondo nada." | Apagando e redesenhando várias vezes |
| C4 · Presente | "Serve pra Natal, aniversário, pra dar pros primos. Vem na caixinha bonita, é só embrulhar." | Produto na caixa, abrindo |

## CTAs (3–5 s)

| | Fala | Imagem |
|---|---|---|
| A1 · Natal | "Vou deixar o link aqui embaixo. Garante antes do Natal." | Lousa acesa |
| A2 · Preço | "Tá com preço bom no Mercado Livre. Clica no link e garante o seu." | Tela do anúncio |
| A3 · Frete | "Chega rapidinho e com frete grátis. Link aqui embaixo." | Caixa do produto |
| A4 · Kit | "Se eu fosse você, levava dois: um pra presentear. Link aqui embaixo." | Duas lousas lado a lado |

Só fale o que for verdade no seu anúncio: A3 só com frete grátis de verdade; A4 só se fizer sentido
comprar mais de um; "barato" (G4) só se o preço for baixo de fato.

## Plano de teste (não grave 64 vídeos)

Mudar uma coisa por vez, senão não dá para saber o que funcionou:

1. **Rodada 1, ganchos:** G1/G2/G3/G4 + C1 + A1 → 4 vídeos. Fica o gancho com mais visitas.
2. **Rodada 2, corpos:** gancho vencedor + C1/C2/C3/C4 + A1 → 4 vídeos.
3. **Rodada 3, CTAs:** gancho + corpo vencedores + A1/A2/A3/A4 → 4 vídeos.

O arquivo é gravado uma vez só; o editor monta as 3 rodadas a partir dele. Cada vídeo vai em um
anúncio (o Clips pede vídeo diferente por anúncio). Compare depois de ~7 dias.
