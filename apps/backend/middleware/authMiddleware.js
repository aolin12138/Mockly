import jwt from 'jsonwebtoken';

function authMiddleware(req, res, next) {
  // Expect header in the form "Bearer <token>" but also handle raw token for compatibility
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, decoded) => {
    if (err || !decoded?.userId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Attach user context to the request for downstream handlers
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  });
}

export default authMiddleware;
