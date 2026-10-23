import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { guardedLookup, safeFetch } from '../src/security/safeFetch';
import { isPublicAddress, validatePublicUrl } from '../src/security/url';

const opts = { accept: '*/*', maxBytes: 1024, timeoutMs: 2000, userAgent: 'test' };

describe('validatePublicUrl', () => {
  it.each([
    'https://www.loja.com.br/produto/123',
    'http://exemplo.com/p?id=1',
    'https://sub.dominio.com.br:443/x',
  ])('aceita %s', (url) => {
    expect(() => validatePublicUrl(url)).not.toThrow();
  });

  it.each([
    ['texto qualquer', 'invalid_url'],
    ['ftp://loja.com/arquivo', 'invalid_url'],
    ['file:///etc/passwd', 'invalid_url'],
    ['javascript:alert(1)', 'invalid_url'],
    ['https://user:senha@loja.com/', 'invalid_url'],
    ['http://localhost:3000/', 'blocked_url'],
    ['http://localhost/', 'blocked_url'],
    ['http://127.0.0.1/', 'blocked_url'],
    ['http://10.0.0.5/admin', 'blocked_url'],
    ['http://192.168.1.1/', 'blocked_url'],
    ['http://172.16.0.1/', 'blocked_url'],
    ['http://169.254.169.254/latest/meta-data/', 'blocked_url'],
    ['http://[::1]/', 'blocked_url'],
    ['http://[::ffff:127.0.0.1]/', 'blocked_url'],
    ['http://[fd00::1]/', 'blocked_url'],
    ['http://2130706433/', 'blocked_url'],
    ['http://0x7f000001/', 'blocked_url'],
    ['http://0/', 'blocked_url'],
    ['http://intranet/', 'blocked_url'],
    ['http://servico.internal/', 'blocked_url'],
    ['http://metadata.google.internal/', 'blocked_url'],
    ['http://impressora.local/', 'blocked_url'],
    ['http://loja.com:8080/', 'blocked_url'],
    ['http://8.8.8.8/', 'blocked_url'],
  ])('recusa %s', (url, code) => {
    expect(() => validatePublicUrl(url)).toThrow(expect.objectContaining({ code }));
  });

  it('remove o fragmento', () => {
    expect(validatePublicUrl('https://loja.com/p#reviews').toString()).toBe('https://loja.com/p');
  });
});

describe('isPublicAddress', () => {
  it('classifica endereços', () => {
    expect(isPublicAddress('8.8.8.8')).toBe(true);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
    for (const a of ['127.0.0.1', '10.1.2.3', '100.64.0.1', '169.254.1.1', '0.0.0.0', '224.0.0.1', '::1', 'fe80::1', '::ffff:192.168.0.1', 'nao-ip'])
      expect(isPublicAddress(a)).toBe(false);
  });
});

describe('guardedLookup (proteção no momento da conexão)', () => {
  it('bloqueia nomes que resolvem para endereço interno (cobre DNS rebinding)', async () => {
    const err = await new Promise<NodeJS.ErrnoException | null>((resolve) =>
      guardedLookup('localhost', {}, (e) => resolve(e)),
    );
    expect(err?.code).toBe('EBLOCKED');
  });
});

describe('safeFetch', () => {
  it('não acessa um servidor local mesmo que ele esteja no ar', async () => {
    let hits = 0;
    const server = createServer((_req, res) => {
      hits++;
      res.end('segredo interno');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    await expect(safeFetch(`http://127.0.0.1:${port}/`, opts)).rejects.toMatchObject({ code: 'blocked_url' });
    server.close();
    expect(hits).toBe(0);
  });
});
