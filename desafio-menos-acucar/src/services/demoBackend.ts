import { isStageOpen, type FeedbackStage } from "@/domain/feedback";
import { getGuideItem } from "@/domain/guide";
import { addDays, unlockedDay } from "@/domain/progress";
import type { MissionCompletion, QuizAnswers, SavedStrategy, UserData, UserProfile } from "@/domain/types";
import { quizAnswersSchema } from "@/validation/schemas";
import { fail, ok, TERMS_VERSION, type AdminFeedbackRow, type AdminMetrics, type Backend, type CompleteMissionInput, type DemoTools, type Result } from "./backend";

// MODO DEMONSTRAÇÃO — não é seguro e não pretende ser.
// Tudo fica no localStorage deste navegador. A "senha" é guardada como hash SHA-256
// só para o fluxo de login se comportar como o real; não há servidor validando nada.

const STORE_KEY = "dma:demo:v1";
const SAMPLE_EMAIL = "exemplo@desafio.local";

interface DemoAccount {
  passwordHash: string;
  data: UserData;
  /** Respostas de feedback ficam fora de UserData, como no modo real. */
  feedbackAnswers?: { stage: FeedbackStage; answers: Record<string, string>; createdAt: string }[];
}

const BETA_ACCESS = { active: true, source: "beta", cohort: "primeira-turma" } as const;

/** Contas salvas por versões anteriores do app não têm os campos do beta. */
function normalize(data: UserData): UserData {
  return {
    ...data,
    profile: {
      ...data.profile,
      termsVersion: data.profile.termsVersion ?? null,
      termsAcceptedAt: data.profile.termsAcceptedAt ?? null,
      marketingOptIn: data.profile.marketingOptIn ?? false,
    },
    access: data.access ?? { ...BETA_ACCESS },
    feedback: data.feedback ?? [],
  };
}

const DEMO_ADMIN_MESSAGE = "O painel do fundador só funciona com o banco de dados conectado. No modo demonstração não há participantes reais.";

interface DemoStore {
  sessionUserId: string | null;
  accounts: Record<string, DemoAccount>;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const emptyStore = (): DemoStore => ({ sessionUserId: null, accounts: {} });

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

const uid = () => crypto.randomUUID();

export class DemoBackend implements Backend {
  readonly mode = "demo" as const;
  readonly demoTools: DemoTools;

  constructor(private readonly storage: KeyValueStorage) {
    this.demoTools = {
      enterSampleAccount: (todayKey) => this.enterSampleAccount(todayKey),
      advanceOneDay: () => this.advanceOneDay(),
    };
  }

  private read(): DemoStore {
    try {
      const raw = this.storage.getItem(STORE_KEY);
      if (!raw) return emptyStore();
      const parsed = JSON.parse(raw) as DemoStore;
      return parsed && typeof parsed === "object" && parsed.accounts ? parsed : emptyStore();
    } catch {
      return emptyStore();
    }
  }

  private write(store: DemoStore): Result {
    try {
      this.storage.setItem(STORE_KEY, JSON.stringify(store));
      return ok(undefined);
    } catch {
      return fail("Não foi possível salvar neste navegador. Verifique se o armazenamento local está liberado.");
    }
  }

  /** Lê, aplica a mudança na conta logada e grava. */
  private mutate<T>(fn: (acc: DemoAccount) => Result<T>): Result<T> {
    const store = this.read();
    const acc = store.sessionUserId ? store.accounts[store.sessionUserId] : undefined;
    if (!acc) return fail("Sua sessão expirou. Entre novamente.");
    acc.data = normalize(acc.data);
    const res = fn(acc);
    if (!res.ok) return res;
    const saved = this.write(store);
    return saved.ok ? res : saved;
  }

  private findByEmail(store: DemoStore, email: string): DemoAccount | undefined {
    return Object.values(store.accounts).find((a) => a.data.profile.email === email);
  }

  async currentUserId() {
    const store = this.read();
    return store.sessionUserId && store.accounts[store.sessionUserId] ? store.sessionUserId : null;
  }

  async signUp(input: { displayName: string; email: string; password: string; acceptTerms: true; marketingOptIn: boolean }) {
    if (input.acceptTerms !== true) return fail("É preciso aceitar o aviso de privacidade para participar.");
    const store = this.read();
    if (this.findByEmail(store, input.email)) return fail("Já existe uma conta com este e-mail neste navegador. Tente entrar.");
    const id = uid();
    const profile: UserProfile = {
      id,
      displayName: input.displayName,
      email: input.email,
      challengeStartedOn: null,
      onboardingCompletedAt: null,
      createdAt: new Date().toISOString(),
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date().toISOString(),
      marketingOptIn: input.marketingOptIn,
    };
    store.accounts[id] = {
      passwordHash: await sha256(input.password),
      data: { profile, quiz: null, completions: [], strategies: [], access: { ...BETA_ACCESS }, feedback: [] },
    };
    store.sessionUserId = id;
    const saved = this.write(store);
    return saved.ok ? ok({ needsEmailConfirmation: false }) : saved;
  }

  async signIn(input: { email: string; password: string }) {
    const store = this.read();
    const acc = this.findByEmail(store, input.email);
    if (!acc || acc.passwordHash !== (await sha256(input.password))) return fail("E-mail ou senha incorretos.");
    store.sessionUserId = acc.data.profile.id;
    return this.write(store);
  }

  async signOut() {
    const store = this.read();
    store.sessionUserId = null;
    this.write(store);
  }

  async loadUserData() {
    const store = this.read();
    const acc = store.sessionUserId ? store.accounts[store.sessionUserId] : undefined;
    return acc ? ok(normalize(structuredClone(acc.data))) : fail("Sua sessão expirou. Entre novamente.");
  }

  async saveQuiz(answers: QuizAnswers, todayKey: string) {
    const parsed = quizAnswersSchema.safeParse(answers);
    if (!parsed.success) return fail("Algumas respostas estão incompletas. Revise o questionário.");
    return this.mutate((acc) => {
      acc.data.quiz = parsed.data;
      acc.data.profile.challengeStartedOn ??= todayKey;
      acc.data.profile.onboardingCompletedAt ??= new Date().toISOString();
      return ok(undefined);
    });
  }

  async completeMission(input: CompleteMissionInput, todayKey: string) {
    return this.mutate<MissionCompletion>((acc) => {
      const unlocked = unlockedDay(acc.data.profile.challengeStartedOn, todayKey);
      if (input.day < 1 || input.day > unlocked) return fail("Esta missão ainda não foi liberada.");
      if (acc.data.completions.some((c) => c.day === input.day)) return fail("Você já concluiu esta missão.");
      const completion: MissionCompletion = {
        id: uid(),
        userId: acc.data.profile.id,
        day: input.day,
        feeling: input.feeling,
        reflection: input.reflection,
        completedAt: new Date().toISOString(),
      };
      acc.data.completions.push(completion);
      return ok(completion);
    });
  }

  async saveStrategy(strategyId: string) {
    if (!getGuideItem(strategyId)) return fail("Estratégia não encontrada.");
    return this.mutate<SavedStrategy>((acc) => {
      const existing = acc.data.strategies.find((s) => s.strategyId === strategyId);
      if (existing) return ok(existing);
      const s: SavedStrategy = { id: uid(), userId: acc.data.profile.id, strategyId, note: null, savedAt: new Date().toISOString() };
      acc.data.strategies.push(s);
      return ok(s);
    });
  }

  async removeStrategy(strategyId: string) {
    return this.mutate((acc) => {
      acc.data.strategies = acc.data.strategies.filter((s) => s.strategyId !== strategyId);
      return ok(undefined);
    });
  }

  async updateDisplayName(name: string) {
    return this.mutate((acc) => {
      acc.data.profile.displayName = name;
      return ok(undefined);
    });
  }

  async resetChallenge() {
    return this.mutate((acc) => {
      acc.data.quiz = null;
      acc.data.completions = [];
      acc.data.strategies = [];
      acc.data.profile.challengeStartedOn = null;
      acc.data.profile.onboardingCompletedAt = null;
      return ok(undefined);
    });
  }

  async acceptTerms(marketingOptIn: boolean) {
    return this.mutate((acc) => {
      acc.data.profile.termsVersion = TERMS_VERSION;
      acc.data.profile.termsAcceptedAt = new Date().toISOString();
      acc.data.profile.marketingOptIn = marketingOptIn;
      return ok(undefined);
    });
  }

  async setMarketingConsent(optIn: boolean) {
    return this.mutate((acc) => {
      acc.data.profile.marketingOptIn = optIn;
      return ok(undefined);
    });
  }

  async submitFeedback(stage: FeedbackStage, answers: Record<string, string>, todayKey = new Date().toISOString().slice(0, 10)) {
    return this.mutate((acc) => {
      if (!acc.data.access.active) return fail("Sua conta não tem acesso ativo ao desafio.");
      if (stage !== "geral") {
        const unlocked = unlockedDay(acc.data.profile.challengeStartedOn, todayKey);
        if (!isStageOpen(stage, unlocked, acc.data.completions.length)) return fail("Esta pesquisa ainda não foi liberada.");
        if (acc.data.feedback.some((f) => f.stage === stage)) return fail("Você já respondeu esta etapa.");
      }
      const createdAt = new Date().toISOString();
      acc.data.feedback.push({ stage, createdAt });
      (acc.feedbackAnswers ??= []).push({ stage, answers, createdAt });
      return ok(undefined);
    });
  }

  async adminMetrics(): Promise<Result<AdminMetrics>> {
    return fail(DEMO_ADMIN_MESSAGE);
  }

  async adminFeedback(): Promise<Result<AdminFeedbackRow[]>> {
    return fail(DEMO_ADMIN_MESSAGE);
  }

  private async enterSampleAccount(todayKey: string): Promise<Result> {
    const store = this.read();
    const existing = this.findByEmail(store, SAMPLE_EMAIL);
    if (existing) delete store.accounts[existing.data.profile.id];
    const id = uid();
    store.accounts[id] = { passwordHash: "", data: buildSampleData(id, todayKey) };
    store.sessionUserId = id;
    return this.write(store);
  }

  private async advanceOneDay(): Promise<Result> {
    return this.mutate((acc) => {
      const start = acc.data.profile.challengeStartedOn;
      if (!start) return fail("Conclua o questionário inicial antes.");
      acc.data.profile.challengeStartedOn = addDays(start, -1);
      return ok(undefined);
    });
  }
}

/** Conta de exemplo: começou há 5 dias, está no Dia 6 e concluiu 4 missões (pulou o Dia 3). */
export function buildSampleData(id: string, todayKey: string): UserData {
  const start = addDays(todayKey, -5);
  const at = (dayOffset: number, hour: number) => {
    const [y, m, d] = addDays(start, dayOffset).split("-").map(Number);
    return new Date(y!, m! - 1, d!, hour, 15).toISOString();
  };
  const c = (day: number, offset: number, hour: number, feeling: MissionCompletion["feeling"], reflection: string | null): MissionCompletion => ({
    id: uid(),
    userId: id,
    day,
    completedAt: at(offset, hour),
    feeling,
    reflection,
  });
  return {
    profile: {
      id,
      displayName: "Visitante",
      email: SAMPLE_EMAIL,
      challengeStartedOn: start,
      onboardingCompletedAt: at(0, 8),
      createdAt: at(0, 8),
      isSample: true,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: at(0, 8),
      marketingOptIn: false,
    },
    access: { ...BETA_ACCESS },
    feedback: [{ stage: "inicial", createdAt: at(0, 9) }],
    quiz: {
      goal: "doces",
      moments: ["apos_almoco", "tarde", "noite"],
      frequency: "uma_vez_dia",
      difficulty: "habito_apos_refeicao",
      dailyTime: "10",
      alternatives: ["frutas", "bebidas", "estrategias"],
      budget: "moderado",
    },
    completions: [
      c(1, 0, 21, "ok", "Percebi que pego um doce quase todo dia depois do almoço, sem nem pensar."),
      c(2, 1, 20, "facil", null),
      c(4, 3, 19, "desafiador", "À tarde era mais cansaço do que fome."),
      c(5, 4, 12, "ok", null),
    ],
    strategies: [
      { id: uid(), userId: id, strategyId: "regra-10-minutos", note: null, savedAt: at(2, 18) },
      { id: uid(), userId: id, strategyId: "agua-saborizada", note: null, savedAt: at(4, 12) },
    ],
  };
}
