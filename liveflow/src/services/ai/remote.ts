import { getSupabase } from '@/lib/supabase';
import type { AIProvider, ChatMessage, CopilotContext, Script, ScriptInput } from './types';

/**
 * Chama a Edge Function `ai-generate`. A chave da API do modelo fica SOMENTE
 * nos secrets do Supabase — o browser envia apenas o JWT do usuário.
 */
async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke('ai-generate', { body });
  if (error) throw new Error('Falha ao gerar com IA. Tente novamente em instantes.');
  return data as T;
}

export class RemoteAIProvider implements AIProvider {
  readonly id = 'remote' as const;

  async generateScript(input: ScriptInput, variant = 0) {
    const { scripts } = await invoke<{ scripts: Script[] }>({ action: 'script', input, count: 1, variant });
    return scripts[0];
  }

  async generateVariations(input: ScriptInput, count: number) {
    const { scripts } = await invoke<{ scripts: Script[] }>({ action: 'script', input, count });
    return scripts;
  }

  async chat(messages: ChatMessage[], context: CopilotContext) {
    const { reply } = await invoke<{ reply: string }>({ action: 'chat', messages, context });
    return reply;
  }
}
