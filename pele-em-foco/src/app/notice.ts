// Mensagem de uma única leitura para a tela de login ("Sua conta foi excluída", "Senha alterada").
// Não usa o state da rota porque os guards também navegam quando a sessão acaba.
let pending: string | null = null;

export const setNextNotice = (message: string) => void (pending = message);

export function takeNextNotice(): string | null {
  const m = pending;
  pending = null;
  return m;
}
