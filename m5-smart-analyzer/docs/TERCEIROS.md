# Código de terceiros

## day-trader-skill (11 skills "trader-*")
- Origem: https://github.com/Jakeschincariol/day-trader-skill — autor Jake Schincariol — licença MIT (texto em `docs/licencas/day-trader-skill-LICENSE.txt`).
- Versão copiada: commit `3d0f4ef6986f4984b7c6bd46f7ff4f87744c3abd` (2026-10-20), plugin 2.0.0. **Cópia fixada**: não atualiza sozinha. Foram copiados só os `SKILL.md`, scripts `.py` e exemplos `.json`; os testes e fixtures não vieram.
- Onde está: `m5-smart-analyzer/.claude/skills/trader-*/`.
- **Não foi escrita por nós e não faz parte do M5 Smart Analyzer.** O projeto-base (regras das aulas, teste histórico) continua independente delas.

### O que revisamos (revisão estática, em 2026-10-28)
- Sem hooks no plugin. Sem `eval`/`exec`/shell; único `subprocess` chama `pdftotext` com argumentos em lista (trader-pelosi).
- Rede só para fontes públicas: Yahoo Finance, SEC EDGAR, Nasdaq Trader, Câmara dos EUA, Stooq, NYSE. Nenhum envio de dados para outro lugar.
- Escreve só nos arquivos indicados pelo usuário (`trader/…`). Sem caracteres invisíveis nem frases para contornar permissões.
- O desenho exige: PASS do trader-risk + um "sim" do usuário + o cartão "Allow once" do Claude. Ordens só via MCP da Alpaca, em conta **paper** por padrão.
- **Não rodamos os testes deles** (a execução de código de terceiros foi bloqueada no ambiente) e a revisão não é exaustiva (~2 MB). Leia antes de usar com dinheiro.

### Limitações para o nosso caso
- É para **ações dos EUA** (Yahoo/SEC/Alpaca), em dólares, com stop e alvo. **Não serve para a Quotex nem para opções binárias de M5**, e não usa as regras das nossas aulas.
- As skills de ordem exigem a Alpaca (conta e chaves próprias). Nunca ponha chaves no chat; nunca marque "Always allow" numa ferramenta de ordem.
