import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, ImagePlus, Loader2, RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import { useLive } from "../lib/live";
import type { VisionResult } from "../lib/types";
import { price } from "../lib/format";
import { Badge, Button, Card, Empty, cx } from "../components/ui";

export function Capture() {
  const { toast } = useLive();
  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const take = useCallback((b: Blob | null | undefined) => {
    if (!b || !b.type.startsWith("image/")) return;
    setFile(b);
    setResult(null);
    setError(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(b);
    });
  }, []);

  // Ctrl+V com a captura copiada do TradingView (botão de câmera → "Copiar imagem do gráfico")
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (item) take(item.getAsFile());
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [take]);

  const analyze = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.vision(file));
    } catch (e) {
      setError((e as Error).message);
      toast((e as Error).message, "erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <Card title="Captura do gráfico" action={<Badge tone="info">PNG · JPG · WEBP · até 5 MB</Badge>}>
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files[0]); }}
          className={cx("flex min-h-[320px] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed bg-panel p-4 text-center transition-colors",
            drag ? "border-info bg-info-soft" : "border-line-2 hover:border-info/60")}>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => take(e.target.files?.[0])} />
          {preview ? <img src={preview} alt="Captura enviada" className="max-h-[460px] rounded-xl object-contain" /> : (
            <>
              <ImagePlus size={28} className="text-mute" />
              <div className="text-[14px] font-semibold">Cole (Ctrl+V), arraste ou selecione a imagem</div>
              <div className="max-w-sm text-[12.5px] text-mute">
                No TradingView, use o ícone de câmera → “Copiar imagem do gráfico”. Mostre o ativo, o tempo gráfico M5, a escala de preço e o horário.
              </div>
            </>
          )}
        </label>
        <div className="mt-4 flex gap-2">
          <Button variant="primary" className="flex-1" disabled={!file || busy} onClick={analyze}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} Analisar com IA
          </Button>
          {file && <Button onClick={() => { setFile(null); setPreview(null); setResult(null); }}>Limpar</Button>}
        </div>
        <p className="mt-3 text-[11.5px] text-faint">
          O navegador não consegue capturar o gráfico do TradingView sozinho (o widget é de outro domínio), por isso a captura é colada ou enviada por você.
        </p>
      </Card>

      <Card title="Leitura da IA">
        {error && <div className="rounded-xl border border-sell/30 bg-sell-soft px-3 py-2.5 text-[13px] text-sell">{error}</div>}
        {!result && !error && <Empty icon={<Camera size={20} />} title="Nenhuma imagem analisada" text="A IA só descreve o que está visível. Campos ilegíveis voltam vazios, nunca estimados." />}
        {result && (
          <div className="space-y-4">
            {result.request_new_capture ? (
              <div className="rounded-xl border border-warn/30 bg-warn-soft p-3 text-[13px] text-warn">
                <div className="flex items-center gap-2 font-semibold"><RefreshCw size={15} /> Envie uma nova captura</div>
                <ul className="mt-1.5 space-y-1 text-[12.5px]">
                  {result.new_capture_reason && <li>• {result.new_capture_reason}</li>}
                  {result.server_checks.map((c) => <li key={c}>• {c}</li>)}
                  {result.missing.map((c) => <li key={c}>• Ausente: {c}</li>)}
                </ul>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-buy/30 bg-buy-soft p-3 text-[13px] font-semibold text-buy">
                <CheckCircle2 size={15} /> Captura legível, M5 e atual
              </div>
            )}
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              <Item k="Ativo" v={result.symbol} /><Item k="Bolsa" v={result.exchange} />
              <Item k="Timeframe" v={result.timeframe} /><Item k="Último preço visível" v={result.last_price !== null ? price(result.last_price) : null} />
              <Item k="Horário visível" v={result.visible_datetime_text} /><Item k="Tendência lida" v={result.trend_read} />
              <Item k="Plataforma" v={result.platform} />
            </dl>
            {result.indicators_visible.length > 0 && (
              <div><div className="text-[11.5px] text-faint">Indicadores visíveis</div>
                <div className="mt-1 flex flex-wrap gap-1.5">{result.indicators_visible.map((i) => <Badge key={i}>{i}</Badge>)}</div></div>
            )}
            {result.levels_visible.length > 0 && (
              <div><div className="text-[11.5px] text-faint">Níveis visíveis</div>
                <ul className="num mt-1 space-y-0.5 text-[12.5px]">{result.levels_visible.map((l, i) => <li key={i}>{l.label}: {l.price !== null ? price(l.price) : "ilegível"}</li>)}</ul></div>
            )}
            {result.observations.length > 0 && (
              <ul className="space-y-1 text-[12.5px] text-mute">{result.observations.map((o) => <li key={o}>• {o}</li>)}</ul>
            )}
            <p className="flex items-start gap-1.5 text-[11.5px] text-faint"><AlertTriangle size={12} className="mt-px shrink-0" />
              A leitura da imagem não gera sinal sozinha: sinais só saem do motor M5 com dados de mercado conectados.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-3 py-2">
      <dt className="text-[11px] text-faint">{k}</dt>
      <dd className={cx("mt-0.5 font-semibold", !v && "text-faint")}>{v ?? "não visível"}</dd>
    </div>
  );
}
