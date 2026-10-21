const extractBearerToken = (req) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return null;
    return header.slice(7).trim() || null;
};

const requireAuth = (supabase) => async (req, res, next) => {
    try {
        const token = extractBearerToken(req);
        if (!token) return res.status(401).json({ error: 'Authentication required' });

        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        if (userError || !user) return res.status(401).json({ error: 'Invalid or expired token' });

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        if (profileError || !profile) return res.status(403).json({ error: 'Profile not found' });

        req.auth = { user, profile, token };
        next();
    } catch (error) {
        next(error);
    }
};

const requireRole = (...roles) => (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.auth.profile.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
};

module.exports = { requireAuth, requireRole, extractBearerToken };
