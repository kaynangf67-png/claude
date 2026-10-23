import { AppError } from '../../lib/errors';

export interface BackgroundRemover {
  readonly id: string;
  /** Devolve PNG com transparência. */
  remove(image: Buffer, mimeType: string): Promise<Buffer>;
}

/**
 * remove.bg — API oficial (https://www.remove.bg/api). Exige REMOVE_BG_API_KEY.
 * Implementado segundo a documentação; não testado contra a API real neste ambiente.
 * A segmentação só separa o produto do fundo; não altera cor nem forma, mas pode
 * cortar bordas finas — por isso o resultado é salvo como cópia para revisão.
 */
export class RemoveBgRemover implements BackgroundRemover {
  readonly id = 'remove.bg';
  constructor(
    private readonly apiKey: string,
    private readonly endpoint = 'https://api.remove.bg/v1.0/removebg',
  ) {}

  async remove(image: Buffer, mimeType: string): Promise<Buffer> {
    const form = new FormData();
    form.append('image_file', new Blob([new Uint8Array(image)], { type: mimeType }), 'image');
    form.append('size', 'auto');
    form.append('format', 'png');
    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'X-Api-Key': this.apiKey },
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new AppError(503, 'bg_unreachable', 'Serviço de remoção de fundo indisponível.');
    }
    if (res.status === 402) throw new AppError(402, 'bg_credits', 'Sem créditos no serviço de remoção de fundo.');
    if (res.status === 403) throw new AppError(503, 'bg_auth', 'Chave do serviço de remoção de fundo inválida.');
    if (!res.ok) throw new AppError(502, 'bg_failed', 'Não foi possível remover o fundo desta imagem.');
    return Buffer.from(await res.arrayBuffer());
  }
}
