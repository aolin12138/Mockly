import jwt from 'jsonwebtoken';

function authMiddleware(req, res, next) {
  // Primary: httpOnly cookie (XSS-safe). Fallback: Authorization header (backward compat).
  const token = req.cookies?.token || (() => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return null;
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  })();

  if (!token) {
    console.log('No auth token provided (cookie or header)');
    return res.status(401).json({ message: 'No token provided' });
  }

  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set');
    return res.status(500).json({ message: 'Server configuration error' });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('JWT verification error:', err.message);
      return res.status(401).json({ message: 'Invalid token', error: err.message });
    }

    if (!decoded?.userId) {
      console.log('No userId in decoded token');
      return res.status(401).json({ message: 'Invalid token - no userId' });
    }

    // Attach user context to the request for downstream handlers
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    console.log('Auth successful for user:', req.userId);
    next();
  });
}

export default authMiddleware;
