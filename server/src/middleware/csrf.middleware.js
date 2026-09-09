const ApiError = require('../utils/errors');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection for cookie-authenticated requests.
 *
 * Cookie auth is vulnerable to cross-site request forgery. Because the
 * frontend is often a different origin than the API (SameSite=none cookies),
 * all state-changing requests must prove they originate from our own client.
 *
 * We require a custom header (`X-Requested-With`) on mutating requests when
 * the request is authenticated via cookie. A cross-origin attacker cannot set
 * that header without triggering a CORS preflight, and our CORS allowlist
 * rejects every origin except our own frontend. HTML forms also cannot set it.
 *
 * Requests authenticated with a Bearer token (never sent from forms or
 * cross-site scripts) are exempt.
 */
module.exports = function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const usesCookieAuth = !!(req.cookies && (req.cookies.accessToken || req.cookies.refreshToken));
  if (!usesCookieAuth) return next();

  const requestedWith = req.headers['x-requested-with'];
  const customHeader = req.headers['x-csrf-token'];
  if (requestedWith === 'XMLHttpRequest' || customHeader) return next();

  return next(
    ApiError.forbidden('CSRF protection: missing required request header.', 'CSRF_REQUIRED')
  );
};