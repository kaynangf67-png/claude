# Checklist de lançamento — Pele em Foco

Estado em 20/10/2026. Ordem = prioridade dentro de cada grupo.

## 1. Funcionando e testado

| Item | Como foi testado |
|---|---|
| Build de produção e typecheck (`npm run build`) | Sem erros |
| Lógica: rotina, progresso, sequência de dias, datas, armazenamento local (incluindo JSON corrompido e navegador bloqueando), status do bônus, config pendente, regras de produtos e artigos | `npm test` — 14 testes passando |
| Página de vendas sem rolagem horizontal, imagens carregando, CTA desativado sem checkout | `npm run test:e2e` em 390px e 1366px |
| Links internos: `/obrigado`, `/privacidade`, `/termos`, 404 | e2e |
| Redirecionamento do app para onboarding; aceite obrigatório do aviso educativo; criação de rotina pelas preferências | e2e |
| Persistência do checklist após recarregar; personalizar (adicionar, desativar, remover passo) | e2e |
| Diário: hábitos, observações, etiquetas, nota, histórico, troca de dia | e2e |
| Biblioteca com filtro, artigo com fontes externas, 404 de artigo, guia de produtos | e2e |
| Navegação inferior (mobile) e superior (desktop) | e2e |
| Exportar dados (download JSON) e apagar tudo (chave removida do `localStorage`) | e2e |
| Sem erros no console | e2e |
| Modo configurado: preço, link do checkout, data do bônus; aviso de bônus encerrado no app | Build com variáveis de teste + verificação no navegador |
| PDF: 53 páginas, sumário com páginas reais, marcadores, capa sem margem | Gerado, aberto com pypdf/pdfinfo e todas as páginas inspecionadas como imagem |

## 2. Implementado, mas não totalmente testado

- [ ] Leitura do PDF em celulares reais (iOS/Android) e impressão física do registro de 30 dias.
- [ ] App em Safari iOS e Firefox (testado só no Chromium).
- [ ] Teclado e leitor de tela: estrutura semântica e rótulos ARIA foram feitos, mas não houve teste com VoiceOver/TalkBack.
- [ ] Páginas legais: modelos. **Revisão jurídica obrigatória.**
- [ ] Fontes: títulos e URLs confirmados por indexação de busca; o ambiente não abria aad.org/sbd.org.br. **Abrir cada link manualmente** (`docs/FONTES.md`).

## 3. Requer credenciais ou serviços externos

1. [ ] **Plataforma de pagamento** (Hotmart, Kiwify, Eduzz, Cakto…): criar produto, subir o PDF, copiar o link para `VITE_CHECKOUT_URL`, redirecionamento para `/obrigado`, e-mail de entrega (modelo em `docs/ACESSO-E-ENTREGA.md`). **Fazer uma compra de teste ponta a ponta.**
2. [ ] **Preencher variáveis** de `.env.example` na hospedagem (preço, bônus, suporte, responsável/CPF-CNPJ). A faixa amarela some quando tudo estiver preenchido.
3. [ ] **Hospedagem** (Vercel, Root Directory `pele-em-foco`) e domínio. Depois do deploy: abrir `/`, `/app`, `/obrigado`, recarregar numa rota interna (testa o rewrite) e conferir capa e amostras.
4. [ ] **E-mail de suporte** real e monitorado.
5. [ ] **`ebook/config.json`** com autor, revisor técnico, suporte, URL do app e data do bônus → `npm run ebook:pdf` → reenviar o PDF à plataforma.
6. [ ] (Opcional) Analytics: não há nenhum hoje. Se adicionar, atualizar a política de privacidade antes.

## 4. Não implementado

- Controle de acesso ao app (login, verificação de compra, expiração no servidor). Hoje o link é aberto e o bônus é informativo. Plano em `docs/ACESSO-E-ENTREGA.md`.
- Webhook de pagamento, reembolso automático revogando acesso.
- Contas e sincronização entre aparelhos.
- Lembretes/notificações push.
- Service worker / uso offline.
- Produtos específicos com preço verificado e links de afiliado (estrutura e validação prontas, lista vazia).
- Fotografia de marca (só arte vetorial).

## Decisões de negócio pendentes (suas, não técnicas)

- [ ] **O que acontece com o app depois da data do bônus?** Assinatura paga, gratuito para sempre ou desligar? “Gratuito por tempo limitado” só é honesto se existir um depois definido. Decida antes de anunciar.
- [ ] **Revisão técnica por dermatologista** (CRM + RQE). Para conteúdo de saúde vendido, é a maior alavanca de credibilidade e de redução de risco. Sem ela, o PDF diz explicitamente que não houve revisão.
- [ ] **Preço.** Nada foi sugerido aqui sem dados de mercado.
- [ ] **Regras da plataforma** sobre produtos de saúde/estética e sobre anúncios nas redes (Meta/TikTok têm políticas próprias para saúde e aparência).

## Repositório e arquivos do e-book

O repositório GitHub é **público**. Por decisão sua, **a fonte HTML do e-book (`ebook/src/pele-em-foco.html`) e o PDF (`ebook/dist/`) não são versionados** (`.gitignore`). Guarde os arquivos que foram enviados na conversa em local seguro. Para regenerar o PDF em outra máquina: coloque o HTML de volta em `ebook/src/` e rode `npm run ebook:pdf`. Se o repositório virar privado, dá para remover essas linhas do `.gitignore` e versionar tudo.
