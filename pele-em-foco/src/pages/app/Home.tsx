import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, ClipboardList, Moon, NotebookPen, Sun } from 'lucide-react';
import { ProgressBar, Spinner } from '../../components/ui';
import { AccessLocked } from '../../components/AccessLocked';
import { useBackend, useSession } from '../../app/session';
import { useAsync } from '../../app/useAsync';
import { categoryLabel } from '../../content/articles';
import { addDays, diffDays, formatDateBR, formatFullDate, todayKey } from '../../lib/dates';
import { dayProgress, PERIOD_LABEL } from '../../lib/routine';
import type { Period } from '../../services/types';

function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export function Home() {
  const { data } = useBackend();
  const { profile, access } = useSession();
  const today = todayKey();
  const active = access?.status === 'active';

  const state = useAsync(async () => {
    if (!active) return null;
    const [completions, journal, articles] = await Promise.all([
      data.listCompletions(addDays(today, -6), today),
      data.listJournal(),
      data.listArticles(),
    ]);
    return { completions, journal, articles };
  }, [data, today, active]);

  const name = profile?.displayName;
  const daysLeft = access?.expiresAt ? Math.max(0, Math.ceil((Date.parse(access.expiresAt) - Date.now()) / 86_400_000)) : null;

  const header = (
    <header className="page-title">
      <p className="eyebrow">{formatFullDate(today)}</p>
      <h1>{greeting(new Date())}{name ? `, ${name}` : ''}.</h1>
      <p>Um passo de cada vez. Constância vale mais do que quantidade de produtos.</p>
    </header>
  );

  if (!access) return <>{header}<Spinner label="Verificando seu acesso…" /></>;
  if (!active) return <div className="stack-lg">{header}<AccessLocked /></div>;
  if (state.error) return <>{header}<p className="field-error" role="alert">{state.error} <button className="btn btn-ghost" onClick={() => void state.reload()}>Tentar de novo</button></p></>;

  if (!state.data) return <>{header}<Spinner /></>;
  const { completions, journal, articles } = state.data;
  const morning = dayProgress(completions, today, 'manha');
  const evening = dayProgress(completions, today, 'noite');
  const total = dayProgress(completions, today);
  const wroteToday = journal.some((j) => j.entryDate === today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const fullDays = week.filter((d) => dayProgress(completions, d).complete).length;
  const featured = articles.length ? articles[Math.abs(diffDays('2026-01-01', today)) % articles.length] : null;

  const nextPeriod: Period | null = new Date().getHours() < 15 ? (morning.complete ? (evening.complete ? null : 'noite') : 'manha') : evening.complete ? (morning.complete ? null : 'manha') : 'noite';
  const next = nextPeriod
    ? { to: `/app/rotina?periodo=${nextPeriod}`, label: `Continuar a rotina da ${PERIOD_LABEL[nextPeriod].toLowerCase()}`, detail: `${dayProgress(completions, today, nextPeriod).done} de 3 passos feitos` }
    : !wroteToday
      ? { to: '/app/diario', label: 'Anotar como foi o dia no diário', detail: 'Rotina de hoje completa' }
      : featured
        ? { to: `/app/aprender/${featured.slug}`, label: `Ler: ${featured.title}`, detail: 'Rotina e diário em dia' }
        : null;

  return (
    <div className="stack-lg">
      {header}

      {next && (
        <Link to={next.to} className="card-forest next-action">
          <span>
            <span className="eyebrow" style={{ color: 'var(--pf-sage)' }}>Próximo passo</span>
            <strong className="next-label">{next.label}</strong>
            <span className="small" style={{ color: 'var(--pf-sage-soft)' }}>{next.detail}</span>
          </span>
          <ArrowRight aria-hidden="true" />
        </Link>
      )}

      <section aria-labelledby="hoje" className="stack">
        <div className="row between wrap">
          <h2 id="hoje" className="h3">Hoje</h2>
          <span className="small muted">{total.done} de {total.total} passos</span>
        </div>
        <div className="grid grid-2">
          {([['manha', Sun, morning], ['noite', Moon, evening]] as const).map(([period, Icon, p]) => (
            <Link key={period} to={`/app/rotina?periodo=${period}`} className="card card-link stack">
              <div className="row between">
                <span className="row"><Icon size={20} aria-hidden="true" /><strong>{PERIOD_LABEL[period]}</strong></span>
                {p.complete ? <span className="tag"><Check size={12} aria-hidden="true" /> Feito</span> : <span className="small muted">{p.done} de {p.total}</span>}
              </div>
              <ProgressBar value={p.done} total={p.total} label={`Rotina da ${PERIOD_LABEL[period].toLowerCase()}`} />
            </Link>
          ))}
        </div>
      </section>

      <section className="card stack" aria-labelledby="semana">
        <div className="row between wrap">
          <h2 id="semana" className="h3">Últimos 7 dias</h2>
          <span className="small muted">{fullDays} {fullDays === 1 ? 'dia' : 'dias'} com a rotina completa</span>
        </div>
        <div className="week">
          {week.map((d) => {
            const p = dayProgress(completions, d);
            return (
              <div key={d} className="week-day">
                <span className={`week-dot ${p.complete ? 'full' : p.done ? 'partial' : ''} ${d === today ? 'today' : ''}`} role="img" aria-label={`${formatDateBR(d + 'T12:00:00')}: ${p.done} de ${p.total} passos`}>
                  {p.complete && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                </span>
                <span aria-hidden="true">{new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'narrow' })}</span>
              </div>
            );
          })}
        </div>
        <p className="xs muted" style={{ marginBottom: 0 }}>Registro de hábitos, não de resultado. Dias imperfeitos fazem parte.</p>
      </section>

      {featured && (
        <section className="card-sage stack" aria-labelledby="destaque">
          <p className="eyebrow" id="destaque">Para ler hoje · {categoryLabel(featured.category)} · {featured.minutes} min</p>
          <h2 className="h3">{featured.title}</h2>
          <p className="muted" style={{ marginBottom: 0 }}>{featured.summary}</p>
          <Link to={`/app/aprender/${featured.slug}`} className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>Ler agora <ArrowRight size={16} aria-hidden="true" /></Link>
        </section>
      )}

      <section aria-labelledby="atalhos">
        <h2 id="atalhos" className="h3" style={{ marginBottom: 'var(--space-3)' }}>Atalhos</h2>
        <div className="grid grid-2">
          <Link to="/app/aprender/questionario" className="card-flat card-link shortcut"><ClipboardList aria-hidden="true" /><span><strong>Questionário de rotina</strong><span className="small muted">Que tipo de produto procurar</span></span></Link>
          <Link to="/app/diario" className="card-flat card-link shortcut"><NotebookPen aria-hidden="true" /><span><strong>Diário da pele</strong><span className="small muted">{wroteToday ? 'Você já anotou hoje' : 'Ainda sem anotação hoje'}</span></span></Link>
          <Link to="/app/aprender" className="card-flat card-link shortcut"><BookOpen aria-hidden="true" /><span><strong>Aprender</strong><span className="small muted">{articles.length} artigos com fontes</span></span></Link>
          <Link to="/app/perfil" className="card-flat card-link shortcut"><Check aria-hidden="true" /><span><strong>Seu acesso</strong><span className="small muted">{daysLeft !== null ? `${daysLeft} ${daysLeft === 1 ? 'dia restante' : 'dias restantes'}` : '—'}</span></span></Link>
        </div>
      </section>

      <p className="xs muted center">Conteúdo educativo. Não faz diagnóstico nem substitui avaliação de dermatologista.</p>
    </div>
  );
}
