import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { servicesFor } from '@/services/backend';
import type { AppServices } from '@/services/domain';
import type { AuthUser } from '@/services/data/types';

const ServicesContext = createContext<AppServices | null>(null);

export function ServicesProvider({ user, children }: { user: AuthUser; children: ReactNode }) {
  const services = useMemo(() => servicesFor(user), [user]);
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): AppServices {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices fora do ServicesProvider');
  return ctx;
}
