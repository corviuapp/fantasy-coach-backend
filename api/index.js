export default function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://frontend-production-f269.up.railway.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { method, query, body } = req;
  // Parse URL sin query parameters
  const url = req.url.split('?')[0];
  
  // Health check
  if (url === '/health') {
    return res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  }
  
  // Root
  if (url === '/') {
    return res.json({ message: 'Fantasy Coach NFL API Working!' });
  }
  
  // Login
  if (method === 'POST' && url === '/api/auth/login') {
    const { email, password } = body;
    if (email === 'demo@example.com' && password === 'demo123') {
      return res.json({
        success: true,
        user: { email: 'demo@example.com', username: 'demo', id: 1 },
        token: 'fake-jwt-token-for-testing'
      });
    }
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Yahoo auth URL
  if (url === '/api/auth/yahoo') {
    const authUrl = `https://api.login.yahoo.com/oauth2/request_auth?client_id=${process.env.YAHOO_CLIENT_ID}&redirect_uri=${process.env.YAHOO_REDIRECT_URI}&response_type=code`;
    return res.json({ url: authUrl });
  }
  
  // Yahoo callback
  if (url === '/auth/yahoo/callback') {
    const { code, error } = query;
    if (error) {
      return res.redirect(302, `https://frontend-production-f269.up.railway.app/#yahoo-error=${error}`);
    }
    if (!code) {
      return res.redirect(302, `https://frontend-production-f269.up.railway.app/#yahoo-error=no_code`);
    }
    return res.redirect(302, `https://frontend-production-f269.up.railway.app/#access_token=temp_token&refresh_token=temp_refresh`);
  }
  
  // Mock leagues - ahora maneja correctamente la URL
  if (url === '/api/yahoo/leagues') {
    return res.json([{
      league_key: "nfl.l.test",
      name: "Test League", 
      url: "#",
      team_count: 10,
      team_key: "nfl.l.test.t.1",
      team_name: "My Test Team"
    }]);
  }
  
  // Mock roster
  if (url === '/api/yahoo/roster') {
    return res.json({ 
      success: true, 
      teamKey: query.teamKey || 'test',
      roster: { 
        players: []
      } 
    });
  }
  
  // Mock lineup optimize
  if (method === 'POST' && url === '/api/lineup/optimize') {
    return res.json({ 
      optimizedLineup: [], 
      message: "No players available" 
    });
  }
  
  // Mock recommendations
  if (url === '/api/recommendations/draft') {
    return res.json([]);
  }
  
  // Test endpoint
  if (url === '/api/test') {
    return res.json({ 
      message: 'API is working!',
      version: '1.0.0'
    });
  }
  
  // Default 404
  res.status(404).json({ 
    error: 'Route not found', 
    path: req.url,
    method: method 
  });
}
