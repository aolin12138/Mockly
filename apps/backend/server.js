import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import interviewRoutes from './routes/interviewRoutes.js';
import interviewCallbackRoutes from './routes/interviewCallbackRoutes.js';
import userRoutes from './routes/userRoutes.js';
import technicalRoutes from './routes/technicalRoutes.js';
import codeRunRoutes from './routes/codeRunRoutes.js';
import integrationRoutes from './routes/integrationRoutes.js';
import authMiddleware from './middleware/authMiddleware.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Debug: Check if DATABASE_URL is loaded
console.log('DATABASE_URL:', process.env.DATABASE_URL);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/interview', interviewCallbackRoutes);
app.use('/api/interview', authMiddleware, interviewRoutes);
app.use('/api/user', authMiddleware, userRoutes);
app.use('/api/integrations', authMiddleware, integrationRoutes);
app.use('/api/questions', technicalRoutes);
app.use('/api/code', codeRunRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});