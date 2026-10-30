import { useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Target } from "lucide-react";
import { useExecute } from "../lib/hooks";
import { useLive } from "../lib/live";
import { OpportunityCard } from "../components/OpportunityCard";
import { Card, Empty, Segmented } from "../components/ui";

type Filter = "ativo" | "todos" | "encerrados";

export function Opportunities() {
  const { signals, status } = useLive();
  const execute = useExecute();
  const [filter, setFilter] = useState<Filter>("ativo");
  const list = signals.filter((s) =>
    filter === "todos" ? true : filter === "ativo" ? s.status === "ativo" : s.status !== "ativo");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={filter} onChange={setFilter} options={[
          { value: "ativo", label: `Ativas (${signals.filter((s) => s.status === "ativo").length})` },
          { value: "encerrados", label: "Encerradas" },
          { value: "todos", label: "Todas" },
        ]} />
        <Link to="/captura" className="inline-flex items-center gap-2 rounded-xl border border-line-2 px-3.5 py-2 text-[13px] font-semibold hover:bg-card-2">
          <Camera size={15} className="text-info" /> Analisar captura do TradingView
        </Link>
      </div>
      {list.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((s) => <OpportunityCard key={s.id} s={s} onExecute={execute} />)}
        </div>
      ) : (
        <Card>
          <Empty icon={<Target size={20} />} title="Mercado sem confirmação. Aguardando uma oportunidade."
            text={status?.running
              ? "Nenhum ativo atendeu todos os critérios no último fechamento M5. Sinais só aparecem confirmados e dentro da região de entrada."
              : "O scanner está parado. Inicie-o no botão do topo."} />
        </Card>
      )}
    </div>
  );
}
