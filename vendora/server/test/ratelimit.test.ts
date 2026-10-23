import { afterAll, beforeAll, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../src/context';
import { makeApp } from './helpers';

let app: FastifyInstance;
let ctx: AppContext;
beforeAll(async () => {
  ({ app, ctx } = await makeApp());
});
afterAll(async () => {
  await app.close();
  await ctx.db.$disconnect();
});

it('limita tentativas de login por IP', async () => {
  const codes: number[] = [];
  for (let i = 0; i < 11; i++) {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'x@vendora.test', password: 'errada' } });
    codes.push(res.statusCode);
  }
  expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
  expect(codes[10]).toBe(429);
});
