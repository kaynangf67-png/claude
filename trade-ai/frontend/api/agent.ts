import { handleAgent } from "../server/agent/handlers.js";

export function GET(request: Request) {
  return handleAgent(request);
}
export function POST(request: Request) {
  return handleAgent(request);
}
