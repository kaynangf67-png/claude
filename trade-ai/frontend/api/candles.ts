import { handleCandles } from "../server/desk.js";

export function GET(request: Request) {
  return handleCandles(request);
}
