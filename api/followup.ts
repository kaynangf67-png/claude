import { handleFollowupRequest } from '../server/followupHandler';

export function POST(request: Request) {
  return handleFollowupRequest(request);
}
