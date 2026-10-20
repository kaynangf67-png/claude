import { AppError } from '../types';

/** Traduz erros do Supabase (Auth e PostgREST) para mensagens úteis em português. */
export function translateError(error: { message?: string; code?: string; status?: number } | null | undefined): AppError {
  const msg = error?.message ?? '';
  const code = error?.code ?? '';
  if (/invalid login credentials/i.test(msg)) return new AppError('E-mail ou senha incorretos.', 'invalid_credentials');
  if (/email not confirmed/i.test(msg)) return new AppError('Confirme seu e-mail pelo link que enviamos antes de entrar.', 'email_not_confirmed');
  if (/already registered|already been registered/i.test(msg)) return new AppError('Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.', 'user_exists');
  if (/password should be at least|weak password/i.test(msg)) return new AppError('Senha fraca. Use pelo menos 8 caracteres, com letras e números.', 'weak_password');
  if (/same password|different from the old/i.test(msg)) return new AppError('A nova senha precisa ser diferente da atual.', 'same_password');
  if (/rate limit|too many/i.test(msg) || error?.status === 429) return new AppError('Muitas tentativas. Aguarde alguns minutos e tente de novo.', 'rate_limited');
  if (/auth session missing|jwt expired|invalid jwt/i.test(msg)) return new AppError('Sua sessão expirou. Entre novamente.', 'session_expired');
  if (code === '42501' || /row-level security/i.test(msg)) return new AppError('Seu acesso ao app não está ativo, então não foi possível salvar.', 'no_access');
  if (code === '23505') return new AppError('Já existe um registro para esta data.', 'duplicate');
  if (code === '23514') return new AppError('Algum campo tem um valor que não é aceito.', 'invalid');
  if (/failed to fetch|network/i.test(msg)) return new AppError('Sem conexão com o servidor. Verifique sua internet.', 'network');
  return new AppError('Algo deu errado. Tente de novo em instantes.', code || 'unknown');
}
