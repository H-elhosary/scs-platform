// =============================================
// Smart Clinic OS — Admin Console IP/VPN Whitelist
// Opt-in via ADMIN_IP_ALLOWLIST: unset/empty = no-op (current open behavior
// preserved, no lockout risk). Set it to a comma-separated list of IPv4
// addresses/CIDRs (e.g. "203.0.113.4,10.8.0.0/24") once the real VPN range
// is known, and every request outside that range gets a 403.
// IPv4 only — most VPN/office egress ranges are IPv4; IPv6 callers are
// rejected once the allowlist is enabled (fail-closed) rather than silently
// bypassing the check.
// =============================================

function ipToLong(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function parseRange(entry) {
  const [addr, prefixStr] = entry.trim().split('/');
  const base = ipToLong(addr);
  if (base === null) return null;
  const prefix = prefixStr === undefined ? 32 : parseInt(prefixStr, 10);
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) return null;
  const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
  return { network: base & mask, mask };
}

function loadRanges() {
  const raw = process.env.ADMIN_IP_ALLOWLIST || '';
  return raw.split(',').map(e => e.trim()).filter(Boolean).map(parseRange).filter(Boolean);
}

// Strip an IPv4-mapped-IPv6 prefix ("::ffff:203.0.113.4") down to the plain
// IPv4 form so req.ip (which Express may report in that form) still matches.
function normalizeIp(ip) {
  return (ip || '').replace(/^::ffff:/, '');
}

function ipWhitelist(req, res, next) {
  const ranges = loadRanges();
  if (ranges.length === 0) return next(); // not configured — no-op

  const clientIp = ipToLong(normalizeIp(req.ip));
  const allowed = clientIp !== null && ranges.some(r => (clientIp & r.mask) === r.network);

  if (!allowed) {
    console.warn(`🚫 [IP Whitelist] Rejected request from ${req.ip} to ${req.path}`);
    return res.status(403).json({
      success: false,
      error: { code: "IP_NOT_ALLOWED", message: "الوصول لهذه اللوحة مسموح فقط من الشبكة الداخلية/VPN المعتمدة" }
    });
  }

  next();
}

module.exports = ipWhitelist;
