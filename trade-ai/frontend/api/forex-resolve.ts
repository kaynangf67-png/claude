import { handleForexResolve } from "../server/forex/handlers.js";

export function POST(request: Request) {
  return handleForexResolve(request);
}
