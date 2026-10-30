# Como incorporar novas transcrições

1. **Separe** o que a aula diz com número, o que diz qualitativamente e o que não diz. Nunca preencha lacunas: use `nao_definido`.
2. **Parâmetros novos** (`src/core/types.ts` → `PARAM_KEYS`; `src/core/config.ts` → `PARAM_SPECS` e `defaultConfig`).
   Se a aula dá o número, use `{ value, origin: 'aula' }`; senão deixe `null`.
3. **Regra nova** em `src/core/rules/<aula>.ts`, exportando um `RuleDefinition` (`id`, `name`, `role`, `lesson`, `evaluate(ctx)`).
   - Use `pendingConfig()` quando faltar parâmetro, `insufficientData()` quando faltar dado, `makeResult()` nos demais casos.
   - Só leia `ctx.candles` até `ctx.lastIndex`. Se a regra exige candles posteriores para confirmar algo, registre o índice em que a confirmação ficou disponível.
   - Acrescente o `id` em `RULE_IDS` e a regra em `RULES` (`src/core/rules/index.ts`).
4. **Gatilho**: exporte um `TriggerRule` (`evaluate` devolve `atendido | nao_atendido | nao_avaliavel`) e inclua em `TRIGGER_RULES`.
   O motor só confirma o gatilho quando todos os critérios são atendidos **e** o cenário é FAVORÁVEL.
5. **Versão**: incremente `RULES_VERSION` (`config.ts`). Registros antigos mantêm a versão e uma cópia da configuração usada.
6. **Testes** em `src/core/*.test.ts`: um cenário favorável, um desfavorável, um incompleto e um inválido, mais um teste de ausência de look-ahead.
7. **Documentação**: atualize `docs/REGRAS.md` (origem da aula) e `docs/PENDENCIAS.md`.
