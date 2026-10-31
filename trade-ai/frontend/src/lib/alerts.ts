/** Alerta de novo sinal: som, vibração, notificação (quando o navegador permite) e título da aba piscando. */

const KEY = "trade-ai:alertas";
let audio: AudioContext | null = null;
let titleTimer: number | undefined;

export function alertsOn(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Precisa ser chamado num toque/clique: libera o som e pede permissão de notificação. */
export async function enableAlerts(): Promise<boolean> {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audio = audio ?? new Ctx();
      await audio.resume();
    }
  } catch { /* sem áudio */ }
  try {
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
  } catch { /* sem notificação */ }
  try {
    localStorage.setItem(KEY, "1");
  } catch { /* sem armazenamento */ }
  beep(true);
  return true;
}

export function disableAlerts(): void {
  try {
    localStorage.setItem(KEY, "0");
  } catch { /* sem armazenamento */ }
}

function beep(up: boolean) {
  if (!audio || audio.state !== "running") return;
  const t = audio.currentTime;
  [0, 0.18].forEach((d, i) => {
    const o = audio!.createOscillator();
    const g = audio!.createGain();
    o.frequency.value = up ? 660 + i * 220 : 660 - i * 220;
    g.gain.setValueAtTime(0.0001, t + d);
    g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.16);
    o.connect(g).connect(audio!.destination);
    o.start(t + d);
    o.stop(t + d + 0.17);
  });
}

export function fireSignal(title: string, body: string, up: boolean): void {
  if (!alertsOn()) return;
  beep(up);
  try {
    navigator.vibrate?.([220, 100, 220]);
  } catch { /* sem vibração */ }
  try {
    if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body });
  } catch { /* Android exige service worker para notificação; o som e a vibração continuam */ }
  const original = document.title.startsWith("●") ? "Trade AI — Leitura de print" : document.title;
  let n = 0;
  window.clearInterval(titleTimer);
  titleTimer = window.setInterval(() => {
    document.title = n++ % 2 ? original : `● ${title}`;
    if (n > 12) {
      window.clearInterval(titleTimer);
      document.title = original;
    }
  }, 800);
}
