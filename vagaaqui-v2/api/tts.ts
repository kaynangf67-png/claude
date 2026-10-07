import { handleTts } from '../server/tts';

export function GET(request: Request) {
  return handleTts(request, process.env);
}
