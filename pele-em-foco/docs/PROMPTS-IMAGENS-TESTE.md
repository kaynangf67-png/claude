# Prompts das imagens do teste (/teste)

Gerar no ChatGPT, no mesmo chat, uma por vez, depois do bloco de estilo.
Revisar cada imagem antes de publicar: a IA erra a aparência da acne com frequência.
Mesmo tom de pele em todas. Nada de rosto reconhecível.

Arquivos esperados (mandar para substituir as ilustrações em `src/components/TesteIllustrations.tsx`):
`1-oleosa`, `2-mista`, `3-normal`, `4-seca`, `5-cravos`, `6-espinhas`, `7-pus`, `8-carocos`, `9-quase-nada` (também usada em "não deixam marca"), `10-manchas`, `11-cicatrizes`.

## Bloco de estilo

```
Vou pedir uma série de 11 imagens para um teste educativo sobre pele. Todas devem seguir este padrão:
- Fotografia macro realista de pele humana, close-up, sem olhos, boca ou qualquer traço que identifique a pessoa.
- Mesmo tom de pele em todas: pele morena média brasileira, com textura natural e poros visíveis.
- Luz natural suave e difusa vinda de cima à esquerda, sem flash, sem sombras duras.
- Sem maquiagem, sem filtro, sem retoque, sem texto, sem marca d'água.
- Formato quadrado 1:1, foco nítido no centro.
- Aparência clínica e respeitosa, como ilustração de material educativo de dermatologia, nunca nojenta ou sensacionalista.
Responda "ok" e aguarde o primeiro pedido.
```

## Imagens

1. **oleosa** — Close da lateral do rosto, da bochecha até a lateral do nariz, com brilho oleoso evidente e uniforme em toda a pele, poros um pouco dilatados. Sem espinhas.
2. **mista** — Close do nariz e do início da bochecha: o nariz e a parte central com brilho oleoso evidente, a bochecha ao lado com aspecto fosco e normal. A diferença entre as duas áreas deve ficar clara. Sem espinhas.
3. **normal** — Close da bochecha com pele uniforme, sem brilho excessivo e sem descamação, aspecto saudável e fosco natural. Sem espinhas.
4. **seca** — Close da bochecha com pele opaca, áspera, com leve descamação fina e linhas de ressecamento sutis. Sem espinhas, sem vermelhidão forte.
5. **cravos** — Close do nariz e do queixo com vários cravos: pontinhos pretos pequenos nos poros (cravos abertos) e alguns pontinhos brancos pequenos e fechados (cravos fechados). Sem vermelhidão, sem inflamação.
6. **espinhas pequenas vermelhas** — Close da bochecha com 4 a 5 espinhas pequenas, vermelhas e levemente elevadas (pápulas), de tamanhos um pouco diferentes, sem pus e sem ponta branca. O resto da pele normal.
7. **espinhas com pus** — Close da bochecha com 3 a 4 espinhas inflamadas, vermelhas, com a ponta branca ou amarelada no centro (pústulas), de tamanhos variados. Aspecto clínico realista, sem sangue e sem pele machucada.
8. **caroços profundos** — Close da mandíbula com 2 lesões de acne grandes e profundas (nódulos): elevações arredondadas, vermelho-escuras, por baixo da pele, inchadas e sem ponta branca visível, com aparência dolorida. Realista e respeitoso, sem ferida aberta.
9. **quase nada** — Close da bochecha com pele limpa, uniforme, sem espinhas, apenas a textura natural e os poros.
10. **manchas** — Close da bochecha com algumas manchas planas e arredondadas, umas acastanhadas e outras levemente avermelhadas, deixadas por espinhas antigas. Sem relevo, sem espinhas ativas.
11. **cicatrizes** — Close da bochecha com cicatrizes de acne atróficas: pequenos afundamentos arredondados e alguns em forma de buraquinho estreito, visíveis pela luz lateral. Sem espinhas ativas, sem vermelhidão.
