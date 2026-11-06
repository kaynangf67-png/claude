# Relatório da Fase 2: backend, autenticação e Daily Risk Manager 2x0

## Concluído

### Risk Manager 2x0 (`backend/app/engines/risk_manager/`)
- **Máquina de estados persistente**, com os 7 estados da especificação. O estado do dia é **recalculado a partir dos fatos gravados** (resultados confirmados e operações vivas), não de um contador. Reiniciar o servidor ou fechar o painel não muda o dia.
- **Concorrência:** a linha do dia fica travada (`FOR UPDATE`) e a versão só avança se ainda for a lida (CAS). Duas autorizações simultâneas não passam.
- **Autoridade final:** só `authorize()` emite `TradeAuthorization`. Antes de emitir, verifica, nesta ordem:
  1. conta DEMO;
  2. emergência;
  3. pausa;
  4. estado do dia;
  5. notícia;
  6. posição aberta;
  7. autorização pendente;
  8. sinal existente e dentro da validade;
  9. símbolo da corretora igual ao do sinal;
  10. stop e alvo do lado certo;
  11. lote para R$ 5.
- **Cálculo de lote** (`sizing.py`): considera distância do stop, spread, slippage, comissão, valor do tick, incremento e lote mínimo, com conversão para BRL. Arredonda para baixo. Se o lote mínimo passar de R$ 5, recusa e informa o risco que ele teria.
- **Execução:** ordem enviada não é operação. A operação só conta com a posição confirmada pela corretora.
  - Autorização vencida (o EA não pegou) ou rejeitada pela corretora libera a vaga.
  - Resposta incerta leva a `RECONCILIATION_REQUIRED`.
  - Aviso repetido não duplica nada.
  - A mesma autorização chegando com outra posição, ou com volume acima do autorizado, também bloqueia o dia até reconciliar.
- **Resultado:** usa o líquido (bruto − custos) convertido para BRL. **Líquido ≤ 0 conta como derrota** e trava o dia.
- **Virada do dia:** se ficou posição aberta ou ordem incerta de ontem, o novo dia nasce em `RECONCILIATION_REQUIRED`. O resultado da posição conta no dia em que ela foi aberta.
- **Controles:** pausa, retomada, emergência e liberação da emergência (só admin). A emergência bloqueia entradas na hora e **não fecha posições**: fechar será outro comando, com confirmação explícita.
- **Auditoria:** cada transição, negação, controle e reconciliação vai para `agent_events`, que só aceita inserção.

### Sessões (`app/core/sessions.py`)
Londres e Nova York são calculadas pelo fuso de cada praça e convertidas para Brasília. Testado na semana de 2026 em que Londres já tinha saído do horário de verão e Nova York ainda não: a sobreposição muda de horário.

### Autenticação e API (`app/core/security.py`, `app/api/routes.py`)
- Senha com scrypt e token assinado (HMAC). Sem `AUTH_SECRET` o login fica desligado; não existe segredo padrão.
- Papéis: viewer lê; operator controla; admin também libera emergência e vê todas as contas. Cada usuário só vê as próprias contas.
- Limite de 5 tentativas de login por minuto por IP.
- Rotas:
  - `POST /api/v1/auth/login`
  - `GET /accounts/{id}/risk/today`
  - `POST /accounts/{id}/control/{pause|resume|emergency|emergency/clear}`
  - `POST /accounts/{id}/risk/reconcile`
- `scripts/create_admin.py` cria o admin com a senha digitada no terminal.

### Banco
Migration `0002`:
- pausa e emergência ficam na conta (persistem entre dias);
- no máximo uma autorização pendente por conta;
- a vaga do dia só é ocupada por autorização viva ou executada.

## Testes: 55 passando (PostgreSQL 16 real)

| Obrigatório | Situação |
|---|---|
| 1 primeira vencedora | ✅ |
| 2 primeira perdedora | ✅ |
| 3 segunda vencedora | ✅ |
| 4 segunda perdedora | ✅ |
| 5 terceira operação | ✅ recusada |
| 6 reinício durante operação | ✅ estado mantido por uma nova instância |
| 7 queda do MT5 / 8 resposta incerta | ✅ no lado do backend (o EA real é da Fase 4) |
| 9 ordem duplicada | ✅ |
| 10 Stop Loss inválido | ✅ |
| 11 volume acima do risco | ✅ |
| 12 lote mínimo incompatível | ✅ |
| 13 virada do dia com posição aberta | ✅ |
| 14 reconciliação | ✅ |
| 15 pausa / 16 retomada | ✅ |
| 17 falha do banco | ✅ dá erro e nada é autorizado |
| 18 falha do backend | parcial: coberto pelo 6; teste com processo derrubado fica para a Fase 9 |
| 19 mudança de horário das sessões | ✅ |
| 20 execução em conta demo | Fase 4/9 (depende do EA e da corretora) |

Extras: empate conta como derrota; autorização vencida libera a vaga; rejeição da corretora; emergência registrada; transições auditadas; rotas com 401, 403, 404 e 429.

## Limitações (sem maquiagem)
- O câmbio para BRL e a especificação do símbolo **entram como parâmetro**. Quem vai fornecê-los de verdade é o Market Data (Fase 5) e o MT5 (Fase 4).
- O limite de login fica em memória. Com mais de um processo, precisa ir para o banco ou o Redis (Fase 10).
- O token não tem lista de revogação. Desativar o usuário bloqueia na próxima requisição; troca de senha não derruba sessões abertas antes de expirarem (8h).
- Nada foi aplicado no Supabase e não há servidor no ar. Ainda não há onde hospedar o backend; essa decisão continua pendente.

## Próximo passo
Fase 3 (painel) ou, como recomendei, antecipar a validação da estratégia (Fases 5, 6 e 8) antes do EA.
