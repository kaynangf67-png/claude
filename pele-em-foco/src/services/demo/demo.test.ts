import { describe, expect, it } from 'vitest';
import { DemoBackend } from './index';
import { DEMO_KEY, DemoStore } from './store';

function memory() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), map };
}

const input = (date: string) => ({ entryDate: date, notes: 'ok', skinFeel: null, observations: [], productsUsed: '' });

describe('modo demonstração reproduz as regras do banco', () => {
  it('não guarda senha em texto e recusa senha errada', async () => {
    const kv = memory();
    const demo = new DemoBackend(new DemoStore(kv));
    await demo.signUp({ email: 'Ana@Exemplo.com', password: 'pele2026foco', displayName: 'Ana', acceptedDisclaimer: true });
    expect(kv.map.get(DEMO_KEY)).not.toContain('pele2026foco');
    await demo.signOut();
    await expect(demo.signIn('ana@exemplo.com', 'errada123')).rejects.toThrow('E-mail ou senha incorretos.');
    await expect(demo.signIn('ninguem@exemplo.com', 'pele2026foco')).rejects.toThrow('E-mail ou senha incorretos.');
    expect((await demo.signIn('ANA@exemplo.com', 'pele2026foco')).email).toBe('ana@exemplo.com');
    await expect(demo.signUp({ email: 'ana@exemplo.com', password: 'x1234567', displayName: '', acceptedDisclaimer: true })).rejects.toThrow(/Já existe/);
  });

  it('sem acesso ativo não grava; com acesso grava sem duplicar; expirado só lê e apaga', async () => {
    const demo = new DemoBackend(new DemoStore(memory()));
    await demo.signUp({ email: 'b@exemplo.com', password: 'pele2026foco', displayName: '', acceptedDisclaimer: true });
    expect((await demo.getAccess()).status).toBe('none');
    await expect(demo.setCompletion('2026-10-20', 'manha', 'limpeza', true)).rejects.toThrow(/não está ativo/);
    expect(await demo.listArticles()).toEqual([]);

    await demo.grantDemoAccess();
    const a = await demo.getAccess();
    expect(a.status).toBe('active');
    expect(Date.parse(a.expiresAt!) - Date.parse(a.startsAt!)).toBe(30 * 86_400_000);
    await demo.setCompletion('2026-10-20', 'manha', 'limpeza', true);
    await demo.setCompletion('2026-10-20', 'manha', 'limpeza', true);
    expect(await demo.listCompletions('2026-10-20', '2026-10-20')).toHaveLength(1);
    await demo.setCompletion('2026-10-20', 'manha', 'limpeza', false);
    expect(await demo.listCompletions('2026-10-20', '2026-10-20')).toHaveLength(0);

    const e = await demo.saveJournal(input('2026-10-20'));
    await expect(demo.saveJournal(input('2026-10-20'))).rejects.toThrow(/Já existe/);
    await demo.saveJournal({ ...input('2026-10-20'), notes: 'editado' }, e.id);
    expect((await demo.listJournal())[0].notes).toBe('editado');
    expect((await demo.listArticles()).length).toBeGreaterThan(0);

    await demo.expireDemoAccess();
    expect((await demo.getAccess()).status).toBe('expired');
    await expect(demo.saveJournal(input('2026-10-19'))).rejects.toThrow(/não está ativo/);
    expect(await demo.listJournal()).toHaveLength(1);
    await demo.deleteJournal(e.id);
    expect(await demo.listJournal()).toHaveLength(0);
  });

  it('isola os dados entre contas e exclui a conta por completo', async () => {
    const kv = memory();
    const demo = new DemoBackend(new DemoStore(kv));
    await demo.signUp({ email: 'c@exemplo.com', password: 'pele2026foco', displayName: '', acceptedDisclaimer: true });
    await demo.grantDemoAccess();
    await demo.saveJournal(input('2026-10-20'));
    await demo.signOut();
    await demo.signUp({ email: 'd@exemplo.com', password: 'pele2026foco', displayName: '', acceptedDisclaimer: true });
    expect(await demo.listJournal()).toEqual([]);
    expect((await demo.getAccess()).status).toBe('none');
    await demo.deleteAccount();
    expect(await demo.getUser()).toBeNull();
    expect(kv.map.get(DEMO_KEY)).not.toContain('d@exemplo.com');
    expect(kv.map.get(DEMO_KEY)).toContain('c@exemplo.com');
  });
});
