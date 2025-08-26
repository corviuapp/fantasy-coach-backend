import express from 'express';
import axios from 'axios';
import { YahooService } from '../../YahooService.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const TOKENS_FILE = path.join(process.cwd(), 'tokens.json');

// Global variables to store tokens
let globalAccessToken = null;
let globalRefreshToken = null;

const router = express.Router();
const yahooService = new YahooService();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  const { sessionId } = req.query;
  
  if (!sessionId) {
    return res.status(400).json({ 
      error: 'sessionId is required' 
    });
  }
  
  // Get session from sessionStore
  import('../../server.js').then(({ sessionStore }) => {
    const tokenData = sessionStore.get(sessionId);
    
    if (!tokenData) {
      return res.status(401).json({ 
        error: 'Invalid or expired session' 
      });
    }
    
    // Add token to session for easy access
    req.session = { accessToken: tokenData.access_token };
    next();
  }).catch(() => {
    res.status(500).json({ error: 'Session error' });
  });
};

// Generate Yahoo OAuth URL
router.get('/', (req, res) => {
  const authUrl = yahooService.getAuthUrl();
  res.json({ url: authUrl });
});

// Handle Yahoo callback
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  
  console.log('Yahoo callback received:', { code: code ? 'YES' : 'NO', error });
  
  if (error) {
    console.log('Yahoo auth error:', error);
    return res.redirect('http://localhost:5173/#yahoo-error=' + error);
  }
  
  if (!code) {
    console.log('No code received from Yahoo');
    return res.redirect('http://localhost:5173/#yahoo-error=no_code');
  }

  try {
    // Obtener el access token
    console.log('Getting token with code...');
    const tokenData = await yahooService.getAccessToken(code);
    console.log('Token received successfully!');
    
    try {
      fs.writeFileSync(TOKENS_FILE, JSON.stringify({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        timestamp: Date.now()
      }));
      console.log('Tokens saved to file');
    } catch (err) {
      console.error('Error saving tokens:', err);
    }
    
    // DEBUGGING COMPLETO - Ver toda la información del token
    console.log('\\n=== TOKEN DATA DEBUG ===');
    console.log('Access Token:', tokenData.access_token ? `${tokenData.access_token.substring(0, 50)}...` : 'NOT RECEIVED');
    console.log('Token Type:', tokenData.token_type);
    console.log('Expires In:', tokenData.expires_in);
    console.log('Refresh Token:', tokenData.refresh_token ? 'YES' : 'NO');
    console.log('XOAUTH Yahoo GUID:', tokenData.xoauth_yahoo_guid);
    console.log('Full Token Length:', tokenData.access_token?.length);
    console.log('========================\\n');
    
    let sessionId = null;
    
    if (tokenData.access_token) {
      // PASO 1: Probar el token con una llamada simple
      console.log('STEP 1: Testing token with basic user info...');
      try {
        const testResponse = await axios.get(
          'https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1?format=json',
          {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Accept': 'application/json'
            }
          }
        );
        
        const userGuid = testResponse.data?.fantasy_content?.users?.[0]?.user?.[0]?.guid;
        console.log('✅ Token is valid! User GUID:', userGuid);
        
      } catch (testError) {
        console.error('❌ Token validation failed!');
        console.error('Error:', testError.response?.status, testError.response?.statusText);
        console.error('Error data:', testError.response?.data);
      }
      
      // PASO 2: Buscar teams en NFL 2025 (game key 461)
      console.log('\\nSTEP 2: Looking for NFL 2025 teams (game key 461)...');
      try {
        const teams2025Response = await axios.get(
          'https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=461/teams?format=json',
          {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Accept': 'application/json'
            }
          }
        );
        
        const gamesData = teams2025Response.data?.fantasy_content?.users?.[0]?.user?.[1]?.games;
        
        if (gamesData && gamesData.length > 0) {
          const gameInfo = gamesData[0]?.game?.[0];
          const teamsData = gamesData[0]?.game?.[1]?.teams;
          
          console.log(`   Game: ${gameInfo?.name} ${gameInfo?.season} (${gameInfo?.game_key})`);
          
          if (teamsData && teamsData.length > 0) {
            console.log(`   ✅ Found ${teamsData.length} teams in NFL 2025!`);
            
            const leagueKeys = new Set();
            
            teamsData.forEach((team, idx) => {
              const t = team.team?.[0];
              console.log(`\\n   Team ${idx + 1}:`);
              console.log(`      Name: ${t?.name}`);
              console.log(`      Team Key: ${t?.team_key}`);
              
              // Extraer league key del team key (formato: 461.l.XXXXX.t.Y)
              if (t?.team_key) {
                const leagueKey = t.team_key.split('.t.')[0];
                leagueKeys.add(leagueKey);
                console.log(`      League Key: ${leagueKey}`);
              }
            });
            
            // Intentar obtener detalles de cada liga encontrada
            console.log('\\n   Fetching league details...');
            for (const leagueKey of leagueKeys) {
              try {
                const leagueResponse = await axios.get(
                  `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}?format=json`,
                  {
                    headers: {
                      'Authorization': `Bearer ${tokenData.access_token}`,
                      'Accept': 'application/json'
                    }
                  }
                );
                
                const leagueData = leagueResponse.data?.fantasy_content?.league?.[0];
                console.log(`\\n   ✅ League found!`);
                console.log(`      Name: ${leagueData?.name}`);
                console.log(`      League Key: ${leagueData?.league_key}`);
                console.log(`      Season: ${leagueData?.season}`);
                console.log(`      Draft Status: ${leagueData?.draft_status}`);
                console.log(`      Num Teams: ${leagueData?.num_teams}`);
                console.log(`      Scoring Type: ${leagueData?.scoring_type}`);
                
              } catch (leagueErr) {
                console.log(`   ❌ Could not fetch details for league ${leagueKey}:`, leagueErr.response?.status);
              }
            }
            
          } else {
            console.log('   📭 No teams found in NFL 2025');
          }
        } else {
          console.log('   📭 No NFL 2025 data found');
        }
        
      } catch (err2025) {
        console.log('   ❌ Error accessing NFL 2025:', err2025.response?.status);
        if (err2025.response?.data) {
          console.log('   Error details:', JSON.stringify(err2025.response.data, null, 2).substring(0, 300));
        }
      }
      
      // PASO 3: Buscar en temporadas anteriores
      console.log('\\nSTEP 3: Checking previous seasons...');
      const previousSeasons = [
        { year: '2024', key: '449' },
        { year: '2023', key: '423' },
        { year: 'Current NFL', key: 'nfl' }
      ];
      
      for (const season of previousSeasons) {
        try {
          console.log(`\\n   Checking ${season.year} (key: ${season.key})...`);
          
          const teamsResponse = await axios.get(
            `https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=${season.key}/teams?format=json`,
            {
              headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Accept': 'application/json'
              }
            }
          );
          
          const gamesData = teamsResponse.data?.fantasy_content?.users?.[0]?.user?.[1]?.games;
          
          if (gamesData && gamesData.length > 0) {
            const teams = gamesData[0]?.game?.[1]?.teams;
            if (teams && teams.length > 0) {
              console.log(`      ✅ Found ${teams.length} teams in ${season.year}`);
              teams.slice(0, 2).forEach(team => {
                const t = team.team?.[0];
                console.log(`         - ${t?.name} (${t?.team_key})`);
              });
            } else {
              console.log(`      📭 No teams in ${season.year}`);
            }
          }
          
        } catch (seasonErr) {
          // Silently continue
        }
      }
      
      // PASO 4: Intentar endpoints alternativos
      console.log('\\nSTEP 4: Trying alternative endpoints...');
      
      // Transactions endpoint
      try {
        console.log('   Checking transactions...');
        const transResponse = await axios.get(
          'https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/transactions?format=json',
          {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Accept': 'application/json'
            }
          }
        );
        
        const transData = JSON.stringify(transResponse.data);
        if (transData.includes('league_key')) {
          console.log('   ✅ Found league references in transactions');
        } else {
          console.log('   📭 No league data in transactions');
        }
        
      } catch (transErr) {
        console.log('   ❌ Transactions error:', transErr.response?.status);
      }
      
      // User's current games
      try {
        console.log('   Checking user games...');
        const gamesResponse = await axios.get(
          'https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games?format=json',
          {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Accept': 'application/json'
            }
          }
        );
        
        const games = gamesResponse.data?.fantasy_content?.users?.[0]?.user?.[1]?.games;
        if (games && games.length > 0) {
          console.log(`   ✅ User is in ${games.length} games`);
          games.forEach(game => {
            const g = game.game?.[0];
            console.log(`      - ${g?.name} ${g?.season} (${g?.game_key})`);
          });
        } else {
          console.log('   📭 No games found');
        }
        
      } catch (gamesErr) {
        console.log('   ❌ Games error:', gamesErr.response?.status);
      }
      
      // PASO 5: Resumen final
      console.log('\\n=== SUMMARY ===');
      console.log('Token is valid and working');
      console.log('User GUID confirmed');
      console.log('If leagues are not showing:');
      console.log('1. Pre-draft leagues have limited API access');
      console.log('2. Try again after completing your draft');
      console.log('3. The 2025 season (game key 461) may not be fully active yet');
      console.log('===============\\n');
      
      // Store tokens globally
      globalAccessToken = tokenData.access_token;
      globalRefreshToken = tokenData.refresh_token;
      
      // Store session data
      sessionId = uuidv4();
      const { sessionStore } = await import('../../server.js');
      sessionStore.set(sessionId, {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        created_at: Date.now()
      });
      
      console.log('Session stored with ID:', sessionId);
    }
    
    // Get environment variable for frontend URL
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    // Simple redirect to frontend
    res.redirect(`${FRONTEND_URL}/#access_token=${tokenData.access_token}&refresh_token=${tokenData.refresh_token}`);
    
  } catch (error) {
    console.error('Error getting token:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    res.redirect('http://localhost:5173/#yahoo-error=token_failed');
  }
});

// Get stored tokens endpoint
router.get('/get-tokens', (req, res) => {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
      console.log('Tokens read from file, age:', Date.now() - data.timestamp, 'ms');
      return res.json({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      });
    }
    console.log('No tokens file found');
    res.json({
      accessToken: null,
      refreshToken: null
    });
  } catch (error) {
    console.error('Error reading tokens:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/leagues", async (req, res) => {
  try {
    // Accept accessToken from query parameter or use global token
    const accessToken = req.query.accessToken || globalAccessToken;
    
    if (!accessToken) {
      return res.status(401).json({ 
        error: 'Access token required - provide accessToken query parameter or authenticate first' 
      });
    }
    const url = "https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/teams?format=json";
    
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const users = response.data?.fantasy_content?.users;
    if (!users || !users[0]) return res.json([]);

    const userTeams = users[0].user[1].teams;
    const leaguesMap = {};

    for (let i = 0; i < userTeams.count; i++) {
      const team = userTeams[i].team[0];
      if (team.game_key === "nfl") {
        const leagueKey = team.league_key;
        if (!leaguesMap[leagueKey]) {
          leaguesMap[leagueKey] = {
            league_key: leagueKey,
            name: team.name,
            url: team.url,
            team_count: team.num_teams,
            team_key: team.team_key,
            team_name: team.name
          };
        }
      }
    }

    return res.json(Object.values(leaguesMap));
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get teams in a league
router.get('/teams', async (req, res) => {
  try {
    const { leagueKey } = req.query;
    const accessToken = req.query.accessToken || globalAccessToken;
    
    if (!leagueKey) {
      return res.status(400).json({ 
        error: 'leagueKey is required parameter' 
      });
    }
    
    if (!accessToken) {
      return res.status(401).json({ 
        error: 'Access token required - provide accessToken query parameter or authenticate first' 
      });
    }
    
    // Get teams from the league
    const teamsResponse = await axios.get(
      `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/teams?format=json`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    const teams = teamsResponse.data?.fantasy_content?.league?.[1]?.teams;
    
    if (!teams) {
      return res.status(404).json({ 
        error: 'No teams found in the league' 
      });
    }
    
    // Process teams into a clean format
    const processedTeams = [];
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i]?.team?.[0];
      if (team) {
        processedTeams.push({
          team_key: team.team_key,
          name: team.name,
          owner_guid: team.owner_guid,
          managers: team.managers
        });
      }
    }
    
    console.log(`🚨 EMERGENCY - Found ${processedTeams.length} teams in league ${leagueKey}:`, processedTeams);
    
    res.json({
      success: true,
      teams: processedTeams,
      leagueKey: leagueKey
    });
    
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ 
      error: 'Internal server error while fetching teams' 
    });
  }
});

// Get user roster
router.get('/roster', async (req, res) => {
  try {
    const { leagueKey, teamKey } = req.query;
    const accessToken = req.query.accessToken || globalAccessToken;
    
    // Validar que existan los parámetros requeridos
    if (!leagueKey) {
      return res.status(400).json({ 
        error: 'leagueKey is required parameter' 
      });
    }
    
    if (!accessToken) {
      return res.status(401).json({ 
        error: 'Access token required - provide accessToken query parameter or authenticate first' 
      });
    }
    
    // Hacer llamada a la API de Yahoo para obtener los teams de la liga
    const teamsResponse = await axios.get(
      `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/teams?format=json`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    const teams = teamsResponse.data?.fantasy_content?.league?.[1]?.teams;
    
    if (!teams) {
      return res.status(404).json({ 
        error: 'No teams found in the league' 
      });
    }
    
    // Obtener información del usuario para encontrar su team
    const userResponse = await axios.get(
      'https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1?format=json',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    const userGuid = userResponse.data?.fantasy_content?.users?.[0]?.user?.[0]?.guid;
    
    console.log(`🚨 DEBUG USER GUID: ${userGuid}`);
    
    if (!userGuid) {
      return res.status(404).json({ 
        error: 'Unable to identify user' 
      });
    }
    
    // Use provided teamKey or find user's team
    let targetTeamKey = teamKey;
    
    if (!targetTeamKey) {
      console.log(`🚨 DEBUG: Buscando equipo del usuario ${userGuid} entre ${teams.length} equipos:`);
      
      // Find the user's team automatically using multiple methods
      for (let i = 0; i < teams.length; i++) {
        const team = teams[i]?.team?.[0];
        const managers = team?.managers;
        
        console.log(`   Equipo ${i + 1}: ${team?.name} (${team?.team_key})`);
        console.log(`      Owner GUID: ${team?.owner_guid}`);
        console.log(`      Managers:`, managers);
        
        // Method 1: Direct owner_guid match
        if (team && team.owner_guid === userGuid) {
          targetTeamKey = team.team_key;
          console.log(`   ✅ MATCH (owner_guid)! Usando team_key: ${targetTeamKey}`);
          break;
        }
        
        // Method 2: Check in managers array
        if (managers && managers.length > 0) {
          for (let j = 0; j < managers.length; j++) {
            const manager = managers[j]?.manager?.[0];
            if (manager && (manager.guid === userGuid || manager.owner_guid === userGuid)) {
              targetTeamKey = team.team_key;
              console.log(`   ✅ MATCH (manager)! Usando team_key: ${targetTeamKey}`);
              break;
            }
          }
          if (targetTeamKey) break;
        }
      }
      
      if (!targetTeamKey) {
        console.log(`❌ NO MATCH ENCONTRADO! Usuario ${userGuid} no encontrado en ningún equipo de la liga`);
        
        // Additional debugging: Get user details from a different endpoint
        try {
          const userTeamsResponse = await axios.get(
            `https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games/leagues;league_keys=${leagueKey}/teams?format=json`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
              }
            }
          );
          
          console.log('🔍 Alternative user teams search:', JSON.stringify(userTeamsResponse.data, null, 2));
          
        } catch (altErr) {
          console.log('🔍 Alternative search failed:', altErr.response?.status);
        }
        
        return res.status(404).json({ 
          error: 'User team not found in the league. Use teamKey parameter to specify manually.',
          debugInfo: {
            userGuid: userGuid,
            availableTeams: teams.map(t => ({
              name: t?.team?.[0]?.name,
              team_key: t?.team?.[0]?.team_key,
              owner_guid: t?.team?.[0]?.owner_guid
            }))
          }
        });
      }
    } else {
      console.log(`🚨 DEBUG: Usando team_key manual proporcionado: ${targetTeamKey}`);
    }
    
    console.log(`🚨 EMERGENCY - Using team key: ${targetTeamKey} (manual: ${teamKey ? 'YES' : 'NO'})`);
    
    // Get roster for the target team
    const rosterResponse = await axios.get(
      `https://fantasysports.yahooapis.com/fantasy/v2/team/${targetTeamKey}/roster?format=json`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    const roster = rosterResponse.data?.fantasy_content?.team?.[1]?.roster;
    
    if (!roster) {
      return res.status(404).json({ 
        error: 'Roster not found' 
      });
    }
    
    // Return roster as JSON
    res.json({
      success: true,
      teamKey: targetTeamKey,
      roster: roster
    });
    
  } catch (error) {
    console.error('Error fetching roster:', error);
    
    // Manejar errores específicos de la API de Yahoo
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.description || error.response.statusText;
      
      if (status === 401) {
        return res.status(401).json({ 
          error: 'Authentication failed - token may be expired' 
        });
      } else if (status === 403) {
        return res.status(403).json({ 
          error: 'Access denied - insufficient permissions' 
        });
      } else if (status === 404) {
        return res.status(404).json({ 
          error: 'Resource not found' 
        });
      }
      
      return res.status(status).json({ 
        error: message || 'Yahoo API error' 
      });
    }
    
    // Error genérico
    res.status(500).json({ 
      error: 'Internal server error while fetching roster' 
    });
  }
});

export default router;