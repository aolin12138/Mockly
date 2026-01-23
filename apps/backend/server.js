import 'dotenv/config';
import express from 'express';
import authRoutes from './routes/authRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Debug: Check if DATABASE_URL is loaded
console.log('DATABASE_URL:', process.env.DATABASE_URL);

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});