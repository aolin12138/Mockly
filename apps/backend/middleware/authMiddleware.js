import jwt from 'jsonwebtoken';

function authMiddleware(req, res, next) {
  // Expect header in the form "Bearer <token>" but also handle raw token for compatibility
  const authHeader = req.headers['authorization'];
  console.log('Auth header:', authHeader);

  if (!authHeader) {
    console.log('No authorization header provided');
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  console.log('Token:', token.substring(0, 20) + '...');

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, decoded) => {
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
