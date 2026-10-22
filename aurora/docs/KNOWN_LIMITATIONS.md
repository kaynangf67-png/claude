# Aurora — Limitações conhecidas

Registro honesto do que **não** funciona, do que **não foi verificado** e do porquê.

## Ambiente de desenvolvimento

- O container de desenvolvimento não acessa `dl.google.com` nem `maven.google.com` (política de rede).
  Por isso o módulo `app` **não é compilado localmente**: ele é compilado no GitHub Actions.
  O módulo `core` é compilado e testado localmente (100 testes).
- Nenhum teste foi feito em emulador ou aparelho físico. Tudo o que depende do Android em tempo de execução
  (voz, TTS, notificações, alarmes, Room no aparelho, calendário) está **implementado, mas não verificado em execução**.

## Wake word ("Ei, Aurora")

- **Não implementado.** Status: estudo de viabilidade concluído (ver ARCHITECTURE.md), protótipo pendente.
- Restrições confirmadas na documentação oficial do Android:
  - serviço em primeiro plano de microfone não pode ser criado com o app em segundo plano (Android 14+), nem após reiniciar;
  - escuta contínua exige notificação persistente e inicialização pelo usuário;
  - `SpeechRecognizer` não é adequado como detector contínuo.
- O Picovoice Porcupine exige validação online da chave, e há relatos de que o plano gratuito terminou em 30/06/2026
  (informação conflitante com a página oficial de preços). Não é usado.
- Alternativas disponíveis hoje: atalho do launcher "Falar" (toque longo no ícone), intent `ACTION_ASSIST`
  (a Aurora pode aparecer como opção de assistente em alguns aparelhos — **não verificado**), botão na tela inicial.
- Escolher a Aurora como "app de assistente" **não** cria uma frase de ativação personalizada.
- Nenhum teste de bateria/CPU, nem com tela desligada, foi feito. O recurso não deve ser chamado de "funcionando" antes disso.

## Lembretes

- Sem a permissão "Alarmes e lembretes" (Android 12+; não concedida por padrão no Android 14+), o alarme é inexato
  e pode atrasar. O app avisa ao criar o lembrete e mostra um banner com atalho para a permissão.
- Fabricantes com economia de bateria agressiva (Xiaomi, Samsung, etc.) podem atrasar ou bloquear alarmes mesmo
  com permissão. Não testado.
- Lembretes únicos guardam um instante absoluto. Se você mudar de fuso, "9h" vira o horário equivalente no novo fuso.
  Lembretes recorrentes mantêm o horário local (9h continua 9h).
- "Adiar 10 min" em lembrete recorrente cria só um aviso extra que **não sobrevive** a reinício do aparelho.
- Alarmes somem com "Forçar parada"; são recriados na próxima vez que o app abrir.

## Voz

- Reconhecimento depende do serviço instalado no aparelho (normalmente Google). Muitos aparelhos exigem internet;
  o reconhecimento no aparelho só é usado se disponível e com pacote pt-BR (com fallback automático).
- TTS depende de uma voz em português instalada; sem ela, as respostas aparecem só em texto (o app avisa).

## IA

- Provedor implementado: Anthropic (Claude), via SDK Java oficial 3.1.0. A interface `AssistantProvider` permite outros,
  mas nenhum outro foi implementado.
- Chamada real à API **não testada** (não há chave no ambiente). Testado contra servidor HTTP simulado (MockWebServer).
- O SDK 3.x envia a chave como `Authorization: Bearer`. Assumido como suportado pela API; não verificado contra a API real.
- O SDK (Jackson, OkHttp, Kotlin reflect) aumenta o APK e **não foi validado em tempo de execução no Android**.
  Se houver incompatibilidade, a alternativa é um cliente HTTP mínimo próprio.
- Custos são **estimativas** (tokens retornados × tabela de preços de 10/2026). A fatura oficial é a do console da Anthropic.
- Modelo padrão: Claude Opus 5.5 (o mais capaz). Para custo mínimo, troque para Haiku 5.5 em Ajustes (~40× mais barato por token).
- Chave guardada no aparelho (cifrada com Keystore): adequada para uso pessoal. Em APK distribuído a terceiros, qualquer
  chave embarcada pode ser extraída — usar backend próprio nesse caso.

## Interpretação de linguagem local

- O parser local cobre as frases mais comuns, não todas. Exemplos não cobertos: "semana que vem" sem dia, "fim de semana",
  "daqui a uma hora e meia", números por extenso acima de 59.
- Horas sem período ("às nove") são deduzidas (7–11 manhã, 1–6 tarde) e o horário interpretado é sempre mostrado.
- "as duas camisas" pode ser lido como horário ("às duas"). Mitigação: a confirmação mostra o horário entendido.

## Integrações

- Calendário: somente leitura. Criação de eventos no calendário ainda não implementada.
- Contatos, mensagens, chamadas: não implementados (de propósito, por segurança).
- Busca na web: não implementada.

## Distribuição

- Só APK de debug. Sem assinatura de release, sem minificação (R8) validada, sem revisão de políticas da Play Store.
