import type { NextRequest } from 'next/server';

/**
 * True for a request made by the app itself. The local server can also be reached by any website open in the same
 * browser; such a request carries Sec-Fetch-Site "cross-site" / "same-site", or a JSON body only after a CORS
 * preflight this server never answers. Electron and the browser both send Sec-Fetch-Site for the app's own fetches.
 */
export function isAppRequest(req: NextRequest): boolean {
  // DNS rebinding: a site whose name resolves to 127.0.0.1 looks same-origin, but its Host is still that name
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(req.headers.get('host') ?? '')) return false;
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  return (req.headers.get('content-type') ?? '').startsWith('application/json');
}
