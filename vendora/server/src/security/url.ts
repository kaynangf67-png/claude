import ipaddr from 'ipaddr.js';
import { AppError } from '../lib/errors';

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.intranet', '.lan', '.home', '.corp', '.arpa'];
const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal', 'metadata', 'instance-data']);
const ALLOWED_PORTS = new Set(['', '80', '443']);

/**
 * Só endereços unicast públicos. Bloqueia privados (10/8, 172.16/12, 192.168/16),
 * loopback, link-local (169.254/16 — inclui o metadata da AWS/GCP), CGNAT,
 * multicast, reservados, ULA IPv6 e IPv4 mapeado em IPv6.
 */
export function isPublicAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  const parsed = ipaddr.process(address); // converte ::ffff:10.0.0.1 em 10.0.0.1
  return parsed.range() === 'unicast';
}

/**
 * Valida a URL informada pelo usuário antes de qualquer acesso de rede.
 * A resolução de DNS é validada de novo no momento da conexão (safeFetch),
 * o que também cobre DNS rebinding.
 */
export function validatePublicUrl(input: string): URL {
  const raw = input.trim();
  if (raw.length > 2000) throw new AppError(400, 'invalid_url', 'O link é longo demais.');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError(400, 'invalid_url', 'Isso não parece um link válido. Copie o endereço completo, começando com https://.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new AppError(400, 'invalid_url', 'Use um link http:// ou https://.');
  if (url.username || url.password)
    throw new AppError(400, 'invalid_url', 'Links com usuário e senha embutidos não são aceitos.');
  if (!ALLOWED_PORTS.has(url.port))
    throw new AppError(400, 'blocked_url', 'Só aceitamos links nas portas padrão (80/443).');

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const bare = host.startsWith('[') ? host.slice(1, -1) : host;
  if (ipaddr.isValid(bare)) {
    if (!isPublicAddress(bare)) throw new AppError(400, 'blocked_url', 'Este endereço não é permitido.');
    throw new AppError(400, 'blocked_url', 'Informe o link da loja pelo nome do site, não por endereço IP.');
  }
  // Números puros ou hex ("2130706433", "0x7f000001") são interpretados como IP por alguns resolvedores.
  if (/^(0x[0-9a-f]+|\d+)$/i.test(bare) || /^[\d.]+$/.test(bare))
    throw new AppError(400, 'blocked_url', 'Este endereço não é permitido.');
  if (!bare.includes('.')) throw new AppError(400, 'blocked_url', 'Informe um domínio público (ex.: loja.com.br).');
  if (BLOCKED_HOSTS.has(bare) || BLOCKED_HOST_SUFFIXES.some((s) => bare.endsWith(s)))
    throw new AppError(400, 'blocked_url', 'Este endereço não é permitido.');

  url.hash = '';
  return url;
}
