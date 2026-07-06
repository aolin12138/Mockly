import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import interviewRoutes from './routes/interviewRoutes.js';
import interviewCallbackRoutes from './routes/interviewCallbackRoutes.js';
import userRoutes from './routes/userRoutes.js';
import technicalRoutes from './routes/technicalRoutes.js';
import codeRunRoutes from './routes/codeRunRoutes.js';
import codeSyncRoutes from './routes/codeSyncRoutes.js';
import integrationRoutes from './routes/integrationRoutes.js';
import authMiddleware from './middleware/authMiddleware.js';
import { mcpPostHandler, mcpGetHandler } from './lib/mcp/server.js';
import { mcpAuthMiddleware } from './lib/mcp/auth.js';
import testRoutes from './routes/testRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Production safety checks
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('FATAL: JWT_SECRET must be at least 32 characters in production');
    process.exit(1);
  }
  if (!process.env.FEEDBACK_CALLBACK_SECRET || process.env.FEEDBACK_CALLBACK_SECRET.length < 16) {
    console.error('FATAL: FEEDBACK_CALLBACK_SECRET must be at least 16 characters in production');
    process.exit(1);
  }
  if (!process.env.MCP_SHARED_SECRET || process.env.MCP_SHARED_SECRET.length < 16) {
    console.error('FATAL: MCP_SHARED_SECRET must be at least 16 characters in production');
    process.exit(1);
  }
}

// Security: Helmet headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: false, // Disable default CSP — we configure via nginx or app-level
  crossOriginEmbedderPolicy: false,
}));

// Security: Trust proxy for rate limiting behind nginx
app.set('trust proxy', 1);

// CORS configuration — use ALLOWED_ORIGINS env var, fallback to localhost for dev
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174').split(',');

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser — reduced from 50MB to 5MB (DoS protection)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// Cookie parser (for httpOnly JWT cookies)
app.use(cookieParser());

// CSRF protection: verify X-CSRF-Token header matches csrf_token cookie for state-changing requests
const csrfProtection = (req, res, next) => {
  // Skip for GET, HEAD, OPTIONS (safe methods)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Skip for MCP and test endpoints (use their own auth)
  if (req.path.startsWith('/mcp') || req.path.startsWith('/api/test')) return next();

  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF token validation failed' });
  }
  next();
};
app.use(csrfProtection);
app.use('/api/auth', authRoutes);
app.use('/api/interview', interviewCallbackRoutes);
app.use('/api/interview', authMiddleware, interviewRoutes);
app.use('/api/user', authMiddleware, userRoutes);
app.use('/api/integrations', authMiddleware, integrationRoutes);
app.use('/api/questions', technicalRoutes);
app.use('/api/code', codeRunRoutes);
app.use('/api/code', codeSyncRoutes);

// MCP server endpoint (authenticated via shared secret, not JWT)
app.post('/mcp', mcpAuthMiddleware, mcpPostHandler);
app.get('/mcp', mcpAuthMiddleware, mcpGetHandler);
app.use('/api/test', testRoutes);

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Production error handler: never leak stack traces to clients
app.use((err, req, res, _next) => {
  console.error('[error]', err.message, err.stack?.split('\n')[0]);
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    error: isProduction ? 'Internal server error' : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`MCP server available at POST /mcp`);
});