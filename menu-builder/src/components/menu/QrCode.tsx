import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui';

/** QR Code gerado no navegador a partir da URL real. Download em SVG (impressão) e PNG. */
export function QrCode({ url, fileName }: { url: string; fileName: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(setSvg).catch(() => setSvg(''));
  }, [url]);

  function save(href: string, ext: string) {
    const a = document.createElement('a');
    a.href = href;
    a.download = `${fileName}.${ext}`;
    a.click();
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <div className="w-40 shrink-0 rounded-lg bg-white p-2 ring-1 ring-line" role="img" aria-label={`QR Code para ${url}`}>
        {svg ? <div className="[&>svg]:block [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="aspect-square animate-pulse rounded bg-canvas" />}
      </div>
      <div className="space-y-2">
        <p className="text-[13px] text-ink-soft">O QR Code aponta para:</p>
        <p className="text-sm font-medium break-all">{url}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" icon={<Download className="size-3.5" aria-hidden="true" />} disabled={!svg} onClick={() => save(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), 'svg')}>
            SVG (impressão)
          </Button>
          <Button size="sm" icon={<Download className="size-3.5" aria-hidden="true" />} onClick={async () => save(await QRCode.toDataURL(url, { width: 1200, margin: 2, errorCorrectionLevel: 'M' }), 'png')}>
            PNG
          </Button>
        </div>
      </div>
    </div>
  );
}
