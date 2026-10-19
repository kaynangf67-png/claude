import { useState } from 'react';
import { ExternalLink, Info, Plus } from 'lucide-react';
import { useCatalog } from '@/state/hooks';
import { ManualProductModal } from '@/components/manual';
import { CategoryBreakdown, MonitoredSection } from '@/components/marketplace';
import { Button, Card, Notice, PageHeader } from '@/components/ui';

export default function TikTok() {
  const catalog = useCatalog();
  const [open, setOpen] = useState(false);
  const items = (catalog.data ?? []).filter((p) => p.marketplace === 'tiktok');
  return (
    <div>
      <PageHeader
        eyebrow="Acompanhamento manual"
        title="TikTok Shop"
        description="Acompanhe produtos em tendência que você observou em fontes autorizadas, com a origem e a data registradas."
        actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Registrar produto observado</Button>}
      />
      <Notice tone="amber" icon={<Info className="h-4 w-4 text-warn" />} className="mb-4">
        <p className="font-medium text-ink">Não existe API oficial de dados de mercado do TikTok Shop.</p>
        <p className="mt-1">
          A TikTok Shop Partner API só dá acesso aos dados da sua própria loja (pedidos, produtos, estoque). Produtos em tendência de outros vendedores não estão disponíveis por API autorizada,
          e coletar o site automaticamente violaria os termos. Por isso, registre aqui o que observar (por exemplo, no TikTok Creative Center) e vincule um termo do Google Trends para medir o interesse.
        </p>
        <p className="mt-1">Visualizações e curtidas indicam popularidade, <strong>não vendas</strong>.</p>
      </Notice>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold">Fluxo recomendado</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-ink-2">
            <li>Abra o TikTok Creative Center e veja os produtos e vídeos em alta no Brasil.</li>
            <li>Registre aqui o produto, a fonte e os números que você viu.</li>
            <li>Informe o termo de pesquisa e confira a curva no Radar Google Trends.</li>
            <li>Informe o custo no DropSeller e simule o lucro.</li>
          </ol>
          <a href="https://ads.tiktok.com/business/creativecenter" target="_blank" rel="noopener noreferrer" className="mt-4 inline-block">
            <Button size="sm"><ExternalLink className="h-3.5 w-3.5" /> Abrir TikTok Creative Center</Button>
          </a>
        </Card>
        <div className="lg:col-span-2"><CategoryBreakdown items={items} /></div>
      </div>
      <MonitoredSection marketplace="tiktok" />
      {open && <ManualProductModal open={open} onClose={() => setOpen(false)} defaultMarketplace="tiktok" />}
    </div>
  );
}
