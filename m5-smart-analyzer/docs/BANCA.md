# Simulador de banca

Local: aba **Histórico → Simulador de banca** (código em `src/core/banca.ts`, testes em `src/core/banca.test.ts`).

## O que faz
Simula 1000 caminhos possíveis da sua banca (Monte Carlo) dada uma **taxa de acerto**, o **payout**, o **tamanho da entrada** (% da banca atual, com juros compostos, ou valor fixo) e o **número de operações**. Mostra:
- valor esperado por entrada (p·b − (1 − p)), com b = payout ÷ 100, e o **ponto de equilíbrio** (1 ÷ (1 + b));
- banca final (mediana e faixa de 5% a 95%) e a chance de terminar acima da inicial;
- chance de **cair 50% ou mais** e de **quebra** (banca abaixo de 10% da inicial, em algum momento);
- maior queda (mediana e 95%) e a **fração de Kelly** (0 = "não apostar" quando o valor esperado não é positivo);
- um gráfico de faixas ao longo das operações.

## Cenários e incerteza
Se você informar a **amostra** (de quantas operações veio a taxa), o simulador roda três cenários pelo intervalo de Wilson 95%: **pessimista** (limite inferior), **observado** e **otimista** (limite superior). Uma taxa de 56% medida em 200 operações vai de cerca de 49% a 63%: no pior caso o valor esperado é negativo e a banca tende a zero; no melhor, multiplica por vários. Isso é o que a incerteza de uma amostra pequena significa. Dá para preencher a taxa e a amostra com o **diário ao vivo**.

## Limites (leia antes de confiar)
- **É matemática, não previsão.** Assume operações **independentes** e **taxa constante**. O mercado não garante nenhum dos dois; pares de cripto andam juntos e as regras podem parar de funcionar.
- A taxa vem de dados da Binance/CSV, **não da Quotex**, e o payout varia por ativo e horário.
- Kelly pressupõe taxa conhecida. Com taxa incerta, o tamanho seguro é bem menor que o de Kelly.
- O resultado depende de uma semente fixa (reprodutível); mudar a semente muda os números, não as conclusões gerais.
- Não é conselho financeiro.

## Para que serve na prática
Responde à pergunta "isso pode virar renda?": com taxa abaixo do equilíbrio (80% de payout → 55,6%) o resultado é perda quase certa, e mesmo acima dele a faixa de resultados é larga e a chance de uma sequência ruim grande. Use depois do teste histórico/diário/agente, nunca no lugar deles.
