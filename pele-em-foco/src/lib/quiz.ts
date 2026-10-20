// Questionário de rotina: transforma o que a pessoa PERCEBE da própria pele em
// sugestões de TIPOS de produto e hábitos. Não diagnostica, não classifica a acne
// e não guarda as respostas. Sinais de alerta sempre levam à orientação de
// procurar um dermatologista antes de qualquer sugestão de produto.
import type { ProductCategory } from '../content/products';

export type Oiliness = 'rosto-todo' | 'zona-t' | 'equilibrada' | 'seca';
export type Sensitivity = 'sim' | 'as-vezes' | 'nao';

export interface QuizAnswers {
  oiliness: Oiliness | null;
  sensitivity: Sensitivity | null;
  makeup: boolean | null;
  sweat: boolean | null;
  shaves: boolean | null;
  alerts: string[];
}

export const ALERTS: { value: string; label: string }[] = [
  { value: 'profundas', label: 'Espinhas grandes, profundas ou doloridas' },
  { value: 'marcas', label: 'As espinhas estão deixando marcas ou cicatrizes' },
  { value: 'piora-subita', label: 'Piorou de repente ou depois de começar um medicamento' },
  { value: 'sem-melhora', label: 'Mantenho uma rotina há 6 a 8 semanas e não melhorou' },
  { value: 'outros-sinais', label: 'Menstruação muito irregular ou pelos crescendo fora do comum' },
  { value: 'autoestima', label: 'A acne está afetando muito meu humor ou minha autoestima' },
];

export const emptyAnswers = (): QuizAnswers => ({ oiliness: null, sensitivity: null, makeup: null, sweat: null, shaves: null, alerts: [] });

export function isComplete(a: QuizAnswers) {
  return a.oiliness !== null && a.sensitivity !== null && a.makeup !== null && a.sweat !== null && a.shaves !== null;
}

export interface Suggestion {
  category: ProductCategory | null;
  title: string;
  text: string;
}

export interface QuizResult {
  seeDermatologist: boolean;
  suggestions: Suggestion[];
  habits: string[];
}

export function buildResult(a: QuizAnswers): QuizResult {
  const oily = a.oiliness === 'rosto-todo' || a.oiliness === 'zona-t';
  const dry = a.oiliness === 'seca';
  const sensitive = a.sensitivity === 'sim' || a.sensitivity === 'as-vezes';
  const fragrance = sensitive ? ' De preferência sem fragrância.' : '';

  const suggestions: Suggestion[] = [
    {
      category: 'limpador',
      title: 'Limpador',
      text: (dry
        ? 'Um limpador suave em creme ou loção, que limpe sem deixar a pele repuxando.'
        : oily
          ? 'Um gel ou espuma de limpeza suave, para pele oleosa. Use até duas vezes por dia e depois de suar, sem esfregar.'
          : 'Um limpador suave, em gel ou espuma leve.') + fragrance,
    },
    {
      category: 'hidratante',
      title: 'Hidratante',
      text: (dry
        ? 'Uma textura mais cremosa, não comedogênica, com ingredientes como glicerina ou ceramidas.'
        : 'Uma textura leve, em gel ou gel-creme, oil free e não comedogênica. Pele oleosa também precisa de hidratação.') + fragrance,
    },
    {
      category: 'protetor',
      title: 'Protetor solar',
      text: (oily
        ? 'FPS 30 ou mais, amplo espectro, com toque seco ou efeito matte.'
        : 'FPS 30 ou mais, amplo espectro, numa textura que você goste de usar todos os dias.') + (a.sweat ? ' Resistente à água ajuda nos dias de treino ou calor.' : '') + fragrance,
    },
  ];
  if (a.makeup) {
    suggestions.push({
      category: 'demaquilante',
      title: 'Demaquilante',
      text: 'Uma água micelar ou demaquilante suave para remover maquiagem e protetor antes do limpador, todas as noites.',
    });
  }

  const habits: string[] = [];
  if (sensitive) {
    habits.push('Introduza um produto novo de cada vez e faça o teste em uma pequena área por alguns dias antes de usar no rosto todo.');
    habits.push('Evite somar vários ácidos ou esfoliantes ao mesmo tempo.');
  }
  if (a.sweat) habits.push('Lave o rosto logo depois de suar e mantenha limpos capacete, boné ou máscara que encostam no rosto.');
  if (a.shaves) habits.push('Na barba, use lâmina limpa e afiada e um produto de barbear suave. Muitas bolinhas na região da barba merecem avaliação, pode não ser acne.');
  if (a.makeup) habits.push('Prefira maquiagem não comedogênica, lave pincéis e esponjas com frequência e não durma de maquiagem.');
  habits.push('Não esprema nem cutuque as espinhas: aumenta a inflamação e o risco de marcas.');
  habits.push('Dê tempo: produtos para acne costumam levar de 6 a 8 semanas para mostrar efeito.');

  return { seeDermatologist: a.alerts.length > 0, suggestions, habits };
}
