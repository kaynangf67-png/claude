# Aurora — Auditoria do projeto

Data: 22/10/2026 · Commit auditado: `bd9a89b` (branch `claude/aurora-android-assistant-38bjve`)
Referência: "AURORA — MASTER PROJECT SPECIFICATION" (seções 1–12 recebidas; a seção 13 chegou incompleta).

Legenda: ✅ verificado por teste/CI · 🟡 implementado e compilando, **nunca executado em aparelho** · ⚠️ parcial ou divergente da especificação · ❌ inexistente

---

## 1. Contexto do repositório

- Monorepo com projetos web sem relação com a Aurora (RecuperaAI, LiveFlow, KL Beauty, Unnica). A Aurora fica isolada em `aurora/`.
- Único workflow de CI: `.github/workflows/aurora-android.yml` (dispara só com mudanças em `aurora/**`).
- Ambiente de desenvolvimento: sem acesso a `dl.google.com` / `maven.google.com`. O módulo `app` só compila no GitHub Actions.
  O módulo `core` compila e é testado localmente.

## 2. Stack e configuração

| Item | Valor |
|---|---|
| Linguagem / UI | Kotlin 2.3.21, Jetpack Compose (BOM 2026.09.00), Material 3 1.4 |
| Build | Gradle 9.6.0, AGP 9.4.0 (Kotlin embutido), KSP 2.3.12 |
| SDK | compileSdk 37, targetSdk 36, minSdk 26 |
| Persistência | Room 2.8.5 (versão de esquema 1), DataStore 1.3.0 |
| Background | AlarmManager, WorkManager 2.12.0 |
| IA | SDK Java oficial da Anthropic 3.1.0 |
| DI | Manual (`AppContainer`) |
| Módulos | `core` (Kotlin/JVM puro, build incluída) e `app` (Android) |

Pontos de entrada: `AuroraApp` (Application), `MainActivity` (launcher, `ACTION_ASSIST`, atalhos "Falar"/"Nova tarefa"),
`ReminderReceiver`, `ReminderActionReceiver`, `RescheduleReceiver` + `RescheduleWorker`.

Permissões: `RECORD_AUDIO`, `INTERNET`, `ACCESS_NETWORK_STATE`, `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`,
`RECEIVE_BOOT_COMPLETED`, `READ_CALENDAR`. Todas pedidas no momento do uso, exceto rede.

## 3. Estado de verificação

| Verificação | Resultado |
|---|---|
| Testes do `core` (local, reexecutados do zero na data acima) | ✅ 100/100 |
| CI run #5 (commit `bd9a89b`): testes core + app, `assembleDebug`, `lintDebug` | ✅ |
| Testes unitários do `app` | ✅ 5 (só mapeadores e busca) |
| Testes instrumentados / de UI | ❌ nenhum |
| Execução em emulador ou aparelho | ❌ nunca |
| Chamada real à API da Anthropic | ❌ nunca (só servidor simulado) |
| Lint: avisos | não revisados (só erros bloqueiam) |

**Conclusão:** o projeto compila e a lógica de domínio é confiável dentro do que os testes cobrem. Nada que dependa
do Android em tempo de execução está comprovado.

## 4. O que existe, comparado com a especificação

### 4.1 Assistente pessoal (spec §5)

| Requisito | Estado | Observação |
|---|---|---|
| Camada única de orquestração | ✅ | `AssistantOrchestrator`: local → esclarecimento/confirmação → IA |
| Validação de argumentos antes de executar | ✅ | `ToolValidator`; sem código, SQL, shell ou intents livres |
| Confirmação para ações destrutivas | ✅ | excluir tarefa, cancelar lembrete, gravar memória proposta pela IA |
| Intents de tarefa, lembrete, agenda, nota, memória, plano do dia, abrir app | ✅ | 16 ferramentas |
| Objetivos, projetos, sessões de foco, hábitos, briefing, revisões, "o que fazer agora" | ❌ | não existem no domínio |
| Distinguir registro local / conversa / sugestão da IA / suposição | ⚠️ | prompt proíbe inventar ações; **não há marcação de procedência nas respostas** |
| Tom configurável (coaching) | ❌ | |

### 4.2 Voz (spec §6)

| Requisito | Estado |
|---|---|
| Botão de microfone, permissão no momento do uso | 🟡 |
| Reconhecimento pt-BR, on-device quando disponível, fallback de idioma | 🟡 |
| Mostrar texto reconhecido (parcial) | 🟡 |
| **Corrigir o texto antes de enviar** | ❌ hoje envia direto |
| Mesma orquestração para voz e texto | ✅ |
| TTS interrompível; velocidade, volume, voz | 🟡 |
| Erros: permissão, serviço ausente, rede, idioma | 🟡 |
| Wake word "Ei, Aurora" | ❌ só estudo de viabilidade (ver `KNOWN_LIMITATIONS.md`) |
| Alternativas: atalho de launcher, `ACTION_ASSIST` | 🟡 · bloco de Configurações Rápidas ❌ · widget ❌ |

### 4.3 Agenda, tarefas e lembretes (spec §7)

| Requisito | Estado | Observação |
|---|---|---|
| Título, descrição, prioridade, prazo (data ou data+hora), recorrência | ✅ domínio · 🟡 UI | |
| Status | ⚠️ | só `PENDING` / `COMPLETED`; faltam Em andamento, Adiada, Cancelada |
| Duração estimada e real | ❌ | |
| Vínculo com projeto/objetivo | ❌ | |
| Motivo do adiamento / histórico de mudanças | ❌ | adiar sobrescreve o prazo sem registro |
| Agenda do dia e da semana, atrasadas | 🟡 | |
| Filtros por projeto/prioridade/status | ⚠️ | só pendentes / atrasadas / concluídas |
| Separação eventos de calendário × tarefas | 🟡 | calendário só leitura, com permissão explicada |
| Lembretes: exato/inexato, notificação, adiar/concluir, reboot, fuso | 🟡 | |
| Comportamento de notificação escolhido pelo usuário | ❌ | um único canal |

### 4.4 Modo Foco (spec §8) — ❌ inexistente

Nenhuma entidade, tela ou ferramenta: objetivos, marcos, sessões de foco, intensidade de coaching, "Retomar o foco".
O único reaproveitável é o `DailyPlanner` (intervalos livres + sugestões sem alterar compromissos).

### 4.5 Caderno Inteligente (spec §9)

| Requisito | Estado | Observação |
|---|---|---|
| Captura por texto e voz | 🟡 | nota com título + conteúdo |
| Captura pelo menu Compartilhar do Android | ❌ | sem `ACTION_SEND` no manifesto |
| Tipos de nota, tags, fonte, status de processamento | ❌ | |
| Original × versão editada × resumo da IA | ❌ | editar sobrescreve o original |
| Livros, aprendizados, links entre notas | ❌ | |
| Busca de texto completo (FTS) | ⚠️ | busca linear por palavras, sem FTS e sem filtros |
| Respostas da IA com referência às notas | ❌ | |
| "Memória" (fatos/preferências do usuário) | 🟡 | entidade separada, aprovada pelo usuário |

### 4.6 Central de Comando (spec §10)

| Requisito | Estado |
|---|---|
| Tela inicial: data, resumo do dia, próximo lembrete, tarefas pendentes, captura | 🟡 |
| Briefing diário falado, objetivo principal, próxima ação, "Retomar o foco" | ❌ |
| Revisão diária e semanal factual | ❌ |

### 4.7 Hábitos (spec §11) — ❌ inexistente

### 4.8 Privacidade e confiabilidade

| Requisito | Estado |
|---|---|
| Dados locais, backup em nuvem desativado | 🟡 |
| Exportar JSON, apagar conversa/memória/tudo | 🟡 |
| **Importar / restaurar backup** | ❌ |
| Chave da IA cifrada (Keystore), nunca no código | 🟡 |
| Limite mensal de gastos com IA, modo offline honesto | ✅ |
| Contexto mínimo enviado à IA | ✅ |

### 4.9 Design (spec §4)

| Requisito | Estado |
|---|---|
| pt-BR em toda a UI | ✅ |
| **Tema claro e escuro** | ❌ só escuro |
| Navegação Início / Foco / Caderno / Projetos / Configurações | ⚠️ hoje: Início / Agenda / Tarefas / Lembretes / Memória (+ Ajustes) |
| Ação de captura sempre acessível | ⚠️ só no Início e na Conversa |
| Estados de carregamento / vazio / erro | ⚠️ vazio e erro sim; carregamento quase não tratado |
| Sem métricas ou ações falsas | ✅ |
| Layouts para telas grandes | ⚠️ não planejado nem testado |

## 5. Arquitetura: o que está bom e o que deve mudar

**Manter:**
- Separação `core` (JVM puro, testável sem Android) × `app`. É o maior ativo do projeto: permite testar regras de foco,
  revisões e coaching em segundos, sem emulador.
- Orquestrador com ferramentas tipadas e validação; provedor de IA atrás de interface; DI manual (ainda suficiente).
- Toda ação da UI passando pelo `ToolExecutor`, para que voz e toque sigam as mesmas regras.

**Problemas a corrigir antes de crescer:**
1. **Esquema Room não versionado** (`app/schemas` não está no repositório). Sem o esquema da v1 salvo não há como
   testar migrações. Precisa ser o primeiro passo da nova fase de dados.
2. **Sem chaves estrangeiras nem relacionamentos.** O modelo atual não suporta projeto/objetivo/nota ligados.
3. **Sem testes de migração nem testes instrumentados.** A spec exige migrações seguras; isso pede emulador no CI.
4. **Pacotes do `app` organizados por camada técnica** (`data`, `ui`, `reminders`). Com 5 pilares, a organização deve
   passar a ser por funcionalidade (`focus`, `knowledge`, `habits`, `reviews`…), mantendo `core` para o domínio.
5. **`ToolExecutor` é um arquivo único de ~450 linhas.** Com ~15 novas ferramentas ele vira um gargalo; dividir por área.
6. **Estado de carregamento não modelado nos ViewModels.** Usam valores iniciais vazios, o que confunde "carregando"
   com "vazio".

## 6. Riscos

| Risco | Impacto | Mitigação proposta |
|---|---|---|
| **Escopo**: a nova especificação é várias vezes maior que a v1 | Alto | Fases pequenas, cada uma verificável no CI e entregue em APK |
| **Nada testado em aparelho** | Alto | Validar o APK atual antes da fase de dados; teste em aparelho ao fim de cada fase |
| Migração de banco com dados reais do usuário | Alto | Esquema versionado + testes de migração no emulador do CI |
| SDK da Anthropic em execução no Android | Médio | Validar na Fase 0; plano B: cliente HTTP mínimo |
| Custo da IA (modelo padrão Opus 5.5) | Médio | Revisar com a seção 13 da spec; padrão mais barato |
| Ciclo de feedback lento (~5 min por rodada de CI) | Médio | Máximo de lógica no `core`, testado localmente |
| Wake word | Médio | Restrições do Android confirmadas; tratar como protótipo isolado, só com aparelho |
