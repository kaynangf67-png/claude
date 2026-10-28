# Agente de simulação 24 h (dinheiro de mentira)

## O que é
Um programa que fica rodando no **seu computador** enquanto você está fora. Ele:
- lê candles da **API pública da Binance** (cripto), sem chave, sem login e sem conta;
- usa o **mesmo motor** do app (zonas, filtros, gatilho, cronômetro de 2:30);
- quando o candle em formação toca uma zona armada, registra uma **entrada virtual**;
- no fechamento do M5, confere o resultado (venda ganha se fecha abaixo da entrada; compra, se acima);
- grava tudo em `agent/dados/diario.csv` (abre no Excel) e `diario.json`, e imprime estatística com o ponto de equilíbrio.

## O que ele NÃO faz
- **Não envia ordens**, nem reais nem de teste. Não tem chave, conta, senha nem acesso à Quotex.
- Não prova que a estratégia funciona. Ele junta a **amostra grande** que a estatística exige. Os preços são da Binance, **não** da Quotex.
- Não roda sozinho com o computador desligado, dormindo ou sem internet.

## Instalação no Windows (uma vez)
1. Instale o **Node.js 22 (LTS)** em https://nodejs.org (Avançar até Instalar). Abra o PowerShell e confira: `node -v`.
2. Baixe o projeto: no GitHub, branch `claude/bold-wright-l35foo` → **Code → Download ZIP** e extraia (ou `git clone` + `git checkout claude/bold-wright-l35foo`).
3. No PowerShell, entre na pasta do app e instale:
   ```
   cd caminho\ate\m5-smart-analyzer
   npm install
   ```
4. **Impeça o Windows de dormir**: Configurações → Sistema → Energia → "Suspender" = **Nunca** (na tomada). Deixe o notebook ligado e ligado à internet.

## Para ligar
- **Mais fácil:** dê dois cliques em `agent\iniciar-agente.bat`. Ele reinicia sozinho se parar. Feche a janela para encerrar.
- **Pelo PowerShell:** `npm run agente -- --exploratorio` (Ctrl+C encerra e salva).
- **Com os seus parâmetros:** copie `agent\config.exemplo.json`, edite e rode `npm run agente -- --config meu.json`.

Opções: `--simbolos BTCUSDT,ETHUSDT` · `--payout 85` · `--intervalo 5` · `--dados pasta` · `npm run agente -- --ajuda`.

## Como ler o resultado
O agente imprime um resumo a cada hora e a cada resultado novo. Exemplo de leitura:
- **Todo toque em zona armada**: taxa de acerto, intervalo de confiança e o **equilíbrio** do seu payout (80% → 55,6%).
- **Resultado virtual**: em "entradas" (1 = o valor de uma entrada). Dinheiro de mentira.
- Regras de ouro, que o próprio agente repete:
  - **n < 100: amostra pequena, não conclua nada.**
  - Só "possível vantagem" com **n ≥ 300** e o intervalo **inteiro** acima do equilíbrio — e mesmo assim **não é prova**: repita em outros períodos e pares, com os parâmetros **fixos**.
  - "Abaixo do equilíbrio" = a estratégia, como configurada, perde dinheiro na amostra.

## Cuidados que valem para qualquer conclusão
- **Fixe os parâmetros antes de olhar o resultado.** Mudar e reexecutar até "dar certo" é enganar a si mesmo. Os valores `--exploratorio` **não vêm da aula**.
- Pares de cripto andam juntos: os casos não são independentes, então o intervalo é otimista.
- Vários critérios ao mesmo tempo geram falsos positivos por acaso.
- O payout varia por ativo e horário. Confirme o seu no `--payout`.
- O diário do agente é **separado** do diário da aba "Ao vivo" do app (arquivos diferentes).

## Próximos passos (só se o diário mostrar vantagem de verdade)
1. Repetir em outro período e com outros pares.
2. Só então discutir a **testnet da Binance** (saldo fictício) e, muito depois, qualquer coisa com dinheiro real, com limites rígidos. Nada disso é automático nem foi construído.
3. Rodar na **nuvem** (24 h sem depender do seu computador) é possível, mas tem custo e configuração; fica para depois.
