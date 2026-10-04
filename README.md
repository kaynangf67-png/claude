# RecuperaAI

> Recupere clientes que demonstraram interesse, mas não finalizaram a compra.

MVP de validação para pequenos negócios brasileiros que vendem pelo WhatsApp (lojas de móveis e roupas, salões, clínicas, oficinas, prestadores de serviço).

**Fluxo demonstrado:** Cliente → Oportunidade perdida → Follow-up com IA → Recuperação → Receita.

## Rodando

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testes do motor de análise e das regras da IA
npm run build
```

Na página inicial, **“Ver demonstração agora”** abre uma conta pronta com a loja *Móveis Bela Casa* e 10 leads de exemplo. Ou crie uma conta, cadastre seu negócio e comece do zero.

## Roteiro de 2 minutos

1. **Painel** — “Quanto o RecuperaAI recuperou para você?”, métricas, funil e prioridades do dia.
2. **Recuperar vendas** — “Encontramos 7 clientes que demonstraram interesse e ainda não compraram.”
3. Clique em **Recuperar cliente** no João Silva → diagnóstico (*Venda potencialmente perdida · 🔥 Lead quente · R$ 2.490 · Follow-up em até 24 horas*) com o **porquê**.
4. **Gerar follow-up com IA** → editar, copiar, abrir no WhatsApp, marcar como enviado ou **simular envio** (o cliente “responde” em 2s).
5. **Simular venda recuperada** → status vira 🔵 Recuperado e o valor entra na receita recuperada do painel.

## Como a “IA” funciona

| Parte | Onde | O que faz |
|---|---|---|
| Diagnóstico | `src/lib/analyze.ts` | Regras determinísticas e explicáveis: interesse (preço, pagamento, entrega…), objeção (“vou falar com minha esposa”, “vou pensar”, “achei caro”, “semana que vem”, sumiu, pergunta sem resposta, pedido de desconto), recência → temperatura, ação recomendada e motivos. |
| Anti-spam | `analyze.ts` | Máximo de 2 follow-ups, intervalo mínimo de 48h, nada para quem desistiu. |
| Follow-up (modo demo) | `src/lib/followup.ts` | Mensagens naturais montadas **só** com dados cadastrados (nome, produto, preço do catálogo, FAQs). |
| Follow-up (Claude) | `server/followupHandler.ts`, `api/followup.ts` | Se `ANTHROPIC_API_KEY` estiver definida, gera a mensagem com Claude. Sem a chave, o app usa o motor local automaticamente. |
| Regras em código | `checkMessage()` | Toda mensagem (inclusive a editada pelo usuário) é checada: preço não cadastrado, desconto inventado, promessa de estoque, tamanho. Resposta do Claude que viola as regras é descartada. |

O modo Claude usa `claude-opus-5-5` com esforço `low` e o fallback de servidor (`fallbacks: "default"`) habilitado.

## Limitações conhecidas (de propósito, é um MVP)

- **Sem backend/banco:** conta e dados ficam no `localStorage` do navegador. Não há autenticação real.
- **Sem integração com WhatsApp:** nada é enviado automaticamente. “Abrir no WhatsApp” só abre o `wa.me` com o texto pronto.
- **Sem pagamento:** “Quero testar” só registra o interesse na tela.
- O diagnóstico é baseado em padrões de texto em português; frases fora dos padrões caem em “sem resposta”/“em atendimento”.
- Os dados de exemplo são de uma loja de móveis, mesmo que o usuário cadastre outro segmento.

## Deploy

Projeto Vite estático + uma função serverless em `api/followup.ts` (formato Vercel). Configure `ANTHROPIC_API_KEY` no provedor para habilitar o modo Claude (opcional).
