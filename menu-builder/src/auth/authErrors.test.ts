import { describe, expect, it } from 'vitest';
import { emailFormatError, normalizeEmail, translateAuthError } from './authErrors';

describe('translateAuthError', () => {
  it('usa o código do Supabase', () => {
    expect(translateAuthError({ message: 'x', code: 'email_not_confirmed' }).code).toBe('email_not_confirmed');
    expect(translateAuthError({ message: 'Invalid login credentials', code: 'invalid_credentials' }).message).toMatch(/E-mail ou senha incorretos/);
  });
  it('traduz o bloqueio por excesso de tentativas com os segundos', () => {
    const e = translateAuthError({ message: 'For security purposes, you can only request this after 29 seconds.', code: 'over_email_send_rate_limit', status: 429 });
    expect(e.message).toBe('Muitas tentativas seguidas. Aguarde 29 segundos e tente de novo.');
  });
  it('nunca devolve a mensagem crua em inglês sozinha', () => {
    expect(translateAuthError({ message: 'Something weird' }).message).toMatch(/^Não foi possível concluir/);
  });
});

describe('e-mail', () => {
  it('normaliza espaços e maiúsculas do teclado do celular', () => {
    expect(normalizeEmail('  Kaynan@Gmail.com ')).toBe('kaynan@gmail.com');
  });
  it('valida formato', () => {
    expect(emailFormatError('kaynan@gmail.com')).toBeNull();
    expect(emailFormatError('kaynan@gmail')).not.toBeNull();
    expect(emailFormatError('')).not.toBeNull();
  });
});
