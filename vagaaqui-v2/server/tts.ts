/**
 * Voz humanizada para a navegação. Roda no servidor (função do Vercel) para que
 * a chave do provedor NUNCA vá para o celular.
 *
 * Provedores (o primeiro com chave configurada vence):
 *  - Google Cloud Text-to-Speech, vozes Chirp 3 HD (1 milhão de caracteres/mês grátis)
 *      GOOGLE_TTS_API_KEY, GOOGLE_TTS_VOICE (padrão pt-BR-Chirp3-HD-Aoede)
 *  - ElevenLabs (multilingual v2)
 *      ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
 * Sem chave: responde 501 e o app usa a voz do próprio celular.
 */
export interface TtsEnv {
  GOOGLE_TTS_API_KEY?: string;
  GOOGLE_TTS_VOICE?: string;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_VOICE_ID?: string;
}

const MAX_CHARS = 220;
/** frases de navegação: letras (com acento), números e pontuação simples */
const SAFE_TEXT = /^[\p{L}\p{N}\s.,;:!?ºª°%()'"\-–/]+$/u;

const json = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function audio(body: ArrayBuffer | Uint8Array<ArrayBuffer>, provider: string) {
  return new Response(body as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      // a mesma frase vira o mesmo áudio: cache longo na CDN = quase nenhum custo repetido
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      'X-TTS-Provider': provider,
    },
  });
}

async function google(text: string, env: TtsEnv, f: typeof fetch): Promise<Response> {
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(env.GOOGLE_TTS_API_KEY!)}`;
  const body = (name?: string) =>
    JSON.stringify({
      input: { text },
      voice: name ? { languageCode: 'pt-BR', name } : { languageCode: 'pt-BR' },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 1.05 },
    });
  let res = await f(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body(env.GOOGLE_TTS_VOICE || 'pt-BR-Chirp3-HD-Aoede') });
  // voz configurada inexistente: tenta a voz padrão do idioma em vez de ficar mudo
  if (res.status === 400) res = await f(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body() });
  if (!res.ok) return json(502, `google ${res.status}`);
  const { audioContent } = (await res.json()) as { audioContent?: string };
  if (!audioContent) return json(502, 'google sem áudio');
  return audio(Uint8Array.from(atob(audioContent), (c) => c.charCodeAt(0)), 'google');
}

async function elevenlabs(text: string, env: TtsEnv, f: typeof fetch): Promise<Response> {
  const voice = env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
  const res = await f(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
  });
  if (!res.ok) return json(502, `elevenlabs ${res.status}`);
  return audio(await res.arrayBuffer(), 'elevenlabs');
}

export async function handleTts(request: Request, env: TtsEnv, f: typeof fetch = fetch): Promise<Response> {
  const text = (new URL(request.url).searchParams.get('text') ?? '').trim();
  if (!text || text.length > MAX_CHARS || !SAFE_TEXT.test(text)) return json(400, 'texto inválido');
  // só o próprio app (o navegador marca pedidos de outros sites)
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return json(403, 'origem não permitida');
  try {
    if (env.GOOGLE_TTS_API_KEY) return await google(text, env, f);
    if (env.ELEVENLABS_API_KEY) return await elevenlabs(text, env, f);
  } catch {
    return json(502, 'provedor indisponível');
  }
  return json(501, 'voz humanizada não configurada');
}
