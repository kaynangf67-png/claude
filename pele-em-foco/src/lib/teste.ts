// Teste público da página de vendas. A pessoa se identifica com ilustrações e o
// resultado separa quem pode começar com uma rotina básica de quem deve procurar
// um dermatologista primeiro. Não dá nota de gravidade, não diagnostica e não sai
// do navegador: nada é salvo ou enviado.
import { PRODUCTS, type Product } from '../content/products';

export type SkinType = 'oleosa' | 'mista' | 'normal' | 'seca';
export type Lesion = 'cravos' | 'espinhas' | 'pus' | 'carocos';
export type Amount = 'poucas' | 'varias' | 'muitas';
export type Marks = 'nao' | 'manchas' | 'cicatrizes';
export type Sensitivity = 'sim' | 'as-vezes' | 'nao';

export interface TesteAnswers {
  skin: SkinType | null;
  /** vazio + noLesions=true quando a pessoa marca "quase nada" */
  lesions: Lesion[];
  noLesions: boolean;
  amount: Amount | null;
  marks: Marks | null;
  sensitivity: Sensitivity | null;
  alerts: string[];
  noAlerts: boolean;
}

export const TESTE_ALERTS: { value: string; label: string }[] = [
  { value: 'piora-subita', label: 'Piorou de repente ou depois de começar um medicamento' },
  { value: 'sem-melhora', label: 'Já mantenho uma rotina há 2 a 3 meses e não melhorou' },
  { value: 'hormonal', label: 'Menstruação muito irregular ou pelos crescendo fora do comum' },
  { value: 'autoestima', label: 'A acne está afetando muito meu humor ou minha autoestima' },
];

export const emptyTeste = (): TesteAnswers => ({
  skin: null, lesions: [], noLesions: false, amount: null, marks: null, sensitivity: null, alerts: [], noAlerts: false,
});

export type StepId = 'skin' | 'lesions' | 'amount' | 'marks' | 'sensitivity' | 'alerts';

/** Quem marca "quase nada" pula a pergunta de quantidade. */
export function steps(a: TesteAnswers): StepId[] {
  const all: StepId[] = ['skin', 'lesions', 'amount', 'marks', 'sensitivity', 'alerts'];
  return a.noLesions ? all.filter((s) => s !== 'amount') : all;
}

export function stepDone(a: TesteAnswers, s: StepId): boolean {
  switch (s) {
    case 'skin': return a.skin !== null;
    case 'lesions': return a.noLesions || a.lesions.length > 0;
    case 'amount': return a.amount !== null;
    case 'marks': return a.marks !== null;
    case 'sensitivity': return a.sensitivity !== null;
    case 'alerts': return a.noAlerts || a.alerts.length > 0;
  }
}

export type Profile = 'basico' | 'acompanhar' | 'dermatologista';

export interface TesteResult {
  profile: Profile;
  /** Motivos, em linguagem simples, para procurar avaliação */
  reasons: string[];
  needs: string[];
  /** Kit afiliado só aparece no perfil básico */
  kits: Product[];
}

const SKIN_NEEDS: Record<SkinType, string> = {
  oleosa: 'Limpador suave em gel, hidratante leve oil free e protetor com toque seco.',
  mista: 'Limpador suave, hidratante leve e protetor com toque seco na testa, nariz e queixo.',
  normal: 'Limpador suave, hidratante leve e protetor solar todos os dias.',
  seca: 'Limpador em creme ou loção, hidratante mais cremoso não comedogênico e protetor solar.',
};

export function buildTesteResult(a: TesteAnswers, products: Product[] = PRODUCTS): TesteResult {
  const reasons: string[] = [];
  if (a.lesions.includes('carocos')) reasons.push('Caroços profundos ou doloridos costumam precisar de tratamento com receita e podem deixar cicatriz.');
  if (a.marks === 'cicatrizes') reasons.push('Cicatrizes indicam que a acne já está marcando a pele, e quanto antes houver tratamento, menor esse risco.');
  if (a.amount === 'muitas') reasons.push('Muitas lesões, ou acne também no peito e nas costas, merecem avaliação profissional.');
  if (a.alerts.includes('piora-subita')) reasons.push('Piora de repente ou depois de um medicamento precisa ser avaliada por um médico.');
  if (a.alerts.includes('sem-melhora')) reasons.push('Se uma rotina mantida por 2 a 3 meses não ajudou, o próximo passo é a consulta.');
  if (a.alerts.includes('hormonal')) reasons.push('Alterações na menstruação ou nos pelos junto com acne podem ter causa hormonal, que só um médico investiga.');
  if (a.alerts.includes('autoestima')) reasons.push('Quando a acne pesa no humor ou na autoestima, vale buscar ajuda profissional, sem esperar piorar.');

  const inflamed = a.lesions.includes('espinhas') || a.lesions.includes('pus');
  const profile: Profile = reasons.length > 0 ? 'dermatologista' : inflamed && a.amount === 'varias' ? 'acompanhar' : 'basico';

  const sensitive = a.sensitivity === 'sim' || a.sensitivity === 'as-vezes';
  const needs = [SKIN_NEEDS[a.skin ?? 'normal']];
  if (sensitive) needs.push('Prefira fórmulas sem fragrância e introduza um produto novo de cada vez.');
  if (a.lesions.includes('cravos')) needs.push('Para cravos, constância na limpeza e na hidratação ajuda mais do que esfoliar com força.');
  if (a.marks === 'manchas') needs.push('Manchas que ficam depois das espinhas clareiam mais rápido com protetor solar todos os dias.');
  needs.push('Não espremer as espinhas e dar tempo: cuidados para acne levam semanas para mostrar efeito.');

  const kits = profile === 'basico'
    ? products.filter((p) => p.category === 'kit' && p.url && (sensitive ? p.forSkin?.includes('sensivel') : a.skin !== null && p.forSkin?.includes(a.skin)))
    : [];

  return { profile, reasons, needs, kits };
}
