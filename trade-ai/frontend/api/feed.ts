import { handleFeed } from "../server/feed.js";

export function GET() {
  return handleFeed();
}
