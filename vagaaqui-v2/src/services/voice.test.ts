import { describe, expect, it } from 'vitest';
import { pickDeviceVoice } from './voice';

const v = (name: string, lang: string, localService = true) => ({ name, lang, localService, default: false, voiceURI: name }) as SpeechSynthesisVoice;

describe('voz do celular', () => {
  it('prefere voz pt-BR "natural"/neural', () => {
    const best = pickDeviceVoice([v('Microsoft Daniel - Portuguese (Brazil)', 'pt-BR'), v('Microsoft Francisca Online (Natural) - Portuguese (Brazil)', 'pt-BR', false), v('Google US English', 'en-US')]);
    expect(best?.name).toContain('Francisca Online (Natural)');
  });
  it('sem pt-BR usa outro português; sem português nenhum, nada', () => {
    expect(pickDeviceVoice([v('Joana', 'pt-PT'), v('Alex', 'en-US')])?.name).toBe('Joana');
    expect(pickDeviceVoice([v('Alex', 'en-US')])).toBeNull();
  });
});
