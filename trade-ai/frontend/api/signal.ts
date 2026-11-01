import { handleSignal } from "../server/signal.js";

export function POST(request: Request) {
  return handleSignal(request);
}
