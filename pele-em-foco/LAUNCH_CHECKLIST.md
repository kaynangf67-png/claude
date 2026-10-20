# Checklist de lançamento — Pele em Foco

Estado em 20/10/2026.

## 1. Funcionando e testado

### Banco — `npm run test:db` (58 verificações, Postgres 16 + stub do Supabase)
- Perfil criado por trigger com nome e aceite do aviso; usuário só altera o próprio nome.
- Conta nova sem acesso: não grava rotina nem diário, não lê biblioteca.
- Usuário **não** insere nem altera `access_entitlements`, não lê `verified_purchases`, não executa `record_verified_purchase`.
- Webhook (service_role) registra compra; reenvio não duplica; e-mail normalizado.
- E-mail não confirmado não ativa; compra de outra pessoa não ativa.
- Ativação = exatamente 30 dias; segunda ativação idempotente.
- Rotina: duplicata recusada, passo inválido recusado, não grava em nome de outro, desfazer remove só o passo.
- Diário: uma entrada por dia, observação fora da lista recusada, edição pelo dono.
- Isolamento: outra conta não vê, não edita e não apaga dados alheios (diário, rotina, acesso, perfil).
- Expirado: não grava, não edita, não lê biblioteca; ainda lê e apaga os próprios dados; a mesma compra não reativa.
- Reembolso revoga o acesso; reembolso é final (reenvio atrasado de “aprovado” não reabre a compra, nem antes da ativação); anônimo não lê nada nem chama funções.
- Excluir a conta apaga tudo em cascata; recriar a conta com o mesmo e-mail **não** reutiliza a compra.
- Teste de mutação: removendo a exigência de acesso ativo de uma política, o teste falha (o harness detecta regressões).

### Unitários — `npm test` (24 testes)
- Datas, progresso da rotina, validações de formulário.
- Listas do frontend (passos, observações, sensações, categorias) **iguais às constraints da migration**.
- Seed SQL da biblioteca sincronizado com `src/content/articles.ts`.
- Artigos: slug válido e único, fontes em https, sem promessas de cura/prazo.
- Webhook Cakto: aprovação, reembolso, chargeback, segredo errado/ausente, outro produto, payload inválido.
- Modo demo: senha não fica em texto, mesma mensagem para e-mail inexistente e senha errada, regras de acesso, isolamento, exclusão de conta.

### Navegador — `npm run test:e2e` (32 verificações: 16 em 390px e 16 em 1366px, modo demo)
- Site, CTA desativado sem checkout, imagens, páginas legais, sem rolagem horizontal.
- Rota protegida → `/entrar`; destino original preservado após login.
- Cadastro: mensagens de erro em português, `aria-invalid`, aceite obrigatório.
- Conta nova sem acesso (início, rotina, aprender bloqueados com explicação).
- Ativação demo → início com estado real; rotina marca/desfaz/persiste; teclado (Espaço) funciona.
- Diário: criar, recarregar, data duplicada recusada, editar, apagar com confirmação.
- Biblioteca: busca, sem resultados, filtro por categoria, artigo com fontes externas.
- Expirado: rotina bloqueada, diário só leitura.
- Perfil: exportar JSON, apagar rotina e diário, sair; senha errada recusada; login volta para a página pedida.
- Outra conta não vê dados da primeira; exclusão de conta.
- Foco do teclado: “Pular para o conteúdo” primeiro; navegação leva o foco ao conteúdo.
- Nenhum erro no console.

### Build e segurança
- `npm run build` e `tsc` sem erros.
- Build com Supabase: **nenhum** código do modo demo, nenhum texto dos artigos (vêm só do banco) e nenhuma referência a `service_role` no bundle (verificado por busca nos arquivos gerados).
- Build de produção sem Supabase e sem `VITE_DEMO_MODE`: mostra “App em configuração”.

## 2. Implementado, mas não testado

- [ ] `SupabaseAuthService` e `SupabaseDataService` contra um projeto real (cadastro, confirmação de e-mail, login, recuperação de senha, sessão persistente, RLS via PostgREST).
- [ ] Edge Function `cakto-webhook` (Deno) — só a lógica pura foi testada.
- [ ] Edge Function `delete-account`.
- [ ] Safari/iOS e Firefox (testado só no Chromium); leitores de tela reais (VoiceOver/TalkBack).

## 3. Requer credenciais ou serviços externos

1. [ ] **Supabase**: projeto, `db push`, Auth (confirmação de e-mail ligada, URLs, modelos em pt-BR), **SMTP próprio**, deploy das funções, secrets. Guia: `docs/SUPABASE.md`.
2. [ ] **Cakto**: produto, entrega do PDF, página de obrigado `/obrigado`, link `pay.cakto.com.br` em `VITE_CHECKOUT_URL`, **webhook** (`purchase_approved`, `refund`, `chargeback`) para a função. Guia: `docs/CAKTO.md`.
3. [ ] **Hospedagem** (Vercel, Root Directory `pele-em-foco`) e domínio.
4. [ ] Variáveis da página de vendas (preço, suporte, responsável e CPF/CNPJ).
5. [ ] `ebook/config.json` (autor, revisor, suporte, `appUrl`) → `npm run ebook:pdf` → reenviar o PDF à Cakto.

## 4. Não implementado

- Assinatura ou renovação paga depois dos 30 dias.
- Login social, autenticação em dois fatores.
- Notificações/lembretes.
- Painel administrativo (liberação manual é via SQL Editor).
- Analytics (nenhum rastreamento).
- Uso offline / service worker.

## Decisões de negócio pendentes

- [ ] **O que acontece depois dos 30 dias?** Hoje: acesso de leitura aos próprios dados. Se houver plano pago, ele precisa existir e estar testado antes de ser anunciado.
- [ ] **Revisão técnica por dermatologista** do e-book e da biblioteca.
- [ ] **Revisão jurídica** de privacidade (agora há dados no servidor: LGPD se aplica com mais peso) e termos.
- [ ] Preço.
