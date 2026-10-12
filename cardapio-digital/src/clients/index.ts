/**
 * Registro de clientes. Cada restaurante tem um arquivo nesta pasta.
 * O build escolhe pela variável CLIENT (padrão: demo):
 *   CLIENT=barretos npm run dev
 */
import type { MenuConfig } from '../types/menu.ts';
import { menu as demo } from './demo.ts';
import { menu as barretos } from './barretos.ts';

export const clients: Record<string, MenuConfig> = { demo, barretos };
