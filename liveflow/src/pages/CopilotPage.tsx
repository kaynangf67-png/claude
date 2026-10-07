import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bot, Loader2, SendHorizonal, Trash2, User } from 'lucide-react';
import { PageHeader } from '@/components/app/page';
import { Markdown } from '@/components/app/markdown';
import { LogoMark } from '@/components/app/brand';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { useServices } from '@/contexts/services';
import { errorMessage, usePlan } from '@/hooks/queries';
import type { ChatMessage } from '@/services/ai/types';
import { sanitizeText } from '@/lib/validation';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'Qual produto devo divulgar hoje?',
  'Crie um roteiro para esse produto.',
  'Crie 10 ganchos.',
  'Como melhorar esse vídeo?',
  'Qual produto está performando melhor?',
  'Monte meu plano de publicações da semana.',
];

const STORAGE_KEY = 'liveflow:copilot';

export default function CopilotPage() {
  const services = useServices();
  const plan = usePlan();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`${STORAGE_KEY}:${services.ctx.userId}`) ?? '[]');
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(`${STORAGE_KEY}:${services.ctx.userId}`, JSON.stringify(messages.slice(-30)));
    } catch {
      /* ignora: histórico é só conveniência */
    }
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, services.ctx.userId]);

  async function send(text: string, e?: FormEvent) {
    e?.preventDefault();
    const content = sanitizeText(text).slice(0, 2000);
    if (!content || loading) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const reply = await services.ai.chat(next, plan);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages([...next, { role: 'assistant', content: `⚠️ ${errorMessage(err)}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-in flex h-[calc(100dvh-11rem)] flex-col lg:h-[calc(100dvh-8.5rem)]">
      <PageHeader
        title="Copiloto IA"
        description="Pergunte sobre seus produtos, vídeos e lives. As respostas usam os seus dados."
        className="mb-4"
        actions={
          <>
            <Badge tone={services.ai.providerId === 'remote' ? 'primary' : 'neutral'}>{services.ai.providerId === 'remote' ? 'IA generativa' : 'Modo local'}</Badge>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setMessages([])}><Trash2 /> Limpar</Button>
            )}
          </>
        }
      />
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center text-center">
              <LogoMark className="size-12 rounded-2xl" />
              <p className="mt-4 text-lg font-semibold">Como posso ajudar hoje?</p>
              <p className="mt-1 text-sm text-muted-foreground">Analiso seus números dos últimos 30 dias para recomendar ações.</p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-xl border bg-card px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-muted">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto grid max-w-3xl gap-5">
              {messages.map((m, i) => (
                <div key={i} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', m.role === 'user' ? 'bg-muted' : 'brand-gradient text-white')}>
                    {m.role === 'user' ? <User className="size-4" /> : <Bot className="size-4" />}
                  </span>
                  <div className={cn('max-w-[85%] rounded-2xl px-4 py-3', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/60')}>
                    {m.role === 'user' ? <p className="text-sm whitespace-pre-wrap">{m.content}</p> : <Markdown text={m.content} />}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="grid size-8 place-items-center rounded-full brand-gradient text-white"><Bot className="size-4" /></span>
                  <Loader2 className="size-4 animate-spin" /> Analisando seus dados…
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>
        <form onSubmit={(e) => send(input, e)} className="border-t bg-card p-3">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Pergunte algo… (Enter envia, Shift+Enter quebra linha)"
              className="max-h-40 min-h-10 resize-none py-2.5"
              rows={1}
              aria-label="Mensagem"
            />
            <Button type="submit" size="icon" className="size-10 shrink-0" disabled={!input.trim() || loading} aria-label="Enviar">
              <SendHorizonal />
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
