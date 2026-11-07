import { useEffect, useRef } from "react";

/** Gráfico ao vivo do TradingView (widget oficial gratuito). interval em minutos: "1", "5", "15", "60", "240". */
export function LiveChart({ symbol, interval = "5" }: { symbol: string; interval?: string }) {
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
      interval,
      timezone: "America/Sao_Paulo",
      theme: "dark",
      style: "1",
      locale: "br",
      backgroundColor: "#000000",
      isTransparent: false,
      gridColor: "rgba(255, 255, 255, 0.04)",
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
  }, [symbol, interval]);

  return <div ref={box} className="tradingview-widget-container h-full w-full" />;
}
