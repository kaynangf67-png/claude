import type { ParkingDataSource } from './types';

/**
 * Catálogo das fontes previstas na arquitetura. No MVP, apenas a colaboração dos
 * usuários e as APIs de estacionamento estão ativas (simuladas). As demais estão
 * documentadas com suas limitações reais e desativadas até existir integração.
 */
const noop = () => {};

function planned(
  id: string,
  name: string,
  capabilities: ParkingDataSource['capabilities'],
  limitations: string,
): ParkingDataSource {
  return { id, name, capabilities, limitations, enabled: false, start: noop, stop: noop };
}

export const DATA_SOURCES: ParkingDataSource[] = [
  {
    id: 'crowd',
    name: 'Confirmações dos usuários',
    capabilities: { perSpotOccupancy: true, aggregateCount: false, trafficFlow: false, typicalLatencyS: 5 },
    limitations: 'Depende de haver usuários passando; pode conter erros — por isso cada usuário tem um peso de confiança.',
    enabled: true,
    start: noop,
    stop: noop,
  },
  {
    id: 'lot_api',
    name: 'APIs de estacionamentos',
    capabilities: { perSpotOccupancy: false, aggregateCount: true, trafficFlow: false, typicalLatencyS: 60 },
    limitations: 'Informa apenas o total de vagas livres do estacionamento, não qual vaga. Só existe para estabelecimentos integrados.',
    enabled: true,
    start: noop,
    stop: noop,
  },
  planned(
    'gps',
    'GPS dos usuários',
    { perSpotOccupancy: false, aggregateCount: false, trafficFlow: true, typicalLatencyS: 2 },
    'GPS não enxerga vagas. Serve para inferir velocidade, fluxo, "rodando procurando vaga" e quando um usuário estacionou ou saiu (padrão de movimento).',
  ),
  planned(
    'traffic',
    'Dados de trânsito (APIs de mapas)',
    { perSpotOccupancy: false, aggregateCount: false, trafficFlow: true, typicalLatencyS: 60 },
    'APIs de trânsito informam velocidade/congestionamento das vias. Nenhuma API de mapas pública detecta vagas livres na rua.',
  ),
  planned(
    'sensor',
    'Sensores de solo / IoT',
    { perSpotOccupancy: true, aggregateCount: false, trafficFlow: false, typicalLatencyS: 10 },
    'Detectam ocupação por vaga com boa precisão, mas só onde a prefeitura/operador instalou sensores.',
  ),
  planned(
    'camera',
    'Câmeras + visão computacional',
    { perSpotOccupancy: true, aggregateCount: true, trafficFlow: true, typicalLatencyS: 15 },
    'Exige câmera com ângulo sobre a rua, permissão de uso e tratamento de privacidade (LGPD). Oclusões e chuva reduzem a precisão.',
  ),
];
