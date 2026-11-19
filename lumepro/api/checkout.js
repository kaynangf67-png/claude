/* Checkout LumePro — Mercado Pago Checkout Pro (função serverless da Vercel).
 *
 * GET  /api/checkout  → { pronto, preco, frete, pendente[] }
 * POST /api/checkout  → cria a preferência de pagamento e devolve { url }
 *
 * Variáveis de ambiente (Vercel → Settings → Environment Variables):
 *   MP_ACCESS_TOKEN       credencial de produção (ou de teste) do Mercado Pago
 *   LUMEPRO_FRETE         valor do frete em reais, ex.: "19.90".
 *                         "0" só se a loja decidir não cobrar frete.
 *   LUMEPRO_SITE_URL      opcional: endereço público da página (retorno do pagamento)
 *   LUMEPRO_WEBHOOK_URL   opcional: URL para notificações de pagamento
 *
 * O preço é fixo aqui no servidor: o navegador não consegue alterá-lo.
 * Nenhum pagamento ou pedido é simulado: sem credencial, o checkout responde
 * que ainda não está configurado.
 */
const PRECO = 99.9; // oferta aprovada — não alterar
const PRODUTO = "Depilador Elétrico de Sobrancelhas LumePro";
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS SC SP SE TO".split(" ");

function lerFrete() {
  const v = String(process.env.LUMEPRO_FRETE ?? "").trim().replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 1000 ? Math.round(n * 100) / 100 : null;
}

function pendencias() {
  const p = [];
  if (!process.env.MP_ACCESS_TOKEN) p.push("MP_ACCESS_TOKEN (credencial do Mercado Pago)");
  if (lerFrete() === null) p.push("LUMEPRO_FRETE (valor do frete)");
  return p;
}

const txt = (v, max = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const dig = v => String(v ?? "").replace(/\D/g, "");

function validar(b) {
  if (!b || typeof b !== "object") return { erro: "Dados do pedido inválidos." };
  const d = {
    nome: txt(b.nome), email: txt(b.email).toLowerCase(), telefone: dig(b.telefone),
    cep: dig(b.cep), rua: txt(b.rua), numero: txt(b.numero, 20), complemento: txt(b.complemento, 60),
    bairro: txt(b.bairro, 80), cidade: txt(b.cidade, 80), uf: txt(b.uf, 2).toUpperCase(),
  };
  if (d.nome.split(" ").length < 2) return { erro: "Informe nome e sobrenome." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) return { erro: "Informe um e-mail válido." };
  if (d.telefone.length < 10 || d.telefone.length > 11) return { erro: "Informe o WhatsApp com DDD." };
  if (d.cep.length !== 8) return { erro: "Informe um CEP válido." };
  if (!d.rua || !d.numero || !d.bairro || !d.cidade) return { erro: "Preencha o endereço completo." };
  if (!UFS.includes(d.uf)) return { erro: "Informe a UF (estado)." };
  return { d };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const p = pendencias();
    return res.status(200).json({ pronto: p.length === 0, preco: PRECO, frete: lerFrete(), pendente: p });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const pend = pendencias();
  if (pend.length) return res.status(503).json({ erro: "O checkout ainda não foi configurado pela loja.", pendente: pend });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const { d, erro } = validar(body);
  if (erro) return res.status(400).json({ erro });

  const frete = lerFrete();
  const pedido = "LP-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const base = (process.env.LUMEPRO_SITE_URL || `${proto}://${host}`).replace(/\/$/, "");
  const [primeiro, ...resto] = d.nome.split(" ");
  const numeroInt = /^\d+$/.test(d.numero) ? Number(d.numero) : undefined;
  const entrega = {
    zip_code: d.cep, street_name: d.rua, street_number: d.numero,
    apartment: d.complemento || undefined, city_name: d.cidade, state_name: d.uf,
  };

  const preferencia = {
    items: [{ id: "lumepro-depilador-sobrancelhas", title: PRODUTO, quantity: 1, unit_price: PRECO, currency_id: "BRL" }],
    payer: {
      name: primeiro, surname: resto.join(" "), email: d.email,
      phone: { area_code: d.telefone.slice(0, 2), number: d.telefone.slice(2) },
      address: { zip_code: d.cep, street_name: d.rua, street_number: numeroInt },
    },
    shipments: { mode: "not_specified", cost: frete, receiver_address: entrega },
    external_reference: pedido,
    metadata: { pedido, entrega: { ...d, telefone: d.telefone } },
    back_urls: {
      success: `${base}/?pagamento=aprovado`,
      pending: `${base}/?pagamento=pendente`,
      failure: `${base}/?pagamento=falhou`,
    },
    auto_return: "approved",
    statement_descriptor: "LUMEPRO",
    ...(process.env.LUMEPRO_WEBHOOK_URL ? { notification_url: process.env.LUMEPRO_WEBHOOK_URL } : {}),
  };

  try {
    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": pedido,
      },
      body: JSON.stringify(preferencia),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.init_point) {
      console.error("Mercado Pago recusou a preferência", r.status, JSON.stringify(j).slice(0, 500));
      return res.status(502).json({ erro: "Não foi possível abrir o pagamento agora. Tente novamente em instantes." });
    }
    return res.status(200).json({ url: j.init_point, pedido });
  } catch (e) {
    console.error("Falha ao falar com o Mercado Pago", e);
    return res.status(502).json({ erro: "Não foi possível abrir o pagamento agora. Tente novamente em instantes." });
  }
};

module.exports._interno = { validar, lerFrete, pendencias, PRECO };
