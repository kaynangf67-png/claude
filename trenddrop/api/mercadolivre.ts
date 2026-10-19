import { handleApi } from '../server/router.js';

export function GET(request: Request) {
  return handleApi(request, 'mercadolivre');
}
