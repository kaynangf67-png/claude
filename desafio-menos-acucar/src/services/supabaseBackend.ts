import type { SupabaseClient } from "@supabase/supabase-js";
import { getGuideItem } from "@/domain/guide";
import type { MissionCompletion, QuizAnswers, SavedStrategy, UserData } from "@/domain/types";
import { env } from "@/lib/env";
import { quizAnswersSchema } from "@/validation/schemas";
import { fail, ok, type Backend, type CompleteMissionInput, type Result } from "./backend";

// Modo real. Toda regra de acesso está no banco (RLS + funções em supabase/migrations).
// As validações aqui são só para dar mensagens melhores; não são a barreira de segurança.

const GENERIC_ERROR = "Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.";

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Já existe uma conta com este e-mail. Tente entrar.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas seguidas. Aguarde alguns minutos.";
  if (m.includes("password")) return "Senha fraca ou inválida. Use pelo menos 8 caracteres.";
  return GENERIC_ERROR;
}

interface ProfileRow {
  id: string;
  display_name: string;
  challenge_started_on: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
}
interface QuizRow {
  goal: QuizAnswers["goal"];
  moments: QuizAnswers["moments"];
  frequency: QuizAnswers["frequency"];
  difficulty: QuizAnswers["difficulty"];
  daily_time: QuizAnswers["dailyTime"];
  alternatives: QuizAnswers["alternatives"];
  budget: QuizAnswers["budget"];
}
interface CompletionRow {
  id: string;
  user_id: string;
  day: number;
  feeling: MissionCompletion["feeling"];
  reflection: string | null;
  completed_at: string;
}
interface StrategyRow {
  id: string;
  user_id: string;
  strategy_id: string;
  note: string | null;
  saved_at: string;
}

const toCompletion = (r: CompletionRow): MissionCompletion => ({
  id: r.id,
  userId: r.user_id,
  day: r.day,
  feeling: r.feeling,
  reflection: r.reflection,
  completedAt: r.completed_at,
});
const toStrategy = (r: StrategyRow): SavedStrategy => ({
  id: r.id,
  userId: r.user_id,
  strategyId: r.strategy_id,
  note: r.note,
  savedAt: r.saved_at,
});

export class SupabaseBackend implements Backend {
  readonly mode = "supabase" as const;

  constructor(private readonly sb: SupabaseClient) {}

  private async uid(): Promise<string | null> {
    const { data } = await this.sb.auth.getUser();
    return data.user?.id ?? null;
  }

  async currentUserId() {
    return this.uid();
  }

  async signUp(input: { displayName: string; email: string; password: string }) {
    const redirect = `${env.siteUrl || window.location.origin}/auth/confirmar`;
    const { data, error } = await this.sb.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { display_name: input.displayName }, emailRedirectTo: redirect },
    });
    if (error) return fail(translateAuthError(error.message));
    // Com confirmação de e-mail ligada, não há sessão até a pessoa clicar no link.
    return ok({ needsEmailConfirmation: !data.session });
  }

  async signIn(input: { email: string; password: string }) {
    const { error } = await this.sb.auth.signInWithPassword(input);
    return error ? fail(translateAuthError(error.message)) : ok(undefined);
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  async loadUserData(): Promise<Result<UserData>> {
    const { data: auth } = await this.sb.auth.getUser();
    const user = auth.user;
    if (!user) return fail("Sua sessão expirou. Entre novamente.");

    const [profile, quiz, completions, strategies] = await Promise.all([
      this.sb.from("profiles").select("id, display_name, challenge_started_on, onboarding_completed_at, created_at").eq("id", user.id).maybeSingle<ProfileRow>(),
      this.sb.from("quiz_responses").select("goal, moments, frequency, difficulty, daily_time, alternatives, budget").eq("user_id", user.id).maybeSingle<QuizRow>(),
      this.sb.from("mission_completions").select("*").eq("user_id", user.id).order("completed_at").returns<CompletionRow[]>(),
      this.sb.from("saved_strategies").select("*").eq("user_id", user.id).order("saved_at").returns<StrategyRow[]>(),
    ]);
    if (profile.error || quiz.error || completions.error || strategies.error) return fail(GENERIC_ERROR);
    if (!profile.data) return fail("Seu perfil ainda não foi criado. Tente entrar novamente em instantes.");

    const q = quiz.data;
    return ok({
      profile: {
        id: profile.data.id,
        displayName: profile.data.display_name,
        email: user.email ?? "",
        challengeStartedOn: profile.data.challenge_started_on,
        onboardingCompletedAt: profile.data.onboarding_completed_at,
        createdAt: profile.data.created_at,
      },
      quiz: q
        ? {
            goal: q.goal,
            moments: q.moments,
            frequency: q.frequency,
            difficulty: q.difficulty,
            dailyTime: q.daily_time,
            alternatives: q.alternatives,
            budget: q.budget,
          }
        : null,
      completions: (completions.data ?? []).map(toCompletion),
      strategies: (strategies.data ?? []).map(toStrategy),
    });
  }

  // O "hoje" vem do servidor (fuso do perfil), então todayKey é ignorado aqui.
  async saveQuiz(answers: QuizAnswers) {
    const parsed = quizAnswersSchema.safeParse(answers);
    if (!parsed.success) return fail("Algumas respostas estão incompletas. Revise o questionário.");
    const id = await this.uid();
    if (!id) return fail("Sua sessão expirou. Entre novamente.");
    const a = parsed.data;
    const { error } = await this.sb.from("quiz_responses").upsert({
      user_id: id,
      goal: a.goal,
      moments: a.moments,
      frequency: a.frequency,
      difficulty: a.difficulty,
      daily_time: a.dailyTime,
      alternatives: a.alternatives,
      budget: a.budget,
    });
    if (error) return fail(GENERIC_ERROR);
    const started = await this.sb.rpc("start_challenge");
    return started.error ? fail(GENERIC_ERROR) : ok(undefined);
  }

  async completeMission(input: CompleteMissionInput) {
    const id = await this.uid();
    if (!id) return fail("Sua sessão expirou. Entre novamente.");
    const { data, error } = await this.sb
      .from("mission_completions")
      .insert({ user_id: id, day: input.day, feeling: input.feeling, reflection: input.reflection })
      .select("*")
      .single<CompletionRow>();
    if (error) {
      if (error.code === "23505") return fail("Você já concluiu esta missão.");
      if (error.code === "42501") return fail("Esta missão ainda não foi liberada.");
      return fail(GENERIC_ERROR);
    }
    return ok(toCompletion(data));
  }

  async saveStrategy(strategyId: string) {
    if (!getGuideItem(strategyId)) return fail("Estratégia não encontrada.");
    const id = await this.uid();
    if (!id) return fail("Sua sessão expirou. Entre novamente.");
    const { data, error } = await this.sb
      .from("saved_strategies")
      .upsert({ user_id: id, strategy_id: strategyId }, { onConflict: "user_id,strategy_id", ignoreDuplicates: false })
      .select("*")
      .single<StrategyRow>();
    return error ? fail(GENERIC_ERROR) : ok(toStrategy(data));
  }

  async removeStrategy(strategyId: string) {
    const id = await this.uid();
    if (!id) return fail("Sua sessão expirou. Entre novamente.");
    const { error } = await this.sb.from("saved_strategies").delete().eq("user_id", id).eq("strategy_id", strategyId);
    return error ? fail(GENERIC_ERROR) : ok(undefined);
  }

  async updateDisplayName(name: string) {
    const id = await this.uid();
    if (!id) return fail("Sua sessão expirou. Entre novamente.");
    const { error } = await this.sb.from("profiles").update({ display_name: name }).eq("id", id);
    return error ? fail(GENERIC_ERROR) : ok(undefined);
  }

  async resetChallenge() {
    const { error } = await this.sb.rpc("reset_challenge");
    return error ? fail(GENERIC_ERROR) : ok(undefined);
  }
}
