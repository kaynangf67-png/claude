# VagaAqui v2 — vai ter vaga quando você chegar?

MVP de micro SaaS para motoristas. Você digita o destino e, em segundos, o app responde: **"Chance de vaga quando você chegar (em 14 min): ALTA 70–85%"**. Junto vêm os **3 melhores quarteirões** a pé do destino, um **estacionamento como plano B** e o botão **IR** (abre o Waze ou o Google Maps).

Feito do zero, simples e rápido: mapa 2D (MapLibre), app instalável pelo navegador (PWA), sem 3D e sem navegação própria.

## Como funciona

1. **Abre na sua localização** (GPS contínuo). A busca aparece em ~0,3 s.
2. **Para onde você vai?** Busca de endereço (Photon/OSM), favoritos Casa/Trabalho e o botão "Vagas aqui perto".
3. **Previsão para a hora da chegada** (agora + tempo de viagem), por **trecho de rua** (quarteirão), nunca por vaga individual.
4. **Lista as 3 melhores ruas diferentes**, ordenadas por *menor tempo total esperado* = caminhada + (1 − chance) × 8 min rodando procurando.
5. **Mostra de onde vem o número**: "12 relatos recentes (o mais novo há 3 min) + histórico do horário". Sem dados, aparece o selo **estimativa**.
6. **Chegou** (GPS a até 150 m do destino): **"Achou vaga?" → SIM, NA RUA / NÃO, LOTADO / FUI PARA ESTACIONAMENTO**.
7. **Foi embora**: **ESTOU SAINDO DA VAGA** libera a vaga para quem está chegando. É o dado mais valioso do app.

### De onde vêm os dados
| Fonte | Peso | Situação neste MVP |
|---|---|---|
| Relatos recentes (achei / lotado / saindo) | alto, decai com meia-vida de 6–15 min | ✅ no aparelho; compartilhado com Supabase |
| Detecção automática de estacionar/sair (opt-in) | 60% de um relato manual | ✅ testada com trajetos simulados, não em carro real |
| Histórico por hora × dia × tipo de área | equivale a 1 relato | ⚠️ **estimativa inicial**: precisa ser calibrada com o piloto |
| Ruas, proibição de estacionar, Zona Azul, estacionamentos | — | ✅ OpenStreetMap (qualidade varia por cidade) |
| Comércio/serviços perto da rua (define rua comercial) | — | ✅ OpenStreetMap |

### Modelo (`src/model/forecast.ts`)
- **Chance do trecho**: média ponderada entre o histórico do horário e cada relato. O peso de um relato é `confiança × 0,5^(idade na chegada / meia-vida)`.
- **Limites**: entre 3% e 95%, nunca "garantido".
- **Faixa**: larga quando só há histórico, estreita com relatos frescos.
- **Histórico** (`src/model/prior.ts`): curva de ocupação por hora para área comercial, residencial ou mista. A chance de ter ≥1 vaga é `1 − ocupação^(vagas^0,4)`. O expoente é conservador porque vagas vizinhas enchem juntas.
- **Chance do destino**: combina os 3 melhores trechos, descontando que eles não são independentes.

## Planos (micro SaaS)
- **Grátis:** previsão, relatos, rota, 2 favoritos, "estou saindo da vaga".
- **Pro** (preço configurável, padrão R$ 9,90/mês):
  - previsão para outro horário e a hora de sair;
  - favoritos ilimitados;
  - "Onde deixei o carro?" com rota a pé;
  - sem anúncios.
- **Incentivo para relatar:** a cada **3 relatos, +1 dia de Pro**. É assim que o app resolve a falta de dados no começo.
- **Pagamento:** com `VITE_CHECKOUT_URL`, o botão abre o checkout (Asaas, Mercado Pago ou Stripe). Sem ele, o botão registra **interesse na lista de espera**, para medir quem pagaria antes de cobrar.
- **A cobrança em si ainda não existe.** Ela depende do webhook do gateway preencher a tabela `subscriptions`. Hoje o "Pro" vem só dos dias ganhos por relatos.

## Privacidade (LGPD)
- **Não mostra a localização de outros motoristas.**
- A detecção automática roda no aparelho e envia só o evento (estacionou ou saiu) e o trecho da rua. A trilha de GPS nunca sai do celular.
- O servidor expõe só os relatos das últimas 3 horas.
- **Apagar meus dados** fica em Configurações e também apaga no servidor (`delete_my_data`).

## Rodar
```bash
npm install
cp .env.example .env.local   # opcional
npm run dev                  # http://localhost:5173
npm test                     # testes unitários
npm run build                # gera dist/
```
**Sem configurar nada**, o app funciona com:
- ruas reais do OpenStreetMap;
- relatos guardados só no aparelho;
- relatos **simulados** para demonstração, avisados na tela e desligáveis em Configurações.

### Supabase (relatos compartilhados + login)
1. Crie um projeto e rode `supabase/migrations/001_init.sql` no SQL Editor.
2. Ponha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente.
3. **Para o login com Google:** ative o provedor Google em Authentication e adicione a URL do app em Redirect URLs.
4. Painel do piloto: `select * from metrics_overview;` (só o dono do banco consegue ver).

## Piloto: o que medir
Lance em **um bairro**, com 50–100 motoristas convidados. Sem densidade de usuários, não existe "tempo real".

O app registra (Menu → Painel do piloto; no servidor, `metrics_overview`):
- **acerto da previsão** e **Brier** (erro da chance: 0 = perfeito, 0,25 = chute), a partir da pergunta de chegada;
- **tempo do abrir até a resposta**;
- **relatos por semana**;
- **navegações**;
- **interesse no Pro**.

**Calibração:** depois de ~200 respostas de chegada, ajuste as curvas de `prior.ts` e as constantes de `MODEL` até o Brier cair.

## Desempenho (medido em Chromium sem GPU, celular 390×844)
- **Busca na tela:** ~0,3 s.
- **Cálculo da previsão:** ~50 ms, a partir de ruas em cache.
- **Tamanho do download (gzip):**
  - app: 85 kB, dentro da meta de 150 kB;
  - MapLibre: 281 kB, carregado em paralelo enquanto a busca já funciona;
  - worker do mapa: 511 kB sem compressão.

## Testes
- **Unitários (37)** cobrem:
  - modelo: decaimento, projeção para a chegada, limites 3–95%, ranking, ruas diferentes;
  - histórico;
  - detector de estacionar: semáforo, ficar no carro, ônibus, leituras imprecisas;
  - conversão do OSM em trechos;
  - perfil comercial;
  - plano Pro;
  - métricas;
  - links do Waze e Google.
- **Ponta a ponta (Playwright, celular e desktop):** busca → previsão → Waze → recurso Pro bloqueado → lista de espera → favorito → chegada pelo GPS → "Sim, na rua" → "Estou saindo da vaga" → os relatos mudam a próxima previsão → "Vagas aqui perto" → painel. Ruas e busca vêm de fixtures; mapa de fundo bloqueado (testa o modo reserva).
- **SQL**, testado em Postgres 16 local, com papéis e `auth.uid()` imitando o Supabase:
  - migração idempotente;
  - tipo inválido recusado;
  - horário do servidor;
  - leitura só das últimas 3 h;
  - limite de 20 relatos por 10 min;
  - anônimo não lê eventos nem o painel;
  - apagar meus dados.

## Limitações (sem rodeio)
- **O app não vê vagas.** A previsão é tão boa quanto os relatos. Com poucos usuários, é praticamente só o histórico estimado, e a tela diz isso.
- **As curvas de ocupação são palpites razoáveis**, não dados medidos. Calibre no piloto.
- **Não foram testados contra servidores reais:**
  - o login com Google e o Supabase pela internet (o SQL foi testado localmente, o cliente REST não);
  - o OpenRouteService;
  - o mapa de fundo da OpenFreeMap (a rede de teste bloqueia esses serviços).
- **Photon e Overpass públicos têm limite de uso.** Com volume, hospede os seus.
- **Push** (avisar "saia agora" com o app fechado) não está no MVP. Hoje o aviso aparece só com o app aberto.
