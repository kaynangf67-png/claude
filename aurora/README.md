# Aurora — assistente pessoal para Android

App nativo (Kotlin + Jetpack Compose) de assistente pessoal por voz, em português do Brasil, para uso pessoal.
Cuida de tarefas, lembretes, notas, memória e agenda **localmente**, e usa IA (Anthropic Claude) só quando você
configura uma chave e o pedido não pode ser resolvido no aparelho.

> Status: em desenvolvimento. Veja [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) e
> [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) antes de confiar em qualquer recurso.

## O que ela faz

- **Voz**: toque no orbe e fale. Ex.: "me lembra amanhã às 9h de ligar pro dentista", "quais são minhas tarefas de hoje?",
  "adia isso para sexta-feira", "anota essa ideia", "organiza meu dia de amanhã", "marca uma tarefa recorrente toda segunda-feira".
- **Tarefas** com prioridade, prazo, hora e repetição; concluir, adiar, excluir (com confirmação).
- **Lembretes** com notificação, "Adiar 10 min", repetição e reagendamento após reiniciar o aparelho.
- **Agenda** do dia e da semana, com eventos do calendário (opcional, somente leitura) e plano do dia sugerido.
- **Memória e notas**: só guarda o que você pede; busca, edição e exclusão individual.
- **Ajustes**: voz, velocidade, volume, modelo de IA, limite de gastos, exportar/apagar dados, permissões.

## Pré-requisitos

- Android Studio (versão recente com suporte ao AGP 9.4) **ou** JDK 17+ e Android SDK (API 36) na linha de comando.
- Aparelho Android 8.0 (API 26) ou superior.
- Opcional: chave de API da Anthropic (console.anthropic.com).

## Compilar e instalar

```bash
cd aurora
./gradlew -p core test          # testes do domínio (não precisa de Android SDK)
./gradlew :app:assembleDebug    # gera o APK
./gradlew :app:installDebug     # instala no aparelho conectado (depuração USB ativa)
```

APK gerado em `aurora/app/build/outputs/apk/debug/app-debug.apk`.

Sem Android SDK local: cada push na pasta `aurora/` roda o workflow **Aurora Android** no GitHub Actions, que
compila, testa e publica o artefato **aurora-debug-apk** (aba Actions → execução → Artifacts).

## Configurar a IA

1. Crie uma chave em console.anthropic.com.
2. No app: **Ajustes › Inteligência artificial**, cole a chave e toque em *Salvar chave*.
3. Escolha o modelo e o limite mensal em US$.

A chave é cifrada com o Android Keystore e fica só no aparelho. Ela **nunca** deve ir para o código, Gradle ou Git.
Para uso pessoal isso basta; se for distribuir o app para outras pessoas, use um backend próprio para guardar a chave.

### Custos (preços de 10/2026, por milhão de tokens: entrada/saída)

| Modelo | Preço | Observação |
|---|---|---|
| Claude Opus 5.5 | US$ 4 / 20 | padrão; mais capaz |
| Claude Sonnet 5.5 | US$ 2 / 10 | |
| Claude Haiku 5.5 | US$ 0,10 / 0,50 | mais barato |

Pedidos comuns (lembretes, tarefas, notas, agenda, plano do dia) são resolvidos no aparelho e **não custam nada**.
O app estima o gasto do mês e bloqueia novas chamadas ao atingir o limite (padrão US$ 5).

## Permissões

| Permissão | Para quê | Quando é pedida |
|---|---|---|
| Microfone | ouvir comandos | ao tocar no microfone |
| Notificações | avisar lembretes | ao usar lembretes (Android 13+) |
| Alarmes e lembretes | aviso no minuto exato | opcional, pela tela de Lembretes/Ajustes |
| Calendário (leitura) | mostrar eventos na agenda | opcional |
| Internet | IA (opcional) | não é pedida ao usuário |

## Privacidade

- Tarefas, lembretes, notas, memória e conversa ficam no banco local do aparelho. Backup em nuvem desativado.
- Nenhum áudio é gravado. O reconhecimento usa o serviço do sistema (no aparelho quando disponível).
- Para a IA vão só: o pedido, as últimas mensagens, um resumo da agenda de hoje e memórias relacionadas.
- Sem analytics e sem servidor próprio. Único serviço externo: `api.anthropic.com` (opcional).
- Exportação em JSON e exclusão total em Ajustes.

## Estrutura

Veja [ARCHITECTURE.md](ARCHITECTURE.md) e [PROJECT_PLAN.md](PROJECT_PLAN.md).

## Limitações principais

- A ativação por "Ei, Aurora" ainda **não existe** (estudo de viabilidade feito; ver KNOWN_LIMITATIONS.md).
- Nada foi testado ainda em aparelho físico.
- Apenas APK de debug; não está pronto para a Play Store.
