import type { Article } from '../content/articles';

export interface AuthUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  acceptedDisclaimer: boolean;
}

export interface AuthService {
  readonly kind: 'supabase' | 'demo';
  getUser(): Promise<AuthUser | null>;
  onChange(cb: (user: AuthUser | null, event?: string) => void): () => void;
  signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
}

export type AccessStatus = 'active' | 'expired' | 'revoked' | 'none';
export interface AccessInfo {
  status: AccessStatus;
  startsAt: string | null;
  /** null com status ativo = acesso vitalício (o banco grava 'infinity') */
  expiresAt: string | null;
  source: string | null;
}
export type ClaimResult = 'activated' | 'already_active' | 'no_purchase' | 'email_not_confirmed' | 'not_authenticated';

export interface Profile {
  displayName: string;
  acceptedDisclaimerAt: string | null;
  createdAt: string;
}

export type Period = 'manha' | 'noite';
export interface RoutineCompletion {
  completedOn: string;
  period: Period;
  stepKey: string;
}

export type SkinFeel = 'como-sempre' | 'mais-oleosa' | 'repuxando' | 'irritada';
export interface JournalInput {
  entryDate: string;
  notes: string;
  skinFeel: SkinFeel | null;
  observations: string[];
  productsUsed: string;
}
export interface JournalEntry extends JournalInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportedData {
  exportedAt: string;
  account: { email: string };
  profile: Profile | null;
  access: AccessInfo;
  routine: RoutineCompletion[];
  journal: JournalEntry[];
}

export interface DataService {
  getAccess(): Promise<AccessInfo>;
  claimAccess(): Promise<ClaimResult>;
  getProfile(): Promise<Profile | null>;
  updateDisplayName(name: string): Promise<void>;
  listCompletions(from: string, to: string): Promise<RoutineCompletion[]>;
  setCompletion(date: string, period: Period, stepKey: string, done: boolean): Promise<void>;
  listJournal(): Promise<JournalEntry[]>;
  saveJournal(input: JournalInput, id?: string): Promise<JournalEntry>;
  deleteJournal(id: string): Promise<void>;
  listArticles(): Promise<Article[]>;
  exportData(email: string): Promise<ExportedData>;
  deleteMyData(): Promise<void>;
  deleteAccount(): Promise<void>;
}

/** Controles que só existem no modo demonstração. */
export interface DemoControls {
  grantDemoAccess(): Promise<void>;
  expireDemoAccess(): Promise<void>;
  removeDemoAccess(): Promise<void>;
}

/** Erro com mensagem já pronta para mostrar ao usuário, em português. */
export class AppError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'AppError';
  }
}
