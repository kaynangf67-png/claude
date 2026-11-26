// Relógio do servidor (permite avançar o tempo nos testes automatizados).
let offset = 0;
export const now = () => Date.now() + offset;
export function advanceClock(ms) { offset += ms; }
