import type { NextRequest } from 'next/server';

/**
 * True for a request made by the app itself. The local server can also be reached by any website open in the same
 * browser; such a request carries Sec-Fetch-Site "cross-site" / "same-site", or a JSON body only after a CORS
 * preflight this server never answers. Electron and the browser both send Sec-Fetch-Site for the app's own fetches.
 */
export function isAppRequest(req: NextRequest): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  return (req.headers.get('content-type') ?? '').startsWith('application/json');
}
