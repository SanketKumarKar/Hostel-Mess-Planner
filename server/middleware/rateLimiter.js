const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

/**
 * Standard JSON response for rate-limited requests.
 * Returns a clear error message so clients can display
 * a user-friendly notification instead of a generic 429.
 */
const rateLimitHandler = (req, res, next, options) => {
    res.status(options.statusCode).json({
        error: 'Too many requests — please slow down.',
        retryAfter: Math.ceil(options.windowMs / 1000),
    });
};

/**
 * Key generator: use the Authorization header's JWT subject (user ID)
 * when available, otherwise fall back to IP via the library's IPv6-safe
 * helper. This prevents a single authenticated user from being confused
 * with everyone behind the same NAT / campus proxy.
 */
const keyGenerator = (req, res) => {
    // Try to extract user id from Supabase JWT (base64-decoded payload)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const payload = JSON.parse(
                Buffer.from(authHeader.split('.')[1], 'base64').toString()
            );
            if (payload.sub) return payload.sub; // Supabase user UUID
        } catch {
            // Malformed token — fall through to IP
        }
    }
    return ipKeyGenerator(req, res);
};

// ─────────────────────────────────────────────
// Rate limit tiers
// ─────────────────────────────────────────────

/**
 * 1. GLOBAL — catch-all for every request.
 *    200 req / 1 min per key.
 *    At 2000 users this allows 400k total req/min which is generous.
 */
const globalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200,
    standardHeaders: true,  // Return RateLimit-* headers
    legacyHeaders: false,   // Disable X-RateLimit-* headers
    keyGenerator,
    handler: rateLimitHandler,
});

/**
 * 2. READ (GET) endpoints — most traffic comes here.
 *    100 req / 1 min.
 *    Covers: GET /api/sessions, /api/menu, /api/votes, /api/announcements
 */
const readLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: rateLimitHandler,
});

/**
 * 3. WRITE / MUTATION (POST, PATCH, PUT, DELETE) — state-changing ops.
 *    40 req / 1 min.
 *    Covers: creating sessions, voting, announcements, menu CRUD.
 */
const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: rateLimitHandler,
});

/**
 * 4. AI / EXPENSIVE — Gemini API calls, image uploads, PDF generation.
 *    10 req / 1 min — these are costly and slow.
 */
const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (req, res, next, options) => {
        res.status(options.statusCode).json({
            error: 'AI request limit reached — please wait a minute before trying again.',
            retryAfter: Math.ceil(options.windowMs / 1000),
        });
    },
});

/**
 * 5. AUTH-SENSITIVE — login, register, password reset attempts.
 *    15 req / 15 min (stricter window) to slow brute-force attacks
 *    while still accommodating legitimate typos.
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    // Always key by IP for auth endpoints (no JWT available yet)
    keyGenerator: (req, res) => ipKeyGenerator(req, res),
    handler: (req, res, next, options) => {
        res.status(options.statusCode).json({
            error: 'Too many login attempts — please try again in 15 minutes.',
            retryAfter: Math.ceil(options.windowMs / 1000),
        });
    },
});

/**
 * 6. PDF GENERATION — heavy resource endpoint.
 *    5 req / 1 min.
 */
const pdfLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (req, res, next, options) => {
        res.status(options.statusCode).json({
            error: 'PDF generation limit reached — please wait a minute.',
            retryAfter: Math.ceil(options.windowMs / 1000),
        });
    },
});

module.exports = {
    globalLimiter,
    readLimiter,
    writeLimiter,
    aiLimiter,
    authLimiter,
    pdfLimiter,
};
