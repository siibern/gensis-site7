const dns = require('dns/promises');

const DNS_TIMEOUT_MS = 3000;
const MAX_EMAIL_LEN = 254;

// In-memory caches survive only while the function container stays warm.
// Cold starts reset state — best-effort abuse mitigation, not authoritative.
const DOMAIN_CACHE_TTL_MS = 10 * 60 * 1000;
const DOMAIN_CACHE_MAX = 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_PER_IP = 30;
const RATE_BUCKETS_MAX = 10000;

const domainCache = new Map();
const rateBuckets = new Map();

const ALLOWED_ORIGIN_RE = /^(https:\/\/(([a-z0-9-]+\.)*gensis\.co\.uk|gensis\.netlify\.app)|http:\/\/localhost(:\d+)?)$/i;

const PRIVATE_TLDS = new Set([
  'local', 'localhost', 'internal', 'home', 'lan', 'private',
  'test', 'example', 'invalid', 'corp', 'arpa',
]);

const isPrivateOrInvalidDomain = (domain) => {
  if (!domain || domain.length > 253) return true;
  if (!/^[a-z0-9.-]+$/.test(domain)) return true;
  if (/^[0-9.]+$/.test(domain)) return true;
  if (domain.includes('..')) return true;
  if (domain === 'localhost') return true;
  const tld = domain.split('.').pop();
  return PRIVATE_TLDS.has(tld);
};

const json = (statusCode, body, extraHeaders) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
  body: JSON.stringify(body),
});

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('dns-timeout')), ms)),
  ]);

const getClientIp = (event) => {
  const headers = event.headers || {};
  const xff = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
  if (xff) return String(xff).split(',')[0].trim();
  return headers['x-nf-client-connection-ip'] || headers['client-ip'] || 'unknown';
};

const checkAndIncrementRate = (ip) => {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    if (rateBuckets.size >= RATE_BUCKETS_MAX) {
      rateBuckets.delete(rateBuckets.keys().next().value);
    }
    rateBuckets.set(ip, { count: 1, windowStart: now });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_PER_IP;
};

const getCachedDomain = (domain) => {
  const entry = domainCache.get(domain);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    domainCache.delete(domain);
    return null;
  }
  return entry.result;
};

const setCachedDomain = (domain, result) => {
  if (result.degraded) return;
  if (domainCache.size >= DOMAIN_CACHE_MAX) {
    domainCache.delete(domainCache.keys().next().value);
  }
  domainCache.set(domain, {
    result,
    expires: Date.now() + DOMAIN_CACHE_TTL_MS,
  });
};

const lookupDomain = async (domain) => {
  try {
    const mx = await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS);
    if (mx && mx.length > 0) return { valid: true };
  } catch (err) {
    if (err && err.code !== 'ENODATA' && err.code !== 'ENOTFOUND' && err.message !== 'dns-timeout') {
      return { valid: true, degraded: true };
    }
  }

  try {
    const a = await withTimeout(dns.resolve(domain), DNS_TIMEOUT_MS);
    if (a && a.length > 0) return { valid: true };
  } catch (_) {
    // fall through to invalid
  }

  return { valid: false, reason: 'bad-domain' };
};

exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  if (!ALLOWED_ORIGIN_RE.test(origin)) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  const ip = getClientIp(event);
  if (!checkAndIncrementRate(ip)) {
    return json(429, { valid: false, reason: 'rate-limited' }, {
      'Retry-After': String(Math.ceil(RATE_WINDOW_MS / 1000)),
    });
  }

  const email = (event.queryStringParameters && event.queryStringParameters.email) || '';
  if (email.length > MAX_EMAIL_LEN) {
    return json(200, { valid: false, reason: 'too-long' });
  }
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) {
    return json(200, { valid: false, reason: 'bad-format' });
  }
  const domain = email.slice(at + 1).trim().toLowerCase();

  if (isPrivateOrInvalidDomain(domain)) {
    return json(200, { valid: false, reason: 'bad-domain' });
  }

  const cached = getCachedDomain(domain);
  if (cached) return json(200, cached);

  const result = await lookupDomain(domain);
  setCachedDomain(domain, result);
  return json(200, result);
};
