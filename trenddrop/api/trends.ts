import { handleApi } from '../server/router';

export function GET(request: Request) {
  return handleApi(request, 'trends');
}
