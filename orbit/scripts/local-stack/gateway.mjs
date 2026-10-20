// Minimal stand-in for Supabase's API gateway (Kong): routes /auth/v1 to
// GoTrue and /rest/v1 to PostgREST. Development/E2E use only.
import http from "node:http";

const routes = [
  ["/auth/v1", Number(process.env.AUTH_PORT ?? 9999)],
  ["/rest/v1", Number(process.env.REST_PORT ?? 3001)],
];
const port = Number(process.env.GATEWAY_PORT ?? 54321);

http
  .createServer((req, res) => {
    const route = routes.find(([prefix]) => req.url.startsWith(prefix));
    if (!route) {
      res.writeHead(404).end();
      return;
    }
    const [prefix, target] = route;
    const headers = { ...req.headers, host: `127.0.0.1:${target}` };
    // PostgREST authenticates with the Authorization header; supabase-js always sends it.
    const upstream = http.request({ host: "127.0.0.1", port: target, method: req.method, path: req.url.slice(prefix.length) || "/", headers }, (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    });
    upstream.on("error", () => res.writeHead(502).end());
    req.pipe(upstream);
  })
  .listen(port, "127.0.0.1", () => console.log(`gateway on :${port}`));
