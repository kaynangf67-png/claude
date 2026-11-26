// Modo História: 4 mundos x 5 fases (a 5ª de cada mundo é um chefe).
// As fases são montadas com um pequeno construtor e verificadas por um bot
// (tools/solver.js) que prova que todas são completáveis com a física real.
import { gridLevel } from './level.js';

class MapBuilder {
  constructor(w, h = 15) {
    this.w = w; this.h = h;
    this.rows = Array.from({ length: h }, () => new Array(w).fill('.'));
    this.ents = [];
  }
  set(x, y, c) { if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.rows[y][x] = c; return this; }
  fill(x0, y0, x1, y1, c = '#') {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c);
    return this;
  }
  // chão do x0 ao x1 com superfície na linha `top` (até o fundo)
  ground(x0, x1, top, c = '#', topC = null) {
    this.fill(x0, top, x1, this.h - 1, c);
    if (topC) this.fill(x0, top, x1, top, topC);
    return this;
  }
  row(x, y, str) { for (let i = 0; i < str.length; i++) if (str[i] !== ' ') this.set(x + i, y, str[i]); return this; }
  coins(x0, x1, y) { for (let x = x0; x <= x1; x++) this.set(x, y, 'o'); return this; }
  ent(e) { this.ents.push(e); return this; }
  def(meta) { return { ...meta, map: this.rows.map((r) => r.join('')), ents: this.ents }; }
}

export const WORLDS = [
  { id: 1, name: 'Prado Pixel', color: '#5ac85a' },
  { id: 2, name: 'Cavernas de Cristal', color: '#8a6cff' },
  { id: 3, name: 'Pico Gelado', color: '#6cd4ff' },
  { id: 4, name: 'Fortaleza de Magma', color: '#ff6a3d' },
];

const defs = [];

// ===================== MUNDO 1 — PRADO PIXEL ============================
{ // 1-1 Primeiros Passos
  const m = new MapBuilder(96);
  m.ground(0, 20, 12).set(2, 11, 'P').coins(8, 10, 10);
  m.ground(21, 34, 11).coins(27, 29, 9);
  m.ground(37, 50, 11).fill(42, 10, 43, 10).set(46, 10, 'C');
  m.ground(51, 60, 10).coins(55, 57, 8);
  m.ground(64, 80, 11).fill(68, 8, 72, 8, '-').coins(68, 72, 7);
  m.ground(81, 95, 12).set(92, 11, 'G');
  defs.push(m.def({ id: '1-1', world: 1, name: 'Primeiros Passos', par: 13 }));
}
{ // 1-2 Espinhos Afiados
  const m = new MapBuilder(102);
  m.ground(0, 15, 12).set(2, 11, 'P').set(10, 11, '^');
  m.ground(16, 30, 12).fill(20, 11, 21, 11, '^').coins(19, 22, 8);
  m.ground(35, 44, 11).set(37, 10, 'C');
  m.ground(45, 46, 9);
  m.ground(47, 60, 11).fill(50, 10, 52, 10, '^').coins(50, 52, 7);
  m.fill(61, 14, 80, 14, '^');
  m.fill(64, 10, 65, 10).fill(69, 9, 70, 9).fill(74, 10, 75, 10).coins(69, 70, 7);
  m.ground(81, 101, 12).fill(86, 7, 90, 7, 'v').set(84, 11, 'C').fill(93, 11, 93, 11, '^');
  m.set(98, 11, 'G');
  defs.push(m.def({ id: '1-2', world: 1, name: 'Espinhos Afiados', par: 14 }));
}
{ // 1-3 Molas e Nuvens
  const m = new MapBuilder(80);
  m.ground(0, 12, 12).set(2, 11, 'P').set(10, 11, 'S');
  m.fill(13, 6, 16, 14).coins(13, 16, 4);
  m.ground(17, 40, 12);
  m.fill(19, 7, 22, 7, '-').fill(25, 8, 28, 8, '-').coins(25, 28, 6);
  m.fill(30, 9, 33, 9, '-').fill(30, 6, 33, 6, '-').coins(30, 33, 4);
  m.set(36, 11, 'C').fill(38, 11, 39, 11, '^');
  m.ground(47, 54, 12).set(50, 11, 'S');
  m.fill(51, 6, 54, 6, '-');
  m.fill(55, 4, 57, 14).coins(55, 57, 2);
  m.ground(58, 79, 12).fill(62, 11, 63, 11, '^');
  m.set(74, 11, 'G');
  defs.push(m.def({ id: '1-3', world: 1, name: 'Molas e Nuvens', par: 11 }));
}
{ // 1-4 Plataformas Móveis
  const m = new MapBuilder(84);
  m.ground(0, 12, 12).set(2, 11, 'P');
  m.ent({ t: 'plat', x: 13, y: 11, x2: 21, y2: 11, w: 3, p: 150, o: 0 });
  m.coins(15, 19, 8);
  m.ground(25, 32, 12).set(28, 11, 'C');
  m.ent({ t: 'plat', x: 33, y: 10, x2: 41, y2: 10, w: 3, p: 130, o: 60 });
  m.ground(45, 50, 12);
  m.ent({ t: 'plat', x: 47, y: 11, x2: 47, y2: 7, w: 3, p: 110, o: 0 });
  m.fill(47, 12, 50, 14, '.');
  m.ground(51, 60, 7).coins(53, 58, 5);
  m.ground(61, 83, 12).fill(66, 11, 67, 11, '^').set(63, 11, 'C');
  m.fill(72, 11, 72, 11, '^');
  m.set(79, 11, 'G');
  defs.push(m.def({ id: '1-4', world: 1, name: 'Plataformas Móveis', par: 15 }));
}
{ // 1-5 CHEFE: Golem de Musgo
  const m = new MapBuilder(32);
  m.ground(0, 31, 12).fill(0, 0, 0, 14).fill(31, 0, 31, 14);
  m.set(3, 11, 'P');
  m.fill(5, 8, 9, 8, '-').fill(22, 8, 26, 8, '-');
  m.set(16, 11, 'G');
  m.ent({ t: 'boss', kind: 'golem', x: 22, y: 11 });
  defs.push(m.def({ id: '1-5', world: 1, name: 'Chefe: Golem de Musgo', par: 9, boss: true }));
}

// ===================== MUNDO 2 — CAVERNAS DE CRISTAL =====================
{ // 2-1 Ecos da Caverna (pulo na parede)
  const m = new MapBuilder(88, 20);
  m.fill(0, 0, 87, 0);
  m.ground(0, 11, 17).set(2, 16, 'P');
  m.fill(12, 3, 13, 14).fill(12, 17, 16, 19);
  m.fill(17, 5, 34, 19).coins(20, 22, 3).fill(26, 4, 27, 4, '^').set(31, 4, 'C');
  m.ground(35, 44, 12);
  m.fill(45, 0, 46, 9).fill(45, 12, 46, 19).fill(47, 17, 49, 19).coins(47, 49, 12);
  m.fill(50, 4, 51, 19).fill(50, 4, 70, 5).fill(58, 3, 59, 3, '^').coins(62, 65, 2);
  m.ground(71, 87, 12).set(74, 11, 'C').fill(78, 11, 78, 11, '^');
  m.set(84, 11, 'G');
  defs.push(m.def({ id: '2-1', world: 2, name: 'Ecos da Caverna', par: 14 }));
}
{ // 2-2 Chão Traiçoeiro (blocos que desmoronam)
  const m = new MapBuilder(88);
  m.ground(0, 10, 12).set(2, 11, 'P');
  m.fill(11, 12, 20, 12, 'X').fill(11, 14, 20, 14, '^').coins(13, 18, 10);
  m.ground(21, 28, 12).set(24, 11, 'C');
  m.fill(29, 14, 44, 14, '^');
  m.fill(31, 10, 32, 10, 'X').fill(35, 8, 36, 8, 'X').fill(39, 6, 40, 6, 'X');
  m.ground(43, 50, 6).coins(45, 48, 4);
  m.ground(51, 60, 12).set(54, 11, 'C');
  m.fill(61, 12, 72, 12, 'X').fill(61, 14, 72, 14, '^').coins(63, 70, 10);
  m.ground(73, 87, 12).fill(78, 11, 78, 11, '^');
  m.set(84, 11, 'G');
  defs.push(m.def({ id: '2-2', world: 2, name: 'Chão Traiçoeiro', par: 12 }));
}
{ // 2-3 Serras Giratórias
  const m = new MapBuilder(88);
  m.ground(0, 26, 12).set(2, 11, 'P');
  m.ent({ t: 'saw', x: 12, y: 7, x2: 12, y2: 11, p: 70, o: 0 });
  m.ent({ t: 'saw', x: 18, y: 11, x2: 24, y2: 11, p: 90, o: 0 });
  m.ground(31, 45, 12).set(32, 11, 'C');
  m.ent({ t: 'saw', x: 37, y: 6, x2: 37, y2: 11, p: 60, o: 0 });
  m.ent({ t: 'saw', x: 41, y: 6, x2: 41, y2: 11, p: 60, o: 30 });
  m.fill(48, 9, 50, 9, '-').fill(54, 9, 56, 9, '-').coins(54, 56, 7);
  m.ent({ t: 'saw', x: 47, y: 6, x2: 58, y2: 6, p: 120, o: 0 });
  m.ground(60, 87, 12).set(62, 11, 'C');
  m.ent({ t: 'saw', x: 68, y: 11, r: 7 });
  m.ent({ t: 'saw', x: 74, y: 8, x2: 74, y2: 11, p: 45, o: 0 });
  m.set(83, 11, 'G');
  defs.push(m.def({ id: '2-3', world: 2, name: 'Serras Giratórias', par: 12 }));
}
{ // 2-4 Profundezas
  const m = new MapBuilder(66);
  m.fill(0, 0, 65, 0);
  m.ground(0, 8, 12).set(2, 11, 'P');
  m.fill(9, 12, 14, 12, 'X').fill(9, 14, 14, 14, '^');
  m.ent({ t: 'saw', x: 12, y: 7, x2: 12, y2: 10, p: 80, o: 0 });
  m.ground(15, 24, 12).set(18, 11, 'C');
  m.fill(23, 0, 24, 8);
  m.fill(28, 3, 29, 14).coins(25, 27, 6);
  m.fill(28, 3, 40, 4).fill(34, 2, 34, 2, '^').coins(36, 38, 1);
  m.ground(41, 65, 12).set(43, 11, 'C');
  m.ent({ t: 'saw', x: 47, y: 11, x2: 54, y2: 11, p: 100, o: 0 });
  m.set(60, 11, 'G');
  defs.push(m.def({ id: '2-4', world: 2, name: 'Profundezas', par: 10 }));
}
{ // 2-5 CHEFE: Aranha de Cristal
  const m = new MapBuilder(32);
  m.ground(0, 31, 12).fill(0, 0, 0, 14).fill(31, 0, 31, 14).fill(0, 0, 31, 0);
  m.set(3, 11, 'P');
  m.fill(4, 8, 8, 8, '-').fill(23, 8, 27, 8, '-').fill(13, 5, 18, 5, '-');
  m.set(16, 11, 'G');
  m.ent({ t: 'boss', kind: 'aranha', x: 22, y: 11 });
  defs.push(m.def({ id: '2-5', world: 2, name: 'Chefe: Aranha de Cristal', par: 10, boss: true }));
}

// ===================== MUNDO 3 — PICO GELADO =============================
{ // 3-1 Deslize
  const m = new MapBuilder(96);
  m.ground(0, 12, 12, '#', 'I').set(2, 11, 'P');
  m.ground(16, 21, 11, '#', 'I').coins(17, 20, 9);
  m.ground(25, 28, 10, '#', 'I');
  m.ground(33, 45, 12).set(36, 11, 'C');
  m.ground(46, 70, 12, '#', 'I').set(52, 11, '^').fill(58, 11, 59, 11, '^').set(64, 11, '^');
  m.fill(75, 10, 77, 10, '-').coins(75, 77, 8);
  m.ground(81, 95, 12).set(92, 11, 'G');
  defs.push(m.def({ id: '3-1', world: 3, name: 'Deslize', par: 13 }));
}
{ // 3-2 Feixes de Laser
  const m = new MapBuilder(88);
  m.fill(0, 0, 87, 1);
  m.ground(0, 27, 12).set(2, 11, 'P');
  m.ent({ t: 'laser', x: 12, y: 2, dir: 'd', len: 9, on: 50, off: 70, o: 0 });
  m.ent({ t: 'laser', x: 18, y: 2, dir: 'd', len: 9, on: 50, off: 70, o: 40 });
  m.ent({ t: 'laser', x: 24, y: 2, dir: 'd', len: 9, on: 50, off: 70, o: 80 });
  m.ground(32, 56, 12).set(34, 11, 'C');
  m.set(40, 11, '#');
  m.ent({ t: 'laser', x: 40, y: 11, dir: 'r', len: 8, on: 60, off: 60, o: 0 });
  m.set(52, 9, '#');
  m.ent({ t: 'laser', x: 52, y: 9, dir: 'l', len: 6, on: 60, off: 60, o: 60 });
  m.fill(60, 10, 62, 10, '-').fill(66, 10, 68, 10, '-');
  m.ent({ t: 'laser', x: 64, y: 2, dir: 'd', len: 12, on: 40, off: 60, o: 0 });
  m.ground(71, 87, 12).set(73, 11, 'C');
  m.ent({ t: 'laser', x: 78, y: 2, dir: 'd', len: 9, on: 30, off: 50, o: 20 });
  m.set(84, 11, 'G');
  defs.push(m.def({ id: '3-2', world: 3, name: 'Feixes de Laser', par: 14 }));
}
{ // 3-3 Avalanche
  const m = new MapBuilder(80);
  m.ground(0, 10, 12, '#', 'I').set(2, 11, 'P');
  m.ent({ t: 'plat', x: 11, y: 11, x2: 15, y2: 11, w: 3, p: 110, o: 0 });
  m.ent({ t: 'plat', x: 19, y: 9, x2: 23, y2: 9, w: 3, p: 110, o: 55 });
  m.ent({ t: 'saw', x: 18, y: 4, x2: 18, y2: 7, p: 60, o: 0 });
  m.ground(27, 38, 12, '#', 'I').set(29, 11, 'C');
  m.ent({ t: 'plat', x: 40, y: 12, x2: 40, y2: 6, w: 3, p: 140, o: 0 });
  m.ground(44, 55, 6, '#', 'I').coins(46, 53, 2);
  m.ent({ t: 'saw', x: 46, y: 5, x2: 54, y2: 5, p: 100, o: 0 });
  m.ground(56, 79, 12).set(58, 11, 'C').fill(64, 11, 65, 11, '^');
  m.set(75, 11, 'G');
  defs.push(m.def({ id: '3-3', world: 3, name: 'Avalanche', par: 13 }));
}
{ // 3-4 Torre Congelada (escalada vertical)
  const m = new MapBuilder(30, 32);
  m.fill(0, 0, 0, 31).fill(29, 0, 29, 31).fill(0, 30, 29, 31);
  m.set(3, 29, 'P');
  m.fill(10, 29, 11, 29, '^');
  m.set(26, 29, 'S');
  m.fill(18, 24, 28, 24, '-');
  m.fill(1, 24, 17, 24).fill(10, 23, 11, 23, '^').coins(13, 15, 21);
  m.fill(4, 12, 5, 21);
  m.fill(1, 11, 3, 11, '-');
  m.fill(4, 11, 28, 11).set(9, 10, 'C');
  m.ent({ t: 'saw', x: 13, y: 9, x2: 20, y2: 9, p: 90, o: 0 });
  m.set(27, 10, 'S');
  m.fill(14, 5, 25, 5).fill(19, 4, 19, 4, '^').coins(20, 23, 2);
  m.set(15, 4, 'G');
  defs.push(m.def({ id: '3-4', world: 3, name: 'Torre Congelada', par: 28 }));
}
{ // 3-5 CHEFE: Yeti Glacial
  const m = new MapBuilder(34);
  m.ground(0, 33, 12, '#', 'I').fill(0, 0, 0, 14).fill(33, 0, 33, 14).fill(0, 0, 33, 0);
  m.set(3, 11, 'P');
  m.fill(4, 8, 8, 8, '-').fill(25, 8, 29, 8, '-').fill(14, 5, 19, 5, '-');
  m.set(17, 11, 'G');
  m.ent({ t: 'boss', kind: 'yeti', x: 24, y: 11 });
  defs.push(m.def({ id: '3-5', world: 3, name: 'Chefe: Yeti Glacial', par: 10, boss: true }));
}

// ===================== MUNDO 4 — FORTALEZA DE MAGMA ========================
{ // 4-1 Canhões
  const m = new MapBuilder(92);
  m.ground(0, 40, 12).set(2, 11, 'P');
  m.set(30, 11, '#');
  m.ent({ t: 'cannon', x: 30, y: 11, dir: 'l', range: 18, every: 100, speed: 2, o: 0 });
  m.coins(33, 36, 9);
  m.ground(45, 60, 12).fill(45, 0, 60, 1).set(46, 11, 'C');
  m.ent({ t: 'cannon', x: 50, y: 2, dir: 'd', range: 9, every: 70, speed: 2.2, o: 0 });
  m.ent({ t: 'cannon', x: 55, y: 2, dir: 'd', range: 9, every: 70, speed: 2.2, o: 35 });
  m.fill(50, 2, 50, 2).fill(55, 2, 55, 2);
  m.fill(63, 10, 65, 10, '-').fill(68, 9, 70, 9, '-').coins(68, 70, 7);
  m.fill(75, 8, 76, 14);
  m.ent({ t: 'cannon', x: 75, y: 8, dir: 'l', range: 13, every: 80, speed: 2, o: 20 });
  m.ground(77, 91, 12).set(79, 11, 'C');
  m.set(88, 11, 'G');
  defs.push(m.def({ id: '4-1', world: 4, name: 'Canhões', par: 13 }));
}
{ // 4-2 Rio de Magma
  const m = new MapBuilder(84);
  m.fill(37, 0, 48, 1);
  m.ground(0, 8, 12).set(2, 11, 'P');
  m.fill(9, 11, 16, 11, 'X');
  m.ent({ t: 'saw', x: 13, y: 6, x2: 13, y2: 9, p: 60, o: 0 });
  m.ground(17, 24, 12).set(19, 11, 'C');
  m.ent({ t: 'plat', x: 25, y: 10, x2: 33, y2: 10, w: 3, p: 120, o: 0 });
  m.ent({ t: 'saw', x: 25, y: 6, x2: 36, y2: 6, p: 140, o: 70 });
  m.ground(37, 48, 12).set(39, 11, 'C');
  m.ent({ t: 'laser', x: 43, y: 2, dir: 'd', len: 9, on: 45, off: 45, o: 0 });
  m.set(43, 2, '#');
  m.fill(47, 2, 48, 8);
  m.fill(49, 14, 52, 14);
  m.fill(53, 3, 54, 14).fill(53, 3, 62, 4).fill(58, 2, 58, 2, '^').coins(55, 57, 1);
  m.ground(63, 83, 12).set(65, 11, 'C');
  m.set(83, 11, '#');
  m.ent({ t: 'cannon', x: 83, y: 11, dir: 'l', range: 16, every: 60, speed: 2, o: 0 });
  m.set(76, 11, 'G');
  defs.push(m.def({ id: '4-2', world: 4, name: 'Rio de Magma', par: 13 }));
}
{ // 4-3 Desafio de Precisão
  const m = new MapBuilder(92);
  m.ground(0, 6, 12).set(2, 11, 'P');
  m.ground(10, 10, 11).ground(14, 14, 10).ground(18, 18, 11).ground(22, 22, 9);
  m.ground(25, 32, 10).set(27, 9, 'C');
  m.fill(35, 9, 36, 9, '-').fill(40, 9, 41, 9, '-').fill(45, 9, 46, 9, '-');
  m.ent({ t: 'saw', x: 38, y: 4, x2: 38, y2: 8, p: 50, o: 0 });
  m.ent({ t: 'saw', x: 43, y: 4, x2: 43, y2: 8, p: 50, o: 25 });
  m.ground(48, 56, 12).set(50, 11, 'C');
  m.fill(57, 0, 75, 1);
  m.fill(57, 12, 62, 12, 'X').ground(63, 69, 12).fill(70, 12, 75, 12, 'X');
  m.ent({ t: 'laser', x: 60, y: 2, dir: 'd', len: 9, on: 40, off: 50, o: 0 });
  m.ent({ t: 'laser', x: 66, y: 2, dir: 'd', len: 9, on: 40, off: 50, o: 30 });
  m.ent({ t: 'laser', x: 72, y: 2, dir: 'd', len: 9, on: 40, off: 50, o: 60 });
  m.fill(60, 2, 60, 2).fill(66, 2, 66, 2).fill(72, 2, 72, 2);
  m.ground(76, 91, 12).set(78, 11, 'C').set(83, 11, '^');
  m.set(88, 11, 'G');
  defs.push(m.def({ id: '4-3', world: 4, name: 'Desafio de Precisão', par: 15 }));
}
{ // 4-4 Ascensão Final
  const m = new MapBuilder(30, 34);
  m.fill(0, 0, 0, 33).fill(29, 0, 29, 33).fill(0, 32, 29, 33);
  m.set(3, 31, 'P');
  m.fill(8, 31, 9, 31, '^');
  m.fill(14, 32, 16, 32, 'X').fill(14, 33, 16, 33, '^');
  m.set(25, 31, 'S');
  m.fill(18, 26, 28, 26, '-').fill(1, 26, 17, 26).set(22, 25, 'C');
  m.set(28, 25, '#');
  m.ent({ t: 'cannon', x: 28, y: 25, dir: 'l', range: 16, every: 90, speed: 2, o: 0 });
  m.fill(6, 10, 7, 25).fill(11, 14, 12, 23);
  m.fill(8, 13, 10, 13, '-').fill(11, 13, 28, 13).set(13, 12, 'C');
  m.ent({ t: 'saw', x: 15, y: 11, x2: 22, y2: 11, p: 80, o: 0 });
  m.set(27, 12, 'S');
  m.fill(14, 7, 25, 7).set(19, 6, '^').coins(22, 24, 4);
  m.set(21, 2, '#');
  m.ent({ t: 'laser', x: 21, y: 2, dir: 'd', len: 4, on: 40, off: 60, o: 0 });
  m.set(16, 6, 'G');
  defs.push(m.def({ id: '4-4', world: 4, name: 'Ascensão Final', par: 30 }));
}
{ // 4-5 CHEFE FINAL: Dragão de Magma
  const m = new MapBuilder(34);
  m.ground(0, 33, 12).fill(0, 0, 0, 14).fill(33, 0, 33, 14).fill(0, 0, 33, 0);
  m.set(3, 11, 'P');
  m.fill(4, 8, 8, 8, '-').fill(25, 8, 29, 8, '-').fill(14, 5, 19, 5, '-');
  m.set(17, 11, 'G');
  m.ent({ t: 'boss', kind: 'dragao', x: 24, y: 11 });
  defs.push(m.def({ id: '4-5', world: 4, name: 'Chefe Final: Dragão de Magma', par: 11, boss: true }));
}

export const LEVEL_DEFS = defs;
export const LEVEL_IDS = defs.map((d) => d.id);
const cache = new Map();

export function getStoryLevel(id) {
  if (!cache.has(id)) {
    const d = defs.find((x) => x.id === id);
    if (!d) return null;
    cache.set(id, gridLevel(d));
  }
  return cache.get(id);
}

export function levelMeta(id) {
  const d = defs.find((x) => x.id === id);
  return d ? { id: d.id, world: d.world, name: d.name, par: d.par, boss: !!d.boss } : null;
}

// fase anterior (para desbloqueio)
export function prevLevelId(id) {
  const i = LEVEL_IDS.indexOf(id);
  return i > 0 ? LEVEL_IDS[i - 1] : null;
}
