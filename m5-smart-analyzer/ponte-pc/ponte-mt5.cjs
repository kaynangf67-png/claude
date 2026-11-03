let node_fs = require("node:fs");
let node_path = require("node:path");
let node_http = require("node:http");
// src/core/candle.ts
/** Verifica as invariantes OHLC. Retorna o código do primeiro problema ou null. */
function candleIssue(c) {
	if (![
		c.t,
		c.o,
		c.h,
		c.l,
		c.c
	].every(Number.isFinite)) return "NAO_FINITO";
	if (c.o <= 0 || c.h <= 0 || c.l <= 0 || c.c <= 0) return "PRECO_NAO_POSITIVO";
	if (c.h < c.l) return "HIGH_MENOR_QUE_LOW";
	if (c.h < Math.max(c.o, c.c)) return "HIGH_MENOR_QUE_CORPO";
	if (c.l > Math.min(c.o, c.c)) return "LOW_MAIOR_QUE_CORPO";
	if (c.v !== void 0 && (!Number.isFinite(c.v) || c.v < 0)) return "VOLUME_INVALIDO";
	return null;
}
// src/core/arquivoM1.ts
/** CSV: timestamp,open,high,low,close,volume,forming (timestamp Unix em segundos, UTC). */
function parseExport(text) {
	const out = [];
	let rejected = 0;
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || !/^\d/.test(line)) continue;
		const p = line.split(",");
		if (p.length < 6) {
			rejected++;
			continue;
		}
		const [t, o, h, l, c, v, f] = p;
		const row = {
			t: Number(t),
			o: Number(o),
			h: Number(h),
			l: Number(l),
			c: Number(c),
			v: Number(v),
			forming: f?.trim() === "1"
		};
		if (candleIssue(row) !== null || row.t % 60 !== 0) {
			rejected++;
			continue;
		}
		out.push(row);
	}
	out.sort((a, b) => a.t - b.t);
	const dedup = [];
	for (const r of out) {
		if (dedup.length && dedup[dedup.length - 1].t === r.t) {
			rejected++;
			continue;
		}
		dedup.push(r);
	}
	return {
		candles: dedup,
		rejected
	};
}
/** Segundos desde o início do último candle exportado. Alto = script parado ou mercado fechado. */
function idadeSegundos(c1, nowSec) {
	if (c1.length === 0) return Infinity;
	return nowSec - c1[c1.length - 1].t;
}
/**
* Monta candles M5 a partir de M1: só janelas COMPLETAS (5 minutos presentes);
* a janela atual, se incompleta, vira o candle em formação (último da lista).
*/
function m5FromM1(c1, nowSec) {
	const groups = /* @__PURE__ */ new Map();
	for (const m of c1) {
		const k = Math.floor(m.t / 300) * 300;
		const g = groups.get(k);
		if (g) g.push(m);
		else groups.set(k, [m]);
	}
	const currentBucket = Math.floor(nowSec / 300) * 300;
	const out = [];
	for (const k of [...groups.keys()].sort((a, b) => a - b)) {
		const g = groups.get(k);
		const completa = g.length === 5 && g.every((c, i) => c.t === k + i * 60 && !c.forming);
		const emFormacao = k === currentBucket && g.length >= 1 && g.every((c, i) => c.t === k + i * 60);
		if (!completa && !emFormacao) continue;
		out.push({
			t: k,
			o: g[0].o,
			h: Math.max(...g.map((x) => x.h)),
			l: Math.min(...g.map((x) => x.l)),
			c: g[g.length - 1].c
		});
	}
	return out;
}
/**
* Responde como a API de klines da Binance: `interval` 1m ou 5m, últimos `limit`
* candles (o último pode estar em formação) ou, com `startTime` (segundos), só o
* candle daquele início, se já estiver fechado.
*/
function klines(c1, interval, limit, nowSec, startTime) {
	const base = interval === "1m" ? c1.map(({ forming: _f, ...c }) => c) : m5FromM1(c1, nowSec);
	const span = interval === "1m" ? 60 : 300;
	if (startTime !== void 0) {
		const c = base.find((x) => x.t === startTime);
		return c && c.t + span <= nowSec ? [c] : [];
	}
	return base.slice(-limit);
}
/** Nome do arquivo de um símbolo; recusa nomes que escapariam da pasta. */
function nomeArquivo(symbol) {
	if (!/^[A-Za-z0-9._#-]{3,20}$/.test(symbol) || symbol.includes("..")) throw new Error(`símbolo inválido: ${symbol}`);
	return `m5exp_${symbol}_M1.csv`;
}
function symbolMt5Valido(s) {
	return /^[A-Za-z0-9._#-]{3,20}$/.test(s) && !s.includes("..");
}
function pastaPadraoWindows() {
	const base = process.env["APPDATA"];
	return base ? (0, node_path.join)(base, "MetaQuotes", "Terminal", "Common", "Files") : null;
}
function lerM1(pasta, symbol) {
	const file = (0, node_path.join)((0, node_path.resolve)(pasta), nomeArquivo(symbol));
	let texto;
	try {
		texto = (0, node_fs.readFileSync)(file, "utf8");
	} catch {
		throw new Error(`arquivo não encontrado: ${file} (o script M5Exportador está rodando no MT5 e o símbolo está certo?)`);
	}
	return parseExport(texto).candles;
}
/** Mesma assinatura de `SessionDeps.fetchKlines`. `now` em ms. */
function criarFetchMt5(pasta, now) {
	return async (symbol, interval, limit, extra = "") => {
		const nowSec = now() / 1e3;
		const c1 = lerM1(pasta, symbol);
		if (c1.length === 0) throw new Error(`arquivo de ${symbol} vazio ou ilegível`);
		const startTime = /[?&]startTime=(\d+)/.exec(extra)?.[1];
		if (startTime === void 0) {
			const idade = idadeSegundos(c1, nowSec);
			if (idade > 180) throw new Error(`dados de ${symbol} parados há ${Math.round(idade)}s (script parado ou mercado fechado)`);
		}
		return klines(c1, interval, limit, nowSec, startTime === void 0 ? void 0 : Number(startTime) / 1e3);
	};
}
// agent/ponteServidor.ts
/** Origens que podem ler: o app publicado, o servidor de desenvolvimento e arquivos locais. */
function origemPermitida(origin) {
	if (!origin) return true;
	return /^https:\/\/m5-smart-analyzer[a-z0-9-]*\.vercel\.app$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
async function responder(deps, req) {
	if (req.method !== "GET") return {
		status: 405,
		body: { erro: "somente GET" }
	};
	const url = new URL(req.url ?? "/", "http://127.0.0.1");
	if (url.pathname === "/api/v3/time") return {
		status: 200,
		body: { serverTime: deps.now() }
	};
	if (url.pathname !== "/api/v3/klines") return {
		status: 404,
		body: { erro: "rota inexistente" }
	};
	const symbol = url.searchParams.get("symbol") ?? "";
	const interval = url.searchParams.get("interval");
	const limit = Math.min(1e3, Math.max(1, Number(url.searchParams.get("limit") ?? 500) || 500));
	const start = url.searchParams.get("startTime");
	if (!symbolMt5Valido(symbol)) return {
		status: 400,
		body: { erro: "símbolo inválido" }
	};
	if (interval !== "1m" && interval !== "5m") return {
		status: 400,
		body: { erro: "interval precisa ser 1m ou 5m" }
	};
	if (start !== null && !/^\d+$/.test(start)) return {
		status: 400,
		body: { erro: "startTime inválido" }
	};
	try {
		return {
			status: 200,
			body: (await criarFetchMt5(deps.pasta, deps.now)(symbol, interval, limit, start === null ? "" : `&startTime=${start}`)).map((k) => [
				k.t * 1e3,
				String(k.o),
				String(k.h),
				String(k.l),
				String(k.c),
				String(k.v ?? 0)
			])
		};
	} catch (e) {
		return {
			status: 503,
			body: { erro: e instanceof Error ? e.message : String(e) }
		};
	}
}
function criarServidor(deps) {
	return (0, node_http.createServer)((req, res) => {
		const origin = req.headers.origin;
		const headers = {
			"Content-Type": "application/json",
			"Cache-Control": "no-store"
		};
		if (origin && origemPermitida(origin)) {
			headers["Access-Control-Allow-Origin"] = origin;
			headers["Access-Control-Allow-Private-Network"] = "true";
			headers["Access-Control-Allow-Methods"] = "GET";
			headers["Vary"] = "Origin";
		}
		if (origin && !origemPermitida(origin)) {
			res.writeHead(403, headers).end(JSON.stringify({ erro: "origem não permitida" }));
			return;
		}
		if (req.method === "OPTIONS") {
			res.writeHead(204, headers).end();
			return;
		}
		responder(deps, req).then((r) => res.writeHead(r.status, headers).end(JSON.stringify(r.body)));
	});
}
// agent/ponte.ts
/**
* Ponte LOCAL de leitura: serve os arquivos exportados do MT5 no formato da API
* de klines da Binance, só para o app web (aberto no seu navegador) mostrar o forex.
*
* - Escuta somente em 127.0.0.1 (este computador). Nada sai para a internet.
* - Só tem GET de candles. Não recebe ordens, não fala com o MT5, não usa chaves.
*
* Uso:  npm run ponte
*       npm run ponte -- --pasta "C:\Users\...\Common\Files" --porta 8765
*/
const AJUDA = `
Ponte local MT5 -> app (somente leitura, 127.0.0.1).

  npm run ponte                         usa a pasta padrão do MT5 no Windows
  npm run ponte -- --pasta CAMINHO      pasta Common\\Files do MT5
  npm run ponte -- --porta 8765         porta local (padrão 8765)
`;
function parseArgs(argv) {
	const out = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a.startsWith("--")) continue;
		const next = argv[i + 1];
		if (next !== void 0 && !next.startsWith("--")) {
			out[a.slice(2)] = next;
			i++;
		} else out[a.slice(2)] = true;
	}
	return out;
}
async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args["ajuda"]) {
		console.log(AJUDA);
		return;
	}
	const pasta = typeof args["pasta"] === "string" ? args["pasta"] : pastaPadraoWindows();
	if (!pasta || !(0, node_fs.existsSync)(pasta)) {
		console.error(`\nERRO: pasta do MT5 não encontrada${pasta ? `: ${pasta}` : ""}. Use --pasta (veja docs/MT5.md).\n`);
		process.exit(2);
	}
	const porta = typeof args["porta"] === "string" ? Number(args["porta"]) : 8765;
	if (!Number.isInteger(porta) || porta < 1024 || porta > 65535) {
		console.error("\nERRO: --porta inválida.\n");
		process.exit(2);
	}
	criarServidor({
		pasta,
		now: () => Date.now()
	}).listen(porta, "127.0.0.1", () => {
		console.log("=".repeat(70));
		console.log(" Ponte MT5 -> app: SOMENTE LEITURA, só neste computador (127.0.0.1).");
		console.log(` Pasta: ${pasta}`);
		console.log(` No app: Ao vivo > Fonte "MT5" > endereço http://127.0.0.1:${porta}`);
		console.log(" Para parar: feche esta janela ou Ctrl+C.");
		console.log("=".repeat(70));
	});
}
main();
