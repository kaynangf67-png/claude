import { handleAnalyze } from "../server/analyze";

export function POST(request: Request) {
  return handleAnalyze(request);
}
