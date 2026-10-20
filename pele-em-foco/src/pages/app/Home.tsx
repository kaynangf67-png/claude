import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, Moon, NotebookPen, ShoppingBag, Sun } from 'lucide-react';
import { ProgressBar } from '../../components/ui';
import { BonusNotice } from '../../components/BonusNotice';
import { ARTICLES } from '../../content/articles';
import { diffDays, formatShort, fromKey } from '../../lib/dates';
import { lastDays, streak } from '../../lib/habits';
import { progress } from '../../lib/routine';
import { useStore } from '../../lib/store';

function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export function Home() {
  const { data, today, day } = useStore();
  const entry = day(today);
  const morning = progress(data.routine, entry, 'manha');
  const evening = progress(data.routine, entry, 'noite');
  const week = lastDays(data, today, 7);
  const completeDays = week.filter((d) => d.complete).length;
  const currentStreak = streak(data, today);
  const featured = ARTICLES[Math.abs(diffDays('2026-01-01', today)) % ARTICLES.length];
  const name = data.preferences.name;

  return (
    <div className="stack-lg">
      <header className="page-title">
        <p className="eyebrow">{fromKey(today).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1>{greeting(new Date())}{name ? `, ${name}` : ''}.</h1>
        <p>Um passo de cada vez. Constância vale mais do que quantidade de produtos.</p>
      </header>

      <BonusNotice compact />

      <section aria-labelledby="hoje" className="grid grid-2">
        <h2 id="hoje" className="sr-only">Rotina de hoje</h2>
        {[
          { label: 'Manhã', icon: Sun, p: morning, tab: 'manha' },
          { label: 'Noite', icon: Moon, p: evening, tab: 'noite' },
        ].map(({ label, icon: Icon, p, tab }) => (
          <Link key={tab} to={`/app/rotina?periodo=${tab}`} className="card card-link stack">
            <div className="row between">
              <span className="row"><Icon size={20} aria-hidden="true" /><strong>{label}</strong></span>
              {p.complete ? <span className="tag"><Check size={12} aria-hidden="true" /> Feito</span> : <span className="small muted">{p.done} de {p.total}</span>}
            </div>
            <ProgressBar value={p.done} total={p.total} label={`Rotina da ${label.toLowerCase()}`} />
            <span className="small muted">{p.complete ? 'Tudo certo por aqui.' : p.done === 0 ? 'Ainda não começou.' : 'Falta pouco.'}</span>
          </Link>
        ))}
      </section>

      <section className="card stack" aria-labelledby="semana">
        <div className="row between wrap">
          <h2 id="semana" style={{ fontSize: 'var(--text-lg)' }}>Últimos 7 dias</h2>
          <span className="small muted">{completeDays} de 7 dias com rotina completa{currentStreak > 1 ? ` · ${currentStreak} seguidos` : ''}</span>
        </div>
        <div className="week">
          {week.map((d) => (
            <div key={d.date} className="week-day">
              <span
                className={`week-dot ${d.complete ? 'full' : d.routineDone > 0 ? 'partial' : ''} ${d.date === today ? 'today' : ''}`}
                aria-label={`${formatShort(d.date)}: ${d.routineDone} de ${d.routineTotal} passos`}
                role="img"
              >
                {d.complete && <Check size={14} strokeWidth={3} aria-hidden="true" />}
              </span>
              <span aria-hidden="true">{fromKey(d.date).toLocaleDateString('pt-BR', { weekday: 'narrow' })}</span>
            </div>
          ))}
        </div>
        <p className="xs muted" style={{ marginBottom: 0 }}>Registro de hábitos, não de resultado. Dias imperfeitos fazem parte.</p>
      </section>

      <section aria-labelledby="destaque" className="card-sage stack">
        <p className="eyebrow" id="destaque">Leitura do dia · {featured.minutes} min</p>
        <h2 style={{ fontSize: 'var(--text-lg)' }}>{featured.title}</h2>
        <p className="muted" style={{ marginBottom: 0 }}>{featured.summary}</p>
        <Link to={`/app/biblioteca/${featured.slug}`} className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
          Ler agora <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>

      <section aria-labelledby="atalhos">
        <h2 id="atalhos" style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>Atalhos</h2>
        <div className="grid grid-3">
          <Link to="/app/diario" className="card-flat card-link row"><NotebookPen aria-hidden="true" /><span><strong>Anotar o dia</strong><br /><span className="small muted">Como a pele está hoje?</span></span></Link>
          <Link to="/app/biblioteca" className="card-flat card-link row"><BookOpen aria-hidden="true" /><span><strong>Biblioteca</strong><br /><span className="small muted">Acne, rótulos, alimentação</span></span></Link>
          <Link to="/app/produtos" className="card-flat card-link row"><ShoppingBag aria-hidden="true" /><span><strong>Produtos</strong><br /><span className="small muted">O que observar em cada categoria</span></span></Link>
        </div>
      </section>

      <p className="xs muted center">Conteúdo educativo. Não substitui avaliação de dermatologista.</p>
    </div>
  );
}
