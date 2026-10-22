// Modelos de domínio. Espelham o schema em supabase/migrations/0001_init.sql.
// Datas trafegam como string ISO; "dias" do desafio são datas locais AAAA-MM-DD.

export type MainGoal = "doces" | "bebidas" | "beliscos" | "alimentacao_geral";

export type CravingMoment =
  | "manha"
  | "apos_almoco"
  | "tarde"
  | "apos_jantar"
  | "noite"
  | "estresse"
  | "tedio"
  | "social"
  | "fim_de_semana";

export type SweetFrequency = "raramente" | "algumas_vezes_semana" | "uma_vez_dia" | "varias_vezes_dia";

export type MainDifficulty =
  | "vontade_repentina"
  | "doces_a_vista"
  | "habito_apos_refeicao"
  | "emocional"
  | "rotina_corrida"
  | "convivio";

export type DailyTime = "5" | "10" | "20";

export type AlternativePreference = "frutas" | "bebidas" | "lanches_salgados" | "receitas_rapidas" | "estrategias";

export type BudgetPreference = "economico" | "moderado" | "flexivel" | "nao_informar";

export interface QuizAnswers {
  goal: MainGoal;
  moments: CravingMoment[];
  frequency: SweetFrequency;
  difficulty: MainDifficulty;
  dailyTime: DailyTime;
  alternatives: AlternativePreference[];
  budget: BudgetPreference;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  /** Data local (AAAA-MM-DD) em que o Dia 1 começou. Nulo até concluir o onboarding. */
  challengeStartedOn: string | null;
  onboardingCompletedAt: string | null;
  createdAt: string;
  /** Conta de exemplo do modo demonstração: a UI mostra um aviso permanente. */
  isSample?: boolean;
}

export type MissionCategory = "observar" | "ambiente" | "trocar" | "planejar" | "emocoes" | "social" | "consolidar";

export interface Mission {
  day: number;
  week: 1 | 2 | 3;
  category: MissionCategory;
  title: string;
  summary: string;
  /** Por que essa missão existe — tom educativo, sem promessa de resultado. */
  why: string;
  steps: string[];
  /** Versão curta para quem tem 5 minutos. */
  quickVersion: string;
  reflectionPrompt: string;
  minutes: number;
  /** Estratégia do guia relacionada, se houver. */
  strategyId?: string;
}

export type MissionFeeling = "facil" | "ok" | "desafiador";

export interface MissionCompletion {
  id: string;
  userId: string;
  day: number;
  completedAt: string;
  feeling: MissionFeeling;
  reflection: string | null;
}

export interface SavedStrategy {
  id: string;
  userId: string;
  strategyId: string;
  note: string | null;
  savedAt: string;
}

export interface Level {
  level: number;
  name: string;
  minXp: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
}

export interface UnlockedAchievement extends Achievement {
  unlocked: boolean;
  unlockedAt: string | null;
}

export type AccessStatus = "none" | "active" | "refunded" | "revoked";

/** Compras chegam só por webhook verificado no servidor (fase futura). O cliente apenas lê. */
export interface Purchase {
  id: string;
  userId: string;
  provider: string;
  providerReference: string;
  status: "pending" | "paid" | "refunded" | "chargeback";
  amountCents: number;
  createdAt: string;
}

export interface UserData {
  profile: UserProfile;
  quiz: QuizAnswers | null;
  completions: MissionCompletion[];
  strategies: SavedStrategy[];
}
