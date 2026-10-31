import { handleDesk } from "../server/desk.js";

export function POST(request: Request) {
  return handleDesk(request);
}
