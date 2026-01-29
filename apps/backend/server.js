import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import interviewRoutes from './routes/interviewRoutes.js';
import authMiddleware from './middleware/authMiddleware.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server
  credentials: true
}));

// Debug: Check if DATABASE_URL is loaded
console.log('DATABASE_URL:', process.env.DATABASE_URL);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/interview', authMiddleware, interviewRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});