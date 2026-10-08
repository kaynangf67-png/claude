/**
 * Saída SIMULADA do AI MULTIMODAL MOVIE ANALYZER para os filmes originais.
 *
 * TODO: FUTURE AI INTEGRATION
 *   Estes dados foram escritos à mão a partir do roteiro dos curtas (que nós
 *   mesmos geramos em scripts/generate_media.py). Em produção, este objeto deve
 *   ser produzido pelo analisador multimodal (ver ai/multimodalAnalyzer.ts),
 *   que recebe VIDEO + AUDIO + TRANSCRIPT + TIMECODES e devolve exatamente
 *   este formato (SceneAnalysis). Os sons vêm do WebVTT de sons e são
 *   anexados pelo analisador em tempo de execução.
 */
import type { SceneAnalysis } from '@/ai/types';

export const LIGACAO_ANALYSIS: Omit<SceneAnalysis, 'sounds'> = {
  contentId: 'a-ligacao',
  producedBy: {
    engine: 'multimodal-analyzer@mock',
    mode: 'pre-processed-mock',
    note: 'Anotações manuais derivadas do roteiro; nenhuma IA analisou o vídeo neste protótipo.',
  },
  characters: [
    { id: 'marina', name: 'Marina', role: 'Protagonista', voiceTag: 'Marina', onScreen: true, locus: 'left', color: '#8fb3ff' },
    { id: 'daniel', name: 'Daniel', role: 'Voz ao telefone (fora de cena)', voiceTag: 'Daniel', onScreen: false, locus: 'right', color: '#ffb86b' },
  ],
  scenes: [
    { id: 'sc0', start: 0, end: 4, shot: 'Cartela de título', environment: 'TITLE_CARD', location: '—', description: 'Título do curta.', characters: [], mood: 'neutral', tension: 0.1, context: 'OPENING_TITLE' },
    { id: 'sc1', start: 4, end: 19, shot: 'Plano geral', environment: 'INDOOR', location: 'Sala de apartamento, à noite, chovendo', description: 'Marina chega em casa; a porta bate atrás dela; o celular sobre a mesa começa a tocar.', characters: ['marina'], mood: 'neutral', tension: 0.35, context: 'ARRIVING_HOME' },
    { id: 'sc2', start: 19, end: 23, shot: 'Detalhe do celular', environment: 'INDOOR', location: 'Mesa da sala', description: 'Chamada de número desconhecido; Marina pega o telefone.', characters: ['marina'], mood: 'neutral', tension: 0.45, context: 'INCOMING_UNKNOWN_CALL' },
    { id: 'sc3', start: 23, end: 31, shot: 'Primeiro plano (perfil)', environment: 'INDOOR', location: 'Sala, junto à janela', description: 'Marina atende. Daniel, do outro lado, fala com pressa.', characters: ['marina'], mood: 'urgent', tension: 0.6, context: 'PHONE_CALL' },
    { id: 'sc4', start: 31, end: 38.5, shot: 'Primeiro plano (aproximação lenta)', environment: 'INDOOR', location: 'Sala, junto à janela', description: 'Marina pergunta o que aconteceu; Daniel não explica.', characters: ['marina'], mood: 'fear', tension: 0.75, context: 'PHONE_CALL' },
    { id: 'sc5', start: 38.5, end: 41, shot: 'Plano geral (aproximação)', environment: 'INDOOR', location: 'Sala de apartamento', description: 'A chuva para de repente. Silêncio.', characters: ['marina'], mood: 'fear', tension: 0.85, context: 'SUDDEN_SILENCE' },
    { id: 'sc6', start: 41, end: 45, shot: 'Plano da porta', environment: 'INDOOR', location: 'Porta de entrada', description: 'Uma sombra de pés aparece sob a porta. Batidas.', characters: [], mood: 'fear', tension: 0.95, context: 'INTRUDER_AT_DOOR' },
    { id: 'sc7', start: 45, end: 49.5, shot: 'Primeiro plano (perfil, virada para a porta)', environment: 'INDOOR', location: 'Sala, olhando para a porta', description: 'Marina sussurra ao telefone.', characters: ['marina'], mood: 'fear', tension: 1, context: 'HIDDEN_DANGER' },
    { id: 'sc8', start: 49.5, end: 53, shot: 'Cartela final', environment: 'TITLE_CARD', location: '—', description: '"Continua…"', characters: [], mood: 'neutral', tension: 0.4, context: 'CLOSING_TITLE' },
  ],
  visualEvents: [
    { id: 've-door-opens', t: 4.5, end: 5.6, code: 'DOOR_OPENS', label: 'A porta se abre; luz quente do corredor', importance: 'medium', notInDialogue: true },
    { id: 've-enters', t: 5.3, end: 9.6, code: 'WOMAN_ENTERS', label: 'Marina entra e caminha até a mesa', importance: 'low', notInDialogue: true },
    { id: 've-turns', t: 10.3, end: 12.4, code: 'WOMAN_TURNS_AROUND', label: 'Marina olha para trás, assustada', importance: 'high', notInDialogue: true },
    { id: 've-phone-lights', t: 12.5, end: 14, code: 'PHONE_LIGHTS_UP', label: 'O celular acende e vibra sobre a mesa', importance: 'medium', notInDialogue: true },
    { id: 've-screen', t: 19, end: 21.3, code: 'SCREEN_TEXT', label: 'Tela do celular: "NÚMERO DESCONHECIDO"', importance: 'high', notInDialogue: true },
    { id: 've-pickup', t: 21.4, end: 23, code: 'HAND_PICKS_UP_PHONE', label: 'A mão de Marina pega o telefone', importance: 'medium', notInDialogue: true },
    { id: 've-rain-stops', t: 38.6, end: 41, code: 'RAIN_STOPS', label: 'A chuva para de repente', importance: 'high', notInDialogue: true },
    { id: 've-shadow', t: 41.3, end: 42.4, code: 'SHADOW_UNDER_DOOR', label: 'Sombra de pés aparece sob a porta', importance: 'high', notInDialogue: true },
    { id: 've-turns-door', t: 45, end: 46, code: 'WOMAN_TURNS_TO_DOOR', label: 'Marina se vira para a porta', importance: 'medium', notInDialogue: true },
    { id: 've-continua', t: 50, end: 53, code: 'TEXT_ON_SCREEN', label: 'Texto na tela: "Continua…"', importance: 'medium', notInDialogue: true },
  ],
  regions: [
    { id: 'roi-title', start: 0, end: 4, rect: [0.25, 0.3, 0.75, 0.62], kind: 'text', label: 'título do filme' },
    { id: 'roi-phone-table', start: 12.5, end: 19, rect: [0.4, 0.6, 0.5, 0.74], kind: 'object', label: 'celular sobre a mesa' },
    { id: 'roi-screen', start: 19, end: 23, rect: [0.36, 0.12, 0.64, 0.86], kind: 'text', label: 'tela do celular' },
    { id: 'roi-hand', start: 19, end: 23, rect: [0.55, 0.42, 1, 1], kind: 'action', label: 'mão pegando o telefone' },
    { id: 'roi-face-1', start: 23, end: 38.5, rect: [0.3, 0.08, 0.62, 0.72], kind: 'face', label: 'rosto de Marina' },
    { id: 'roi-door', start: 41, end: 45, rect: [0.36, 0.07, 0.64, 0.95], kind: 'object', label: 'porta e fresta iluminada' },
    { id: 'roi-face-2', start: 45, end: 49.5, rect: [0.3, 0.1, 0.62, 0.72], kind: 'face', label: 'rosto de Marina' },
    { id: 'roi-end', start: 49.5, end: 53, rect: [0.3, 0.4, 0.7, 0.6], kind: 'text', label: 'texto final' },
  ],
};

export const MANIFESTO_ANALYSIS: Omit<SceneAnalysis, 'sounds'> = {
  contentId: 'manifesto',
  producedBy: { engine: 'multimodal-analyzer@mock', mode: 'pre-processed-mock', note: 'Anotações manuais do roteiro do manifesto.' },
  characters: [{ id: 'narracao', name: 'Narração', role: 'Narradora', voiceTag: 'Narração', onScreen: false, locus: 'center', color: '#ffcf8a' }],
  scenes: [
    { id: 'm-sc1', start: 0, end: 12.6, shot: 'Abstrato — feixes de luz', environment: 'ABSTRACT', location: '—', description: 'Ondas de luz coloridas atravessam a tela.', characters: [], mood: 'happy', tension: 0.1, context: 'BRAND_MANIFESTO' },
    { id: 'm-sc2', start: 12.6, end: 18, shot: 'Logo', environment: 'ABSTRACT', location: '—', description: 'A marca LUMIA aparece.', characters: [], mood: 'happy', tension: 0.1, context: 'BRAND_REVEAL' },
  ],
  visualEvents: [{ id: 'mv-logo', t: 12.6, end: 14, code: 'LOGO_REVEAL', label: 'A marca LUMIA aparece', importance: 'low', notInDialogue: true }],
  regions: [{ id: 'm-roi-logo', start: 12.6, end: 18, rect: [0.4, 0.3, 0.6, 0.62], kind: 'text', label: 'logo' }],
};

export const SCENE_ANALYSES: Record<string, Omit<SceneAnalysis, 'sounds'>> = {
  'a-ligacao': LIGACAO_ANALYSIS,
  manifesto: MANIFESTO_ANALYSIS,
};
