# Aurora — Status da implementação

Legenda: ✅ verificado · 🟡 implementado, não verificado em execução · ⏳ pendente · ❌ não planejado agora

Atualizado em 22/10/2026.

## Verificação

| O quê | Como | Resultado |
|---|---|---|
| `core` compila | `./gradlew -p core test` (local) | ✅ |
| Testes do `core` | 100 testes JUnit (parser, recorrência, fuso, orquestrador, validador, planejador, provedor) | ✅ 100/100 |
| `app` compila / APK de debug | GitHub Actions (`.github/workflows/aurora-android.yml`) | ver seção "CI" abaixo |
| Testes unitários do `app` | GitHub Actions | ver seção "CI" |
| Execução em emulador/aparelho | — | ⏳ não feito |

## Marcos

| # | Marco | Status |
|---|---|---|
| M0 | Inspeção, plano, docs, esqueleto Gradle | ✅ |
| M1 | Domínio: modelos, parser pt-BR, recorrência, validação | ✅ testado |
| M2 | Orquestrador, intenções locais, esclarecimento/confirmação, planejador | ✅ testado |
| M3 | Provedor de IA (Anthropic), orçamento, erros | ✅ testado com servidor simulado; 🟡 API real |
| M4 | Room, DataStore, chave cifrada (Keystore), DI | 🟡 |
| M5 | Lembretes: AlarmManager exato/inexato, notificação, ações, reagendamento | 🟡 |
| M6 | Voz: SpeechRecognizer + TTS | 🟡 |
| M7 | UI: Início, Conversa, Agenda, Tarefas, Lembretes, Memória, Ajustes | 🟡 |
| M8 | Calendário (leitura), abrir apps, compartilhar nota | 🟡 · criação de eventos ⏳ |
| M9 | Wake word | ⏳ estudo feito; protótipo pendente |

## Testes manuais necessários (aparelho físico)

1. Instalar o APK, abrir, conceder microfone, falar "me lembra daqui a 2 minutos de testar" → notificação chega.
2. Negar "Alarmes e lembretes" → criar lembrete → mensagem de alarme inexato aparece; aviso chega (talvez com atraso).
3. Reiniciar o aparelho com lembrete futuro → aviso continua chegando.
4. Modo avião → "quais são minhas tarefas de hoje?" funciona; pergunta livre → resposta de offline.
5. Salvar chave, escolher Haiku 5.5, perguntar algo livre → resposta e gasto estimado em Ajustes.
6. Fechar e reabrir o app → tarefas, lembretes, notas e conversa continuam lá.
7. Sem voz pt-BR instalada → aviso; sem permissão de microfone → banner e teclado funcionando.

## CI

Os resultados do CI são registrados aqui a cada rodada.
