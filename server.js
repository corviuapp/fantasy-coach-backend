import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import dotenv from 'dotenv';
import { createServer } from 'http';
import pg from 'pg';
import yahooRoutes from './src/routes/yahoo.js';
import lineupRoutes from './src/routes/lineup.js';

dotenv.config();

const { Pool } = pg;

export const sessionStore = new Map();

class FantasyCoachServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.setupDatabase();
    this.setupMiddleware();
    this.setupRoutes();
  }

  async setupDatabase() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
      await this.pool.query('SELECT NOW()');
      console.log('✅ Database connected');
    } catch (error) {
      console.log('⚠️  Database connection failed:', error.message);
    }
  }

  setupMiddleware() {
    this.app.set('trust proxy', 1);
    
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || "https://frontend-production-f269.up.railway.app",
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"]
    }));

    this.app.use(session({
      secret: process.env.SESSION_SECRET || 'fallback-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? "none" : "lax",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
      }
    }));

    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(morgan('dev'));
  }

  setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString()
      });
    });

    this.app.get('/api/test', (req, res) => {
      res.json({ 
        message: 'Fantasy Coach NFL API is working!',
        version: '1.0.0'
      });
    });

    // Yahoo OAuth routes
    this.app.use('/api/auth/yahoo', yahooRoutes);
    this.app.use('/auth/yahoo', yahooRoutes);
    this.app.use('/api/yahoo', yahooRoutes);
    
    // Lineup optimization routes
    this.app.use('/api/lineup', lineupRoutes);

    // Basic auth routes
    this.app.post('/api/auth/login', async (req, res) => {
      const { email, password } = req.body;
      
      if (email === 'demo@example.com' && password === 'demo123') {
        res.json({
          success: true,
          user: { 
            email: 'demo@example.com', 
            username: 'demo',
            id: 1 
          },
          token: 'fake-jwt-token-for-testing'
        });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });

    // Mock recommendations
    this.app.get('/api/recommendations/draft', (req, res) => {
      res.json([]);
    });

    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });
  }

  async start() {
    this.server = createServer(this.app);
    
    this.server.listen(this.port, () => {
      console.log('🏈 Fantasy Coach NFL API');
      console.log(`📡 Running on port ${this.port}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    });
  }
}

const server = new FantasyCoachServer();
server.start();

export default server;
