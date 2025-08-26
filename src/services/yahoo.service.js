import axios from 'axios';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

export class YahooService {
  constructor() {
    this.clientId = process.env.YAHOO_CLIENT_ID;
    this.clientSecret = process.env.YAHOO_CLIENT_SECRET;
    this.redirectUri = process.env.YAHOO_REDIRECT_URI;
    
    // Debug logs temporales
    console.log('YahooService initialized:');
    console.log('Client ID:', this.clientId ? 'SET (' + this.clientId.substring(0, 20) + '...)' : 'NOT SET');
    console.log('Client Secret:', this.clientSecret ? 'SET' : 'NOT SET');
    console.log('Redirect URI:', this.redirectUri);
  }

  getAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'fspt-r',
      language: 'en-us'
    });
    
    return `https://api.login.yahoo.com/oauth2/request_auth?${params}`;
  }

  async getAccessToken(code) {
  try {
    const tokenUrl = 'https://api.login.yahoo.com/oauth2/get_token';
    const params = new URLSearchParams();
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('redirect_uri', this.redirectUri);
    params.append('code', code);
    params.append('grant_type', 'authorization_code');

    console.log('Requesting token...');
    console.log('Client ID:', this.clientId?.substring(0,20) + '...');
    console.log('Has secret:', !!this.clientSecret);
    console.log('Code:', code.substring(0,10) + '...');

    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });

    console.log('Yahoo responded with status:', response.status);
    return response.data;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - Yahoo did not respond in 15 seconds');
    } else if (error.response) {
      console.error('Yahoo API error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('No response received from Yahoo:', error.message);
    } else {
      console.error('Error setting up request:', error.message);
    }
    throw error;
  }
}

async getUserLeagues(accessToken) {
  try {
    const response = await axios.get(
      'https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=nfl/leagues?format=json',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error fetching leagues:', error);
    throw error;
  }
}

async getUserTeam(accessToken, leagueKey, teamId = 1) {
  try {
    const response = await axios.get(
      `https://fantasysports.yahooapis.com/fantasy/v2/team/${leagueKey}.t.${teamId}/roster?format=json`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error fetching user team:', error);
    throw error;
  }
}
}
