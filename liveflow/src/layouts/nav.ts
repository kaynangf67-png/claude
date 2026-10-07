import {
  BarChart3,
  Bot,
  CalendarDays,
  Clapperboard,
  LayoutDashboard,
  Package,
  Radio,
  Send,
  Settings,
  Sparkles,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Operação',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/publicacoes', label: 'Publicações', icon: Send },
      { to: '/produtos', label: 'Produtos', icon: Package },
      { to: '/videos', label: 'Vídeos', icon: Clapperboard },
      { to: '/lives', label: 'Lives', icon: Radio },
      { to: '/agenda', label: 'Agenda', icon: CalendarDays },
      { to: '/automacoes', label: 'Automações', icon: Workflow },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Inteligência',
    items: [
      { to: '/ia/roteiros', label: 'Roteiros IA', icon: Sparkles },
      { to: '/ia/copiloto', label: 'Copiloto IA', icon: Bot },
    ],
  },
  { label: 'Conta', items: [{ to: '/configuracoes', label: 'Configurações', icon: Settings }] },
];

/** Itens fixos da barra inferior no mobile (o resto vai em "Mais"). */
export const MOBILE_PRIMARY = ['/', '/publicacoes', '/videos', '/produtos'];
