/** Erro com mensagem segura para o usuário. Qualquer outro erro vira "erro interno" na resposta. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what = 'Recurso') => new AppError(404, 'not_found', `${what} não encontrado.`);
