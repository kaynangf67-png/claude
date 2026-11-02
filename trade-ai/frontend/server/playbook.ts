/**
 * Estratégias de referência para a IA de entrada.
 * ATENÇÃO: nenhuma destas estratégias foi validada com histórico. Use como hipótese a testar,
 * não como regra de vantagem comprovada.
 */
export const PLAYBOOK = `
ESTRATÉGIA 1 - Rompimento com reteste (resistência que vira suporte), não validada:
- Identifique um nível horizontal que o preço já testou várias vezes sem romper (resistência).
- Espere uma vela fechar acima do nível (rompimento).
- Espere o preço voltar e encostar no nível (reteste). O nível agora funciona como suporte.
- Entrada: quando a vela de reteste fecha de volta a favor do rompimento (alta).
- Invalidação: fechamento abaixo do nível. Nesse caso a leitura não vale.
- Simétrico para venda: suporte rompido, reteste de baixo, fechamento abaixo do nível.
- Riscos: o reteste pode falhar e virar rompimento falso. Níveis muito próximos entre si pesam contra.

REGRAS GERAIS DO PLAYBOOK:
- Só use esta estratégia se o padrão estiver claro nas velas recebidas. Se não estiver, responda NAO_OPERAR.
- Indique no resumo qual estratégia usou (ou que nenhuma se aplicou).
- Nunca invente níveis: use apenas máximas, mínimas e fechamentos das velas recebidas.
`;
