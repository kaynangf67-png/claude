import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, LogOut, Menu, Moon, Plus, Sun, User } from 'lucide-react';
import { Logo } from '@/components/app/brand';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/misc';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/auth';
import { useServices } from '@/contexts/services';
import { qk, useFileUrl, useNotifications, useProfile } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { backendMode } from '@/services/backend';
import { MOBILE_PRIMARY, NAV_GROUPS } from './nav';

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function isActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">{group.label}</p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                    active && 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <item.icon className={cn('size-[18px]', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} strokeWidth={1.9} />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function NotificationsMenu() {
  const { data = [] } = useNotifications();
  const services = useServices();
  const queryClient = useQueryClient();
  const unread = data.filter((n) => !n.read_at).length;
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open && unread) services.account.markAllRead().then(() => queryClient.invalidateQueries({ queryKey: qk.notifications }));
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-background" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80">
        <DropdownMenuLabel>Notificações</DropdownMenuLabel>
        {data.length === 0 && <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">Nada por aqui ainda.</p>}
        <div className="max-h-80 overflow-y-auto">
          {data.slice(0, 8).map((n) => (
            <div key={n.id} className="flex gap-2.5 rounded-md px-2.5 py-2">
              <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-primary')} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/80">{formatRelative(n.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user, auth } = useAuth();
  const { data: profile } = useProfile();
  const { data: avatar } = useFileUrl('avatars', profile?.avatar_url);
  const name = profile?.full_name || user?.fullName || user?.email || '';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Conta">
        <Avatar src={avatar} name={name} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="truncate text-xs">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/configuracoes">
            <User /> Perfil e configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => auth.signOut()}>
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppLayout() {
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const services = useServices();
  const queryClient = useQueryClient();

  // Manutenção ao abrir o app: estende automações e sincroniza status das lives.
  useEffect(() => {
    let cancelled = false;
    services.lives
      .sync()
      .then((r) => {
        if (!cancelled && (r.generated || r.updated)) {
          for (const key of [qk.lives, qk.automations, qk.schedules, qk.videos]) queryClient.invalidateQueries({ queryKey: key });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [services, queryClient]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  const current = ALL_ITEMS.find((i) => isActive(pathname, i.to));

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link to="/">
            <Logo />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <SidebarNav />
        </div>
        <div className="m-3 rounded-xl border bg-card p-3.5">
          <p className="text-[13px] font-medium">Venda sem aparecer: vídeos curtos com o produto no carrinho.</p>
          <Button asChild variant="brand" size="sm" className="mt-3 w-full">
            <Link to="/publicacoes?nova=1">
              <Plus /> Nova publicação
            </Link>
          </Button>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:h-16">
        <Link to="/" className="lg:hidden">
          <Logo />
        </Link>
        <span className="hidden text-sm font-medium text-muted-foreground lg:block">{current?.label}</span>
        <div className="ml-auto flex items-center gap-1">
          {backendMode === 'demo' && (
            <Badge tone="warning" className="mr-1 hidden sm:inline-flex" title="Dados salvos apenas neste navegador">
              Modo demonstração
            </Badge>
          )}
          <Button asChild size="sm" variant="brand" className="mr-1 hidden sm:inline-flex lg:hidden">
            <Link to="/publicacoes?nova=1">
              <Plus /> Nova publicação
            </Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Alternar tema">
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <NotificationsMenu />
          <div className="ml-1">
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-4 pt-5 pb-28 sm:px-6 sm:pt-7 lg:px-8 lg:pb-12">
        <Outlet />
      </main>

      {/* Bottom nav mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/92 backdrop-blur-md pb-safe lg:hidden" aria-label="Navegação principal">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {MOBILE_PRIMARY.map((to) => {
            const item = ALL_ITEMS.find((i) => i.to === to)!;
            const active = isActive(pathname, to);
            return (
              <NavLink key={to} to={to} className={cn('flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium', active ? 'text-primary' : 'text-muted-foreground')}>
                <item.icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                {item.label}
              </NavLink>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium',
              !MOBILE_PRIMARY.some((to) => isActive(pathname, to)) ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Menu className="size-5" strokeWidth={1.8} />
            Mais
          </button>
        </div>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent title="Menu" side="sheet">
          <SidebarNav onNavigate={() => setMoreOpen(false)} />
          <Button asChild variant="brand" className="mt-5 w-full" onClick={() => setMoreOpen(false)}>
            <Link to="/publicacoes?nova=1">
              <Plus /> Nova publicação
            </Link>
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
