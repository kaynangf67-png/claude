import { handleBinary } from "../server/binary/handlers.js";

export function GET(request: Request) {
  return handleBinary(request);
}
export function POST(request: Request) {
  return handleBinary(request);
}
