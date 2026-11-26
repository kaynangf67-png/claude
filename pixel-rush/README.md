# PIXEL RUSH — Corrida Mundial

Jogo de plataforma 2D em pixel art, com câmera lateral, saltos de precisão e ranking mundial. Todo resultado que entra no ranking é recalculado pelo servidor a partir das entradas do jogador.

Simples de aprender (←/→ e pular), difícil de dominar (pulo com altura variável, pulo na parede, *coyote time*, *buffer* de pulo, gelo, molas, blocos que desmoronam).

## Rodar localmente

```bash
cd pixel-rush
npm install
npm start            # http://localhost:3000  (usa SQLite em data/pixelrush.db)
npm test             # 14 testes: física, fases, servidor, anti-trapaça, multiplayer
npm run verify-levels   # bot prova que as 20 fases são completáveis
```

Requer Node.js 22.13 ou mais novo, que já traz o SQLite embutido. Para usar PostgreSQL (produção, Supabase, Neon, RDS…):

```bash
DATABASE_URL=postgres://usuario:senha@host:5432/banco npm start
```

As tabelas são criadas automaticamente na primeira execução. Os testes também rodam contra Postgres:
`TEST_DATABASE_URL=postgres://... npm test` (atenção: o schema `public` desse banco é apagado a cada execução).

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | PostgreSQL. Sem ela, SQLite local (`SQLITE_FILE`, padrão `data/pixelrush.db`). |
| `PORT` | Porta HTTP (padrão 3000). |
| `TRUST_PROXY=1` | Usar `X-Forwarded-For` para limitar requisições por IP atrás de proxy. |
| `ADMIN_TOKEN` | Habilita `POST /api/admin/ban` (header `X-Admin-Token`) para banir trapaceiros. |
| `PG_POOL` | Tamanho do pool de conexões Postgres (padrão 10). |
| `DISABLE_RATE_LIMITS=1` | Só para desenvolvimento e testes automatizados. |

## O que tem no jogo

**Gameplay**
- Simulação de física com passo fixo de 60 Hz: aceleração, atrito, gravidade diferente na subida e na descida, pulo com controle de altura, pulo na parede e deslize, *coyote time* e *buffer* de pulo.
- Plataformas de vários tamanhos, plataformas atravessáveis, gelo, molas e blocos que desmoronam. Obstáculos móveis: plataformas, serras, lasers temporizados e canhões. Espinhos nas quatro direções.
- Checkpoints, morte com reinício quase instantâneo, `R` para recomeçar na hora (o token da próxima tentativa já fica pedido antes) e cronômetro com milissegundos.
- Teclado, controle (Gamepad API) e controles de toque no celular.

**Modo História** (`shared/levels.js`): 4 mundos com 5 fases cada (Prado Pixel, Cavernas de Cristal, Pico Gelado e Fortaleza de Magma). Cada mundo introduz obstáculos novos, e a 5ª fase é uma luta de chefe (Golem, Aranha, Yeti e o Dragão final), com padrões de ataque e uma 2ª fase mais agressiva. Uma fase só abre depois que a anterior foi concluída, e o servidor confere isso. Cada fase tem um tempo "par" e medalhas (bronze, prata, ouro e diamante).

**Modo Competitivo**
- Contra-relógio contra os fantasmas do recordista mundial e do seu próprio recorde. O fantasma é o replay real, re-simulado no seu navegador.
- Desafio Diário: um percurso gerado por dia, igual para o mundo todo.
- Evento Mundial semanal: um percurso difícil por semana. O TOP 25 recebe medalhas exclusivas e moedas.
- Corridas online (veja Multiplayer).

**Modo Infinito**: o mundo é gerado a partir de uma semente sorteada pelo servidor, e a dificuldade sobe a cada trecho. Uma parede de energia persegue o jogador e acelera com o tempo. A pontuação é a distância em metros.

**Multiplayer** (WebSocket): matchmaking por rating (2 a 4 jogadores), salas privadas com código, convites para amigos online, sistema de amizades, fantasmas dos rivais em tempo real, emotes e rating no estilo Elo.

**Rankings** (`server/rankings.js`): TOP 100 mundial, Brasil, por país, por continente, semanal, mensal (a temporada), histórico (campeões das temporadas e recordes de todos os tempos), velocidade por fase, distância, tempo total da História, diário, evento e corridas. O TOP 3 aparece com troféus de ouro, prata e bronze na tela inicial e no ranking. O perfil mostra nome, avatar, país e bandeira, pontuação, recordes, fases concluídas, tempo total de jogo, posição mundial, medalhas, conquistas e histórico de resultados.

**Temporadas** (`server/seasons.js`): cada mês é uma temporada. Quando ela acaba, o servidor distribui as recompensas por posição: troféus e medalhas, moedas, a moldura "Campeão Mundial" para o TOP 3 e a moldura "Elite" para o TOP 10. Uma linha de trava no banco garante que cada período só pague as recompensas uma vez.

**Personagem**: bonequinho 2D em pixel art, com duas skins gratuitas (Menino e Menina), escolhidas no cadastro e trocadas no Cofre.

**Interface**: a tela inicial mostra só os nomes no cantinho (Jogar, Evento, Ranking, Loja, Cofre, Perfil, Configurações); cada nome abre uma página própria.

**Loja e Cofre**: na Loja ficam de vitória, efeitos de pulo, trilhas, mascotes, emotes e molduras de perfil; o Cofre mostra suas moedas e os itens que você tem. Tudo é cosmético e nada altera a física. As moedas vêm das fases, de recordes, do Modo Infinito, de corridas, de conquistas e das temporadas, com limite diário para evitar "farm". Há 21 conquistas.

## Proteção contra trapaças

O cliente nunca informa o tempo nem a pontuação. O fluxo é este:

1. `POST /api/run/start`: o servidor cria um token de tentativa (e a semente, no Modo Infinito) e registra a hora.
2. O jogo grava a entrada de cada tick (←, →, pular) em RLE.
3. `POST /api/run/finish`: o servidor **re-simula a tentativa inteira** com o mesmo código de física (`shared/sim.js`) e calcula ele mesmo o tempo, as mortes, as moedas e a distância.
4. Uma tentativa é rejeitada quando:
   - as entradas não completam a fase;
   - o formato das entradas é inválido;
   - o tempo de relógio real desde o início é menor que o tempo simulado (detecta *speed hack* e resultados fabricados);
   - o token já foi usado, expirou ou pertence a outro jogador;
   - a fase ainda está bloqueada para aquele jogador.
5. Nas corridas, a colocação usa o tempo validado, não a ordem de chegada das mensagens.

A simulação usa apenas `+ − × ÷` em IEEE-754, sem `Math.sin` nem `Math.random`. Por isso navegador e servidor chegam exatamente ao mesmo resultado, e um teste confere isso. Os replays dos recordes ficam guardados e servem de fantasma, então qualquer recorde pode ser revisto. Também há limites de requisições por IP e por usuário, senhas com scrypt, sessões guardadas apenas como hash e CSP restritiva.

**Limite conhecido:** como em qualquer jogo de speedrun, um bot (TAS) que gera entradas perfeitas e espera o tempo real passar continua produzindo uma tentativa fisicamente válida. Para esses casos existem os replays públicos e o `POST /api/admin/ban`.

## Arquitetura

```
shared/   código usado no navegador E no servidor (física, fases, gerador, pontuação, itens)
server/   HTTP (API REST + arquivos estáticos), WebSocket, banco, rankings, temporadas
public/   cliente: canvas 384x216 ampliado sem suavização, sprites gerados por código, áudio WebAudio
tools/    bot de busca (beam search) que prova que as fases são completáveis
test/     node:test (rodam em SQLite e em Postgres)
```

O cliente não tem etapa de build: são ES modules servidos diretamente.

**Escala:** a API HTTP não guarda estado (sessão no banco) e escala horizontalmente atrás de um balanceador. Os rankings usam índices dedicados e cache de 10 s, e as tabelas `bests` e `users.total_score` evitam varrer todas as tentativas para o ranking histórico. As salas de corrida ficam na memória de cada instância. Com mais de uma instância, use *sticky sessions* no `/ws` ou troque o estado das salas por Redis.

## Deploy

O servidor precisa de um processo Node persistente, porque usa WebSocket. Funções serverless (o `vercel.json` da raiz do repositório) não servem para ele.

- **Docker**: `docker build -t pixel-rush . && docker run -p 3000:3000 -e DATABASE_URL=... pixel-rush`
- **Render**: o `render.yaml` já está pronto. Basta informar `DATABASE_URL`.
- **Banco**: qualquer PostgreSQL. No Supabase, use a *connection string* (Session pooler ou conexão direta) em `DATABASE_URL`.
