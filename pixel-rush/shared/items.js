// Catálogo de cosméticos. Nenhum item altera a física: a competição é justa.
export const SLOTS = {
  skin: 'Skins', victory: 'Animações de vitória', jump: 'Efeitos de pulo', trail: 'Trilhas',
  pet: 'Mascotes', emote: 'Emotes', frame: 'Molduras',
};

const skin = (id, name, price, rarity, pal) => ({ id, slot: 'skin', name, price, rarity, pal });

export const ITEMS = [
  // --- skins: bonequinho 2D (menino e menina)
  skin('skin_male', 'Menino', 0, 'comum', { o: '#1a1030', h: '#3b2416', s: '#f1c27d', S: '#d9a066', k: '#1a1030', c: '#3d8bff', C: '#2759c4', d: '#2b2d42', D: '#17182b', l: '#2b2d42', b: '#5a3a1a' }),
  skin('skin_female', 'Menina', 0, 'comum', { o: '#1a1030', h: '#7a3b1d', s: '#f6cda8', S: '#e0a982', k: '#1a1030', c: '#ff5d8f', C: '#c23a6a', d: '#ff5d8f', D: '#c23a6a', l: '#f6cda8', b: '#c23a6a', r: '#ffd23f' }),

  // --- animações de vitória
  { id: 'victory_basic', slot: 'victory', name: 'Pulinho', price: 0, rarity: 'comum', fx: 'hop' },
  { id: 'victory_spin', slot: 'victory', name: 'Giro', price: 200, rarity: 'comum', fx: 'spin' },
  { id: 'victory_confetti', slot: 'victory', name: 'Confete', price: 450, rarity: 'raro', fx: 'confetti' },
  { id: 'victory_fireworks', slot: 'victory', name: 'Fogos de Artifício', price: 900, rarity: 'épico', fx: 'fireworks' },
  { id: 'victory_crown', slot: 'victory', name: 'Coroa Real', price: 180, cur: 'gem', rarity: 'lendário', fx: 'crown' },

  // --- efeitos de pulo
  { id: 'jump_dust', slot: 'jump', name: 'Poeira', price: 0, rarity: 'comum', fx: 'dust', colors: ['#d8cbb0', '#ffffff'] },
  { id: 'jump_stars', slot: 'jump', name: 'Estrelas', price: 250, rarity: 'comum', fx: 'stars', colors: ['#ffd23f', '#fff4b8'] },
  { id: 'jump_hearts', slot: 'jump', name: 'Corações', price: 350, rarity: 'raro', fx: 'hearts', colors: ['#ff5d8f', '#ffb3c6'] },
  { id: 'jump_bolt', slot: 'jump', name: 'Raios', price: 600, rarity: 'épico', fx: 'bolt', colors: ['#3ee0ff', '#ffffff'] },
  { id: 'jump_rainbow', slot: 'jump', name: 'Pixels Arco-íris', price: 120, cur: 'gem', rarity: 'lendário', fx: 'rainbow', colors: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'] },

  // --- trilhas
  { id: 'trail_none', slot: 'trail', name: 'Sem trilha', price: 0, rarity: 'comum', fx: null },
  { id: 'trail_ghost', slot: 'trail', name: 'Imagem Fantasma', price: 300, rarity: 'comum', fx: 'ghost' },
  { id: 'trail_fire', slot: 'trail', name: 'Fogo', price: 600, rarity: 'raro', fx: 'fire', colors: ['#ff7a1a', '#ffd166', '#c43c00'] },
  { id: 'trail_neon', slot: 'trail', name: 'Neon', price: 800, rarity: 'épico', fx: 'neon', colors: ['#3ee0ff', '#ff3dff'] },
  { id: 'trail_rainbow', slot: 'trail', name: 'Arco-íris', price: 150, cur: 'gem', rarity: 'lendário', fx: 'rainbow', colors: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'] },

  // --- mascotes
  { id: 'pet_none', slot: 'pet', name: 'Sem mascote', price: 0, rarity: 'comum', sprite: null },
  { id: 'pet_slime', slot: 'pet', name: 'Gosminha', price: 400, rarity: 'raro', sprite: 'slime' },
  { id: 'pet_bird', slot: 'pet', name: 'Piu', price: 500, rarity: 'raro', sprite: 'bird' },
  { id: 'pet_bot', slot: 'pet', name: 'Drone B-1', price: 900, rarity: 'épico', sprite: 'bot' },
  { id: 'pet_dragon', slot: 'pet', name: 'Dragãozinho', price: 200, cur: 'gem', rarity: 'lendário', sprite: 'dragon' },

  // --- emotes (usados em corridas e na tela de vitória)
  { id: 'emote_gg', slot: 'emote', name: 'GG', price: 0, rarity: 'comum', text: 'GG' },
  { id: 'emote_wave', slot: 'emote', name: 'Oi!', price: 0, rarity: 'comum', text: 'OI!' },
  { id: 'emote_fire', slot: 'emote', name: 'Em chamas', price: 200, rarity: 'comum', text: '🔥' },
  { id: 'emote_cool', slot: 'emote', name: 'Estiloso', price: 300, rarity: 'raro', text: '😎' },
  { id: 'emote_lol', slot: 'emote', name: 'KKKK', price: 300, rarity: 'raro', text: 'KKKK' },
  { id: 'emote_crown', slot: 'emote', name: 'Rei da Pista', price: 1000, rarity: 'épico', text: '👑' },

  // --- molduras de perfil
  { id: 'frame_none', slot: 'frame', name: 'Simples', price: 0, rarity: 'comum', css: 'frame-none' },
  { id: 'frame_wood', slot: 'frame', name: 'Madeira', price: 150, rarity: 'comum', css: 'frame-wood' },
  { id: 'frame_neon', slot: 'frame', name: 'Neon', price: 500, rarity: 'raro', css: 'frame-neon' },
  { id: 'frame_fire', slot: 'frame', name: 'Chamas', price: 900, rarity: 'épico', css: 'frame-fire' },
  { id: 'frame_diamond', slot: 'frame', name: 'Diamante', price: 220, cur: 'gem', rarity: 'lendário', css: 'frame-diamond' },
  { id: 'frame_top10', slot: 'frame', name: 'Elite Top 10', price: null, rarity: 'exclusivo', css: 'frame-top10' },
  { id: 'frame_champion', slot: 'frame', name: 'Campeão Mundial', price: null, rarity: 'exclusivo', css: 'frame-champion' },
];

export const ITEM_MAP = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const DEFAULT_ITEMS = ITEMS.filter((i) => i.price === 0).map((i) => i.id);
export const DEFAULT_EQUIPPED = {
  skin: 'skin_male', victory: 'victory_basic', jump: 'jump_dust', trail: 'trail_none',
  pet: 'pet_none', emote: 'emote_gg', frame: 'frame_none',
};

export const AVATARS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11', 'a12'];
export const AVATAR_COLORS = {
  a1: ['#ff5d73', '#ffd23f'], a2: ['#4fe3b0', '#ff6ab0'], a3: ['#3d8bff', '#ffe066'], a4: ['#2b2d42', '#e63946'],
  a5: ['#b8c4d0', '#3ee0ff'], a6: ['#ff7a1a', '#2a0800'], a7: ['#bdf3ff', '#6c63ff'], a8: ['#efeaff', '#9b8cff'],
  a9: ['#ffd23f', '#ff3d6e'], a10: ['#8ac926', '#1982c4'], a11: ['#ff9f1c', '#2ec4b6'], a12: ['#f72585', '#4cc9f0'],
};

// Diamantes: moeda premium comprada com dinheiro (só cosméticos, sem vantagem no jogo).
export const GEM_PACKS = [
  { id: 'gems_100', gems: 100, bonus: 0, price: 4.9 },
  { id: 'gems_310', gems: 310, bonus: 10, price: 14.9 },
  { id: 'gems_520', gems: 520, bonus: 20, price: 24.9 },
  { id: 'gems_1060', gems: 1060, bonus: 60, price: 49.9 },
];
export const GEM_PACK_MAP = Object.fromEntries(GEM_PACKS.map((p) => [p.id, p]));
