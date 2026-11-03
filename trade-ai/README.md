# TRADE AI — leitura de print para binárias

Uma página: você escolhe o ativo (forex, cripto ou commodities das corretoras de binárias), acompanha o gráfico ao vivo em 5 minutos (widget do TradingView), seleciona o print M5, informa o payout e clica em **CALCULAR ENTRADA**.
A IA (Claude) lê o que está visível e responde **CALL**, **PUT** ou **NÃO OPERAR**, com horário de entrada
(abertura da próxima vela), expiração, motivos a favor e contra e o que invalida a entrada.

```
trade-ai/frontend/
├── api/analyze.ts        função serverless da Vercel (POST /api/analyze)
├── server/analyze.ts     prompt, esquema JSON, travas e chamada ao Claude (+ testes)
└── src/                  React + Tailwind (página única)
```

## Travas (no servidor, não dependem da IA)

Vira **NÃO OPERAR** quando: a imagem não é gráfico, o print não está em M5, o ativo do print é diferente do selecionado, o print tem mais de 3 minutos
(data do arquivo), o setup é fraco, há menos de 2 motivos a favor ou a IA
pede nova captura. A IA é instruída a não inventar preço, horário ou ativo que não aparecem.

## Desempenho real

Cada CALL/PUT fica no histórico do navegador. Você marca **Ganhou** ou **Perdeu** e o app mostra a taxa real,
o intervalo de confiança de 95% e o ponto de equilíbrio do payout (85% → 54,1%). É isso que diz se a leitura
funciona para você, não a confiança da IA.

## Rodando

```bash
cd frontend
npm install
npm test           # 23 testes
npm run dev        # interface; a função /api só roda na Vercel (ou com `vercel dev`)
```

Na Vercel: projeto com pasta raiz `trade-ai/frontend` e a variável `ANTHROPIC_API_KEY`
(Settings → Environment Variables). Sem ela, o app avisa que a análise está desativada.

## Avisos

- A leitura de um print não prevê a próxima vela. Nenhum resultado é garantido.
- A CVM já emitiu alertas contra corretoras de opções binárias (IQ Option, Olymp Trade, Binomo) por captarem
  clientes no Brasil sem autorização.
- O scanner multimercado anterior (FastAPI + WebSocket) está no histórico do git, commit `825ae05`.
