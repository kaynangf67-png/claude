# VagaAqui

> Encontre sua vaga antes de chegar.

MVP web 3D que mostra onde há **maior probabilidade** de existir vaga de estacionamento, escolhe a melhor opção (não a mais próxima) e guia o motorista até ela, com confirmações colaborativas e recompensas.

| Mapa 3D | Navegação | Preview 3D |
| --- | --- | --- |
| ![Mapa](docs/screenshots/01-mapa.png) | ![Navegação](docs/screenshots/02-navegacao.png) | ![Preview 3D](docs/screenshots/03-preview-3d.png) |
| **Índice de Confiança** | **Chegada e confirmação** | **Celular** |
| ![Índice](docs/screenshots/04-indice-confianca.png) | ![Chegada](docs/screenshots/06-chegada.png) | ![Mobile](docs/screenshots/05-mobile-navegacao.png) |

**Stack:** React 19 · TypeScript · Vite · Three.js · React Three Fiber · @react-three/drei · GSAP · Lucide React.

## Rodando

```bash
cd vagaaqui
npm install
npm run dev        # http://localhost:5173
npm test           # 25 testes: Índice de Confiança, recomendação, rotas, importador OSM, simulação, geometria
npm run build      # typecheck + build de produção em dist/
npm run import-osm # grava um snapshot das ruas reais em public/osm/area.json (opcional)
```

Nenhuma chave de API é necessária. Variáveis opcionais estão em `.env.example` (copie para `.env.local`):

| Variável | Para quê |
| --- | --- |
| `VITE_API_URL` | URL do backend real. Vazio = repositório mock local (perfil salvo no navegador). |
| `VITE_MAP_CENTER_LAT` / `VITE_MAP_CENTER_LON` | Centro da área do mapa (padrão: -20.329, -40.292, Grande Vitória-ES). |
| `VITE_OSM_RADIUS_M` | Raio (m) da área baixada do OpenStreetMap (padrão 650). |
| `VITE_MAP_SOURCE` | `osm` (padrão, ruas reais) ou `procedural` (cidade fictícia de demonstração). |
| `VITE_USE_BROWSER_GPS` | `true` tenta usar o GPS do aparelho; fora da área mapeada volta para a localização simulada e avisa o usuário. |

## Jornada demonstrada

Abrir app → animação do logo → **ENCONTRAR VAGA** → mapa 3D aparece → ver localização → explorar (Preview 3D) → vagas com % → **MELHOR OPÇÃO** com motivos → **IR ATÉ A VAGA** → câmera de GPS segue o carro, rota animada no chão, manobras e voz → pergunta "Você viu uma vaga aqui?" ao passar → chegada: **SIM, ESTÁ LIVRE / NÃO, ESTÁ OCUPADA / EU ESTACIONEI AQUI** → vaga vira 🔴 "confirmada há 5 s" → pontos, nível, precisão → **SAÍ DA VAGA** libera a vaga para os outros.

Se a vaga estiver ocupada na chegada, o app agradece, dá os pontos e já recalcula a próxima melhor opção.

## Ruas reais (OpenStreetMap)

O mapa usa as **ruas, prédios, parques, praias, litoral e estacionamentos reais do OpenStreetMap** ao redor do centro configurado. Ordem de carregamento (`src/world/cityStore.ts`):

1. **Snapshot do projeto** `public/osm/area.json`, se existir (gerado por `npm run import-osm`). Recomendado para produção: não depende do Overpass, carrega rápido e é igual para todos.
2. **Cache do aparelho**, válido por 7 dias.
3. **Overpass API ao vivo**, direto do navegador, com 3 servidores alternativos.
4. Se tudo falhar: **cidade fictícia de demonstração**, com aviso na tela.

O importador (`src/world/osm/`) gera:

- **Malha dirigida**: mão única respeitada (`oneway=yes/-1`, rotatórias) nas rotas e no trânsito simulado. Trechos fora da maior componente fortemente conexa não recebem vagas, então toda vaga sugerida tem ida e volta.
- **Ruas curvas** com vértices simplificados (Douglas-Peucker, 1,2 m) e largura por classe da via, `lanes` ou `width`.
- **Vagas de meio-fio** nas vias residenciais, terciárias, secundárias e primárias. As tags `parking:*` / `parking:lane:*` do OSM são respeitadas quando existem.
- **Prédios** extrudados da planta real, com altura por `height` ou `building:levels` e **estimada** quando o OSM não informa (comum no Brasil).
- **Estacionamentos** (`amenity=parking`) com nome e `capacity` reais quando existem. As vagas livres "ao vivo" desses estacionamentos são simuladas.
- **Zonas** (orla, centro, comercial, residencial) inferidas pela distância ao litoral/praia, pela densidade de comércio e por `landuse`.

Snapshot quando o Overpass não está acessível na sua rede:

```bash
npm run import-osm -- --print-query > consulta.overpassql   # cole em https://overpass-turbo.eu
npm run import-osm -- --from-file export.json               # JSON "raw" exportado de lá
```

A atribuição "© colaboradores do OpenStreetMap", exigida pela licença ODbL, aparece no mapa.

## Como a probabilidade é calculada (Índice de Confiança da Vaga)

`src/domain/confidence.ts` — puro, testado e explicável na interface ("Como calculamos").

1. **Prior histórico** por zona, hora e dia útil/fim de semana (`historical.ts`).
2. **Cadeia de Markov livre⇄ocupada** coerente com esse histórico: a permanência média por zona define a velocidade com que uma informação "envelhece" (centro ≈ 2–3 min, bairro residencial ≈ horas).
3. **Confirmações** entram por **Bayes**, ponderadas pela precisão de quem confirmou. "Estacionei" e "saí da vaga" reiniciam o estado.
4. A crença é **projetada até o momento estimado de chegada** do motorista.
5. Ajustes: dados ao vivo de estacionamentos, oferta de vagas no trecho, motoristas lentos por perto (concorrência), fluxo de veículos.
6. Probabilidade sempre entre **3% e 95%**: o app nunca diz "100% livre".

A **confiabilidade** é separada da probabilidade: frescor da última confirmação, volume de confirmações, qualidade do histórico da zona e usuários próximos. Cores: 🟢 ≥ 65% · 🟡 35–64% · 🔴 < 35% · ⚪ confiabilidade baixa (informação antiga).

**Melhor vaga** (`recommendation.ts`): minimiza o tempo esperado = direção + caminhada até o destino + (1 − P ajustada pela confiabilidade) × custo de ter que procurar outra.

## Arquitetura

```
src/
  components/
    map/        Map3D, City, Vehicle, ParkingSpot, ParkingSpotMarker, ParkingSpotsLayer,
                NavigationRoute, LocationIndicator, CameraRig, TrafficCars, ParkingLots,
                PointsOfInterest, Particles, shaders, geometries
    ui/         SearchBar, ConfidenceCard, BottomPanel, UserConfirmation, RewardSystem,
                UserProfile, Preview3D, NavigationControls, MapControls, DriverMode,
                SettingsPanel, TopBar
    splash/     SplashScreen
  domain/       confidence, historical, recommendation, rewards  (lógica pura + testes)
  world/        cityTypes (modelo de cidade), cityStore (carregamento), roadGraph (Dijkstra dirigido,
                rota, curvas suaves), osm/ (consulta Overpass, conversão, construção, fixture de teste),
                cityGenerator (cidade fictícia de reserva)
  simulation/   WorldSimulation (trânsito, verdade oculta, relatos de outros usuários)
  services/
    repository/   ParkingRepository → MockParkingRepository | HttpParkingRepository
    dataSources/  contrato ParkingDataSource + catálogo de fontes e suas limitações
    location/     GPS do navegador → coordenadas do mapa
    speech.ts     instruções por voz (Web Speech API)
  store/        appStore (useSyncExternalStore), cameraBus
  data/         mockSpots (vagas, estacionamentos, relatos iniciais)
```

### Conectar um backend real

1. Defina `VITE_API_URL`. `HttpParkingRepository` já chama `GET/PUT /me/profile` e `POST /reports`.
2. Substitua a leitura de vagas da `WorldSimulation` por `GET /spots?bbox=…` retornando `ParkingSpot[]` (mesmo formato de `src/types`). O Índice de Confiança roda igual no cliente ou no servidor.
3. A autenticação deve ser adicionada no `HttpParkingRepository` (nenhuma credencial fica no código).

### Fontes de dados (Configurações → Sistema de detecção)

Ativas na demonstração (simuladas): confirmações dos usuários e APIs de estacionamentos (contagem agregada). Preparadas, com as limitações reais documentadas: GPS (infere fluxo e "estacionou/saiu", **não vê vagas**), APIs de trânsito (velocidade das vias, **nenhuma API pública de mapas detecta vagas na rua**), sensores de solo e câmeras com visão computacional (só onde instalados, com LGPD).

## Performance

- Detecção de capacidade (núcleos, memória, GPU via `WEBGL_debug_renderer_info`, celular, movimento reduzido) → perfis Leve/Equilibrada/Máxima, ajustáveis em Configurações.
- Perfis reduzem prédios, carros estacionados, trânsito, partículas, estrelas, sombras, antialias e resolução; `PerformanceMonitor` baixa a resolução se o FPS cair.
- Prédios, ruas, carros e árvores são `InstancedMesh` (poucas draw calls); janelas são procedurais em shader (sem texturas).
- O bundle 3D (three + R3F + drei, ~258 kB gzip) é carregado com `React.lazy` **durante** a animação de abertura.

## Limitações honestas deste MVP

- **Qualidade do mapa = qualidade do OSM na região.** Alturas sem tag são estimadas, e sem tags `parking:*` as vagas de meio-fio vêm de uma heurística por tipo de via (pode marcar trechos onde estacionar é proibido).
- **O mar não é preenchido**: o OSM representa o oceano só como a linha de costa (desenhada em ciano), não como polígono.
- O download ao vivo do Overpass pesa alguns MB na primeira abertura e depende de um serviço público com limite de uso. Para produção, gere o snapshot.
- Vagas, ocupação, trânsito e outros usuários são **simulados**. A "precisão" do usuário é validada contra a verdade da simulação; em produção seria validação cruzada entre fontes.
- O carro do usuário é simulado (velocidade 1×/2×/4× em Configurações); o GPS real só posiciona o carro se você estiver dentro da área mapeada.
- O histórico de ocupação é uma tabela estimada, não dados medidos.
