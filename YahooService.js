import axios from 'axios';

export class YahooService {
  constructor() {
    this.clientId = process.env.YAHOO_CLIENT_ID;
    this.clientSecret = process.env.YAHOO_CLIENT_SECRET;
    this.redirectUri = process.env.YAHOO_REDIRECT_URI || 'http://localhost:3000/auth/yahoo/callback';
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
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code: code,
        grant_type: 'authorization_code'
      });

      const response = await axios.post(
        'https://api.login.yahoo.com/oauth2/get_token',
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Yahoo token error:', error.response?.data);
      throw error;
    }
  }

  async getUserLeagues(accessToken) {
    try {
      const response = await axios.get(
        'https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=nfl/leagues/teams?format=json',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      console.log('🚨 DETAILED YAHOO API RESPONSE - Full Raw Data:');
      console.log('='.repeat(80));
      console.log(JSON.stringify(response.data, null, 2));
      console.log('='.repeat(80));
      
      // Additional targeted logging for teams detection
      if (response.data?.fantasy_content?.users?.[0]?.user?.[1]?.games?.['0']?.game?.[1]?.leagues) {
        const leagues = response.data.fantasy_content.users[0].user[1].games['0'].game[1].leagues;
        console.log('🔍 LEAGUES ANALYSIS:');
        
        for (const key in leagues) {
          if (key !== 'count' && leagues[key]?.league) {
            const leagueData = leagues[key].league;
            const league = leagueData[0];
            const teamsData = leagueData[1]?.teams;
            
            console.log(`📊 League: ${league?.name} (${league?.league_key})`);
            console.log(`   Teams data present: ${teamsData ? 'YES' : 'NO'}`);
            
            if (teamsData) {
              console.log(`   Number of teams: ${teamsData.length}`);
              teamsData.forEach((teamWrapper, idx) => {
                const team = teamWrapper?.team?.[0];
                if (team) {
                  console.log(`   Team ${idx + 1}: ${team.name} (${team.team_key})`);
                  console.log(`      is_owned_by_current_login: ${team.is_owned_by_current_login}`);
                  console.log(`      owner_guid: ${team.owner_guid}`);
                }
              });
            }
            console.log('');
          }
        }
      } else {
        console.log('❌ No leagues data found in expected structure');
      }
      
      return response.data;
    } catch (error) {
      console.error('Yahoo API error:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  async getLeagueSettings(accessToken, leagueKey) {
    try {
      const response = await axios.get(
        `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/settings?format=json`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Yahoo League Settings API error:', error);
      throw error;
    }
  }

  async getRosterPositions(accessToken, gameKey) {
    try {
      const response = await axios.get(
        `https://fantasysports.yahooapis.com/fantasy/v2/game/${gameKey}/roster_positions?format=json`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Yahoo Roster Positions API error:', error);
      throw error;
    }
  }

  async getStatCategories(accessToken, gameKey) {
    try {
      const response = await axios.get(
        `https://fantasysports.yahooapis.com/fantasy/v2/game/${gameKey}/stat_categories?format=json`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Yahoo Stat Categories API error:', error);
      throw error;
    }
  }
}
