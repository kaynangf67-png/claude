import { handleAnalyze } from "../server/analyze.js";

export function POST(request: Request) {
  return handleAnalyze(request);
}
