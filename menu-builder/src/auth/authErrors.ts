/**
 * Traduz erros do Supabase Auth para mensagens em português que dizem o que fazer.
 * Usa o `code` do erro quando existe (mais estável que o texto em inglês).
 */
export class AuthFailure extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
  ) {
    super(message);
  }
}

export function translateAuthError(error: { message: string; code?: string | null; status?: number }): AuthFailure {
  const code = error.code ?? undefined;
  const msg = error.message ?? '';
  const wait = msg.match(/after (\d+) seconds?/i)?.[1];

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg))
    return new AuthFailure('E-mail ou senha incorretos. Se acabou de criar a conta, confirme o e-mail antes de entrar.', 'invalid_credentials');
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg))
    return new AuthFailure('Seu e-mail ainda não foi confirmado. Abra o link que enviamos (veja também o spam) ou reenvie abaixo.', 'email_not_confirmed');
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered/i.test(msg))
    return new AuthFailure('Este e-mail já tem conta. Entre com sua senha.', 'user_already_exists');
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || error.status === 429 || wait)
    return new AuthFailure(
      wait ? `Muitas tentativas seguidas. Aguarde ${wait} segundos e tente de novo.` : 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
      'rate_limit',
    );
  if (code === 'weak_password') return new AuthFailure('Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.', code);
  if (code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(msg))
    return new AuthFailure('E-mail inválido. Confira se digitou certo (ex.: nome@gmail.com).', 'email_address_invalid');
  if (code === 'signup_disabled' || /signups not allowed/i.test(msg))
    return new AuthFailure('O cadastro de novas contas está fechado. Peça acesso ao administrador.', 'signup_disabled');
  if (/failed to fetch|network/i.test(msg)) return new AuthFailure('Sem conexão com o servidor. Verifique a internet e tente de novo.', 'network');
  return new AuthFailure(`Não foi possível concluir (${msg || 'erro desconhecido'}).`, code);
}

/** E-mail como o Supabase guarda: sem espaços e em minúsculas. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function emailFormatError(email: string): string | null {
  if (!email) return 'Informe o e-mail.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'E-mail inválido. Confira se digitou certo (ex.: nome@gmail.com).';
  return null;
}
