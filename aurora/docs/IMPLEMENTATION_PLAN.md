# Aurora — Plano de implementação (especificação mestre)

Base: [PROJECT_AUDIT.md](PROJECT_AUDIT.md). Substitui [PROJECT_PLAN_V1.md](PROJECT_PLAN_V1.md).

> **Pendência:** a especificação mestre chegou cortada na seção 13 ("AI Provider and Cost Control"). Itens das seções 13
> em diante (custo de IA, provavelmente privacidade, testes e entrega) serão encaixados neste plano quando chegarem.

## Princípios

1. **Cada fase termina compilando, com testes verdes no CI e um APK instalável.** Nada de fases "meio feitas" no `main`.
2. **Lógica nova vai para o `core`** (JVM puro) e é testada localmente. O `app` só faz persistência, Android e UI.
3. **Um único modelo de dados compartilhado.** Uma nota ligada a um projeto é um registro só, visível nos dois lugares.
4. **Fatos × interpretações.** Tudo que a Aurora afirmar sobre o passado vem de registros (`CommitmentChange`,
   `FocusSession`, `HabitCheckIn`, status de tarefas). Sugestões da IA são marcadas como sugestões e exigem aprovação.
5. **Migrações explícitas e testadas.** Nunca `fallbackToDestructiveMigration`.

## Modelo de dados alvo (esquema Room v2)

Uma única migração 1 → 2 cria a base dos cinco pilares, para que as fases seguintes só construam telas e regras,
sem mexer no banco a cada passo. Revisões ficam para a v3, quando o formato do relatório estiver definido.

| Entidade | Campos principais | Relações |
|---|---|---|
| `Objective` | nome, descrição, motivo pessoal, resultado-alvo, prazo, prioridade, status, horas/semana | — |
| `Milestone` | título, prazo, status, ordem | `objectiveId` → Objective (CASCADE) |
| `Project` | nome, descrição, status | `objectiveId` → Objective (SET NULL) |
| `Task` (existente, ampliada) | + status (A fazer, Em andamento, Concluída, Adiada, Cancelada), duração estimada, duração real, `sourceNoteId` | `projectId`, `objectiveId`, `milestoneId` (SET NULL) |
| `CommitmentChange` | tipo (adiada, remarcada, cancelada, escopo reduzido, concluída), de → para, motivo, data | `taskId` (CASCADE) |
| `Reminder` (existente) | + vínculo opcional | `taskId` (SET NULL) |
| `FocusSession` | duração planejada, início, fim, pausas (ms), status, o que foi feito, obstáculo | `taskId`, `objectiveId` (SET NULL) |
| `Habit` | nome, descrição, frequência, agenda, meta, ativo/pausado | `objectiveId` (SET NULL) |
| `HabitCheckIn` | data, valor, observação; único por (hábito, dia) | `habitId` (CASCADE) |
| `KnowledgeNote` (substitui `notes`) | título, **conteúdo original**, versão editada, resumo da IA + status (pendente/aceito/rejeitado), tipo, fonte/URL, status de processamento (caixa de entrada/organizada/arquivada), capítulo | `bookId`, `projectId`, `objectiveId` (SET NULL) |
| `KnowledgeNoteFts` | índice FTS4 de título + original + editada | espelha `KnowledgeNote` |
| `Tag`, `NoteTagCrossRef` | nome único | N:N com notas |
| `KnowledgeLink` | nota ↔ nota, tipo de ligação | CASCADE nos dois lados |
| `Book` | título, autor, status de leitura, datas, tema, nota pessoal, resumo pessoal | — |
| `MemoryEntry` (existente) | fatos/preferências do usuário para a IA | mantida separada do Caderno |
| `ConversationMessage` (existente) | | |

Decisões para evitar duplicação:
- **"BookLearning"** não vira tabela: é uma `KnowledgeNote` do tipo "Aprendizado de livro" com `bookId` e capítulo.
- **"AgendaEntry"** não vira tabela: a agenda é composta de tarefas + lembretes + eventos lidos do calendário.
- **"AppSettings"** continua no DataStore.
- **"FocusPlan"**: o plano de um objetivo é o conjunto de marcos e tarefas vinculados a ele, sem tabela própria.
- Migração de `notes` → `knowledge_notes`: `content` vira o conteúdo original; tipo "Nota geral"; status "organizada".

## Fases

Tamanho relativo: P (≤ 3 rodadas de CI), M (4–8), G (> 8).

### Fase 0 — Validar o que já existe · P · **bloqueia todas as outras**
- Usuário instala o APK atual e segue o roteiro de [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).
- Corrigir falhas encontradas (especialmente: SDK da IA em execução, notificações, voz).
- **Verificação:** relatório do usuário com modelo do aparelho, versão do Android e resultado de cada item.

### Fase 1 — Fundação · G
1. Exportar e versionar o esquema Room v1 (`app/schemas/1.json`).
2. Job de CI com emulador para testes instrumentados (migração e DAOs).
3. Modelo de domínio novo no `core` + entidades/DAOs Room v2 + `Migration(1, 2)` + repositórios.
4. Tema claro e escuro (seguindo o sistema, com opção manual).
5. Nova navegação: **Início · Foco · Caderno · Projetos · Configurações**, com botão de captura sempre visível.
   Agenda, Tarefas e Lembretes passam a ser acessados a partir do Início e de Projetos.
6. Estado explícito de carregamento/vazio/sucesso/erro nos ViewModels.
- **Verificação:** teste de migração 1→2 com dados reais simulados passando no emulador; testes antigos verdes;
  APK abre, dados criados na versão anterior continuam lá (teste manual).

### Fase 2 — Tarefas, projetos e histórico de compromissos · M · depende da 1
- Status completos, duração estimada/real, vínculo com projeto/objetivo/marco.
- Todo adiamento, remarcação ou cancelamento grava `CommitmentChange` com motivo opcional.
- Filtros por projeto, prioridade e status; tela **Projetos** com tarefas e notas vinculadas.
- **Verificação:** testes no `core` para transições de status e registro de mudanças; testes de DAO no emulador.

### Fase 3 — Caderno Inteligente · G · depende da 1
- Captura rápida (texto, voz, **menu Compartilhar do Android**, link colado) com "capturar agora, organizar depois".
- Tipos, tags, fonte; original preservado, versão editada separada.
- Busca FTS4 + filtros (tipo, tag, livro, projeto, período).
- Biblioteca de livros e aprendizados por livro; ligações entre notas.
- **Verificação:** testes de busca FTS no emulador; teste de que editar não altera o original; compartilhar um texto
  de outro app cria uma nota (teste manual).

### Fase 4 — Modo Foco · G · depende da 2
- Objetivos e marcos (criar, editar, aprovar sugestões).
- Sessões de foco: iniciar/pausar/retomar/encerrar, baseadas em **horários gravados** (sem serviço em primeiro plano;
  notificação ao fim via alarme). Registro do que foi feito e de obstáculos.
- Coaching configurável (desligado / leve / firme-respeitoso, padrão firme). Frases sobre adiamento só com base em
  `CommitmentChange`. Notificação ignorada não conta como falha.
- **"Retomar o foco"**: revisa pendências reais, propõe um próximo passo e registra a decisão.
- **Verificação:** testes no `core` das regras de coaching (nunca citar adiamento sem registro); cálculo de tempo com
  pausas; teste manual do timer com o app fechado.

### Fase 5 — Hábitos · M · depende da 1
- Cadastro, frequência, check-in pelo app e por voz, histórico de consistência sem "sequência perdida".
- **Verificação:** testes de cálculo de consistência por frequência; check-in único por dia.

### Fase 6 — Central de Comando · M · depende de 2, 4 e 5
- Briefing diário (tela e, opcionalmente, voz) e painel do Início com objetivo principal, próxima ação, atrasadas,
  sessão de foco ativa, hábitos do dia, captura e "Retomar o foco".
- Revisão diária e semanal: seção **"Fatos registrados"** gerada localmente + seção **"Interpretação"** (IA, opcional).
- Migração 2→3 para guardar revisões.
- **Verificação:** testes de que o relatório só contém itens presentes no banco; teste de migração 2→3.

### Fase 7 — Assistente ampliado · G · depende de 2 a 6
- Novas ferramentas: projeto, objetivo, foco, hábito, briefing, revisões, "o que merece atenção agora",
  propor ajuste de plano (sempre com confirmação).
- Perguntas sobre o Caderno: busca local primeiro, resposta da IA **com referências às notas**; sem nota relevante,
  dizer isso.
- Procedência nas respostas: registro local / conversa atual / sugestão / precisa de busca externa.
- Sugestões da IA para notas (título, resumo, tags, ligações) com aceitar / editar / rejeitar.
- **Verificação:** testes de orquestrador com provedor simulado (nenhuma ação sem validação; nenhuma afirmação sobre
  o passado sem registro); teste com a API real quando houver chave.

### Fase 8 — Voz e acesso rápido · M · depende da 7
- Corrigir o texto reconhecido antes de enviar; opções de fala automática.
- Bloco de Configurações Rápidas e widget de captura.
- **Verificação:** teste manual em aparelho (documentado em `KNOWN_LIMITATIONS.md`).

### Fase 9 — Backup e restauração · M · depende da 6
- Importar o JSON exportado (com validação e prévia), backup manual em arquivo.
- **Verificação:** teste de ida e volta exportar → apagar → importar.

### Fase 10 — "Ei, Aurora" (protótipo) · G · só com aparelho físico
- Detector local (candidato: Vosk, Apache 2.0, offline) em serviço de primeiro plano iniciado pelo usuário, com
  notificação permanente e botão de parar. Medir bateria/CPU com tela desligada.
- **Verificação:** só será declarado funcional após teste no aparelho com a tela desligada e o app fora da tela.

## Dependências

```
Fase 0 ─► Fase 1 ─┬─► Fase 2 ─► Fase 4 ─┐
                  ├─► Fase 3 ───────────┼─► Fase 7 ─► Fase 8
                  └─► Fase 5 ───────────┤
                         Fase 2+4+5 ─► Fase 6 ─► Fase 9
Fase 10: independente, depois da Fase 8, e só com aparelho
```

## Riscos e respostas

| Risco | Resposta |
|---|---|
| Escopo grande demais para validar | Uma fase por vez, com APK ao fim de cada uma e teste do usuário |
| Migração quebrar dados | Esquema versionado + teste de migração no emulador antes de liberar o APK |
| Coaching virar acusação injusta | Regras no `core` com testes: só citar fatos registrados |
| IA inventar memória ou conteúdo de livro | Respostas do Caderno exigem notas recuperadas; sem notas → "não encontrei registro" |
| Custo de IA | Resolver com a seção 13 da especificação (pendente) |
| Interface sobrecarregada | Início com no máximo 5 blocos; o resto em telas próprias |
