# Pesquisa de Mercado Global — Dores, Oportunidades e Ideias de SaaS

**Data:** 03/10/2026 · **Escopo:** EUA, Canadá, Reino Unido, Austrália, União Europeia e adaptação ao Brasil

---

## 0. LEIA ANTES: método, limitações e onde você pode estar se enganando

### 0.1 Como a pesquisa foi feita (e o que NÃO foi possível fazer)

- **Coleta:** cerca de 110 buscas web em mais de 40 nichos, em inglês, português, alemão e francês.
- **Bloqueio de rede:** o ambiente desta sessão **bloqueou o acesso direto** a Reddit, Hacker News (API), Capterra, G2, Trustpilot, App Store, Product Hunt e aos sites dos concorrentes.
  - Por isso **não abri nenhum thread do Reddit** e **não tenho contagem de upvotes ou comentários**. Não vou fingir que tenho.
  - A evidência de "usuário reclamando" vem de três lugares: trechos indexados de reviews (Capterra/GetApp/Trustpilot/BBB, citados por agregadores), fóruns como BiggerPockets e DentalTown, e matérias de imprensa.
  - Para liberar o acesso direto: Network access nas configurações do ambiente ([docs](https://code.claude.com/docs/en/cloud-environments#network-access)).
- **Preços:** quase todos vieram de **agregadores** (Costbench, Capterra, GetApp, blogs de comparação), não da página oficial. **Confirme na página do fornecedor antes de usar qualquer preço em plano de negócio.**
- **Qualidade das fontes.** Cada fonte recebeu uma nota:
  - **[A]** primária ou independente: governo, imprensa, entidade setorial, pesquisa com metodologia.
  - **[B]** sites de review e agregadores.
  - **[C]** blog de fornecedor ou concorrente, com conflito de interesse. Atenção: **uma parte grande das estatísticas que circulam na internet sobre "quanto você perde" é [C]** (ex.: "o contratante perde US$ 30–50 mil/ano em chamadas perdidas"). Tratei esses números como *indicativos*, nunca como fato.
- **Convenção de rótulos no texto:**
  - **DADO** = encontrado em fonte citada.
  - **INFERÊNCIA** = conclusão minha a partir dos dados.
  - **HIPÓTESE** = aposta de negócio a validar.
- As fontes estão numeradas **[S1]…[S92]**, com URL e nota de qualidade na seção 18.

### 0.2 Pontos cegos do pedido (sendo direto)

1. **Você pediu amplitude e profundidade ao mesmo tempo.** São mais de 50 oportunidades, mais de 30 dores e 16 seções. Isso força superficialidade. Uma pesquisa honesta de 50 oportunidades *com validação real* levaria semanas e entrevistas com clientes. O que está aqui é um **mapa de hipóteses priorizadas por evidência**, não validação. A validação de verdade está no plano da seção 17.
2. **Falta a variável mais importante: você.** O que decide se uma ideia funciona *para você* não é a ideia. É **acesso à distribuição**: conhece donos de clínica? Tem rede de contadores? Sabe vender por telefone? Você não informou capital, habilidades, mercado-alvo nem rede. Sem isso, nenhuma pesquisa escolhe por você. **Antes de construir, liste os 3 nichos onde você consegue marcar 20 conversas em 1 semana.** Esse filtro elimina 80% desta lista.
3. **"Mercado internacional" e "adaptar ao Brasil" puxam para lados opostos.** O padrão mais forte encontrado (vazamento de leads em negócios de serviço) se manifesta por **telefone** nos EUA e por **WhatsApp** no Brasil. Os produtos são diferentes, e a concorrência também. Competir nos EUA contra startups com centenas de milhões de dólares de VC (Avoca: US$ 125M+, valuation de US$ 1B [S36]) com uma equipe pequena brasileira é, na prática, uma má ideia. Ali o espaço está em nichos estreitos, ferramentas de autoatendimento (*product-led*) baratas e problemas de documentos/compliance.
4. **"Construível em 7–30 dias" é uma armadilha se virar o critério principal.** Se você constrói em 2 semanas, qualquer um também constrói, inclusive as milhares de agências GoHighLevel que já vendem "missed call text back + reviews + CRM" para negócio local [S64]. O MVP rápido é bom para **validar**, não para **defender**. O fosso vem de integração com o sistema que o cliente já usa, de conhecimento vertical e de distribuição.
5. **Dependência do WhatsApp é risco de plataforma real, não detalhe.**
   - A Meta mudou para cobrança por mensagem em 1/7/2025 [S23].
   - A Meta proibiu chatbots de IA de "propósito geral" na API a partir de 15/1/2026. Bots focados em negócio (atendimento, agendamento, vendas) continuam permitidos [S24].
   - Uma fonte (Zenvia [S70]) menciona cobrança de mensagens de serviço a partir de 1/10/2026, o que **contradiz** outras fontes que dizem que elas são gratuitas na janela de 24h. **Não consegui verificar.** Cheque na documentação oficial da Meta antes de modelar margem.

---

## 1. RESUMO EXECUTIVO

**Os 6 padrões mais fortes, em ordem de quantidade de evidência independente:**

1. **Vazamento de receita no "primeiro contato" em negócios de serviço.**
   - **DADO:** no estudo de cliente oculto do Clio (2024, 500 escritórios de advocacia dos EUA), ~40% atenderam o telefone e 64% dos potenciais clientes não receberam follow-up nenhum [S31].
   - **DADO:** no estudo da HBR (Oldroyd et al., 2011, 1,25 milhão de leads), empresas que contataram o lead em até 1 hora tiveram ~7x mais chance de qualificá-lo [S71].
   - **DADO:** no Brasil, 42,2% das clínicas privadas relatam dificuldade de confirmar consultas [S26], e a Unimed Litoral subiu a confirmação de 36% para 90% com automação no WhatsApp [S26].
   - **INFERÊNCIA:** o problema é transversal (advocacia, imóveis, home services, clínicas) e mensurável. Nos EUA está saturado por IA de voz com muito capital [S36]. No Brasil o canal é o WhatsApp: 82% dos pequenos negócios o usam como principal canal de venda e comunicação [S27].
2. **Follow-up de orçamento e reativação de "dinheiro parado".**
   - **DADO [C]:** fornecedores do setor odontológico estimam que 40–60% dos tratamentos apresentados nunca são agendados [S9].
   - **DADO [C]:** em home services, a conversão de orçamentos fica em 30–50% [S30].
   - **DADO:** o Jobber só inclui "quote follow-ups" no plano Grow (US$ 249/mês) [S3].
   - **INFERÊNCIA:** é uma dor de alta frequência, com ROI fácil de demonstrar e pouco atendida por produto *focado e barato*.
3. **Abuso comercial dos incumbentes (contratos, renovação automática, aumentos de preço).**
   - Podium: US$ 399–599/mês, contrato de 12 meses, queixas de cancelamento [S6].
   - Birdeye: US$ 299–449/local/mês, 1,7/5 no Trustpilot com 25 reviews [S7].
   - Mindbody: queixa de US$ 80 → US$ 469/mês em uma década, multa de saída de 30–50% e US$ 500 para exportar dados [S18].
   - ServiceTitan: US$ 250–500/técnico/mês e contratos de ~3 anos [S5].
   - HoneyBook: aumento de 51–89% em fevereiro de 2025 [S17].
   - Toast: taxa de US$ 0,99 revertida após revolta [S89].
   - **INFERÊNCIA:** existe uma cunha consistente de "simples, mensal, sem contrato, preço público". Mas essa cunha **não é fosso**: atrai clientes que trocam de fornecedor com facilidade.
4. **Prazos regulatórios criam demanda forçada (Europa e Reino Unido).**
   - Bélgica: e-invoicing obrigatório via Peppol desde 1/1/2026, e 8 de cada 10 PMEs belgas não estavam conectadas [S55].
   - França: recebimento obrigatório de e-fatura para todas as empresas a partir de 1/9/2026 [S55].
   - Alemanha: recebimento obrigatório desde 2025 e emissão escalonada até 2028 [S54].
   - Reino Unido: Making Tax Digital para autônomos e senhorios acima de £50 mil a partir de abril de 2026, £30 mil em 2027 e £20 mil em 2028 [S53].
   - **INFERÊNCIA:** é a demanda mais "forte" no sentido literal, porque é obrigatória. Exige conhecimento fiscal local e pede uma vantagem que uma equipe brasileira normalmente não tem.
5. **Coleta de documentos e informações (contadores, construtoras, seguradoras).**
   - Contadores: perseguir documentos de clientes é dor recorrente nos EUA e no Brasil [S13][S42].
   - Construtoras: certificados de seguro (COI) de subcontratadas ainda vivem em planilhas e e-mail. Uma estimativa [C] fala em ~10h/semana para 50 subcontratadas [S16].
   - Corretoras de seguro: 65 min de redigitação manual por submissão, em um caso relatado [C] [S49].
   - **INFERÊNCIA:** é a categoria onde a **IA cria vantagem real** (extração de PDF/foto → dado estruturado → cobrança automática do que falta) e onde o MVP é viável.
6. **Comissões de marketplace sufocam pequenos negócios.**
   - iFood: 12% no plano básico ou 23% com entrega, mais 3,2% sobre pagamento online [S41]; a Fhoresp chegou a convocar boicote [S41].
   - Salões no Reino Unido: Treatwell cobra 35% + IVA sobre cliente novo [S19].
   - **INFERÊNCIA:** existe demanda por "canal próprio + recompra". Mas o iFood **comprou a Anota AI** (atendimento de restaurantes no WhatsApp) [S79], o que indica que o incumbente já cobre esse flanco.

**O que eu NÃO encontrei com força:**
- Consumidor final (B2C) tem evidência de dor (assinaturas esquecidas [S61], erros em contas médicas [S62]), mas monetização e aquisição difíceis para equipe pequena.
- "Agentes de navegador" genéricos têm muito hype e pouca evidência de pagamento por SMB.

**As 5 oportunidades para aprofundar (sem ranking, detalhadas na seção 17):**
- **(A)** Agente de follow-up de orçamentos via WhatsApp para prestadores de serviço (BR).
- **(B)** Reativação de orçamentos e tratamentos não fechados em clínicas odontológicas e estéticas (BR).
- **(C)** Coleta automática de documentos para escritórios contábeis (BR).
- **(D)** Resposta e qualificação instantânea de leads de portais para imobiliárias pequenas e corretores (BR).
- **(E)** Extração e controle de certificados de seguro (COI) para pequenas construtoras (EUA, autoatendimento).

---

## 2. PRINCIPAIS DORES ENCONTRADAS (32)

| # | Dor | Quem sofre | Evidência (DADO) | Força |
|---|-----|-----------|------------------|-------|
| 1 | Chamadas perdidas viram cliente do concorrente | Home services (EUA) | 80% não deixam recado e 62% escolhem quem atende primeiro (dados [C]) [S1][S2]; Avoca com 800+ clientes e ARR de 8 dígitos [S36] | Forte (o pagamento prova; os números de perda são [C]) |
| 2 | Escritórios de advocacia não respondem potenciais clientes | Advocacia EUA | Clio 2024: ~40% atendem; 64% sem follow-up [S31] | Forte [A] |
| 3 | Resposta lenta a leads | Corretores e vendas | HBR: ~7x mais qualificação em até 1h [S71]; BR: 1º contato médio de 5h08 e 47% sem resposta (dado atribuído à Morada.ai, **fonte primária não verificada**) | Forte (EUA) / Média (BR) |
| 4 | Orçamentos enviados e nunca acompanhados | Prestadores de serviço | Conversão de 30–50% e "48% nunca fazem follow-up" ([C], estatística antiga reciclada) [S30] | Média |
| 5 | Tratamentos odontológicos apresentados e não agendados | Dentistas | 40–60% não agendados; US$ 0,5–1M parados por consultório ([C], Henry Schein One / Curve) [S9] | Média |
| 6 | Faltas (no-show) em clínicas | Clínicas BR | 34% das clínicas com no-show >11% (Doctoralia/Feegow); 42,2% com dificuldade de confirmar [S26] | Forte [A/B] |
| 7 | No-show em salões e reservas | Salões, restaurantes | OpenTable: no-show de 10–20%; depósito reduz a 1–7% [S78]; Fresha mede 3,16% em salões, abaixo do que os donos relatam [S19] | Média |
| 8 | Cobrança atrasada e inadimplência | PMEs (Reino Unido) | 62% têm faturas a receber, média de £21,4 mil (QuickBooks UK); 86h/ano perseguindo pagamento (Small Business Commissioner) [S14] | Forte [A] |
| 9 | Freelancers não recebem em dia | Freelancers | 29% das faturas atrasam (dados Bonsai, 100 mil+ freelancers); 57% têm medo de cobrar [S60] | Forte |
| 10 | Perseguir documentos de clientes | Contadores (EUA e BR) | TaxDome e Content Snare existem para isso [S13]; atraso no fechamento mensal [S42] | Forte (gente paga) |
| 11 | Controle de certificados de seguro de subcontratadas | Construtoras pequenas (EUA) | Planilha, e-mail e renovações perdidas (fontes [C]) [S16] | Média |
| 12 | Software de serviços de campo caro e com contrato longo | HVAC/encanamento | ServiceTitan: US$ 250–500/técnico e contratos de ~3 anos [S5] | Forte |
| 13 | Cancelar é difícil e há cobranças após cancelar | Clientes Podium, Birdeye, HCP, Trainerize | Padrão de reviews negativos [S4][S6][S7][S57] | Forte (B) |
| 14 | Aumentos de preço abruptos | Fotógrafos, estúdios fitness | HoneyBook +51–89% [S17]; Mindbody [S18] | Forte |
| 15 | Comissões de marketplace | Restaurantes BR, salões Reino Unido | iFood 12–23% + 3,2% [S41]; Treatwell 35% + IVA [S19] | Forte [A] |
| 16 | Taxas e lock-in de POS | Restaurantes EUA | Toast: processamento de 2,49% + 15¢ e contratos de 2–3 anos [S89] | Média |
| 17 | Verificação de elegibilidade de seguro manual | Dentistas EUA | 12–30 min por paciente ([C], fornecedores de IA) [S11] | Média (dor real; mercado já tomado) |
| 18 | Software odontológico legado | Dentistas | Dentrix: suporte, cliques demais, sem nuvem (DentalTown, Capterra) [S12] | Média |
| 19 | Redigitar dados em portais de seguradoras | Corretoras de seguro | 65 min por submissão (caso [C]); Quandri lançou requote com IA [S49] | Média |
| 20 | Oficinas sem sistema de gestão | Oficinas BR | 65% sem sistema (pesquisa RepareCar, via Estado de Minas) [S43] | Média (pesquisa de fornecedor) |
| 21 | Software de oficina caro nos EUA | Oficinas EUA | Tekmetric US$ 179–409; Shopmonkey US$ 215–449 + US$ 20/assento [S20] | Média |
| 22 | Evasão de alunos em academias | Academias BR | Evasão anual de 40–60% (ACAD Brasil, via EM) [S83] | Forte [A] |
| 23 | Coordenação de manutenção com inquilinos | Pequenos senhorios | Fórum BiggerPockets: mensagens de madrugada, encaminhar para fornecedor [S58] | Média (fórum real) |
| 24 | Contratados que somem antes do 1º dia (ghosting) | PMEs com mão de obra horista | CFIB: 36% contrataram quem nunca apareceu [S77] | Forte [A] |
| 25 | Obrigação de e-fatura sem preparo | PMEs Bélgica, França, Alemanha | 8 de 10 PMEs belgas sem Peppol [S55] | Forte (obrigatória) |
| 26 | MTD obriga software para autônomos | Autônomos e senhorios (Reino Unido) | Planilha sozinha não atende; exige "bridging software" [S53] | Forte (obrigatória) |
| 27 | Orçamento demora horas | Handwerk (DE) | 2–4h por orçamento, 15–20h/semana ([C]) [S56] | Média |
| 28 | Medir terreno para orçar | Paisagismo e gramados | Vários SaaS de satélite a partir de US$ 39–199 [S52] | Forte (gente paga) |
| 29 | Bookkeeping terceirizado não confiável | PMEs EUA | Bench fechou de repente em 27/12/2024, 35 mil+ clientes [S73] | Forte [A] (evento) |
| 30 | Vendedor gasta tempo com CRM | Equipes de vendas | Salesforce: só ~30% do tempo vendendo [S63] | Forte |
| 31 | Assinaturas esquecidas | Consumidor | £688M/ano gastos com assinaturas não usadas no Reino Unido (Citizens Advice) [S61] | Forte [A] (monetização fraca) |
| 32 | Erros em contas médicas | Consumidor EUA | 78% dos que contestam vencem; 64% nunca contestaram [S62] | Média |

---

## 3. BANCO DE OPORTUNIDADES (58)

**Legenda:**
- **Evid.** = força da evidência de demanda.
  - **F (forte):** gente procurando solução, pagando por uma ou reclamando de uma existente.
  - **M (média):** o problema aparece com frequência e há algumas soluções.
  - **Fr (fraca):** pouca evidência.
- **"Não encontrado"** = não consegui verificar.

| # | Nicho | Público | Problema | Frequência | Solução atual | Problema da solução atual | Disposição p/ pagar | Concorrência | Oportunidade | Evid. | Fontes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Home services EUA | HVAC, encanador, eletricista | Chamada perdida = job perdido | Diária | Recepcionista, call center, IA de voz | Humano caro (US$ 300+/mês); IA nova | Sim: Smith.ai US$ 95+, Rosie US$ 49, Goodcall US$ 59 | **Muito alta** (Avoca US$ 1B) | Só em micro-nicho; não recomendado | F | S1 S8 S36 |
| 2 | Home services | Prestadores | Orçamento enviado sem follow-up | Diária | Memória, planilha, Jobber Grow | Recurso preso em plano de US$ 249/mês | Inferida (ROI direto) | Média | Agente de follow-up independente do FSM | M | S3 S30 |
| 3 | FSM | Empresas de 5–15 técnicos | ServiceTitan caro e com contrato | Contínua | Jobber, HCP | HCP: queixas de suporte e cancelamento | Sim (US$ 49–699) | Alta | Pouca brecha horizontal; vertical por ofício | F | S3 S4 S5 |
| 4 | Reputação local | Negócio local | Podium/Birdeye caros e com contrato | Contínua | Podium, Birdeye, NiceJob, Grade.us | US$ 299–599/mês; renovação automática | Sim (US$ 45–599) | Alta | Ferramenta mensal barata, vertical, via WhatsApp | F | S6 S7 S65 |
| 5 | Google Business Profile | Negócio local | Posts, respostas e fotos não são mantidos | Semanal | Agência (US$ 300–1.200) ou nada | Agência cara | Sim (US$ 20–100 software) | Alta (barato) | Commodity; só como recurso dentro de outro produto | M | S39 |
| 6 | Odontologia EUA | Clínicas | Tratamento não agendado | Diária | Recepção liga quando dá | 60–70% sem follow-up sistemático [C] | Sim (Weave US$ 249–399) | Alta | Reativação com IA integrada ao PMS | M | S9 S10 |
| 7 | Odontologia EUA | Clínicas | Verificação de elegibilidade | Por paciente | Telefone e portal | 12–30 min/paciente [C] | Sim | **Alta** (Overjet, VideaHealth) | Não recomendado (tomado e regulado) | M | S11 S91 |
| 8 | Odontologia | Clínicas | Software legado ruim | Contínua | Dentrix etc. | Suporte, cliques, sem nuvem | Sim | Alta (troca difícil) | Não atacar o PMS; criar camada por cima | M | S12 |
| 9 | Comunicação clínica | Clínicas EUA | Weave caro e com contrato | Contínua | Weave, NexHealth | US$ 399 + setup de US$ 750 | Sim | Alta | Versão simples só de SMS e lembretes | M | S10 |
| 10 | Contabilidade | Escritórios (EUA/BR) | Perseguir documentos | Mensal/anual | E-mail, WhatsApp, portais | TaxDome US$ 800–1.200/usuário/ano | Sim | Média (BR pouco focada) | Coletor via WhatsApp + IA (BR) | F | S13 S42 S87 |
| 11 | Recebíveis | PMEs Reino Unido | Faturas atrasadas | Semanal | Planilha, e-mail, Chaser | Chaser a partir de £199/mês | Sim | Média | Régua simples para microempresas | F | S14 S15 |
| 12 | Freelancers | Autônomos | Cobrar sem constranger | Mensal | E-mail manual | Medo de perder o cliente (57%) | Fraca/Média | Alta (Bonsai etc.) | Feature, não produto | M | S60 |
| 13 | Construção EUA | Construtoras pequenas | Controle de COIs | Semanal | Excel + calendário | Plataformas >US$ 500/mês não leem o ACORD 25 [C] | Sim (US$ 19–500) | Média | Extração por IA + lembretes, autoatendimento | M | S16 |
| 14 | Construção | Mestre de obras | Diário de obra | Diária | Papel, Procore | Procore caro para pequenos | Sim (Contractor Foreman US$ 49+) | Alta | Diário por voz/WhatsApp | M | S35 |
| 15 | Fotógrafos/casamento | Autônomos | CRM ficou caro | Contínua | HoneyBook, Dubsado | +51–89% em 2025 | Sim (US$ 19–129) | Alta | Saturado; vertical BR? | F | S17 |
| 16 | Estúdios fitness | Boutiques | Mindbody caro | Contínua | Mindbody, WellnessLiving | US$ 469+; multa de saída | Sim | Alta | Difícil (migração) | F | S18 |
| 17 | Salões Reino Unido | Salões | Comissão de marketplace | Por cliente novo | Treatwell, Fresha, Booksy | 20–35% + IVA | Sim | Alta | Agendamento direto + depósito | F | S19 |
| 18 | Salões e barbearias | Donos | No-show | Diária | Lembrete manual | Sem depósito | Sim | Alta | Depósito via Pix + confirmação | M | S19 S44 |
| 19 | Oficinas EUA | Oficinas | Software caro por assento | Contínua | Tekmetric, Shopmonkey | Preço é o maior tema negativo do Shopmonkey | Sim (US$ 179–499) | Alta | Fraca | M | S20 |
| 20 | Oficinas BR | Oficinas pequenas | Sem sistema; orçamento no papel | Diária | Papel, WhatsApp | 65% sem sistema | Não encontrado (preço BR) | Média | Orçamento + aprovação no WhatsApp | M | S43 |
| 21 | Imóveis EUA | Corretores | Speed-to-lead | Diária | Follow Up Boss | FUB US$ 58–833 | Sim | Alta | Não (tomado) | F | S21 S71 |
| 22 | Restaurantes | Independentes | Cliente some e não volta | Contínua | Thanx, Owner.com | Foco em redes; preço não público | Sim | Média | Recuperação via WhatsApp (BR) | M | S22 |
| 23 | Restaurantes BR | Delivery | Dependência do iFood | Diária | Anota AI, cardápio digital | iFood comprou a Anota AI | Sim (Anota AI R$ 178,99+) | Alta | Recompra direta pós-pedido | F | S41 S79 |
| 24 | Restaurantes | Com reservas | No-show | Diária | OpenTable, Resy | Taxa de 2% sobre depósito | Sim | Alta | Fraca | M | S78 |
| 25 | Restaurantes EUA | Independentes | Taxas e lock-in do POS | Contínua | Toast, Square | Contratos e hardware proprietário | Sim | Muito alta | Não (hardware) | F | S89 |
| 26 | Clínicas BR | Médicos, dentistas | No-show e confirmação | Diária | Ligação, WhatsApp manual | 42,2% com dificuldade | Sim | Média–alta | Confirmação + lista de espera automática | F | S26 |
| 27 | Clínicas BR | Odonto e estética | Orçamento não fechado | Diária | Recepção, Clint, Kommo | CRM genérico; esforço manual | Sim | Média | Reativação vertical com IA | M | S86 |
| 28 | Cobrança BR | PMEs de serviço | Inadimplência | Mensal | Asaas, bancos | Asaas cobra por boleto/Pix e R$ 0,55/msg WhatsApp | Sim | Alta | Régua conversacional por vertical | M | S28 |
| 29 | FSM BR | Manutenção, refrigeração | OS e orçamento | Diária | Field Control, Auvo | R$ 295/usuário/mês | Sim | Média | Versão para 1–5 técnicos | M | S29 |
| 30 | Advocacia | Escritórios pequenos | Intake | Diária | Recepção, Clio Grow | ~40% atendem | Sim | Alta (EUA) | BR: intake no WhatsApp (verificar OAB) | F | S31 |
| 31 | Transporte | Donos-operadores | Faturamento e papelada | Por carga | TruckingOffice, planilha | Muita digitação | Sim (US$ 20+) | Média | Extração por IA da rate con → fatura | M | S32 |
| 32 | Limpeza residencial | Empresas pequenas | Agenda e cobrança | Diária | ZenMaid, Jobber | Pouca dor de preço (US$ 19–59) | Sim | Alta | Fraca | M | S33 |
| 33 | Temporada (Airbnb) | Anfitriões e gestores | Limpeza de virada | Por reserva | Turno | Marketplace | Sim | Alta | Fraca | M | S34 |
| 34 | Contratação horista | Restaurantes, varejo | Ghosting | Semanal | Indeed, WhatsApp | 36% contrataram quem não apareceu | Não encontrado | Média | Triagem e confirmação por WhatsApp | M | S77 |
| 35 | Escalas | PMEs com turnos | Escala e ponto | Semanal | Homebase, 7shifts | Erros de folha relatados | Sim (US$ 30–120/local) | Alta | Fraca | M | S38 |
| 36 | Creches EUA | Donos | Cobrança e taxas | Mensal | brightwheel | Taxas para pais; cancelamento | Sim | Alta | Fraca | M | S40 |
| 37 | Dedetização | Operadores pequenos | Software caro/antigo | Contínua | PestPac, GorillaDesk | PestPac: contrato de 15 meses e taxas | Sim (US$ 49–299) | Média | Vertical simples (BR?) | M | S47 |
| 38 | Aluguel para eventos | Infláveis, festas | Reservas e estoque | Por evento | Goodshuffle, InflatableOffice | Aumentos de preço | Sim (US$ 39–225) | Média | BR: locadoras de festa | M | S48 |
| 39 | Seguros | Corretoras independentes | Redigitar em portais | Diária | Manual | 65 min/submissão [C] | Sim | Média (Quandri etc.) | Difícil (integração com seguradoras) | M | S49 |
| 40 | Veterinária | Clínicas | Lembretes e no-show | Diária | PetDesk, Vetstoria | US$ 199/mês, €149/local | Sim | Média (consolidando) | BR: vet via WhatsApp | M | S50 |
| 41 | Mudanças | Pequenos | CRM caro | Contínua | SmartMoving | A partir de ~US$ 600/mês | Sim | Média | Versão para 1–3 caminhões | M | S51 |
| 42 | Paisagismo | Jardinagem | Medir para orçar | Por orçamento | Visita no local, satélite | US$ 39–199/mês | Sim | Média | BR: orçamento por satélite | F | S52 |
| 43 | MTD Reino Unido | Autônomos e senhorios | Envio trimestral obrigatório | Trimestral | Software certificado | Precisa reconhecimento do HMRC | Sim | Alta | Difícil (compliance) | F | S53 |
| 44 | E-fatura UE | Micro PMEs | Receber e emitir e-fatura | Contínua | ERPs, provedores Peppol | 8/10 sem Peppol (BE) | Sim (obrigatória) | Alta | Difícil (fiscal local) | F | S54 S55 |
| 45 | Handwerk DE | Ofícios | Orçamento lento | Semanal | Plancraft, Hero, OfficeOn | €64,99/mês + 6 meses mínimo | Sim | Alta | Orçamento por foto/voz | M | S56 |
| 46 | Personal trainers | Online | Add-ons caros | Mensal | Trainerize, TrueCoach | Recursos essenciais em add-on pago | Sim (US$ 23–200) | Alta | Fraca | M | S57 |
| 47 | Pequenos senhorios | 1–20 unidades | Manutenção | Semanal | Mensagens, RentRedi | Inquilino prefere mandar mensagem | Sim | Alta | Recepção de chamados por WhatsApp (BR) | M | S58 |
| 48 | Imóveis BR | Imobiliárias pequenas | Resposta a leads de portal | Diária | Corretor no WhatsApp | Demora; leads sem resposta | Sim (Lastro levantou R$ 85M) | Média (foco em incorporadoras) | Versão para imobiliárias pequenas | M | S82 |
| 49 | Academias BR | Academias | Evasão | Contínua | Recepção, ERP | Evasão de 40–60%/ano | Não encontrado | Média | Detector de risco + reativação | M | S83 S84 |
| 50 | Bookkeeping | PMEs EUA | Confiança e portabilidade | Anual | Bench (fechou), Pilot | Risco de fornecedor | Sim | Alta | Fraca para equipe pequena | M | S73 |
| 51 | Pet grooming | Tosadores | Agenda e no-show | Diária | MoeGo | Taxa para o cliente reservar | Sim (até US$ 239) | Média | BR: pet shops via WhatsApp | M | S74 |
| 52 | Estúdios de tatuagem | Tatuadores | Depósito e consentimento | Por sessão | Apps de US$ 35–65/artista | Cobrança por artista | Sim | Média | Simples, preço por estúdio | M | S75 |
| 53 | Condomínios BR | Síndicos | Comunicação caótica em grupos de WhatsApp | Diária | uCondo, apps | Adoção pelos moradores | Sim | Alta | Fraca | M | S76 |
| 54 | Segurança patrimonial | Empresas de vigilância | Relatórios de ronda | Diária | TrackTik, Silvertrac | US$ 249+/mês, cotação | Sim | Média | BR: ronda por WhatsApp/QR | Fr–M | S69 |
| 55 | Escolas de música/aulas | Professores | Agenda e cobrança | Mensal | My Music Staff, TutorBird | Barato (US$ 16,95) | Sim (baixo) | Alta | Fraca (ticket baixo) | M | S66 |
| 56 | Limpeza comercial | Empresas | Precificar licitações | Por proposta | CleanGuru | US$ 75/mês | Sim | Baixa–média | BR: calculadora de proposta | Fr–M | S67 |
| 57 | Vendas B2B | Vendedores | Digitar no CRM | Diária | Manual | ~70% do tempo fora de venda | Sim | Muito alta | Não (incumbentes) | F | S63 |
| 58 | Consumidor | Famílias | Assinaturas e contas médicas | Mensal | Rocket Money etc. | Taxa de 35–60% sobre economia | Sim | Alta | Não para B2B-first | F (dor) | S61 S62 |

---

## 4. 20 OPORTUNIDADES ANALISADAS

Formato compacto. **Notas de 1 a 5** (5 = mais favorável): Evidência de demanda (Ev), Intensidade da dor (Dor), Concorrência (Conc: 5 = pouca), Facilidade de MVP (MVP), Monetização (Mon), Complexidade técnica (Tec: 5 = simples), Expansão (Exp), Dependência de aquisição (Aq: 5 = baixa), Risco (Ri: 5 = baixo). **Não somei as notas de propósito**: os pesos dependem de você.

### Oportunidade #1 — Follow-up automático de orçamentos (prestadores de serviço, BR)

- **Problema:** orçamento enviado por WhatsApp ou PDF e nunca acompanhado. O cliente esfria ou fecha com o concorrente.
- **Público:** refrigeração, elétrica, marcenaria, energia solar, reformas, desentupidoras, vidraçarias, de 1 a 20 funcionários.
- **Por que existe:** o dono é técnico e vendedor ao mesmo tempo, e o follow-up é a primeira tarefa que cai.
- **Como resolvem:** memória, lembrete no celular, planilha.
- **Problema das soluções atuais:** os CRMs genéricos (Kommo, RD) exigem configurar funil. FSMs brasileiros cobram por usuário (Field Control a partir de R$ 295/usuário/mês [S29]). Nos EUA, o Jobber só dá follow-up no plano de US$ 249 [S3].
- **Concorrentes:** Kommo, RD Station CRM [S46], Field Control, Auvo [S29]; nos EUA, Jobber, Housecall Pro, Markate [S68].
- **Preço dos concorrentes:** acima. Preço do Kommo: não verificado.
- **Evidência de demanda:**
  - **DADO [C]:** conversão de orçamentos em home services de 30–50% [S30].
  - **DADO:** 82% dos pequenos negócios usam o WhatsApp como canal principal [S27].
  - **INFERÊNCIA:** é dor real, mas o dado de perda é de fornecedor. **Evidência: Média.**
- **Possível solução:** o dono encaminha o orçamento (PDF/foto) para um número. O sistema extrai cliente, valor e serviço e roda uma sequência de follow-up pelo próprio WhatsApp do negócio. Respostas quentes voltam para o dono.
- **Como a IA ajuda:** extrai dados do PDF/foto, redige mensagens com contexto, classifica a resposta (objeção de preço, prazo, "vou pensar") e sugere contra-argumento.
- **MVP (2–3 semanas):** número de WhatsApp (API oficial) + Supabase + LLM + painel simples.
- **Funcionalidades essenciais:**
  1. Ingestão de orçamento por encaminhamento.
  2. Sequência D+1/D+3/D+7 editável.
  3. Classificação de respostas.
  4. Alerta de "lead quente" para o dono.
  5. Relatório de "R$ em orçamentos abertos × fechados".
- **Monetização:** assinatura mensal. **HIPÓTESE:** R$ 99–249/mês. Não há âncora de preço verificada para esse produto específico no Brasil.
- **Avaliação:**
  - Dificuldade técnica: Baixa–Média.
  - Complexidade comercial: Média.
  - Dependência de terceiros: Alta (Meta).
  - Potencial de expansão: Alto (vira um CRM leve).
- **Notas:** Ev 3 · Dor 4 · Conc 3 · MVP 5 · Mon 3 · Tec 4 · Exp 4 · Aq 2 · Ri 3.
- **Positivos:** ROI visível ("recuperei R$ X"); vende bem por outbound e demonstração.
- **Negativos:** ticket baixo; o dono pode não querer automação falando com o cliente dele; risco de bloqueio do número por spam se for mal configurado.
- **Vantagem defensável:** fraca no início. Possível com dados de conversão por segmento e integração com geradores de orçamento.

### Oportunidade #2 — Reativação de orçamentos e tratamentos não fechados (odontologia e estética, BR)

- **Problema:** o paciente recebe o plano de tratamento (implante, ortodontia, harmonização) e não fecha. Ninguém liga de volta.
- **Público:** clínicas odontológicas e de estética com 1–5 cadeiras.
- **Por que existe:** a recepção está ocupada com a agenda do dia, e o follow-up não tem dono.
- **Como resolvem:** recepcionista liga quando dá; CRMs como Clint e Kommo [S86].
- **Problema das soluções atuais:** o CRM exige alimentação manual. Os sistemas de gestão (Simples Dental, Clinicorp) registram o orçamento, mas não perseguem o paciente. **INFERÊNCIA:** não verifiquei se fazem.
- **Concorrentes:** Clint, SocialHub, GestãoDS, Kommo [S86]; nos EUA, Weave e Intiveo [S9][S10].
- **Preço dos concorrentes:** Clint não encontrado. Weave US$ 249–399/mês [S10].
- **Evidência de demanda:**
  - **DADO [C]:** 40–60% dos tratamentos não são agendados; consultórios dos EUA com US$ 0,5–1M parados [S9].
  - **DADO:** existe um mercado de CRM para clínicas no Brasil com 4 players disputando [S86].
  - **Evidência: Média–Forte** (há gente pagando).
- **Possível solução:** importar orçamentos abertos (CSV/exportação do sistema de gestão ou foto). A IA roda uma cadência com conteúdo educativo, opção de parcelamento e agendamento de reavaliação.
- **Como a IA ajuda:** personaliza por procedimento, trata objeções comuns (preço, medo, "vou pensar") e passa para humano.
- **MVP:** 2–4 semanas.
- **Funcionalidades essenciais:**
  1. Importação de orçamentos.
  2. Cadência por procedimento.
  3. Respostas a objeções com escalonamento.
  4. Agendamento.
  5. Painel de R$ recuperado.
- **Monetização:** mensalidade + bônus opcional por sucesso. **HIPÓTESE:** R$ 297–697/mês. Ticket do serviço alto (implante), então ROI fácil.
- **Avaliação:**
  - Dificuldade técnica: Média (importação de dados).
  - Complexidade comercial: Média.
  - Dependência de terceiros: Alta.
  - Potencial de expansão: Alto.
- **Notas:** Ev 4 · Dor 4 · Conc 3 · MVP 4 · Mon 4 · Tec 3 · Exp 4 · Aq 3 · Ri 3.
- **Positivos:** dinheiro claramente "parado" e mensurável; o dentista entende ROI.
- **Negativos:** dados de saúde (LGPD, dado sensível); regras do CFO sobre publicidade odontológica (**não verifiquei** — precisa checar); concorrência crescendo.
- **Vantagem defensável:** integração com os sistemas de gestão brasileiros e biblioteca de objeções por procedimento.

### Oportunidade #3 — Coletor de documentos para escritórios contábeis (BR)

- **Problema:** todo mês o escritório persegue extratos, notas e recibos de dezenas a centenas de clientes por WhatsApp e e-mail.
- **Público:** escritórios contábeis com 30–500 clientes PJ.
- **Por que existe:** o cliente não tem rotina, e o contador não tem como cobrar em escala sem parecer chato.
- **Como resolvem:** WhatsApp manual, portais (Gestta/Thomson Reuters [S87], Acessórias) que o cliente não usa.
- **Problema das soluções atuais:** **INFERÊNCIA:** portal exige o cliente fazer login, e o cliente mora no WhatsApp. Content Snare declara que o problema é a "ida e volta" [S13].
- **Concorrentes:** Gestta, Acessórias [S87]; internacionais TaxDome (US$ 800–1.200/usuário/ano) e Content Snare [S13].
- **Evidência de demanda:**
  - **DADO:** produtos inteiros existem só para isso lá fora [S13].
  - **DADO:** a dor aparece em conteúdo do setor contábil brasileiro [S42].
  - **Evidência: Forte** lá fora; **Média** no Brasil (sem dado quantitativo).
- **Possível solução:** checklist mensal por cliente. Cobrança automática pelo WhatsApp. O cliente responde com foto/PDF. A IA classifica ("extrato Itaú de setembro"), confere o que falta e arquiva no Drive/sistema do escritório.
- **Como a IA ajuda:** classificar documentos, detectar período errado ou documento ilegível, responder dúvidas simples.
- **MVP:** 2–3 semanas.
- **Funcionalidades essenciais:**
  1. Checklist por cliente.
  2. Lembretes escalonados.
  3. Recebimento e classificação por IA.
  4. Painel "quem falta entregar".
  5. Exportação para pasta/sistema.
- **Monetização:** por escritório, com faixas por número de clientes. **HIPÓTESE:** R$ 197–797/mês.
- **Avaliação:**
  - Dificuldade técnica: Média.
  - Complexidade comercial: Baixa–Média (contador compra ferramenta).
  - Dependência de terceiros: Alta (Meta).
  - Potencial de expansão: Alto (vira um "copiloto" do escritório).
- **Notas:** Ev 4 · Dor 4 · Conc 3 · MVP 4 · Mon 4 · Tec 3 · Exp 5 · Aq 4 · Ri 3.
- **Positivos:** um cliente (escritório) traz centenas de usuários finais; uso mensal recorrente; baixo churn provável (HIPÓTESE).
- **Negativos:** dados financeiros sensíveis; incumbentes podem copiar.
- **Vantagem defensável:** histórico de documentos, integração com sistemas contábeis e efeito de rede leve (os clientes do escritório se acostumam com o fluxo).

### Oportunidade #4 — Resposta instantânea a leads de portais (imobiliárias pequenas, BR)

- **Problema:** lead do Zap/VivaReal/OLX chega e o corretor responde horas depois.
- **Público:** imobiliárias com 3–30 corretores e corretores autônomos.
- **Por que existe:** o corretor está em visita, e os leads chegam fora do horário.
- **Como resolvem:** o corretor responde no WhatsApp quando pode; CRMs imobiliários.
- **Problema das soluções atuais:** a IA existente (Lais/Lastro, Morada.ai) é focada em **incorporadoras** (Morada atende "quase 200 incorporadoras" [S82]). **INFERÊNCIA:** imobiliárias de usado e locação são menos atendidas.
- **Concorrentes:** Lastro/Lais (Série A de R$ 85M [S82]), Morada.ai, CRMs do grupo OLX/ZAP.
- **Evidência de demanda:**
  - **DADO:** HBR 7x [S71].
  - **DADO:** só 19% das empresas do mercado imobiliário brasileiro usam IA (Brain/Abrainc) [S82].
  - **DADO não verificado:** 5h08 de primeiro contato e 47% sem resposta.
  - **Evidência: Média–Forte.**
- **Possível solução:** a IA responde em menos de 1 minuto, qualifica (tipo de imóvel, faixa, financiamento, prazo), agenda a visita e passa para o corretor.
- **MVP:** 3–4 semanas (integrar e-mails e leads dos portais).
- **Funcionalidades essenciais:**
  1. Captura de lead de portal.
  2. Resposta e qualificação.
  3. Agendamento.
  4. Roteamento para corretor.
  5. Relatório de tempo de resposta.
- **Monetização:** por imobiliária ou por corretor. **HIPÓTESE:** R$ 197–997/mês.
- **Avaliação:**
  - Dificuldade técnica: Média.
  - Complexidade comercial: Média.
  - Dependência de terceiros: Alta (portais + Meta).
  - Potencial de expansão: Alto.
- **Notas:** Ev 4 · Dor 4 · Conc 2 · MVP 3 · Mon 4 · Tec 3 · Exp 4 · Aq 3 · Ri 2.
- **Positivos:** dor aguda e cara; comissão alta por venda.
- **Negativos:** concorrentes com capital; o grupo OLX/ZAP (dono dos portais) comprou a Sohtec [S82] e pode embutir isso no próprio CRM.
- **Vantagem defensável:** baixa contra o dono do portal.

### Oportunidade #5 — Extração e controle de COI para pequenas construtoras (EUA)

- **Problema:** construtora contrata subcontratadas e precisa garantir que o seguro delas está válido. Hoje faz isso em planilha, digitando a partir do PDF ACORD 25.
- **Público:** construtoras e remodeladoras com 10–200 subcontratadas.
- **Por que existe:** as plataformas de compliance são caras (>US$ 500/mês, segundo fonte [C]) e mesmo assim exigem digitação [S16].
- **Como resolvem:** Excel e calendário; CertCove (gratuito/barato); COI Rocket (~US$ 200/mês) [S16].
- **Concorrentes:** CertCove, COI Rocket, myCOI, BCS [S16].
- **Evidência de demanda:**
  - **DADO:** existem várias ferramentas e conteúdo recorrente sobre o tema [S16].
  - **INFERÊNCIA:** a quantificação da dor é de fornecedor [C]. **Evidência: Média.**
- **Possível solução:** a construtora encaminha o e-mail com COI. A IA extrai seguradora, apólice, limites e validade, compara com os requisitos, cobra a subcontratada antes do vencimento e mantém o painel de conformidade.
- **MVP:** 2 semanas (extração de PDF + lembretes por e-mail).
- **Funcionalidades essenciais:**
  1. Endereço de e-mail para encaminhar COIs.
  2. Extração ACORD 25.
  3. Regras de requisitos mínimos.
  4. Cobrança automática de renovação.
  5. Painel e exportação.
- **Monetização:** autoatendimento, por faixa de número de subcontratadas. **HIPÓTESE:** US$ 49–199/mês, ancorado entre US$ 19 (ImageToTable) e US$ 200+ (COI Rocket) [S16].
- **Avaliação:**
  - Dificuldade técnica: Baixa–Média.
  - Complexidade comercial: Média (vender nos EUA sem estar lá).
  - Dependência de terceiros: Baixa.
  - Potencial de expansão: Médio (licenças, W-9, lien waivers).
- **Notas:** Ev 3 · Dor 3 · Conc 3 · MVP 5 · Mon 3 · Tec 4 · Exp 3 · Aq 2 · Ri 4.
- **Positivos:** sem dependência de WhatsApp; recebe em dólar; produto de autoatendimento possível.
- **Negativos:** aquisição nos EUA sem rede (SEO/ads/outbound em inglês); ticket modesto.
- **Vantagem defensável:** fraca. Só por precisão da extração e integrações (Procore, QuickBooks).

### Oportunidade #6 — Confirmação de consultas + lista de espera inteligente (clínicas, BR)

- **Problema:** no-show e horários vagos.
- **Público:** clínicas médicas, odontológicas, psicólogos, fisioterapeutas.
- **Evidência:** **DADO** [S26]: 34% das clínicas com no-show >11%; 42,2% com dificuldade de confirmar; Unimed Litoral de 36% → 90% de confirmação. **Forte.**
- **Solução atual:** Doctoralia/Feegow (Doctoralia comprou a Feegow [S80]), iClinic e a maioria dos sistemas de gestão já têm lembrete.
- **Gap:** **INFERÊNCIA:** lembrete existe; o que falta é **preencher o buraco** (oferecer automaticamente o horário liberado para a lista de espera) e reagendar conversando.
- **Concorrência:** Alta. É feature de sistema de gestão.
- **MVP:** 2 semanas.
- **Funcionalidades essenciais:**
  1. Confirmação.
  2. Remarcação por conversa.
  3. Lista de espera com oferta automática.
  4. Relatório de no-show.
  5. Integração com Google Agenda ou sistema de gestão.
- **Monetização:** R$ 99–299/mês (**HIPÓTESE**).
- **Notas:** Ev 5 · Dor 4 · Conc 2 · MVP 5 · Mon 3 · Tec 4 · Exp 3 · Aq 3 · Ri 3.
- **Risco principal:** ser feature, não produto. Só faz sentido para clínicas **sem sistema de gestão**, ou como cunha para a #2.

### Oportunidade #7 — Recuperação de clientes inativos (recorrência local: barbearias, salões, pet shops, estética, BR)

- **Problema:** o cliente some depois de 1–3 visitas e ninguém percebe.
- **Evidência:**
  - **DADO:** Thanx (EUA) vende *winback* automático para restaurantes [S22].
  - **DADO:** academias brasileiras têm evasão de 40–60%/ano [S83]; nos EUA, 50% das desistências ocorrem nos primeiros 90 dias ([C]/[B]) [S84].
  - **Evidência: Média.**
- **Solução atual:** nada, ou disparos em massa.
- **Gap:** detectar o "atrasou X dias além da frequência habitual" e mandar uma mensagem personalizada.
- **MVP:** 2 semanas (importar histórico do sistema de agendamento/planilha).
- **Funcionalidades essenciais:**
  1. Cálculo da frequência individual.
  2. Gatilho de atraso.
  3. Mensagem com oferta.
  4. Atribuição de retorno.
  5. Relatório de R$ recuperado.
- **Monetização:** R$ 79–199/mês (**HIPÓTESE**).
- **Notas:** Ev 3 · Dor 3 · Conc 3 · MVP 5 · Mon 2 · Tec 4 · Exp 3 · Aq 2 · Ri 3.
- **Negativos:** mensagem de marketing no WhatsApp custa ~R$ 0,31–0,38 cada [S25], o que corrói margem em ticket baixo; dependência do sistema de agendamento para obter dados.

### Oportunidade #8 — Régua de cobrança conversacional por vertical (escolas, cursos, academias, condomínios, BR)

- **Problema:** inadimplência recorrente; cobrar é constrangedor e manual.
- **Evidência:**
  - **DADO:** Asaas cobra por cobrança recebida e R$ 0,55 por mensagem de WhatsApp [S28].
  - **DADO:** no Reino Unido, 86h/ano gastas perseguindo pagamento [S14].
  - **Evidência: Forte** (gente paga).
- **Gap:** **INFERÊNCIA:** os gateways cobram bem, mas não **negociam**. Uma IA que propõe acordo, parcelamento e segunda via dentro de limites definidos pelo dono.
- **Concorrência:** Alta (Asaas, Iugu, bancos digitais, Cora).
- **MVP:** 2–3 semanas (sobre a API do Asaas, por exemplo).
- **Notas:** Ev 4 · Dor 4 · Conc 2 · MVP 4 · Mon 3 · Tec 3 · Exp 3 · Aq 3 · Ri 3.
- **Risco:** regras de cobrança do CDC (sem constrangimento, horários). **Não verifiquei.**

### Oportunidade #9 — Orçamento por foto/voz para pequenos prestadores (BR) ("AI Quote Agent")

- **Problema:** fazer orçamento leva tempo, e quem responde primeiro ganha.
- **Evidência:**
  - **DADO:** Markate lançou orçamento por foto em menos de 60s [S68].
  - **DADO [C]:** no Handwerk alemão, 2–4h por orçamento [S56].
  - **DADO:** o app brasileiro "Meu Ajudante" teria 35 mil usuários (fonte fraca) [S81].
  - **Evidência: Média.**
- **Gap:** gerar orçamento profissional em PDF a partir de áudio de WhatsApp + tabela de preços do prestador.
- **MVP:** 1–2 semanas.
- **Notas:** Ev 3 · Dor 3 · Conc 3 · MVP 5 · Mon 2 · Tec 4 · Exp 4 · Aq 2 · Ri 3.
- **Negativos:** ticket baixo (autônomo paga pouco), muitos apps gratuitos. **Melhor como cunha da #1.**

### Oportunidade #10 — Ferramenta de reputação simples, mensal e sem contrato

- **Problema:** pedir avaliação no Google e responder avaliações.
- **Evidência:** **DADO:** Podium e Birdeye caros e com contrato; Trustpilot do Birdeye 1,7/5 [S6][S7]; NiceJob a partir de US$ 45, Grade.us US$ 99 [S65]. **Forte.**
- **Gap:** preço e contrato. **INFERÊNCIA:** no Brasil, o pedido via WhatsApp pós-atendimento quase não é explorado por ferramenta dedicada (**não verificado**).
- **Concorrência:** Alta e barata. Agências GoHighLevel embutem isso [S64].
- **Notas:** Ev 5 · Dor 3 · Conc 1 · MVP 5 · Mon 2 · Tec 5 · Exp 2 · Aq 2 · Ri 3.
- **Conclusão honesta:** é commodity. Só vale como **feature** dentro de outro produto.

### Oportunidade #11 — Recepção de chamados de manutenção (administradoras e pequenos proprietários, BR)

- **Problema:** inquilino manda mensagem a qualquer hora; o administrador encaminha para o prestador; ninguém acompanha.
- **Evidência:** **DADO:** fórum BiggerPockets (usuários reais) [S58]; Buildium diz que 72% dos inquilinos insatisfeitos citam comunicação [S58]. **Média.**
- **Gap:** triagem por IA (urgência, foto), despacho para o prestador e status para o inquilino, tudo no WhatsApp.
- **MVP:** 2–3 semanas.
- **Notas:** Ev 3 · Dor 3 · Conc 3 · MVP 4 · Mon 3 · Tec 4 · Exp 3 · Aq 3 · Ri 3.
- **Ressalva:** a evidência é dos EUA. O mercado brasileiro de administradoras não foi pesquisado.

### Oportunidade #12 — Diário de obra por áudio (construção pequena, BR/EUA)

- **Problema:** relatório diário de obra é chato e ninguém faz. Depois falta prova em disputa.
- **Evidência:** **DADO:** Procore e Contractor Foreman vendem diário de obra [S35]. **Média.**
- **Gap:** o mestre de obras manda áudio e fotos no WhatsApp, e a IA monta o relatório (clima, equipe, atividades, problemas).
- **Notas:** Ev 3 · Dor 3 · Conc 3 · MVP 5 · Mon 3 · Tec 4 · Exp 3 · Aq 2 · Ri 3.

### Oportunidade #13 — Faturamento automático para transportadores autônomos (EUA)

- **Problema:** rate confirmation e BOL em PDF → fatura → factoring, tudo digitado.
- **Evidência:** **DADO:** TruckingOffice a partir de US$ 20 com queixa de "muita digitação" [S32]. **Média.**
- **Gap:** extração por IA. **Notas:** Ev 3 · Dor 3 · Conc 3 · MVP 4 · Mon 2 · Tec 4 · Exp 3 · Aq 2 · Ri 3.

### Oportunidade #14 — Triagem e confirmação de candidatos horistas via WhatsApp (BR)

- **Problema:** candidato marca entrevista e não aparece; contratado não aparece no 1º dia.
- **Evidência:** **DADO:** CFIB: 36% dos donos já contrataram quem nunca apareceu [S77]; Indeed: 84% dos empregadores com candidatos que faltaram à entrevista [S77]. **Forte** (dor), **Fraca** (disposição para pagar no BR, não encontrada).
- **Notas:** Ev 3 · Dor 4 · Conc 3 · MVP 4 · Mon 2 · Tec 4 · Exp 3 · Aq 2 · Ri 3.

### Oportunidade #15 — Intake jurídico via WhatsApp (escritórios pequenos, BR)

- **Evidência:** **DADO** dos EUA (Clio) [S31]. **Não encontrei dado brasileiro.**
- **Risco:** regras da OAB sobre captação e publicidade (**não verificado**).
- **Notas:** Ev 3 · Dor 3 · Conc 3 · MVP 4 · Mon 3 · Tec 4 · Exp 3 · Aq 3 · Ri 2.

### Oportunidade #16 — Orçamento por satélite para jardinagem, limpeza de telhado e energia solar (BR)

- **Evidência:** **DADO:** nos EUA, mercado ativo com Deep Lawn, QuoteIQ, PropertyIntel e SiteRecon (US$ 39–199) [S52]. **Forte** (EUA).
- **INFERÊNCIA:** no Brasil, energia solar (dimensionamento de telhado) pode ser o segmento com mais dinheiro. **Não pesquisado.**
- **Notas:** Ev 3 · Dor 3 · Conc 3 · MVP 3 · Mon 3 · Tec 2 · Exp 3 · Aq 3 · Ri 3.

### Oportunidade #17 — Agendamento + depósito via Pix para estúdios de tatuagem e beleza independentes (BR)

- **Evidência:** **DADO:** depósito reduz no-show (OpenTable, 1–7%) [S78]; apps de tatuagem cobram US$ 35–65 por artista [S75]. **Média.**
- **Gap:** cobrar por estúdio, com depósito Pix nativo.
- **Concorrência:** Alta (Booksy, Trinks, AppBarber [S44]).
- **Notas:** Ev 3 · Dor 3 · Conc 2 · MVP 4 · Mon 2 · Tec 4 · Exp 2 · Aq 2 · Ri 3.

### Oportunidade #18 — Camada de IA para corretoras de seguro (requote e renovações, BR/EUA)

- **Evidência:** **DADO:** Quandri lançou requote com IA [S49]; 65 min/submissão (caso [C]). **Média.**
- **Negativos:** integração com portais de seguradoras é difícil (agentes de navegador frágeis); regulação SUSEP no BR (**não verificado**).
- **Notas:** Ev 3 · Dor 4 · Conc 3 · MVP 2 · Mon 4 · Tec 2 · Exp 4 · Aq 3 · Ri 2.

### Oportunidade #19 — Detector de evasão para academias e estúdios (BR)

- **Evidência:**
  - **DADO:** evasão de 40–60% (ACAD) [S83].
  - **DADO [B/C]:** quem vai menos de 4x no 1º mês tem ~80% de chance de cancelar (Gymdesk) [S84].
  - **Média–Forte** (dor). Disposição para pagar não verificada.
- **Gap:** ler os check-ins do sistema da academia e acionar o professor e uma mensagem no momento certo.
- **Dependência:** integração com o sistema da academia (Tecnofit e outros: **não verifiquei se têm API**).
- **Notas:** Ev 4 · Dor 4 · Conc 3 · MVP 3 · Mon 3 · Tec 3 · Exp 3 · Aq 3 · Ri 3.

### Oportunidade #20 — Kit de e-fatura e MTD para microempresas da UE e do Reino Unido

- **Evidência:** **DADO** forte e obrigatória [S53][S54][S55].
- **Por que está aqui mesmo assim:** é a demanda mais garantida da pesquisa.
- **Por que provavelmente NÃO é para você:**
  - Exige reconhecimento pelo HMRC (MTD) e conhecimento fiscal de cada país.
  - Compete com Xero, Sage, QuickBooks e dezenas de provedores Peppol.
  - Não tem vantagem para uma equipe brasileira.
- **Notas:** Ev 5 · Dor 4 · Conc 1 · MVP 2 · Mon 3 · Tec 2 · Exp 3 · Aq 2 · Ri 2.

---

## 5. 10 BORING SAAS

Problemas simples e específicos pelos quais já existe pagamento comprovado em algum mercado. Todos os preços sugeridos são **HIPÓTESE**.

| # | Software para… | …fazer o quê | Prova de que alguém paga | Preço BR sugerido |
|---|---|---|---|---|
| 1 | Construtoras pequenas | Controlar seguros e documentos de subcontratadas com lembrete automático | CertCove, COI Rocket [S16] | US$ 49–199 (EUA) |
| 2 | Escritórios contábeis | Cobrar documentos do mês pelo WhatsApp e arquivar sozinho | TaxDome, Content Snare [S13] | R$ 197–797 |
| 3 | Dedetizadoras | Agenda de retorno com garantia e certificado de execução | GorillaDesk US$ 49–299 [S47] | R$ 99–249 |
| 4 | Locadoras de festa e infláveis | Reserva, disponibilidade de estoque e sinal via Pix | Goodshuffle US$ 39+, InflatableOffice até US$ 225 [S48] | R$ 79–199 |
| 5 | Empresas de vigilância | Relatório de ronda por QR + foto, enviado ao cliente | Silvertrac US$ 249+ [S69] | R$ 199–499 |
| 6 | Empresas de limpeza comercial | Calculadora de proposta por m² e frequência | CleanGuru US$ 75 [S67] | R$ 79–149 |
| 7 | Oficinas mecânicas | Orçamento com fotos aprovado pelo cliente no WhatsApp | 65% sem sistema (BR) [S43]; Tekmetric (EUA) [S20] | R$ 99–199 |
| 8 | Transportadores autônomos | PDF da carga → fatura → envio para factoring | TruckingOffice [S32] | US$ 29–79 (EUA) |
| 9 | Pequenos senhorios e administradoras | Receber chamado de manutenção, triar e acompanhar | BiggerPockets [S58] | R$ 99–299 |
| 10 | Mudanças pequenas | Orçamento por vídeo/lista de itens + agenda de caminhão | SmartMoving a partir de ~US$ 600 [S51] | R$ 149–299 |

---

## 6. 15 IDEIAS "NICHO DENTRO DO NICHO"

Formato: Mercado → Segmento → Problema → Solução. Todas são **HIPÓTESE** de produto, ancoradas nas fontes citadas.

1. **Marketing** → restaurantes de delivery → cliente que pediu 1x e não voltou → recompra via WhatsApp com cupom no "dia habitual" [S22][S41].
2. **CRM** → dentistas → orçamento de implante e ortodontia não fechado → cadência de reativação com parcelamento [S9][S86].
3. **CRM** → energia solar residencial → proposta enviada e não fechada → follow-up com simulação de economia (**não pesquisado; validar**).
4. **Agendamento** → clínicas de fisioterapia → paciente abandona o pacote de sessões → alerta de falta + reengajamento [S26].
5. **Cobrança** → escolas de idiomas e cursos livres → mensalidade atrasada → régua conversacional com acordo [S28].
6. **Cobrança** → condomínios pequenos sem administradora → inadimplência de taxa → cobrança automática + prestação de contas [S76].
7. **Atendimento** → imobiliárias de locação → inquilino pedindo manutenção → triagem por IA + despacho [S58].
8. **Vendas** → imobiliárias pequenas → lead de portal sem resposta → resposta em menos de 1 min + qualificação [S82].
9. **Documentos** → contadores → documentos do mês → coletor no WhatsApp [S13].
10. **Documentos** → construtoras → COI de subcontratadas → extração + lembrete [S16].
11. **Operações** → construção → diário de obra → relatório gerado de áudio [S35].
12. **RH** → restaurantes e varejo → candidato que some → triagem e confirmação automática [S77].
13. **Retenção** → academias de bairro → aluno que para de ir no 1º mês → alerta ao professor + mensagem [S83][S84].
14. **Orçamento** → jardinagem e limpeza de telhado → medir área → orçamento por satélite [S52].
15. **Reputação** → oficinas e pet shops → avaliação no Google após o serviço → pedido automático no WhatsApp [S65].

---

## 7. 10 OPORTUNIDADES COM IA

| # | Tipo de agente | Oportunidade | Onde a IA é essencial (e não decorativa) | Evidência |
|---|---|---|---|---|
| 1 | AI Follow-up Agent | Follow-up de orçamentos (#1) | Ler orçamento, responder objeções com contexto | M [S30] |
| 2 | AI Sales Agent | Reativação de tratamentos (#2) | Conversa com objeções de preço e medo | M–F [S9][S86] |
| 3 | AI Document Worker | Coletor contábil (#3) | Classificar documento, detectar o que falta ou está errado | F [S13] |
| 4 | AI Sales Agent | Lead imobiliário (#4) | Qualificar em linguagem natural 24/7 | M–F [S71][S82] |
| 5 | AI Document Worker | COI (#5) | Extrair campos de PDF heterogêneo | M [S16] |
| 6 | AI Quote Agent | Orçamento por foto/voz (#9) | Transformar áudio e foto em itens com preço | M [S68] |
| 7 | AI Back Office | Faturamento de cargas (#13) | Extrair rate con/BOL | M [S32] |
| 8 | AI Operations Agent | Diário de obra (#12) | Áudio → relatório estruturado | M [S35] |
| 9 | AI Scheduling Agent | Remarcação e lista de espera (#6) | Negociar novo horário em conversa | F [S26] |
| 10 | AI Customer Service | Chamados de manutenção (#11) | Triar urgência por texto e foto | M [S58] |

**Onde a IA NÃO é diferencial:** lembrete de consulta, pedido de avaliação, disparo de cobrança simples. Isso é automação com regras; IA ali só aumenta custo e risco.

---

## 8. 10 OPORTUNIDADES COM WHATSAPP

Contexto: **DADO** 82% dos pequenos negócios brasileiros usam o WhatsApp como principal canal de comunicação e venda [S27]. Custos por mensagem no Brasil (2026, segundo [S25]):
- Utilidade: ~R$ 0,04–0,05.
- Marketing: ~R$ 0,31–0,38.
- Serviço na janela de 24h: R$ 0 (com a ressalva sobre outubro/2026 de [S70]).

**Implicação:** produtos que dependem de **mensagens de marketing** em massa têm margem pior que os de **utilidade** (confirmação, cobrança, status).

| # | Processo hoje feito no WhatsApp | Workflow automatizável | Categoria de mensagem predominante (INFERÊNCIA) |
|---|---|---|---|
| 1 | Enviar orçamento e "e aí, fechou?" | Cadência de follow-up | Marketing/utilidade (zona cinza; verificar classificação da Meta) |
| 2 | Confirmar consulta | Confirmação + remarcação + lista de espera | Utilidade |
| 3 | Cobrar mensalidade | Régua + Pix + acordo | Utilidade |
| 4 | Pedir documentos ao cliente do contador | Checklist + recebimento + classificação | Utilidade |
| 5 | Receber pedido de delivery | Pedido estruturado (Anota AI já faz [S79]) | Serviço |
| 6 | Aprovar orçamento de oficina | Link com fotos + aprovar/recusar | Utilidade |
| 7 | Chamado de manutenção | Triagem + despacho + status | Serviço/utilidade |
| 8 | Lead de portal imobiliário | Resposta e qualificação | Serviço (lead inicia) ou marketing |
| 9 | Pós-venda e avaliação | Pedido de avaliação no Google | Marketing |
| 10 | Diário de obra (áudios no grupo) | Relatório estruturado | Interno (pode nem usar a API) |

**Riscos específicos:**
- Política de IA da Meta (bots de propósito geral proibidos desde 15/1/2026; bots de negócio permitidos) [S24].
- Bloqueio do número por denúncias de spam.
- Usar APIs **não oficiais** (WhatsApp Web automatizado) é comum no Brasil, é mais barato e viola os termos. **Não recomendo construir negócio em cima disso.**

---

## 9. 10 IDEIAS PARA OUTBOUND

Critério: o alvo é encontrável no Google Maps ou em diretórios, o problema é *observável de fora* e a demonstração cabe em 10 minutos.

| # | Produto | Como encontrar | Sinal observável antes do contato | Demo de 10 min |
|---|---|---|---|---|
| 1 | Follow-up de orçamentos (#1) | Maps: "ar condicionado", "energia solar" | Peça um orçamento e meça se fazem follow-up (cliente oculto) | "Você não me respondeu em 3 dias; olha o que o sistema faria" |
| 2 | Reativação odontológica (#2) | Maps: "implante dentário" | Cliente oculto pedindo orçamento | Simulação com 10 orçamentos fictícios |
| 3 | Coletor contábil (#3) | CRC, Maps: "contabilidade" | Escritórios com mais de 3 funcionários no LinkedIn | Fluxo real no celular do contador |
| 4 | Lead imobiliário (#4) | Anunciantes no Zap/VivaReal | Mandar lead e cronometrar a resposta | Mostrar o próprio tempo de resposta |
| 5 | Confirmação + lista de espera (#6) | Maps: clínicas | Ligar e perguntar se confirmam por WhatsApp | Simulação no WhatsApp do dono |
| 6 | Reputação (#10) | Maps: nota < 4,3 ou poucas avaliações | Contagem de avaliações visível | Comparativo com o concorrente da rua |
| 7 | Oficinas (#20 da tabela) | Maps: "oficina mecânica" | Pedir orçamento e ver como chega | Orçamento com fotos gerado na hora |
| 8 | Locadoras de festa | Instagram e Maps | Reserva só por DM | Página de reserva com sinal Pix |
| 9 | Recuperação de inativos (#7) | Barbearias e pet shops no Maps | Programa de fidelidade em papel | Lista de "clientes sumidos" a partir da agenda |
| 10 | COI (#5, EUA) | Listas de licenças de contratantes estaduais | Não observável | Extração ao vivo de um PDF ACORD 25 |

**Concorrente real do outbound local:** agências que vendem GoHighLevel em white-label. A partir de US$ 497/mês para a agência, elas revendem "CRM + missed call text back + reviews" a ~US$ 97+ por cliente [S64]. **INFERÊNCIA:** para ganhar delas, o produto precisa ser **vertical e mais simples**, não "mais um CRM".

---

## 10. PRODUTOS ESTRANGEIROS INTERESSANTES (e adaptação, não cópia)

| Produto original | Problema que resolve | Mercado | Adaptação possível ao BR | Diferencial |
|---|---|---|---|---|
| Avoca / Rosie / Goodcall [S8][S36] | Chamada perdida em home services | EUA | O equivalente brasileiro é **mensagem de WhatsApp sem resposta e orçamento sem follow-up**, não telefone | Canal (WhatsApp) + vertical |
| Thanx [S22] | Winback de restaurante | EUA, redes | Recompra para delivery independente que quer fugir do iFood | Barato, sem app, via WhatsApp |
| Content Snare / TaxDome [S13] | Coleta de documentos do contador | EUA, AU, Reino Unido | Coletor no WhatsApp; o cliente brasileiro não usa portal (INFERÊNCIA) | Zero login para o cliente final |
| Weave / Intiveo [S9][S10] | Comunicação e reativação odontológica | EUA | Reativação de orçamentos sobre os sistemas de gestão BR | Foco em R$ recuperado |
| Jobber / Housecall Pro [S3][S4] | Gestão de serviços de campo | EUA, CA, Reino Unido, AU | Field Control/Auvo já existem [S29]; brecha para 1–5 técnicos, preço por empresa | Preço por empresa, orçamento no WhatsApp |
| CertCove / myCOI [S16] | Compliance de subcontratadas | EUA | Pouco aplicável ao BR (o seguro não é exigido da mesma forma; não verificado) | Melhor vender nos EUA |
| Deep Lawn / QuoteIQ [S52] | Orçamento por satélite | EUA | Energia solar, limpeza de telhado, jardinagem de condomínio | Base de imagens BR (verificar qualidade) |
| PetDesk / Vetstoria [S50] | Lembretes veterinários | EUA, UE | Vacinas e retornos de pet via WhatsApp | Preço BR |
| Turno [S34] | Limpeza de virada em aluguel de temporada | EUA | Litoral brasileiro com anfitriões multi-imóvel | Marketplace (evitar no início) |
| Markate Kate AI [S68] | Orçamento por foto | EUA | Orçamento por áudio de WhatsApp | Áudio é nativo no BR |

---

## 11. CONCORRÊNCIA (principais empresas encontradas)

| Empresa | Produto | Público | Preço (via agregador; confirmar) | Recurso principal | Reclamações recorrentes | Fonte |
|---|---|---|---|---|---|---|
| Jobber | FSM | Serviços de campo SMB | US$ 49 / 129 / 249 / 699 (anual) | Orçamento, agenda, fatura | Follow-up só em plano alto | S3 |
| Housecall Pro | FSM | Serviços de campo SMB | US$ 59–299 | Agenda, fatura | Suporte só por IA/chat no plano Basic; cancelamento | S4 |
| ServiceTitan | FSM enterprise | HVAC e encanamento médios | US$ 250–500/técnico + implantação | Suíte completa | Preço, contrato de 3 anos | S5 |
| Podium | Mensagens + reviews | Local | US$ 399–599, 12 meses | Inbox + reviews | Cancelamento, renovação | S6 |
| Birdeye | Reputação | Local, multi-local | US$ 299–449/local | Reviews | Renovação automática; Trustpilot 1,7 | S7 |
| NiceJob / Grade.us | Reviews | SMB | US$ 45–175 / US$ 99 | Pedido de review | Preço para quem só quer coletar | S65 |
| Weave | Comunicação clínica | Odonto/médico EUA | US$ 249–399 + US$ 750 de setup | Telefone + SMS | Contrato; custo de exportação | S10 |
| Overjet / VideaHealth | IA odontológica | Odonto EUA | Não encontrado | Elegibilidade, imagem | Não encontrado | S11 S91 |
| Mindbody | Gestão fitness | Estúdios | Até US$ 469+ | Agenda + marketplace | Aumentos, multa de saída | S18 |
| HoneyBook | CRM criativos | Fotógrafos, eventos | US$ 36 / 59 / 129 | Contratos, faturas | Aumento de 2025 | S17 |
| Toast | POS | Restaurantes EUA | Processamento de 2,49% + 15¢ | POS | Lock-in, taxas | S89 |
| Avoca | IA de voz | Home services | Não encontrado | Atendimento e despacho | Não encontrado | S36 |
| GoHighLevel | CRM white-label | Agências | US$ 297–497 (agência) | Tudo-em-um | Cobranças, entregabilidade | S64 |
| Field Control / Auvo | FSM BR | Manutenção BR | R$ 295/usuário (Field Control) | OS, geolocalização | Não encontrado | S29 |
| Kommo / RD Station | CRM + WhatsApp | PMEs BR | Não verificado | Funil + WhatsApp | Preço modular confuso (RD, segundo a Kommo) | S46 |
| Clint / SocialHub / GestãoDS | CRM para clínicas | Clínicas BR | Não encontrado | WhatsApp + funil | Não encontrado | S86 |
| Lastro (Lais) / Morada.ai | IA imobiliária | Incorporadoras BR | Não encontrado | Qualificação no WhatsApp | Não encontrado | S82 |
| Anota AI (iFood) | Atendente de restaurante | Delivery BR | R$ 178,99+/mês (anual) | Pedidos no WhatsApp | Não encontrado | S79 |
| Asaas | Cobrança | PMEs BR | Boleto R$ 1,84; Pix R$ 1,24; WhatsApp R$ 0,55/msg | Régua de cobrança | Não encontrado | S28 |
| Zenvia / Octadesk / Blip | Atendimento omnichannel | PMEs/médias BR | Zenvia a partir de R$ 100; Octadesk a partir de ~R$ 1.542 | Chatbot, inbox | Não encontrado | S70 |

---

## 12. MODELOS DE MONETIZAÇÃO OBSERVADOS

| Modelo | Exemplos (DADO) | Observação crítica |
|---|---|---|
| Por técnico ou usuário | ServiceTitan US$ 250–500/técnico [S5]; Field Control R$ 295/usuário [S29]; Shopmonkey +US$ 20/assento [S20] | Gera queixa de preço em times pequenos; abre espaço para "preço por empresa" |
| Por local | Birdeye US$ 299–449/local [S7]; Homebase US$ 30–120/local [S38]; Vetstoria €149/local [S50] | Bom para multi-unidade |
| Planos por recurso | Jobber [S3]; HoneyBook [S17] | Recurso crítico preso no plano caro = brecha |
| Contrato anual com renovação automática | Podium [S6]; Birdeye [S7]; Mindbody [S18] | Principal fonte de ódio em reviews; **diferencial: mensal sem multa** |
| Por transação | Asaas por cobrança [S28]; OpenTable 2% [S78]; Toast 2,49% [S89] | Alinha custo e uso; o cliente percebe como "imposto" |
| Comissão de marketplace | iFood 12–23% + 3,2% [S41]; Treatwell 35% [S19] | Gera demanda por canal próprio |
| Por sucesso | Rocket Money 35–60% da economia [S61] | Fácil de vender, ruim de prever; gera atrito |
| Freemium + add-ons | Trainerize [S57]; CertCove [S16] | Funciona em autoatendimento, mas gera queixas de "tudo é extra" |
| Setup + mensalidade | Weave US$ 750 de setup [S10]; ServiceTitan implantação [S5] | Viável no BR para ticket acima de R$ 500 |

**Faixa realista para o Brasil (INFERÊNCIA):** produtos de "uma dor" para pequeno negócio local tendem a R$ 79–299/mês. Produtos com ROI direto e alto (odontologia, imóveis, contabilidade multi-cliente) sustentam R$ 300–1.000/mês. A meta de R$ 100–500/mês é plausível; acima disso exige ROI provado em reais.

---

## 13. OPORTUNIDADES DE MVP (construíveis em 7–30 dias)

**Stack comum:** WhatsApp Cloud API (oficial), Supabase/Postgres, Stripe ou Asaas/Pagar.me para BR, Claude/OpenAI para extração e conversa, Google Calendar/Drive APIs.

| Oportunidade | Prazo estimado de MVP (INFERÊNCIA) | Maior risco técnico |
|---|---|---|
| #5 COI (EUA) | 7–14 dias | Precisão da extração em PDFs escaneados |
| #9 Orçamento por áudio | 7–14 dias | Qualidade do preço sem tabela do prestador |
| #1 Follow-up de orçamentos | 14–21 dias | Templates aprovados pela Meta; classificação marketing × utilidade |
| #6 Confirmação + lista de espera | 14–21 dias | Integração com a agenda do sistema de gestão |
| #3 Coletor contábil | 14–30 dias | Classificação de documentos variados; LGPD |
| #2 Reativação odontológica | 21–30 dias | Importar dados dos sistemas de gestão |
| #12 Diário de obra | 7–14 dias | Adoção pelo mestre de obras |
| #4 Lead imobiliário | 21–30 dias | Captura de leads dos portais (e-mail/integração) |

**Fora do escopo de MVP rápido:** #18 (seguros; portais de seguradoras), #20 (e-fatura/MTD; certificação), FSM completo (#3 da tabela), POS (#25 da tabela).

---

## 14. ONDE A IA REALMENTE CRIA VANTAGEM

1. **Documentos não estruturados → dado estruturado:** COI, extratos, notas, rate cons, orçamentos em foto. A dor é digitação e a IA elimina a digitação [S16][S32][S49].
2. **Conversa com objeção:** reativação de orçamento ou tratamento, qualificação de lead. Regras fixas não respondem "achei caro, tem parcelamento?" [S9][S71].
3. **Áudio → relatório:** diário de obra, orçamento falado. No Brasil, áudio de WhatsApp é comportamento nativo (INFERÊNCIA).
4. **Triagem:** chamados de manutenção com foto, urgência de pedidos.

**Onde a IA é hype para SMB (INFERÊNCIA):** "agente de navegador genérico", "funcionário de IA que faz tudo", chatbots de propósito geral no WhatsApp (proibidos pela Meta desde 1/2026 [S24]).

**Sinal de mercado:**
- **DADO:** ~50% do lote Spring 2025 da YC eram "AI agents" (67 de 144) [S37].
- **DADO:** capital de VC migrando para vertical AI [S36].
- **INFERÊNCIA:** isso valida a categoria **e** garante concorrência bem financiada nos EUA. Equipes pequenas devem ir para nichos estreitos ou mercados (como o BR) onde esses players ainda não chegaram.

---

## 15. GAPS DE MERCADO (reclamação recorrente + solução insuficiente)

| Gap | Onde | Evidência |
|---|---|---|
| GAP 1 — Caro | ServiceTitan, Podium, Birdeye, Mindbody, SmartMoving, Weave | S5 S6 S7 S18 S51 S10 |
| GAP 2 — Complexo | ServiceTitan "overkill" para pequenos; Dentrix com "cliques demais"; Handwerk "zu kompliziert" | S5 S12 S56 |
| GAP 3 — Genérico → vertical | CRM genérico → clínica (Clint), imóveis (Lastro), restaurante (Anota AI): **o mercado BR já está verticalizando** | S86 S82 S79 |
| GAP 4 — Manual | COI, documentos contábeis, rate cons, verificação de seguro | S16 S13 S32 S11 |
| GAP 5 — Muitas ferramentas | Clint posiciona "CRM + automação + IA + mensagens" para substituir 3–4 ferramentas | S86 |
| GAP 6 — IA | Extração, reativação, qualificação | Seção 14 |
| GAP 7 — Negligenciado | Imobiliárias pequenas (IA focada em incorporadoras); oficinas BR (65% sem sistema) | S82 S43 |
| GAP 8 — UX ruim | Dentrix, PestPac ("design desatualizado") | S12 S47 |
| GAP 9 — Atendimento | Advocacia (~40% atendem), imóveis, clínicas | S31 S26 |
| GAP 10 — WhatsApp | Confirmação, cobrança, documentos, orçamentos | S27 |

---

## 16. IDEIAS PARA INVESTIGAR MAIS (promissoras, evidência insuficiente)

1. **Glosas de convênio em clínicas BR.** HIPÓTESE: as operadoras negam guias e as clínicas contestam manualmente. **Não pesquisado.** Pode ser grande e com ROI direto.
2. **Reforma Tributária BR (CBS/IBS, transição a partir de 2026).** HIPÓTESE: cria demanda forçada como a e-fatura na Europa. **Não pesquisado.** Verificar cronograma oficial.
3. **Energia solar: follow-up de propostas e dimensionamento por satélite.** Segmento com ticket alto. **Não pesquisado no BR.**
4. **Contestação de contas médicas (consumidor EUA).** 78% dos que contestam vencem [S62], mas aquisição B2C é cara e já há startups (Remedy, Sheer Health, FairMedBill).
5. **Coordenação de limpeza de temporada no litoral BR.** Turno domina nos EUA [S34]; marketplace (efeito de rede) é desaconselhado no início.
6. **Ghosting de contratação horista no BR.** Dor forte [S77], disposição para pagar desconhecida.
7. **Corretoras de seguro (SUSEP): camada de IA.** Dor média, integração difícil [S49].
8. **Agências de outbound local como CANAL, não concorrente.** HIPÓTESE: vender seu produto vertical para agências revenderem (modelo GoHighLevel invertido) [S64].
9. **Lacuna pós-Bench nos EUA:** "bookkeeping de confiança" [S73]. Fraco para equipe pequena brasileira.
10. **E-fatura para micro empresas belgas e francesas** [S55]. Demanda obrigatória; só com parceiro local.

---

## 17. SELEÇÃO FINAL: 5 OPORTUNIDADES PARA INVESTIGAÇÃO PROFUNDA (sem ranking)

**Critério de seleção, aplicado de forma objetiva:**
- Evidência ao menos Média.
- MVP em até 30 dias.
- Quem paga é claro.
- Não depende de hardware nem de marketplace.
- Não compete de frente com player de mais de US$ 100M no mesmo mercado e canal.

**A ordem abaixo é alfabética por letra, não de preferência.**

### (A) Follow-up de orçamentos via WhatsApp para prestadores de serviço (BR)

- **Problema encontrado:** orçamentos sem acompanhamento. Conversão típica de 30–50% em home services ([C], S30); recurso escondido em plano caro no líder dos EUA (S3).
- **Evidências existentes:** S3, S27, S30 e S68 (Markate investindo em velocidade de orçamento). **Lacuna: nenhum dado brasileiro.**
- **Quem paga:** o dono da empresa de serviço (refrigeração, solar, reformas, vidraçaria, marcenaria).
- **Concorrentes:** Kommo, RD Station CRM, Field Control, Auvo, Jobber (EUA).
- **Lacuna encontrada:** produto *só de follow-up*, sem exigir que o cliente adote um CRM ou FSM inteiro.
- **MVP possível:** encaminhar orçamento → cadência automática → alerta de resposta quente → relatório de R$ em aberto.
- **Primeiros 10 clientes:** cliente oculto em 50 empresas do Maps (pedir orçamento e medir follow-up) → mostrar o resultado a quem não fez follow-up → piloto gratuito de 14 dias para os 10 mais receptivos.
- **Primeiros 100:**
  - Estudos de caso com R$ recuperado.
  - Parcerias com distribuidores de equipamentos (ar-condicionado, solar), que têm a lista de instaladores.
  - Grupos e associações do setor.
- **Preço potencial (HIPÓTESE):** R$ 99–249/mês.
- **Principais riscos:**
  - Ticket baixo × custo de aquisição.
  - O dono não querer automação falando com o cliente.
  - Classificação de templates pela Meta.
  - Concorrente de CRM copiar.
- **Hipóteses a validar:**
  1. Mais de 50% das empresas não fazem follow-up sistemático.
  2. O dono aceita mensagem automática.
  3. O ROI aparece em até 30 dias.
  4. Ele paga mais de R$ 99.

### (B) Reativação de orçamentos e tratamentos não fechados em clínicas odontológicas e estéticas (BR)

- **Problema encontrado:** grande volume de planos de tratamento não convertidos ([C], S9). Mercado brasileiro de CRM para clínicas ativo (S86).
- **Evidências existentes:** S9, S10 (Weave cobra até US$ 399), S26 (dor de comunicação em clínicas BR), S86.
- **Quem paga:** dono ou gestor da clínica.
- **Concorrentes:** Clint, SocialHub, GestãoDS, Kommo, módulos dos sistemas de gestão.
- **Lacuna encontrada (INFERÊNCIA):** os CRMs são genéricos para "funil de clínica". Falta um produto que **comece pelos orçamentos já perdidos** (dinheiro parado) e meça R$ recuperado.
- **MVP possível:** importar CSV/exportação de orçamentos abertos → cadência por procedimento → agendamento de reavaliação.
- **Primeiros 10 clientes:** dentistas da sua rede; cliente oculto pedindo orçamento de implante e medindo o follow-up; oferta de "reativamos sua base de orçamentos antigos, você paga só se agendar".
- **Primeiros 100:** fornecedores de implante, laboratórios de prótese e consultorias odontológicas como canal; conteúdo com números reais.
- **Preço potencial (HIPÓTESE):** R$ 297–697/mês, ou bônus por agendamento no piloto.
- **Principais riscos:**
  - LGPD (dado de saúde é sensível).
  - Regras do CFO sobre publicidade (**não verificado**).
  - Exportação de dados dos sistemas de gestão.
  - Concorrência crescente.
- **Hipóteses a validar:**
  1. A clínica tem mais de 30 orçamentos abertos com mais de 30 dias.
  2. A recepção não faz follow-up sistemático.
  3. A taxa de reagendamento por reativação passa de 5%.
  4. O dono paga mensalidade depois do piloto.

### (C) Coletor de documentos para escritórios contábeis via WhatsApp (BR)

- **Problema encontrado:** cobrar documentos mensalmente de dezenas ou centenas de clientes. Produtos dedicados existem lá fora (S13); a dor aparece no Brasil (S42).
- **Evidências existentes:** S13, S42, S87 (Gestta e Acessórias mostram que contador paga software). **Lacuna: dado quantitativo brasileiro.**
- **Quem paga:** o escritório contábil.
- **Concorrentes:** Gestta (Thomson Reuters), Acessórias e outros sistemas de escritório; TaxDome e Content Snare lá fora.
- **Lacuna encontrada (INFERÊNCIA):** portais exigem login do cliente final. O coletor via WhatsApp com IA não exige.
- **MVP possível:** checklist por cliente → lembretes → recebimento e classificação por IA → painel de pendências → exportação para pasta.
- **Primeiros 10 clientes:** contadores da rede; grupos de contadores; demonstração com os clientes reais do escritório em piloto.
- **Primeiros 100:** parceria com sistemas contábeis; eventos do CRC; conteúdo "quantas horas seu escritório perde cobrando documento".
- **Preço potencial (HIPÓTESE):** R$ 197–797/mês por faixa de clientes.
- **Principais riscos:**
  - Incumbentes adicionarem o recurso.
  - Dados financeiros sensíveis.
  - O cliente final ignorar o bot como ignora o contador.
- **Hipóteses a validar:**
  1. Escritórios gastam mais de 10h/mês cobrando documentos.
  2. O cliente final responde melhor ao bot do que ao humano (ou igual, com menos esforço do escritório).
  3. O escritório paga por número de clientes.

### (D) Resposta e qualificação instantânea de leads de portais para imobiliárias pequenas (BR)

- **Problema encontrado:** demora na resposta a leads. HBR mostra o efeito do tempo de resposta (S71); só 19% do setor usa IA (S82).
- **Evidências existentes:** S71, S82. Dado de 5h08 / 47% sem resposta **não verificado na fonte primária**.
- **Quem paga:** a imobiliária (por corretor ou por unidade) ou o corretor autônomo.
- **Concorrentes:** Lastro/Lais, Morada.ai (foco em incorporadoras), CRMs dos portais (grupo OLX/ZAP comprou a Sohtec).
- **Lacuna encontrada (INFERÊNCIA):** imobiliárias de usados e locação, e corretores autônomos.
- **MVP possível:** capturar leads (e-mail de notificação dos portais) → resposta e qualificação no WhatsApp → agendamento → roteamento.
- **Primeiros 10 clientes:** mandar leads de teste para 30 anúncios, cronometrar a resposta e mostrar o resultado às imobiliárias mais lentas.
- **Primeiros 100:** sindicatos e associações (CRECI, SECOVI), comunidades de corretores, integrações com CRMs imobiliários.
- **Preço potencial (HIPÓTESE):** R$ 197–997/mês.
- **Principais riscos:**
  - O dono do portal embutir a funcionalidade.
  - Concorrentes com capital descerem para o segmento pequeno.
  - Mudança no formato de entrega de leads dos portais.
- **Hipóteses a validar:**
  1. Mais de 40% dos anúncios demoram mais de 1h para responder.
  2. Imobiliárias pequenas pagam por isso.
  3. Leads qualificados por IA não são percebidos como piores.

### (E) Extração e controle de COI para pequenas construtoras (EUA, autoatendimento)

- **Problema encontrado:** controle de seguros de subcontratadas em planilha (S16).
- **Evidências existentes:** S16. Várias ferramentas pagas existem, mas os dados de dor são de fornecedor [C].
- **Quem paga:** construtora, remodeladora ou subempreiteira principal.
- **Concorrentes:** CertCove, COI Rocket, myCOI, BCS, ImageToTable.
- **Lacuna encontrada:** plataformas caras que não extraem, e extratores baratos que não fazem gestão (segundo fonte [C]; validar).
- **MVP possível:** e-mail de encaminhamento → extração → regras → lembretes → painel.
- **Primeiros 10 clientes:** fóruns e comunidades de construção, listas de licenças estaduais + e-mail frio, Upwork/LinkedIn.
- **Primeiros 100:** SEO ("COI tracking spreadsheet template"), integrações (Procore, QuickBooks), parcerias com corretoras de seguro.
- **Preço potencial (HIPÓTESE):** US$ 49–199/mês.
- **Principais riscos:**
  - Vender nos EUA sem presença.
  - Mercado de ticket modesto.
  - Concorrentes baratos.
- **Hipóteses a validar:**
  1. Construtoras com mais de 20 subcontratadas usam planilha.
  2. Pagam mais de US$ 49 por extração + lembrete.
  3. Aceitam enviar documentos para um fornecedor desconhecido.

---

### PLANO DE VALIDAÇÃO

| | Hipótese central | Validar em 48 horas | Validar em 7 dias | O que perguntar | Confirma a oportunidade | Faz abandonar a ideia |
|---|---|---|---|---|---|---|
| **A** | Prestadores perdem orçamentos por falta de follow-up e pagam para recuperar | Cliente oculto: pedir orçamento a 30 empresas do Maps e registrar quem faz follow-up em 72h | 15 entrevistas com donos + landing page com preço + 3 pilotos manuais (você faz o follow-up "à mão" pelo WhatsApp deles) | "Quantos orçamentos você mandou mês passado? Quantos fechou? O que acontece com os outros? Quanto vale um job médio? Já tentou resolver isso?" | Mais de 60% sem follow-up; 3 de 15 dispostos a pagar R$ 99+ antes do produto; o piloto recupera ao menos 1 job | A maioria já faz follow-up; ninguém paga antes de ver resultado; o piloto não recupera nada em 2 semanas |
| **B** | Clínicas têm orçamentos parados e pagam para reativá-los | Cliente oculto pedindo orçamento de implante em 20 clínicas e medindo o follow-up; mandar mensagem a 10 dentistas da rede | 10 entrevistas + 2 pilotos manuais com a base real de orçamentos abertos (com termo de LGPD) | "Quantos orçamentos abertos você tem? Quem cuida do follow-up? Quanto vale um implante? Usa CRM? Por que parou?" | Base com mais de 30 orçamentos abertos; reagendamento de 5% ou mais no piloto; 2 de 10 com intenção de pagar | Clínicas já usam CRM que faz isso e estão satisfeitas; a exportação de dados é inviável; reagendamento abaixo de 2% |
| **C** | Contadores gastam muitas horas cobrando documentos e pagam para automatizar | Mensagem a 20 escritórios; post em grupo de contadores perguntando o tempo gasto | 10 entrevistas + 2 pilotos manuais (você opera a cobrança para 20 clientes de cada escritório) | "Quantos clientes? Quantas horas por mês cobrando documento? Usa portal? Seus clientes usam? Quanto paga em software hoje?" | Mais de 10h/mês relatadas; taxa de resposta do cliente final igual ou maior com o fluxo; 3 escritórios querendo pagar | Portais já resolvem e os clientes usam; a dor é baixa (menos de 3h/mês); escritórios não pagam por software extra |
| **D** | Imobiliárias pequenas demoram a responder e pagam por resposta instantânea | Enviar lead de teste a 30 anúncios e cronometrar | 10 entrevistas + 1 piloto com fluxo manual/semiautomático na imobiliária | "Quantos leads por mês? Quem responde? Em quanto tempo? Quantos viram visita? O que faz fora do horário?" | Mais de 40% demoram mais de 1h; o piloto aumenta as visitas agendadas; 2 de 10 dispostos a pagar | A maioria responde em menos de 15 min; o CRM do portal já faz isso; corretores rejeitam a IA |
| **E** | Construtoras pequenas gerenciam COI em planilha e pagam por extração + lembrete | Landing page em inglês + US$ 100 em ads ou posts em comunidades de construção; medir cadastros | 10 conversas (e-mail frio a 200 construtoras) + extração gratuita de 20 COIs reais | "How do you track subcontractor COIs today? How many subs? Ever had a lapsed policy on a job? What do you pay for it?" | Taxa de conversão da landing de 5% ou mais; 3 de 10 com dor ativa; extração com mais de 95% de precisão | Ninguém responde; todos já usam o módulo do Procore ou do GC; não pagam mais de US$ 20 |

**Regra geral de validação (opinião minha, direta):**
- Não escreva código antes de ter **3 pessoas dispostas a pagar** (ou pagando um piloto) em pelo menos uma dessas cinco.
- Os pilotos "manuais" (você fazendo o trabalho que o software faria) validam valor e disposição de pagar mais rápido do que qualquer MVP.
- Se em 2 semanas nenhuma das cinco passar no critério de "confirma", o problema não é a ideia: é o nicho ou o acesso a ele.

---

## 18. FONTES

Nota de qualidade: **[A]** primária ou independente · **[B]** review ou agregador · **[C]** fornecedor ou concorrente, com conflito de interesse. Todas acessadas via busca em 03/10/2026; **o conteúdo das páginas não foi aberto diretamente** (bloqueio de rede). Os trechos citados vêm do índice do buscador.

- **S1** [C] Signpost — How much business do contractors lose from missed calls — https://www.signpost.com/blog/how-much-business-do-contractors-lose-from-missed-calls/
- **S2** [C] ContractorToolStack — https://contractortoolstack.com/guides/how-contractors-stop-missing-phone-calls/
- **S3** [B] Jobber pricing — https://www.getonecrew.com/post/jobber-pricing ; https://costbench.com/software/field-service-management/jobber/
- **S4** [B] Housecall Pro — https://buyersprint.com/2026/04/18/housecall-pro-pricing-2026/ ; https://www.trustpilot.com/review/housecallpro.com?page=2 ; https://www.complaintsboard.com/housecall-pro-b134741
- **S5** [C] ServiceTitan — https://projul.com/blog/servicetitan-pricing-analysis-2026 ; https://www.getonecrew.com/post/servicetitan-reviews
- **S6** [B/C] Podium — https://pabau.com/blog/podium-cost/ ; https://www.getapp.com/marketing-software/a/podium/reviews/ ; https://fieldcamp.ai/reviews/podium/
- **S7** [B/C] Birdeye — https://pabau.com/blog/birdeye-pricing/ ; https://costbench.com/software/review-management/birdeye/hidden-costs/
- **S8** [B] AI receptionists — https://dupple.com/learn/best-ai-receptionists ; https://trtc.io/blog/details/ai-receptionist-pricing-2026
- **S9** [C] Odonto, tratamento não agendado — https://www.henryscheinone.com/insights/blogs/average-providers-are-losing-hundreds-of-thousands-in-unscheduled-treatment/ ; https://www.curvedental.com/dental-blog/healthy-dental-case-acceptance-rate
- **S10** [B] Weave — https://www.quo.com/blog/weave-pricing/ ; https://www.softwarepundit.com/node/180
- **S11** [C/A] Verificação de seguro odontológico — https://www.revenuewell.com/article/dental-ai-insurance-verification-vs-manual-checks-which-saves-more-time ; https://www.businesswire.com/news/home/20260114241532/en/VideaHealth-Launches-AutoVerify-to-Bring-Speed-and-Accuracy-to-Insurance-Eligibility-Checks
- **S12** [B] Dentrix — https://www.dentaltown.com/channel/post/25865/what-dentists-are-saying-about-practice-management-software ; https://www.capterra.com/p/2329/Dentrix/reviews/?page=8
- **S13** [C] Content Snare vs TaxDome — https://contentsnare.com/taxdome-alternative/
- **S14** [A] Atrasos de pagamento no Reino Unido — https://quickbooks.intuit.com/uk/blog/small-business-late-payments-report-2025/ ; https://www.smallbusinesscommissioner.gov.uk/?p=64916 ; https://financialit.net/news/cash-management/sme-cash-flow-crisis-nearly-two-thirds-invoices-paid-late-across-uk
- **S15** [B] Ferramentas de contas a receber — https://capterra.com/p/157101/CHASER/ ; https://www.g2.com/compare/kolleno-vs-upflow-upflow
- **S16** [C] COI — https://imagetotable.ai/blog/construction-coi-tracking-email-spreadsheet-problem ; https://blog.redteam.com/subcontractor-insurance-tracking-manage-cois-reduce-risk/ ; https://www.capterra.in/software/1109350/CertCove
- **S17** [A/B] HoneyBook — https://www.fstoppers.com/business/honeybooks-price-hike-coming-heres-what-need-know-and-how-save-690584 ; https://agiled.app/blog/honeybook-review
- **S18** [C] Mindbody (fontes concorrentes) — https://www.wellnessliving.com/blog/mindbody-pricing-driving-clients-change-software ; https://vibefam.com/mindbody-reviews-reddit-2026/
- **S19** [B/C] Salões, comissões e no-show — https://whito.co.uk/research/uk-beauty-salon-marketing-costs/ ; https://schedulingkit.com/statistics/no-show-statistics
- **S20** [B] Tekmetric / Shopmonkey — https://www.capterra.com/resources/tekmetric-vs-shopmonkey/ ; https://www.b2breviews.com/reviews/shopmonkey
- **S21** [B/C] Follow Up Boss — https://www.luxurypresence.com/?p=44245
- **S22** [A/C] Thanx / retenção de restaurantes — https://www.fsrmagazine.com/industry-news/thanx-launches-thanx-campaigns-drive-revenue/ ; https://www.getsauce.com/post/restaurant-customer-retention-software
- **S23** [B] Preços do WhatsApp em 07/2025 — https://www.ycloud.com/blog/whatsapp-api-pricing-update.md ; https://chakrahq.com/article/pricing-updates-for-whatsapp-business-platform-effective-july-2025-onwards/
- **S24** [A/B] Política de IA do WhatsApp — https://respond.io/blog/whatsapp-general-purpose-chatbots-ban ; https://www.business-standard.com/technology/tech-news/meta-bans-ai-chatbots-from-whatsapp-business-api-chatgpt-to-shut-down-jan-2026-125102200335_1.html
- **S25** [B] Preços do WhatsApp no BR — https://eazybe.com/br/blog/preco-api-whatsapp-business ; https://www.messagecentral.com/pt-br/blog/whatsapp-business-api-pricing-in-brazil
- **S26** [A] No-show em clínicas BR — https://medicinasa.com.br/agendamento-consultas/ ; https://acontecendoaqui.com.br/empreendedorismo/alerta-falta-de-pacientes-pode-comprometer-ate-32-da-agenda-de-clinicas-no-pais/ ; https://medicinasa.com.br/?p=65266
- **S27** [A] Sebrae e WhatsApp — https://agenciasebrae.com.br/dados/whatsapp-se-consolida-nas-vendas-on-line-enquanto-facebook-e-lojas-proprias-perdem-folego/ ; https://agenciasebrae.com.br/cultura-empreendedora/whatsapp-e-o-principal-meio-de-comunicacao-para-80-dos-negocios-de-servico/
- **S28** [C] Asaas — https://blog.asaas.com/aplicativo-de-cobranca/
- **S29** [B] Field Control / Auvo — https://www.capterra.com/p/207608/Field-Control/ ; https://www.b2bstack.com.br/product/auvo
- **S30** [C] Follow-up de orçamentos — https://zigaflow.com/insights/quotes-dont-fail-on-price-they-fail-on-follow-up ; https://chiirp.com/insider_information_blog/estimate-rehash-playbook
- **S31** [A] Clio Legal Trends (via ABA e OK Bar) — https://americanbar.org/groups/law_practice/resources/law-practice-magazine/2025/march-april-2025/laws-new-first-impression-transforming-client-intake ; https://www.okbar.org/lpt_articles/answering-the-call-why-responsiveness-is-critical-for-law-firm-success/
- **S32** [B] TruckingOffice — https://us.fitgap.com/products/024604/truckingoffice ; https://www.capterra.co.nz/reviews/122284/truckingoffice
- **S33** [B] Software de limpeza — https://costbench.com/software/cleaning-service-software/compare-all/ ; https://g2.com/compare/bookingkoala-vs-zenmaid-software
- **S34** [B/A] Turno — https://bnbcalc.com/reviews/turno-review ; https://skift.com/2024/09/23/short-term-rental-hosts-confront-cleaning-fee-conundrum/
- **S35** [B] Procore vs Contractor Foreman — https://www.rfp.wiki/specialty-industries/construction-engineering/procore/contractor-foreman
- **S36** [A] Avoca e IA vertical — https://www.fortune.com/2026/04/27/avoca-ai-agents-missed-calls-hvac-plumbing-roofing-kleiner-perkins-chen-shrivastava-braswell/ ; https://www.avoca.ai/blog/avoca-raises-125m-series-b-1b-valuation ; https://insights.euclid.vc/p/the-vertical-report-2026-full-version ; https://research.cbinsights.com/voice-ais-500m-win
- **S37** [A] YC e agentes — https://pitchbook.com/news/articles/y-combinator-is-going-all-in-on-ai-agents-making-up-nearly-50-of-latest-batch ; https://www.extruct.ai/data-room/ycombinator-companies-w26/
- **S38** [B] Homebase — https://costbench.com/compare/7shifts-vs-homebase/ ; https://www.capterra.com/p/153076/Homebase/reviews/
- **S39** [B/C] Ferramentas de Google Business Profile — https://slashpost.ai/blogs/google-business-profile/google-business-profile-optimization-cost ; https://www.capterra.com/p/10046105/gmbqrcode/
- **S40** [C/B] brightwheel — https://www.procaresoftware.com/blog/why-some-child-care-centers-are-switching-from-brightwheel-in-2026/ ; https://nz.trustpilot.com/review/mybrightwheel.com
- **S41** [A] iFood — https://tecnoblog.net/noticias/nao-e-impressao-o-ifood-agora-cobra-taxa-de-servico-em-todos-os-pedidos/ ; https://www.dgabc.com.br/Noticia/4232903/federacao-de-hoteis-e-restaurantes-inicia-boicote-a-plataforma-ifood ; https://www.cora.com.br/blog/como-vender-no-ifood/
- **S42** [C] Fechamento contábil — https://www.jettax.com.br/blog/fechamento-contabil/
- **S43** [A/C] 65% das oficinas sem sistema (pesquisa RepareCar via EM) — https://www.em.com.br/networking-e-negocios/2026/07/7470212-65-das-oficinas-mecanicas-do-pais-ainda-operam-sem-sistema-de-gestao.html
- **S44** [C/A] Booksy BR e barbearias por assinatura — https://biz.booksy.com/pt-br/precos ; https://seucreditodigital.com.br/barbearias-por-assinatura-crescem/
- **S46** [C] Kommo vs RD — https://www.kommo.com/br/blog/rdstation/
- **S47** [B] Dedetização — https://costbench.com/software/pest-control-software/compare-all/ ; https://www.lawnstarter.com/blog/?p=54886
- **S48** [B] Aluguel para eventos — https://www.capterra.com/p/135628/InflatableOffice/pricing/ ; https://www.softwareadvice.com/retail/goodshuffle-profile/
- **S49** [A/C] Corretoras de seguro — https://fintech.global/2025/10/02/quandri-introduces-ai-powered-requoting-for-agencies/ ; https://www.iamagazine.com/?p=30787
- **S50** [C/B] Veterinária — https://petdesk.com/?p=260340 ; https://us.fitgap.com/products/059554/vetstoria
- **S51** [B] SmartMoving — https://toolradar.com/tools/smartmoving/pricing
- **S52** [C] Medição por satélite — https://myquoteiq.com/best-satellite-measuring-software-lawn-care-2026/
- **S53** [A] MTD (HMRC) — https://www.gov.uk/government/news/one-year-until-making-tax-digital-for-income-tax-launches ; https://www.gov.uk/guidance/choose-the-right-software-for-making-tax-digital-for-income-tax
- **S54** [B] E-fatura na Alemanha — https://www.advisori.de/en/blog/e-invoicing-mandate-germany ; https://econnect.eu/en/docs/knowledge/regulations/europe/germany
- **S55** [A/B] Bélgica e França — https://itdaily.com/news/software/e-invoicing-belgian-companies-lag-behind ; https://www.cleartax.com/fr/en/e-invoicing-for-small-business
- **S56** [A/C] Handwerk — https://www.handwerksblatt.de/betriebsfuehrung/plancraft-will-software-fuer-das-handwerk-moeglichst-einfach-halten ; https://www.ki-syndikat.de/ki-konkret/handwerksbetrieb/handwerksbetrieb-01-angebot-in-minuten/
- **S57** [C/B] Trainerize — https://www.fitbudd.com/insights/trainerize-pricing-explained-what-it-actually-costs-trainers-in-2026-vs-better-alternatives ; https://costbench.com/software/gym-management/trainerize/
- **S58** [A — fórum de usuários] BiggerPockets — https://www.biggerpockets.com/posts/7277357 ; https://www.biggerpockets.com/posts/7250136
- **S59** [A] Zapia — https://teletime.com.br/03/06/2025/zapia-ia-que-agenda-servicos-whatsapp/
- **S60** [A] Freelancers — https://smallbusiness.co.uk/freelancers-continue-to-struggle-with-bad-debt-2527151/ ; https://startups.co.uk/?p=86134
- **S61** [A/B] Assinaturas — https://www.citizensadvice.org.uk/about-us/media-centre/press-releases/consumers-spend-688-million-on-unused-subscriptions-in-the-last-year/ ; https://www.fincomparelab.com/reviews/rocket-money-review/
- **S62** [A] Contas médicas — https://www.healthcarefinancenews.com/news/consumers-find-success-medical-bill-disputes ; https://techstrong.ai/articles/ai-being-used-more-to-scrutinize-reduce-byzantine-medical-bills/
- **S63** [B] Salesforce State of Sales (resumo) — https://www.advisorpedia.com/grow/sales-strategy/the-top-3-takeaways-from-salesforces-state-of-sales-research-report
- **S64** [B] GoHighLevel — https://prospeo.io/s/gohighlevel-pricing-reviews-pros-and-cons ; https://ecosire.com/blog/gohighlevel-white-label-saas-complete-guide
- **S65** [B] NiceJob / Grade.us — https://www.capterra.com/p/137378/Grade-us/pricing/ ; https://wisernotify.com/blog/nicejob-alternatives/
- **S66** [B] My Music Staff / TutorBird — https://www.capterra.com/p/148451/My-Music-Staff/pricing/ ; https://www.capterra.com/p/181623/TutorBird/pricing/
- **S67** [B] CleanGuru — https://toolradar.com/tools/cleanguru
- **S68** [A] Markate Kate AI — https://insights.munich-startup.de/news/feed/markate-s-kate-ai-turns-customer-photos-into-job-estimates-in-under-60-seconds
- **S69** [B/C] Segurança patrimonial — https://www.shiftflow.app/blog/best-time-tracking-software-security ; https://capterra.com/p/135436/Silvertrac-Software/
- **S70** [C] Zenvia / preços de chatbots BR — https://zenvia.com/novas-regras-cobranca-whatsapp-2026/ ; https://www.aurorainbox.com/pt/?p=38229
- **S71** [A] HBR, "The Short Life of Online Sales Leads" (Oldroyd, McElheran, Elkington, mar/2011), via resumo em https://ainora.lt/blog/lead-response-time-statistics-every-study-2026 (original esperado em hbr.org/2011/03/the-short-life-of-online-sales-leads, **não aberto**)
- **S72** [A] Product Hunt 2026 — https://www.producthunt.com/p/anysite/who-actually-launched-on-product-hunt-in-2026
- **S73** [A] Fechamento da Bench — https://techcrunch.com/2024/12/27/bench-shuts-down-leaving-thousands-of-businesses-without-access-to-accounting-and-tax-docs
- **S74** [C] MoeGo — https://www.gomarketbox.com/blog/moego-pricing-reviews
- **S75** [C] Software para tatuagem — https://meetergo.com/en/magazine/tattoo-booking-software
- **S76** [A/C] Condomínios — https://www.sindiconet.com.br/informese/aplicativo-para-condominio-noticias-espaco-noknox
- **S77** [A] Ghosting de contratação — https://montreal.ctvnews.ca/first-quiet-quitting-now-ghosting-small-businesses-say-many-new-hires-never-show-1.6177001 ; https://www.hrdconnect.com/?p=166790
- **S78** [A] No-show em restaurantes — https://www.inquirer.com/food/restaurants/opentable-service-fee-no-show-restaurant-reservation-20260114.html ; https://www.thecaterer.com/news/opentable-launches-campaign-as-a-third-of-diners-admit-no-showing
- **S79** [A] iFood compra a Anota AI — https://startups.com.br/noticias/exclusivo-ifood-compra-a-anota-ai-para-oferecer-atendimento-pelo-whatsapp/
- **S80** [A] Doctoralia compra a Feegow — https://startups.com.br/negocios/doctoralia-compra-brasileira-feegow-e-mira-gestao-para-clinicas/
- **S81** [C — fraca] Meu Ajudante — https://lilys.ai/notes/pt/productivity-tools-20251203/freelance-electricians-viral-tool
- **S82** [A] IA imobiliária BR — https://www.infomoney.com.br/business/enquanto-85-das-imobiliarias-nos-eua-usam-ia-brasil-ainda-engatinha-com-19/ ; https://startups.com.br/negocios/proptechs/proptech-lastro-levanta-serie-a-de-r-85m-liderada-pela-prosus/ ; https://startupi.com.br/?p=258056 ; https://startups.com.br/negocios/olx-brasil-adquire-sohtec-de-automacao-imobiliaria-para-digitalizar-negocios-do-setor/
- **S83** [A] Evasão em academias BR — https://www.em.com.br/networking-e-negocios/2026/07/7469486-retencao-de-alunos-vira-novo-campo-de-batalha-das-academias-no-brasil.html
- **S84** [C] Retenção em academias — https://gymdesk.com/blog/5th-class-cliff-gym-member-retention ; https://uptivo.fit/blog/gym-member-retention-statistics
- **S85** [B] Doctolib — https://www.capterra.ie/software/184480/doctolib
- **S86** [C/A] CRM para clínicas BR — https://www.clint.digital/blog/crm-para-clinica-whatsapp-2026/ ; https://www.em.com.br/mundo-corporativo/2025/01/7025844-clinicas-odontologicas-usam-crm-para-otimizar-whatsapp.html
- **S87** [A] Thomson Reuters compra a Gestta — https://www.thomsonreuters.com.br/pt/sala-de-imprensa/thomson-reuters-anuncia-aquisicao-de-gestta.html
- **S88** [A] Sebrae, falta de clientes — https://agenciasebrae.com.br/brasil-empreendedor/falta-de-clientes-dificulta-empreendedorismo/
- **S89** [A/C] Toast — https://www.restaurantbusinessonline.com/technology/toast-remove-99-cent-fee-after-widespread-backlash ; https://www.dineopen.com/blog/toast-pos-alternatives-2026
- **S90** [B] Software de administração de imóveis no Reddit (agregador GummySearch) — https://gummysearch.com/tools/best-products/property-management-software
- **S91** [C] Overjet — https://www.overjet.com/blog/verify-dental-insurance
- **S92** [C — fraca] Exemplos de micro-SaaS — https://www.flowjam.com/blog/27-micro-saas-examples-that-actually-print-money-in-2026

*(S45 foi descartada: o dado "5h08 / 47% sem resposta" atribuído à Morada.ai apareceu só em resumo de busca, sem fonte primária identificável.)*
