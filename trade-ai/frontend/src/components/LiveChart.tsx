import { useEffect, useRef } from "react";

/** Gráfico ao vivo do TradingView (widget oficial gratuito), fixo em 5 minutos. */
export function LiveChart({ symbol }: { symbol: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.innerHTML = '<div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>';
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "5",
      timezone: "America/Sao_Paulo",
      theme: "dark",
      style: "1",
      locale: "br",
      backgroundColor: "#0a0f0c",
      isTransparent: false,
      gridColor: "rgba(28, 39, 33, 0.6)",
      allow_symbol_change: false,
      hide_top_toolbar: true,
      hide_legend: true,
      hide_side_toolbar: true,
      hide_volume: true,
      withdateranges: false,
      save_image: false,
      details: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    el.appendChild(script);
    return () => {
      el.innerHTML = "";
    };
  }, [symbol]);

  return <div ref={box} className="tradingview-widget-container h-full w-full" />;
}
