import { describe, expect, it, vi } from 'vitest';
import { handleTts } from './tts';

const req = (text: string, site = 'same-origin') => new Request(`https://app.test/api/tts?text=${encodeURIComponent(text)}`, { headers: { 'sec-fetch-site': site } });
const mp3 = btoa('ID3fake-mp3');

describe('voz humanizada (função do servidor)', () => {
  it('sem chave configurada: 501 (o app usa a voz do celular)', async () => {
    const r = await handleTts(req('Vire à direita'), {});
    expect(r.status).toBe(501);
  });

  it('Google: devolve MP3 com cache longo e não expõe a chave', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ audioContent: mp3 })));
    const r = await handleTts(req('Em 100 metros, vire à direita na Rua Sete'), { GOOGLE_TTS_API_KEY: 'k123' }, f as unknown as typeof fetch);
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(r.headers.get('Cache-Control')).toContain('max-age=31536000');
    expect(new TextDecoder().decode(await r.arrayBuffer())).toBe('ID3fake-mp3');
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.voice).toEqual({ languageCode: 'pt-BR', name: 'pt-BR-Chirp3-HD-Aoede' });
    expect(body.input.text).toBe('Em 100 metros, vire à direita na Rua Sete');
  });

  it('Google: voz configurada inválida → tenta a voz padrão do idioma', async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response('bad voice', { status: 400 })).mockResolvedValueOnce(new Response(JSON.stringify({ audioContent: mp3 })));
    const r = await handleTts(req('Recalculando a rota'), { GOOGLE_TTS_API_KEY: 'k', GOOGLE_TTS_VOICE: 'pt-BR-Inexistente' }, f as unknown as typeof fetch);
    expect(r.status).toBe(200);
    expect(JSON.parse(f.mock.calls[1][1].body).voice).toEqual({ languageCode: 'pt-BR' });
  });

  it('ElevenLabs quando só ele está configurado', async () => {
    const f = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    const r = await handleTts(req('Você chegou'), { ELEVENLABS_API_KEY: 'x' }, f as unknown as typeof fetch);
    expect(r.status).toBe(200);
    expect((f.mock.calls[0] as unknown as [string])[0]).toContain('api.elevenlabs.io/v1/text-to-speech/');
  });

  it('recusa texto grande, estranho ou pedido de outro site (protege a cota)', async () => {
    const env = { GOOGLE_TTS_API_KEY: 'k' };
    expect((await handleTts(req('a'.repeat(300)), env)).status).toBe(400);
    expect((await handleTts(req('<script>alert(1)</script>'), env)).status).toBe(400);
    expect((await handleTts(req('Vire à direita', 'cross-site'), env)).status).toBe(403);
  });

  it('provedor fora do ar: 502 (o app cai para a voz do celular)', async () => {
    const f = vi.fn(async () => new Response('down', { status: 503 }));
    expect((await handleTts(req('Siga em frente'), { GOOGLE_TTS_API_KEY: 'k' }, f as unknown as typeof fetch)).status).toBe(502);
  });
});
