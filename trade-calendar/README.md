# Trade Calendar

Controle diário de resultados de Day Trade em um calendário com visual de iOS.
App web estático (HTML, CSS e JavaScript puros, sem dependências nem build), instalável no iPhone e funcionando offline.

## Rodando

```bash
cd trade-calendar
python3 -m http.server 4321   # http://localhost:4321
node --test calc.test.mjs     # testes dos cálculos
```

No iPhone: abra o endereço no Safari → Compartilhar → **Adicionar à Tela de Início**. O app abre em tela cheia, como um app nativo.

## O que tem

Quatro abas na barra inferior, todas lendo a mesma base de dados:

- **Dashboard — "Meu Desempenho"**: cards de período (Hoje, Esta semana, Últimos 30 dias, Este mês, Mês passado, Personalizado) com o resultado de cada um. O período escolhido atualiza o resultado líquido em destaque, os indicadores (lucro bruto, prejuízo bruto, dias operados, dias positivos e negativos, taxa de dias positivos, melhor e pior dia), o gráfico de performance (diário, semanal ou mensal, com lucro acumulado e toque para ver valores) e a **Comparação de desempenho** (hoje vs. ontem, semana, mês e 30 dias, com diferença em reais, variação percentual e seta de melhora/piora).
- **Calendário**: mês no estilo do iPhone, com o resultado em reais abaixo de cada dia (verde = lucro, vermelho = prejuízo, cinza = sem operações), dia atual em destaque, setas e gesto de deslizar, resumo do mês e visão dos 12 meses do ano.
- **Estatísticas**: total acumulado no ano, evolução mensal e anual, melhor e pior mês, médias de lucro e de prejuízo diário, taxa de dias positivos e resultados por mês e por ano.
- **Histórico**: todos os registros agrupados por mês, com filtro (todos, lucro, prejuízo, sem operações).
- **Registro do dia** (toque em um dia, em um item do histórico ou no `+`): data, valor ganho, valor perdido, resultado líquido calculado na hora, operações, observações, "Sem operações", editar e excluir.
- **Saldo da conta**: no topo do Dashboard. Você informa só o saldo atual (ex.: depositou R$ 100, coloca R$ 100). Cada resultado registrado, editado ou excluído no calendário soma ou subtrai desse saldo automaticamente; os dias que já estavam registrados antes não são somados de novo. Depositou ou sacou: é só atualizar o valor. O saldo entra no backup.
- **Plano do dia (gerenciamento)**: em Ajustes você define stop diário, meta diária e máximo de operações. Ao registrar o dia, o app avisa na hora ("Stop atingido, pare de operar hoje", "Meta batida, encerre o dia", "Limite de operações"), pergunta "Segui o plano?" e marca o dia no calendário (✓ dentro do plano, ! fora). O Dashboard mostra a sequência de dias dentro do plano, a taxa de disciplina do período e a média de resultado dentro e fora do plano. Bater o stop exato conta como respeitar o plano; passar dele, não. Dias sem operações não contam nem quebram a sequência.
- **Ajustes**: tema automático, claro ou escuro; exportar e importar backup (JSON); apagar todos os registros.

## Regras de cálculo

- Resultado líquido = lucro bruto − prejuízo bruto (soma dos valores ganhos − soma dos valores perdidos).
- Hoje: só o dia atual · Esta semana: de segunda-feira até hoje · Últimos 30 dias: 30 dias incluindo hoje · Este mês: do dia 1 até hoje · Mês passado: do primeiro ao último dia do mês anterior · Personalizado: o intervalo escolhido.
- Dias sem operações não contam como positivos nem negativos e não entram em "dias operados".
- Taxa de dias positivos = dias positivos ÷ dias operados.
- Média de lucro diário = soma dos dias positivos ÷ dias positivos; média de prejuízo diário = soma dos dias negativos ÷ dias negativos.
- Comparação: variação percentual = (atual − anterior) ÷ |anterior|. Quando o anterior é zero, aparece "sem base anterior".

## Dados

Os registros são salvos automaticamente no `localStorage` do aparelho (chave `tradecal.entries.v1`) e continuam lá depois de fechar o app. Não há servidor nem conta: os dados não saem do celular. O app começa vazio, sem dados de exemplo. Para trocar de aparelho ou se proteger de uma limpeza do navegador, use **Ajustes → Exportar backup**.

## Publicar (Vercel)

Crie um projeto apontando para a pasta `trade-calendar` como *Root Directory*. O `vercel.json` desta pasta já serve os arquivos estáticos.
