import { useSyncExternalStore } from 'react';
import { analyzeLead } from './analyze';
import { DEMO_BUSINESS, buildDemoLeads } from './demoData';
import { uid } from './format';
import type { Business, Lead, LeadStatus, Message, Sender, User } from './types';

export interface AppState {
  user: User | null;
  business: Business | null;
  leads: Lead[];
}

const STORAGE_KEY = 'recuperaai:v1';
const EMPTY: AppState = { user: null, business: null, leads: [] };

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as AppState) };
  } catch {
    /* armazenamento indisponível: segue em memória */
  }
  return EMPTY;
}

let state: AppState = load();
const listeners = new Set<() => void>();

function set(updater: (s: AppState) => AppState) {
  state = updater(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppState() {
  return useSyncExternalStore(subscribe, () => state);
}

export const getState = () => state;

function updateLead(id: string, fn: (lead: Lead) => Lead) {
  set((s) => ({ ...s, leads: s.leads.map((l) => (l.id === id ? fn(l) : l)) }));
}

function message(from: Sender, text: string, extra: Partial<Message> = {}): Message {
  return { id: uid(), from, text, at: new Date().toISOString(), ...extra };
}

export const actions = {
  signup(user: User) {
    set(() => ({ user, business: null, leads: [] }));
  },
  /** Entra direto na conta de demonstração com empresa e leads de exemplo. */
  startDemo() {
    set(() => ({
      user: { name: 'Você', email: 'demo@recupera.ai' },
      business: structuredClone(DEMO_BUSINESS),
      leads: buildDemoLeads(),
    }));
  },
  logout() {
    set(() => EMPTY);
  },
  saveBusiness(business: Business, withDemoLeads = false) {
    set((s) => ({ ...s, business, leads: withDemoLeads && s.leads.length === 0 ? buildDemoLeads() : s.leads }));
  },
  loadDemoLeads() {
    set((s) => ({ ...s, leads: buildDemoLeads() }));
  },
  clearLeads() {
    set((s) => ({ ...s, leads: [] }));
  },
  addLead(input: { name: string; phone: string; productName: string; value: number; firstMessage?: string }) {
    const now = new Date().toISOString();
    const lead: Lead = {
      id: uid(),
      name: input.name,
      phone: input.phone,
      productName: input.productName,
      value: input.value,
      status: 'novo',
      followupsSent: 0,
      createdAt: now,
      messages: input.firstMessage ? [message('cliente', input.firstMessage)] : [],
    };
    set((s) => ({ ...s, leads: [lead, ...s.leads] }));
    return lead.id;
  },
  addMessage(leadId: string, from: Sender, text: string) {
    updateLead(leadId, (l) => ({
      ...l,
      status: from === 'empresa' && l.status === 'novo' ? 'interessado' : l.status,
      messages: [...l.messages, message(from, text)],
    }));
  },
  /** Registra o follow-up como enviado (manualmente pelo WhatsApp ou na simulação). */
  sendFollowup(leadId: string, text: string) {
    const at = new Date().toISOString();
    updateLead(leadId, (l) => ({
      ...l,
      status: l.status === 'recuperado' || l.status === 'perdido' ? l.status : 'followup',
      followupsSent: l.followupsSent + 1,
      lastFollowupAt: at,
      messages: [...l.messages, { ...message('empresa', text, { isFollowup: true }), at }],
    }));
  },
  /** Envia uma resposta sugerida (não conta como follow-up). */
  sendReply(leadId: string, text: string) {
    updateLead(leadId, (l) => ({
      ...l,
      status: l.status === 'novo' ? 'interessado' : l.status,
      messages: [...l.messages, message('empresa', text)],
    }));
  },
  simulateCustomerReply(leadId: string) {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead || !state.business) return;
    const analysis = analyzeLead({ ...lead, messages: lead.messages.filter((m) => !m.isFollowup) }, state.business);
    const replies: Record<string, string> = {
      decisao_compartilhada: 'Oi! Conversei sim, a gente gostou bastante 😊 Como faço pra fechar?',
      vai_pensar: 'Oi! Pensei sim e gostei. Como faço pra fechar?',
      preco: 'Oi! Pensando melhor, acho que vale a pena. Como faço pra fechar?',
      adiou: 'Oi! Agora consigo ver isso sim. Como faço pra fechar?',
    };
    const text = replies[analysis.objection] ?? 'Oi! Desculpa a demora, ainda tenho interesse sim. Como faço pra fechar?';
    updateLead(leadId, (l) => ({ ...l, messages: [...l.messages, message('cliente', text)] }));
  },
  setStatus(leadId: string, status: LeadStatus) {
    updateLead(leadId, (l) => ({
      ...l,
      status,
      recoveredAt: status === 'recuperado' ? new Date().toISOString() : undefined,
    }));
  },
  deleteLead(leadId: string) {
    set((s) => ({ ...s, leads: s.leads.filter((l) => l.id !== leadId) }));
  },
};

// ---- Toasts (não persistidos) ------------------------------------------------

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone?: 'success' | 'info';
}
let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();

export function toast(t: Omit<Toast, 'id'>) {
  const item = { ...t, id: uid() };
  toasts = [...toasts, item];
  toastListeners.forEach((l) => l());
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== item.id);
    toastListeners.forEach((l) => l());
  }, 4200);
}

export function useToasts() {
  return useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toasts,
  );
}
