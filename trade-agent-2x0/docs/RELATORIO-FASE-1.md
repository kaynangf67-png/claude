# Relatório da Fase 1: arquitetura, estrutura, banco e documentação

## Ambiente inspecionado

- Python 3.13, Node 22, PostgreSQL 16 local (para testes), Alembic, SQLAlchemy 2, FastAPI, psycopg 3, pytest.
- Já existentes: projeto `trade-ai/` (TypeScript, Vercel) com motor de análise, agente 2x0 e escritório 3D; Supabase `trade-agent`; workflow do GitHub Actions.
- **Não disponível aqui:** MetaTrader 5 e Windows. O EA (Fase 4) não pode ser compilado nem testado neste ambiente; vai precisar da VPS ou de um PC Windows com MT5.

## Concluído

1. **Arquitetura** (`docs/ARQUITETURA.md`): módulos, fluxo de uma operação, defesas em camadas, decisões, componentes externos, custos e credenciais.
2. **Estrutura de pastas** conforme a especificação, com os motores separados em `backend/app/engines/*`.
3. **Contratos entre módulos** (`backend/app/core/contracts.py`): `TradeSignal` (proposta), `TradeAuthorization` (única coisa que o EA executa), `RiskState` com os 7 estados, `DataSource` (LIVE/DEMO_FEED/HISTORICAL).
4. **Configuração segura** (`backend/app/core/config.py`): DEMO por padrão; `TRADING_MODE=REAL` impede o sistema de iniciar; risco > R$ 5 recusado; segredos nunca aparecem na visão pública.
5. **Banco**: migration `0001` com as 21 tabelas pedidas, aplicada e revertida com sucesso num PostgreSQL 16 local. As regras 2x0 críticas também ficam no banco (veja a seção 4 da arquitetura).
6. **API mínima**: `/api/v1/health` e `/api/v1/system`, com documentação automática em `/docs`. Nenhum endpoint de ordem existe.
7. **`.env.example`**, `.gitignore`, `docker-compose` de Postgres local, script de testes.

## Testes executados

`18 passed`: configuração (DEMO padrão, REAL recusado, risco fora do limite, segredos ocultos), API (health, system, não sobe em REAL) e banco:
- conta REAL recusada;
- 3ª operação do dia recusada, e repetir a 2ª também;
- risco acima de R$ 5 recusado;
- duas posições abertas ao mesmo tempo recusadas;
- sinal BUY sem stop recusado;
- auditoria não pode ser apagada;
- notificação duplicada recusada.

## Não feito nesta fase (de propósito)

- Nenhuma lógica de análise, risco ou execução: só contratos e restrições.
- A migration **não foi aplicada no Supabase**. Fica para a Fase 2, junto com a decisão de schema separado ou projeto novo.
- Autenticação, painel e EA: fases 2, 3 e 4.

## Pontos que precisam da sua decisão

1. **Ordem das fases.** Recomendo antecipar a validação da estratégia (backtest fora da amostra com custos reais, Fases 5, 6 e 8) antes de gastar com VPS e EA (Fase 4). Hoje nenhum perfil testado tem expectativa positiva.
2. **Corretora** para a conta DEMO, porque ela define o sufixo dos símbolos, a comissão, o lote mínimo e o valor do tick.
3. **Hospedagem do backend** (processo contínuo). A Vercel não serve para isso.
4. **R$ 5 de risco** limita o stop a uns 9 ou 10 pips em EURUSD com 0,01 lote, uma estimativa a confirmar com a corretora. Ou se aceita stop curto (scalping), ou o Risk Manager vai recusar a maioria dos setups de H1/M15.

## Próximo passo

**Fase 2:** autenticação, Risk Manager 2x0 completo (máquina de estados com CAS, virada de dia com posição aberta, reconciliação, pausa e emergência) e os testes obrigatórios 1–6, 9–16 e 19.
