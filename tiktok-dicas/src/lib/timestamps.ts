import type { Palavra } from "../tipos";

/**
 * Aceita os formatos mais comuns de timestamps por palavra e devolve sempre Palavra[].
 *
 * 1. Formato do projeto:     { "palavras": [{ "texto", "inicio", "fim" }] }  (segundos)
 * 2. Lista simples:          [{ "word"|"text"|"texto", "start"|"inicio", "end"|"fim" }]
 * 3. Whisper / ElevenLabs STT: { "words": [...] }  ou  { "segments": [{ "words": [...] }] }
 * 4. ElevenLabs TTS "with-timestamps": { "alignment": { characters, character_start_times_seconds, character_end_times_seconds } }
 */
export const normalizarTimestamps = (bruto: unknown): Palavra[] => {
  const dado = bruto as Record<string, unknown>;

  const alinhamento = (dado?.alignment ?? dado?.normalized_alignment ?? dado) as Record<string, unknown>;
  if (Array.isArray(alinhamento?.characters)) {
    return deCaracteres(
      alinhamento.characters as string[],
      alinhamento.character_start_times_seconds as number[],
      alinhamento.character_end_times_seconds as number[],
    );
  }

  let lista: unknown[] | null = null;
  if (Array.isArray(bruto)) lista = bruto;
  else if (Array.isArray(dado?.palavras)) lista = dado.palavras as unknown[];
  else if (Array.isArray(dado?.words)) lista = dado.words as unknown[];
  else if (Array.isArray(dado?.segments)) {
    lista = (dado.segments as { words?: unknown[] }[]).flatMap((s) => s.words ?? []);
  }
  if (!lista) {
    throw new Error(
      "Formato de timestamps não reconhecido. Use { \"palavras\": [{ \"texto\", \"inicio\", \"fim\" }] } (em segundos).",
    );
  }

  const palavras = lista
    .map((item) => item as Record<string, unknown>)
    .filter((p) => p.type === undefined || p.type === "word")
    .map((p) => ({
      texto: String(p.texto ?? p.palavra ?? p.word ?? p.text ?? "").trim(),
      inicio: Number(p.inicio ?? p.start),
      fim: Number(p.fim ?? p.end),
    }))
    .filter((p) => p.texto.length > 0 && Number.isFinite(p.inicio) && Number.isFinite(p.fim));

  if (palavras.length === 0) throw new Error("O arquivo de timestamps não tem nenhuma palavra.");
  return palavras.sort((a, b) => a.inicio - b.inicio);
};

const deCaracteres = (chars: string[], inicios: number[], fins: number[]): Palavra[] => {
  const palavras: Palavra[] = [];
  let atual: Palavra | null = null;
  chars.forEach((c, i) => {
    if (/\s/.test(c)) {
      if (atual) palavras.push(atual);
      atual = null;
      return;
    }
    if (!atual) atual = { texto: "", inicio: inicios[i], fim: fins[i] };
    atual.texto += c;
    atual.fim = fins[i];
  });
  if (atual) palavras.push(atual);
  return palavras;
};

export const normalizarTexto = (t: string): string =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9$%]+/g, "");

export const tokens = (t: string): string[] =>
  t
    .split(/\s+/)
    .map(normalizarTexto)
    .filter((w) => w.length > 0);
