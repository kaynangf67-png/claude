import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MenuUnavailable, MenuView } from '@/components/menu/MenuView';
import { Spinner } from '@/components/ui';
import { getRepository } from '@/data';
import type { PublicMenu } from '@/domain/types';

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

export default function PublicMenuPage() {
  const { slug = '' } = useParams();
  const repo = getRepository();
  const [menu, setMenu] = useState<PublicMenu | null | undefined>(undefined);

  useEffect(() => {
    repo.getPublicMenu(slug).then(setMenu).catch(() => setMenu(null));
  }, [repo, slug]);

  useEffect(() => {
    if (!menu) return;
    document.title = `Cardápio · ${menu.restaurantName}`;
    setMeta('description', menu.description || `Cardápio digital de ${menu.restaurantName}.`);
    setMeta('theme-color', menu.secondaryColor);
  }, [menu]);

  if (menu === undefined) return <Spinner label="Carregando cardápio…" />;
  if (menu === null) return <MenuUnavailable />;
  return (
    <MenuView
      menu={menu}
      banner={repo.mode === 'demo' ? <div className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">Modo demonstração · dados salvos apenas neste navegador</div> : undefined}
    />
  );
}
