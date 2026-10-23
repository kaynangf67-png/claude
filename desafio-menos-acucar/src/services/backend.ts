import type { FeedbackStage } from "@/domain/feedback";
import type { MissionCompletion, QuizAnswers, SavedStrategy, UserData } from "@/domain/types";
import type { SignInInput, SignUpInput } from "@/validation/schemas";

export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = (error: string): Result<never> => ({ ok: false, error });

export interface CompleteMissionInput {
  day: number;
  feeling: MissionCompletion["feeling"];
  reflection: string | null;
}

/**
 * Contrato único de dados. A UI só fala com esta interface; quem decide entre
 * modo demonstração (localStorage) e Supabase é `getBackend()` em services/index.ts.
 */
export interface Backend {
  readonly mode: "demo" | "supabase";
  /** Retorna o id do usuário logado ou null. */
  currentUserId(): Promise<string | null>;
  signUp(input: SignUpInput): Promise<Result<{ needsEmailConfirmation: boolean }>>;
  signIn(input: SignInInput): Promise<Result>;
  signOut(): Promise<void>;
  loadUserData(): Promise<Result<UserData>>;
  /** Salva as respostas e, na primeira vez, inicia o Dia 1 do desafio na data local informada. */
  saveQuiz(answers: QuizAnswers, todayKey: string): Promise<Result>;
  completeMission(input: CompleteMissionInput, todayKey: string): Promise<Result<MissionCompletion>>;
  saveStrategy(strategyId: string): Promise<Result<SavedStrategy>>;
  removeStrategy(strategyId: string): Promise<Result>;
  updateDisplayName(name: string): Promise<Result>;
  /** Apaga progresso e respostas e volta para o onboarding. A conta continua existindo. */
  resetChallenge(): Promise<Result>;
  /** Aceite do aviso de privacidade para contas criadas antes dele existir. */
  acceptTerms(marketingOptIn: boolean): Promise<Result>;
  setMarketingConsent(optIn: boolean): Promise<Result>;
  /** Envia uma pesquisa (ou mensagem "geral"). A validação definitiva é feita no servidor. */
  submitFeedback(stage: FeedbackStage, answers: Record<string, string>): Promise<Result>;
  /** Só administradores (verificado no banco). No modo demonstração, indisponível. */
  adminMetrics(): Promise<Result<AdminMetrics>>;
  adminFeedback(stage: FeedbackStage | null): Promise<Result<AdminFeedbackRow[]>>;
  /** Só existe no modo demonstração. */
  readonly demoTools?: DemoTools;
}

export interface DemoTools {
  /** Cria e entra numa conta de exemplo, já no Dia 6, marcada como "dados de exemplo". */
  enterSampleAccount(todayKey: string): Promise<Result>;
  /** Volta a data de início em 1 dia, simulando a passagem do tempo. */
  advanceOneDay(): Promise<Result>;
}

/** Versão do aviso de privacidade. Mudar o texto de /privacidade exige subir esta versão. */
export const TERMS_VERSION = "beta-2026-10";

export interface AdminMetrics {
  generated_at: string;
  registered: number;
  marketing_opt_in: number;
  started: number;
  completed_one: number;
  returned: number;
  reached_day7: number;
  completed_21: number;
  by_day: { day: number; completed: number }[];
  feedback: {
    inicial: { submitted: number; eligible: number };
    dia7: { submitted: number; eligible: number };
    dia21: { submitted: number; eligible: number };
    geral: { submitted: number };
  };
  difficulties: Record<string, number>;
  goals: Record<string, number>;
  ease_day7: Record<string, number>;
  would_pay: Record<string, number>;
  would_recommend: Record<string, number>;
}

export interface AdminFeedbackRow {
  id: string;
  first_name: string;
  stage: FeedbackStage;
  answers: Record<string, string>;
  created_at: string;
}
