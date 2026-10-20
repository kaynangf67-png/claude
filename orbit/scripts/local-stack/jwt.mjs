// Prints an HS256 JWT for a Supabase API role (anon | service_role).
import { createHmac } from "node:crypto";

const [secret, role] = process.argv.slice(2);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iss: "supabase-local", role, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 10 * 365 * 86400 })}`;
process.stdout.write(`${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`);
