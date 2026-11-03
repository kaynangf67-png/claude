import { handleForexAnalyze } from "../server/forex/handlers.js";

export function POST(request: Request) {
  return handleForexAnalyze(request);
}
