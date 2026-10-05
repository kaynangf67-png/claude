// Dados do responsável pelo RecuperaAI, exibidos nos Termos e na Política de Privacidade.
// Preencha antes de divulgar o site: páginas legais sem contato não protegem ninguém.
export const LEGAL = {
  /** Nome completo ou razão social. */
  operator: 'Kaynan Gomes Fernandes de Souza',
  /** CPF ou CNPJ (opcional, mas recomendado para quem cobra assinatura). */
  document: '',
  /** E-mail para cancelamento, reembolso e pedidos sobre dados pessoais. */
  email: 'vitrinewebcompany@gmail.com',
  updatedAt: '5 de outubro de 2026',
};

export const legalIsComplete = () => Boolean(LEGAL.operator.trim() && LEGAL.email.trim());
