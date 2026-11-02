import { handleBacktest } from "../server/backtest.js";

export function GET(request: Request) {
  return handleBacktest(request);
}
