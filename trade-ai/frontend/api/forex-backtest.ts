import { handleForexBacktest } from "../server/forex/handlers.js";

export function GET(request: Request) {
  return handleForexBacktest(request);
}
