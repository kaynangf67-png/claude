import sharp from 'sharp';
import { AppError } from '../../lib/errors';

/**
 * Gera cenas novas COM O MESMO PRODUTO da foto (modelo de imagem do Google
 * Gemini). O modelo recebe a foto real como referência e só pode mudar o que
 * está em volta: cenário, luz, ângulo da câmera em relação à cena. As regras
 * do prompt proíbem mudar forma, cor, marca e textos do produto, mas um modelo
 * de imagem pode errar — por isso cada imagem sai marcada como gerada por IA
 * e como promocional (não pode virar a foto principal).
 */
export interface SceneGenerator {
  readonly id: string;
  readonly model: string;
  generate(photo: { data: Buffer; mimeType: string }, scene: string, aspectRatio: '1:1' | '3:4'): Promise<Buffer>;
}

export const SCENES = [
  {
    key: 'ia_estudio',
    label: 'Estúdio (IA)',
    aspect: '1:1',
    prompt:
      'Foto de estúdio profissional para e-commerce: o produto sobre uma superfície lisa em tom neutro, fundo em degradê suave, luz de softbox lateral, sombra realista no chão.',
  },
  {
    key: 'ia_ambiente',
    label: 'Ambiente de uso (IA)',
    aspect: '1:1',
    prompt:
      'Foto realista do produto no ambiente onde ele normalmente é usado (escolha o ambiente que combina com esse tipo de produto), apoiado numa superfície, com o fundo levemente desfocado e luz natural.',
  },
  {
    key: 'ia_detalhe',
    label: 'Close com luz dramática (IA)',
    aspect: '1:1',
    prompt:
      'Close fotográfico do produto em fundo escuro, com luz lateral dramática que realça material e acabamento. O produto inteiro continua visível no quadro.',
  },
  {
    key: 'ia_vertical',
    label: 'Vertical para stories (IA)',
    aspect: '3:4',
    prompt:
      'Composição vertical estilo editorial para redes sociais: o produto em destaque sobre um fundo de cor sólida que combine com as cores dele, com uma forma geométrica simples de apoio e sombra suave.',
  },
] as const;

const RULES = `Use a foto enviada como referência exata do produto.
Regras obrigatórias:
- O produto deve ser IDÊNTICO ao da foto: mesma forma, proporções, cores, materiais, marca, textos e logotipos. Não redesenhe, não melhore, não troque peças.
- Não adicione ao produto textos, logotipos, selos, acessórios ou partes que não aparecem na foto.
- Mostre o produto do mesmo lado que aparece na foto (não invente o verso ou lados escondidos).
- Não escreva nenhum texto na imagem.
- Apenas um produto na cena.
Cena: `;

export class GeminiSceneGenerator implements SceneGenerator {
  readonly id = 'gemini';
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generate(photo: { data: Buffer; mimeType: string }, scene: string, aspectRatio: '1:1' | '3:4'): Promise<Buffer> {
    // A foto vai reduzida: o modelo não precisa de mais que isso para manter o produto.
    const ref = await sharp(photo.data).rotate().resize({ width: 1536, height: 1536, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
    const res = await this.fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: ref.toString('base64') } }, { text: RULES + scene }] }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio } },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (res.status === 401 || res.status === 403) throw new AppError(502, 'image_ai_auth', 'A chave da IA de imagens foi recusada. Confira GEMINI_API_KEY.');
    if (res.status === 429) throw new AppError(429, 'image_ai_rate', 'A IA de imagens está no limite de uso. Tente de novo em alguns minutos.');
    if (!res.ok) throw new AppError(502, 'image_ai_error', `A IA de imagens respondeu com erro (HTTP ${res.status}).`);
    const body = (await res.json()) as {
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ inlineData?: { data?: string }; inline_data?: { data?: string } }> } }>;
      promptFeedback?: { blockReason?: string };
    };
    const parts = body.candidates?.[0]?.content?.parts ?? [];
    const data = parts.map((p) => p.inlineData?.data ?? p.inline_data?.data).find(Boolean);
    if (!data) throw new AppError(502, 'image_ai_empty', 'A IA de imagens não devolveu imagem para esta cena.');
    return Buffer.from(data, 'base64');
  }
}
