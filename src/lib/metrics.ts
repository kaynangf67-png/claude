import { analyzeLead, isRecoverable } from './analyze';
import type { Analysis, Business, Lead } from './types';

export interface LeadWithAnalysis {
  lead: Lead;
  analysis: Analysis;
}

export function withAnalysis(leads: Lead[], business: Business): LeadWithAnalysis[] {
  const now = Date.now();
  return leads.map((lead) => ({ lead, analysis: analyzeLead(lead, business, now) }));
}

export function computeMetrics(items: LeadWithAnalysis[]) {
  const recovered = items.filter((i) => i.lead.status === 'recuperado');
  const open = items.filter((i) => isRecoverable(i.lead, i.analysis));
  return {
    leadsIdentified: items.length,
    followupsSentLeads: items.filter((i) => i.lead.followupsSent > 0).length,
    recoveredCount: recovered.length,
    recoveredRevenue: recovered.reduce((sum, i) => sum + i.lead.value, 0),
    openCount: open.length,
    openValue: open.reduce((sum, i) => sum + i.lead.value, 0),
    pendingFollowups: open.filter((i) => i.analysis.canFollowUp || i.analysis.urgency === 'agora').length,
    open,
  };
}
