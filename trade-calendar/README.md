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

- **Mês**: calendário com o resultado líquido de cada dia abaixo do número (verde = lucro, vermelho = prejuízo, neutro = sem operações), dia atual em destaque, setas e gesto de deslizar para trocar de mês.
- **Resumo do mês** no topo: resultado líquido, lucro total, prejuízo total, dias positivos, dias negativos e taxa de acerto.
- **Registro do dia** (toque em um dia ou no `+`): valor ganho, valor perdido, resultado líquido calculado na hora, quantidade de operações, observações, opção “Sem operações”, editar e apagar.
- **Ano**: os 12 meses com os dias coloridos e o resultado de cada mês; toque em um mês para abri-lo.
- **Estatísticas** (Mês / Ano / Geral): gráfico de evolução (saldo acumulado + resultado de cada dia/mês, com toque para ver valores), melhor e pior dia, média de lucro e de prejuízo diário, histórico diário, mensal e anual.
- **Ajustes**: tema automático, claro ou escuro; exportar e importar backup (JSON); apagar todos os registros.

## Como os números são calculados

- Resultado líquido do dia = valor ganho − valor perdido.
- Lucro total = soma dos dias que fecharam positivos; prejuízo total = soma dos dias que fecharam negativos.
- Taxa de acerto = dias positivos ÷ (dias positivos + dias negativos). Dias zerados e sem operações não entram.
- Média de lucro diário = lucro total ÷ dias positivos; média de prejuízo diário = prejuízo total ÷ dias negativos.

## Dados

Os registros são salvos automaticamente no `localStorage` do aparelho (chave `tradecal.entries.v1`) e continuam lá depois de fechar o app. Não há servidor nem conta: os dados não saem do celular. O app começa vazio, sem dados de exemplo. Para trocar de aparelho ou se proteger de uma limpeza do navegador, use **Ajustes → Exportar backup**.

## Publicar (Vercel)

Crie um projeto apontando para a pasta `trade-calendar` como *Root Directory*. O `vercel.json` desta pasta já serve os arquivos estáticos.
