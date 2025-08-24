import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import authRoutes from './modules/auth/auth.routes';
import { authenticate } from './middleware/auth';

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(morgan('combined'));

const limiter = rateLimit({ windowMs: 60_000, max: 120 });
app.use(limiter);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.get('/api/me', authenticate, (req: Request, res: Response) => {
  const user = (req as any).user || null;
  res.json({ user });
});

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = parseInt(process.env.PORT || '4000', 10);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sf1';

async function start() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: 'sf1' });
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

start();
