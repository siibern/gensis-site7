const dns = require('dns/promises');

const DNS_TIMEOUT_MS = 3000;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('dns-timeout')), ms)),
  ]);

exports.handler = async (event) => {
  const email = (event.queryStringParameters && event.queryStringParameters.email) || '';
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) {
    return json(200, { valid: false, reason: 'bad-format' });
  }
  const domain = email.slice(at + 1).trim().toLowerCase();

  try {
    const mx = await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS);
    if (mx && mx.length > 0) return json(200, { valid: true });
  } catch (err) {
    if (err && err.code !== 'ENODATA' && err.code !== 'ENOTFOUND' && err.message !== 'dns-timeout') {
      return json(200, { valid: true, degraded: true });
    }
  }

  try {
    const a = await withTimeout(dns.resolve(domain), DNS_TIMEOUT_MS);
    if (a && a.length > 0) return json(200, { valid: true });
  } catch (_) {
    // fall through to invalid
  }

  return json(200, { valid: false, reason: 'no-mx' });
};
