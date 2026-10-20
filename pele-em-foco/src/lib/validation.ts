// Validações de formulário com mensagens em português.

export function validateEmail(email: string): string | null {
  const v = email.trim();
  if (!v) return 'Informe seu e-mail.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Este e-mail não parece válido.';
  return null;
}

export const PASSWORD_MIN = 8;

export function validatePassword(password: string): string | null {
  if (!password) return 'Crie uma senha.';
  if (password.length < PASSWORD_MIN) return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) return 'Use letras e números na senha.';
  return null;
}

export function validateDisplayName(name: string): string | null {
  if (name.trim().length > 60) return 'Use no máximo 60 caracteres.';
  return null;
}
