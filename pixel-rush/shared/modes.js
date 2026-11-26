// Constrói a fase de cada modo — idêntico no cliente e no servidor.
import { getStoryLevel } from './levels.js';
import { endlessLevel, courseLevel } from './generator.js';

export const MODES = ['level', 'endless', 'daily', 'event', 'race'];

const courseCache = new Map();
function cachedCourse(id, opts) {
  if (!courseCache.has(id)) {
    if (courseCache.size > 64) courseCache.delete(courseCache.keys().next().value);
    courseCache.set(id, courseLevel(id, opts));
  }
  return courseCache.get(id);
}

export function buildLevel(mode, levelId, seed = 0) {
  switch (mode) {
    case 'level': return getStoryLevel(levelId);
    case 'endless': return endlessLevel(seed >>> 0); // novo a cada tentativa (cache interno de blocos)
    case 'daily': return cachedCourse(levelId, { chunks: 6, diff: 0.55, name: 'Desafio Diário' });
    case 'event': return cachedCourse(levelId, { chunks: 8, diff: 0.8, name: 'Evento Mundial' });
    case 'race': return cachedCourse(levelId, { chunks: 4, diff: 0.5, name: 'Corrida Online' });
    default: return null;
  }
}

export function endlessDistance(level, sim) {
  return Math.max(0, Math.floor((sim.s.maxX - level.start.x) / 16));
}
