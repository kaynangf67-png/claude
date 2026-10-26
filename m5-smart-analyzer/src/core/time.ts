/** Utilitários de data/hora sem dependências externas (usa Intl). */

export function isValidTimezone(tz: string): boolean {
  if (tz === 'UTC') return true;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Deslocamento (ms) do fuso `tz` em relação ao UTC no instante `utcMs`. */
function tzOffsetMs(utcMs: number, tz: string): number {
  if (tz === 'UTC') return 0;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(Math.floor(utcMs / 1000) * 1000));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Converte um horário "de parede" no fuso `tz` para segundos Unix (UTC).
 * Em horários ambíguos (fim do horário de verão) prevalece o primeiro.
 */
export function zonedWallTimeToUnix(
  y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string,
): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const off1 = tzOffsetMs(guess, tz);
  const t1 = guess - off1;
  const off2 = tzOffsetMs(t1, tz);
  return Math.floor((guess - off2) / 1000);
}

export function formatDateTime(t: number, tz: string, withSeconds = false): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hourCycle: 'h23',
  }).format(new Date(t * 1000));
}

export function formatTime(t: number, tz: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(t * 1000));
}

/** Hora cheia (0–23) de `t` no fuso `tz`. */
export function hourOfDay(t: number, tz: string): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date(t * 1000)),
  );
}
