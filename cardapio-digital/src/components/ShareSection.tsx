import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Share2 } from 'lucide-react';

interface Props {
  url: string;
  restaurantName: string;
  onShare: () => void;
  onCopy: () => void;
}

/** QR Code da URL pública + compartilhar, copiar e baixar o QR para impressão. */
export function ShareSection({ url, restaurantName, onShare, onCopy }: Props) {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff' } })
      .then(setSvg)
      .catch(() => setSvg(''));
  }, [url]);

  const download = async () => {
    const dataUrl = await QRCode.toDataURL(url, { width: 1200, margin: 2, errorCorrectionLevel: 'M' });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qrcode-cardapio-${restaurantName.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase()}.png`;
    a.click();
  };

  return (
    <section aria-labelledby="compartilhar-titulo" className="border-t border-line">
      <div className="container-menu grid items-center gap-8 py-12 sm:grid-cols-[auto_1fr] sm:py-16">
        <div className="mx-auto w-44 rounded-2xl bg-white p-3 shadow-card ring-1 ring-line sm:mx-0 sm:w-48">
          {svg ? (
            <div
              role="img"
              aria-label={`QR Code do cardápio: ${url}`}
              className="[&>svg]:block [&>svg]:size-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <div className="aspect-square animate-pulse rounded-lg bg-black/5" />
          )}
        </div>
        <div className="text-center sm:text-left">
          <h2 id="compartilhar-titulo" className="font-display text-2xl font-semibold sm:text-3xl">
            Compartilhe este cardápio
          </h2>
          <p className="mt-2 text-muted">Aponte a câmera do celular para o QR Code ou envie o link.</p>
          <p className="mt-2 text-sm font-medium break-all text-ink">{url}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
            <button
              type="button"
              onClick={onShare}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-brand-contrast transition hover:brightness-110"
            >
              <Share2 className="size-4" aria-hidden="true" />
              Compartilhar
            </button>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-surface px-5 text-sm font-semibold ring-1 ring-line transition hover:ring-brand"
            >
              <Copy className="size-4" aria-hidden="true" />
              Copiar link
            </button>
            <button
              type="button"
              onClick={download}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-surface px-5 text-sm font-semibold ring-1 ring-line transition hover:ring-brand"
            >
              <Download className="size-4" aria-hidden="true" />
              Baixar QR Code
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
