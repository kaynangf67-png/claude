# Aurora — Plano do Projeto

Assistente pessoal nativo para Android, em português do Brasil, para uso pessoal (1 usuário).
Prioridades: confiabilidade, privacidade e custo operacional mínimo.

## Ambiente de desenvolvimento (inspecionado em 22/10/2026)

| Item | Situação |
|---|---|
| Repositório | Monorepo com projetos web (RecuperaAI, LiveFlow, KL Beauty, Unnica). Nenhum projeto Android existente. Aurora fica isolada em `aurora/`. |
| JDK | OpenJDK 21 |
| Gradle | 8.14.3 instalado; o projeto usa o wrapper 9.6.0 (mínimo exigido pelo AGP 9.4) |
| Android SDK | **Ausente.** `dl.google.com` é bloqueado pela política de rede do container. |
| Google Maven (`maven.google.com`) | **Bloqueado** (redireciona para `dl.google.com`). AGP e AndroidX não podem ser baixados aqui. |
| Maven Central / Gradle Plugin Portal | Disponíveis |

Consequência: o módulo `core` (Kotlin/JVM puro: domínio, parser de datas, orquestrador, provedor de IA)
é compilado e testado localmente. O módulo `app` (Android) é compilado e testado no GitHub Actions
(`.github/workflows/aurora-android.yml`), que também gera o APK de debug como artefato.

## Versões escolhidas (verificadas na documentação oficial em 22/10/2026)

| Componente | Versão | Fonte |
|---|---|---|
| Android Gradle Plugin | 9.4.0 (Kotlin embutido, Gradle ≥ 9.6, API máx. 37) | developer.android.com/build/releases/gradle-plugin |
| Kotlin | 2.3.21 | Maven Central (linha alinhada ao KSP 2.3.x) |
| KSP | 2.3.12 | Gradle Plugin Portal |
| Compose BOM | 2026.09.00 (UI 1.12.1, Material3 1.4.0) | developer.android.com/develop/ui/compose/bom/bom-mapping |
| Room | 2.8.5 | developer.android.com/jetpack/androidx/versions |
| DataStore | 1.3.0 | idem |
| WorkManager | 2.12.0 | idem |
| Activity / Lifecycle / Navigation / Core | 1.13.0 / 2.11.0 / 2.10.2 / 1.19.1 | idem |
| Anthropic Java SDK | 3.1.0 | Maven Central |
| compileSdk / targetSdk / minSdk | 36 / 36 / 26 | minSdk 26 por `java.time` e pelo SDK da Anthropic (Jackson) |

## Marcos

| # | Marco | Verificação |
|---|---|---|
| M0 | Inspeção, plano, documentação, esqueleto Gradle | Build do `core` local |
| M1 | Domínio: modelos, parser pt-BR de data/hora, recorrência, validação de ferramentas | Testes unitários locais |
| M2 | Orquestrador com intenções locais + ferramentas tipadas + planejador do dia | Testes unitários locais |
| M3 | Provedor de IA (interface + Anthropic), orçamento de gastos, tratamento de erros | Testes locais com MockWebServer |
| M4 | App Android: Room, DataStore, chave de API cifrada (Keystore), DI manual | CI: `assembleDebug` |
| M5 | Lembretes: AlarmManager (exato/inexato), notificações, boot/fuso/atualização | CI + teste manual em aparelho |
| M6 | Voz: SpeechRecognizer (pt-BR, on-device quando disponível) + TextToSpeech | Teste manual em aparelho |
| M7 | UI Compose: Início, Conversa, Agenda, Tarefas, Lembretes, Memória, Ajustes | CI + teste manual |
| M8 | Calendário (leitura via CalendarContract; criação via Intent com confirmação), abrir apps, compartilhar | Teste manual |
| M9 | Wake word: estudo de viabilidade + protótipo (ver ARCHITECTURE.md §Wake word) | **Somente aparelho físico** |

## O que exige ação manual do usuário

- **Aparelho Android físico** (Android 8.0+) para: microfone, TTS, notificações reais, alarmes exatos, wake word.
- **Chave de API da Anthropic** (console.anthropic.com) — colada em Ajustes › Provedor de IA. Nunca vai para o Git.
- **Permissões em tempo de execução:** microfone, notificações (Android 13+), alarmes exatos (Android 12+, tela de ajustes do sistema), calendário (opcional), contatos (futuro, opcional).
- **Liberar `dl.google.com`** na política de rede do ambiente, caso queira compilar o APK dentro deste container em vez do GitHub Actions.
- Baixar o pacote de voz pt-BR do mecanismo de TTS/reconhecimento se o aparelho não tiver.
