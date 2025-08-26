import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// import { db, createTables } from './database.js';
import yahooRoutes from './routes/yahoo.js';
import expertRoutes from './routes/experts.js';
import coachRoutes from './routes/coach.js';
import lineupRoutes from './routes/lineup.js';

dotenv.config();

const tokenStore = new Map();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://frontend-production-f269.up.railway.app',
    'https://frontend-production-5421.up.railway.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200,
  preflightContinue: false
}));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    message: 'Backend is running!'
  });
});

app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend connected successfully!',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Login funcional sin base de datos
  if (email === 'demo@example.com' && password === 'demo123') {
    res.json({
      success: true,
      user: { 
        email: 'demo@example.com', 
        username: 'Demo User',
        id: 1
      },
      token: 'demo-token-123'
    });
  } else {
    res.status(401).json({ 
      success: false,
      error: 'Invalid credentials' 
    });
  }
});

/*
app.get('/api/recommendations/draft', (req, res) => {
  try {
    const players = db.prepare('SELECT * FROM players ORDER BY projected_points DESC LIMIT 3').all();
    
    const recommendations = players.map((player, idx) => ({
      player: { 
        name: player.name, 
        position: player.position, 
        team: player.team 
      },
      score: Math.round(90 - idx * 3),
      confidence: Math.round(85 - idx * 5),
      explanation: `Projected for ${player.projected_points} points this season.`
    }));
    
    res.json(recommendations);
  } catch (error) {
    console.error('Error getting players:', error);
    res.status(500).json({ error: 'Database error' });
  }
});
*/

// Yahoo OAuth - Agregar ANTES de app.listen
import { YahooService } from './services/yahoo.service.js';
const yahoo = new YahooService();

// Ruta para iniciar OAuth con Yahoo
app.get('/api/auth/yahoo', (req, res) => {
  const authUrl = yahoo.getAuthUrl();
  res.json({ url: authUrl });
});

/*
// Obtener ligas de Yahoo
app.get('/api/yahoo/leagues', async (req, res) => {
  try {
    // Aquí obtendrías el token del usuario de la DB
    // Por ahora retornamos mock data
    res.json([
      { id: 1, name: 'My Yahoo League', teams: 12, platform: 'yahoo' }
    ]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
*/

app.get('/api/yahoo/test-leagues', async (req, res) => {
  try {
    const { access_token } = req.query;
    
    if (!access_token) {
      return res.status(400).json({ error: 'Access token is required' });
    }
    
    const leagues = await yahoo.getUserLeagues(access_token);
    res.json(leagues);
  } catch (error) {
    console.error('Error fetching Yahoo leagues:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener ligas de Yahoo usando sessionId
app.get('/api/yahoo/leagues', async (req, res) => {
  try {
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Obtener el token del Map usando el sessionId
    const tokenData = tokenStore.get(sessionId);
    
    if (!tokenData) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    
    // Usar el token guardado para obtener las ligas del usuario
    const leagues = await yahoo.getUserLeagues(tokenData.access_token);
    res.json(leagues);
  } catch (error) {
    console.error('Error fetching Yahoo leagues:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener roster del usuario usando sessionId y leagueKey
app.get('/api/yahoo/roster', async (req, res) => {
  try {
    const { sessionId, leagueKey } = req.query;
    
    if (!sessionId || !leagueKey) {
      return res.status(400).json({ error: 'Session ID and league key are required' });
    }
    
    // Obtener el token del Map usando el sessionId
    const tokenData = tokenStore.get(sessionId);
    
    if (!tokenData) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    
    // Usar el token guardado para obtener el roster del usuario
    const roster = await yahoo.getUserTeam(tokenData.access_token, leagueKey);
    res.json(roster);
  } catch (error) {
    console.error('Error fetching Yahoo roster:', error);
    res.status(500).json({ error: error.message });
  }
});

// Hacer el tokenStore disponible para los routers
app.set('tokenStore', tokenStore);

app.use('/api/auth/yahoo', yahooRoutes);
app.use('/api/expert-consensus', expertRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/lineup', lineupRoutes);
app.listen(PORT, () => {
  console.log('================================');
  console.log('Fantasy Coach NFL Backend');
  console.log('Server running on port:', PORT);
  console.log('http://localhost:' + PORT);
  console.log('================================');
});
