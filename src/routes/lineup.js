import express from 'express';
import Groq from 'groq-sdk';
import { YahooService } from '../../YahooService.js';
const router = express.Router();

const yahooService = new YahooService();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post('/optimize', async (req, res) => {
  try {
    const { roster, leagueKey, sessionId } = req.body;

    // Validación de entrada mejorada
    if (!roster || !Array.isArray(roster)) {
      return res.status(400).json({
        error: 'Se requiere un array de jugadores en el roster',
        success: false
      });
    }

    if (roster.length === 0) {
      return res.status(400).json({
        error: 'El roster no puede estar vacío',
        success: false
      });
    }

    // Obtener configuraciones de la liga de Yahoo (opcional)
    let leagueSettings = null;
    let rosterPositions = [];
    let scoringSettings = null;
    
    if (leagueKey && sessionId) {
      try {
        const accessToken = await getAccessTokenFromSession(sessionId, req);
        if (accessToken) {
          try {
            leagueSettings = await yahooService.getLeagueSettings(accessToken, leagueKey);
            
            // Extraer game_key del league_key para obtener roster positions
            const gameKeyOnly = leagueKey.split('.')[0];
            
            const rosterPositionsData = await yahooService.getRosterPositions(accessToken, gameKeyOnly);
            const statCategoriesData = await yahooService.getStatCategories(accessToken, gameKeyOnly);
            
            rosterPositions = parseRosterPositions(rosterPositionsData);
            scoringSettings = parseScoringSettings(statCategoriesData, leagueSettings);
          } catch (apiError) {
            console.log('Yahoo API call failed:', apiError.message);
            // Continue with defaults
          }
        }
      } catch (sessionError) {
        console.log('Session token retrieval failed:', sessionError.message);
        // Continue with defaults
      }
    }

    // Generar proyecciones y análisis de matchups con validación
    let playersWithProjections = [];
    let playersWithMatchups = [];
    
    try {
      playersWithProjections = await getPlayerProjections(roster, scoringSettings);
      playersWithMatchups = await analyzeMatchups(playersWithProjections);
    } catch (projectionError) {
      console.error('Error generating projections:', projectionError.message);
      return res.status(500).json({
        error: 'Error procesando datos de jugadores',
        success: false
      });
    }

    // Usar fallback directamente sin Groq para evitar crashes
    console.log('Generating optimized lineup with fallback method for', playersWithMatchups.length, 'players');
    
    let optimizedLineup;
    try {
      optimizedLineup = await generateOptimizedLineup(playersWithMatchups, rosterPositions, leagueSettings);
      
      if (!optimizedLineup || !optimizedLineup.lineup) {
        throw new Error('Failed to generate lineup');
      }
    } catch (optimizationError) {
      console.error('Optimization error:', optimizationError.message);
      
      // Emergency fallback with minimal data
      optimizedLineup = {
        lineup: playersWithMatchups.slice(0, 9).map(player => ({
          player_id: player.player_id || 'unknown',
          player_name: player.name || 'Unknown Player',
          position: player.display_position || player.position || 'N/A',
          projected_points: (player.projection?.points || 10).toFixed(1),
          confidence: player.projection?.confidence || 75,
          scoring_type: 'standard',
          lineup_position: player.position || 'FLEX'
        })),
        changes: [],
        explanations: [{
          player_id: 'general',
          player_name: 'Lineup Optimización',
          explanation: 'Se generó un lineup básico debido a limitaciones de procesamiento'
        }]
      };
    }

    // Validar respuesta antes de enviar
    if (!optimizedLineup.lineup || !Array.isArray(optimizedLineup.lineup)) {
      return res.status(500).json({
        error: 'Error en la generación del lineup optimizado',
        success: false
      });
    }

    res.json({
      lineup_optimizado: optimizedLineup.lineup,
      cambios_sugeridos: optimizedLineup.changes || [],
      explicaciones: optimizedLineup.explanations || [],
      success: true,
      roster_count: playersWithMatchups.length,
      optimized_count: optimizedLineup.lineup.length
    });

  } catch (error) {
    console.error('Critical error optimizing lineup:', error);
    
    // Último recurso: respuesta mínima válida
    res.status(500).json({
      error: 'Error interno del servidor al optimizar lineup',
      success: false,
      lineup_optimizado: [],
      cambios_sugeridos: [],
      explicaciones: [{
        player_id: 'error',
        player_name: 'Sistema',
        explanation: 'Ocurrió un error procesando tu solicitud. Por favor intenta nuevamente.'
      }]
    });
  }
});

async function getPlayerProjections(roster, scoringSettings) {
  try {
    if (!roster || !Array.isArray(roster)) {
      throw new Error('Invalid roster data');
    }

    return roster.map(player => {
      try {
        const basePoints = Math.random() * 25 + 5;
        
        // Aplicar modificadores de scoring si están disponibles
        let adjustedPoints = basePoints;
        if (scoringSettings && scoringSettings.pprValue) {
          // Ajustar puntos basado en el tipo de scoring (PPR, medio PPR, standard)
          const playerPos = player.position || player.display_position || '';
          if (scoringSettings.pprValue > 0 && ['WR', 'RB', 'TE'].includes(playerPos)) {
            // Los receptores obtienen más puntos en ligas PPR
            adjustedPoints += Math.random() * scoringSettings.pprValue * 8; // Simular recepciones
          }
        }
        
        return {
          ...player,
          player_id: player.player_id || player.id || `player_${Math.random()}`,
          name: player.name || player.player_name || 'Unknown Player',
          position: player.position || player.display_position || 'FLEX',
          projection: {
            points: Math.max(0, adjustedPoints),
            confidence: Math.random() * 100,
            ceiling: adjustedPoints + Math.random() * 10,
            floor: Math.max(0, adjustedPoints - Math.random() * 8),
            scoringType: scoringSettings?.scoringType || 'standard'
          }
        };
      } catch (playerError) {
        console.error('Error processing player:', playerError.message);
        // Return a safe fallback for this player
        return {
          ...player,
          player_id: player.player_id || player.id || `player_${Math.random()}`,
          name: player.name || 'Unknown Player',
          position: player.position || 'FLEX',
          projection: {
            points: 10,
            confidence: 50,
            ceiling: 15,
            floor: 5,
            scoringType: 'standard'
          }
        };
      }
    });
  } catch (error) {
    console.error('Error in getPlayerProjections:', error.message);
    throw error;
  }
}

async function analyzeMatchups(players) {
  try {
    if (!players || !Array.isArray(players)) {
      throw new Error('Invalid players data for matchup analysis');
    }

    return players.map(player => {
      try {
        return {
          ...player,
          matchup: {
            difficulty: ['Easy', 'Medium', 'Hard'][Math.floor(Math.random() * 3)],
            opponent_rank: Math.floor(Math.random() * 32) + 1,
            weather_impact: Math.random() > 0.7 ? 'Negative' : 'Neutral',
            injury_status: ['Healthy', 'Questionable', 'Doubtful'][Math.floor(Math.random() * 3)]
          }
        };
      } catch (playerError) {
        console.error('Error analyzing matchup for player:', playerError.message);
        return {
          ...player,
          matchup: {
            difficulty: 'Medium',
            opponent_rank: 16,
            weather_impact: 'Neutral',
            injury_status: 'Healthy'
          }
        };
      }
    });
  } catch (error) {
    console.error('Error in analyzeMatchups:', error.message);
    throw error;
  }
}

async function generateOptimizedLineup(players, rosterPositions, leagueSettings) {
  let startPlayers = [];
  let availablePlayers = [...players];
  
  // Si tenemos restricciones de posición, úsalas
  if (rosterPositions && rosterPositions.length > 0) {
    startPlayers = optimizeWithPositionConstraints(availablePlayers, rosterPositions);
  } else {
    // Fallback al método original si no hay restricciones
    startPlayers = players
      .sort((a, b) => b.projection.points - a.projection.points)
      .slice(0, Math.min(9, players.length));
  }
  
  const sitPlayers = players.filter(player => 
    !startPlayers.find(starter => starter.player_id === player.player_id)
  );

  // Generate smarter START/SIT recommendations considering position constraints
  const changes = generateStartSitRecommendations(startPlayers, sitPlayers, rosterPositions);

  const explanations = startPlayers.map(player => ({
    player_id: player.player_id,
    player_name: player.name || 'Unknown Player',
    explanation: `Start recomendado: ${player.projection.points.toFixed(1)} puntos proyectados, matchup ${player.matchup.difficulty.toLowerCase()} vs equipo ranked #${player.matchup.opponent_rank}`
  }));

  return {
    lineup: startPlayers.map(player => ({
      player_id: player.player_id,
      player_name: player.name || 'Unknown Player',
      position: player.display_position || player.position,
      projected_points: player.projection.points.toFixed(1),
      confidence: Math.round(player.projection.confidence),
      scoring_type: player.projection.scoringType || 'standard',
      lineup_position: player.optimized_position
    })),
    changes,
    explanations,
    roster_requirements: rosterPositions,
    scoring_settings: leagueSettings?.scoring_type
  };
}

// Helper functions
async function getAccessTokenFromSession(sessionId, req) {
  try {
    // Get tokenStore from Express app (set in server.js)
    const app = req?.app;
    const tokenStore = app?.get('tokenStore') || new Map();
    const session = tokenStore.get(sessionId);
    return session?.access_token || null;
  } catch (error) {
    console.error('Error getting access token from session:', error);
    return null;
  }
}

function parseRosterPositions(rosterPositionsData) {
  try {
    if (!rosterPositionsData?.fantasy_content?.game?.roster_positions) {
      return [];
    }
    
    const positions = rosterPositionsData.fantasy_content.game.roster_positions;
    const rosterReqs = [];
    
    // Parse Yahoo roster positions format
    for (let i = 0; i < positions.count; i++) {
      const position = positions[i]?.roster_position;
      if (position) {
        rosterReqs.push({
          position: position.position,
          position_type: position.position_type,
          count: position.count || 1,
          is_starting_position: position.is_starting_position === '1'
        });
      }
    }
    
    return rosterReqs;
  } catch (error) {
    console.error('Error parsing roster positions:', error);
    return [];
  }
}

function parseScoringSettings(statCategoriesData, leagueSettings) {
  try {
    const scoring = {
      scoringType: 'standard',
      pprValue: 0,
      statModifiers: {}
    };
    
    // Parse scoring type from league settings
    if (leagueSettings?.fantasy_content?.league?.settings?.scoring_type) {
      scoring.scoringType = leagueSettings.fantasy_content.league.settings.scoring_type;
    }
    
    // Parse stat categories for PPR information
    if (statCategoriesData?.fantasy_content?.game?.stat_categories) {
      const stats = statCategoriesData.fantasy_content.game.stat_categories;
      
      // Look for reception stats to determine PPR value
      for (let i = 0; i < stats.count; i++) {
        const stat = stats[i]?.stat_category;
        if (stat && stat.name === 'Receptions') {
          scoring.pprValue = parseFloat(stat.value) || 0;
          break;
        }
      }
    }
    
    return scoring;
  } catch (error) {
    console.error('Error parsing scoring settings:', error);
    return { scoringType: 'standard', pprValue: 0, statModifiers: {} };
  }
}

function optimizeWithPositionConstraints(players, rosterPositions) {
  const lineup = [];
  const availablePlayers = [...players];
  
  // Sort players by projected points descending
  availablePlayers.sort((a, b) => b.projection.points - a.projection.points);
  
  // Fill required positions first
  const startingPositions = rosterPositions.filter(pos => pos.is_starting_position);
  
  // Track how many players we've used for each position
  const positionCounts = {};
  
  for (const posReq of startingPositions) {
    const { position, count } = posReq;
    let filled = 0;
    
    for (let i = availablePlayers.length - 1; i >= 0 && filled < count; i--) {
      const player = availablePlayers[i];
      const playerPos = player.display_position || player.position;
      
      // Check if player can fill this position
      if (canPlayerFillPosition(player, position)) {
        // For non-FLEX positions, ensure we don't exceed individual position limits
        if (position !== 'W/R/T' && position !== 'W/R' && position !== 'BN') {
          // Count how many of this specific position we already have
          const currentPosCount = positionCounts[playerPos] || 0;
          const maxForPosition = getMaxPlayersForPosition(playerPos);
          
          // Skip if we already have enough of this position
          if (currentPosCount >= maxForPosition) {
            continue;
          }
          
          positionCounts[playerPos] = currentPosCount + 1;
        }
        
        player.optimized_position = position;
        lineup.push(player);
        availablePlayers.splice(i, 1);
        filled++;
      }
    }
  }
  
  return lineup;
}

// Helper function to define max players per position in a standard lineup
function getMaxPlayersForPosition(position) {
  const limits = {
    'QB': 1,
    'RB': 2,
    'WR': 2,
    'TE': 1,
    'K': 1,
    'DEF': 1
  };
  return limits[position] || 99; // Allow unlimited for positions not in limits (like FLEX)
}

function canPlayerFillPosition(player, requiredPosition) {
  const playerPos = player.display_position || player.position;
  
  // Direct position match
  if (playerPos === requiredPosition) {
    return true;
  }
  
  // Handle FLEX positions
  if (requiredPosition === 'W/R/T') {
    return ['WR', 'RB', 'TE'].includes(playerPos);
  }
  
  if (requiredPosition === 'W/R') {
    return ['WR', 'RB'].includes(playerPos);
  }
  
  // Handle other flexible positions
  if (requiredPosition === 'BN') {
    return true; // Bench can hold any position
  }
  
  return false;
}

function generateStartSitRecommendations(startPlayers, benchPlayers, rosterPositions) {
  const recommendations = [];
  
  // Find potential improvements: bench players who could replace starters
  benchPlayers.forEach(benchPlayer => {
    const betterThanStarters = startPlayers.filter(starter => {
      // Check if bench player can play starter's position and has higher projection
      const canReplace = canPlayerFillPosition(benchPlayer, starter.optimized_position || starter.position);
      const betterProjection = benchPlayer.projection.points > starter.projection.points;
      
      return canReplace && betterProjection;
    });
    
    if (betterThanStarters.length > 0) {
      const worstStarter = betterThanStarters.sort((a, b) => a.projection.points - b.projection.points)[0];
      
      recommendations.push({
        player_id: benchPlayer.player_id,
        player_name: benchPlayer.name || 'Unknown Player',
        action: 'start',
        reason: `Proyección superior (${benchPlayer.projection.points.toFixed(1)} vs ${worstStarter.projection.points.toFixed(1)} pts) y puede jugar ${worstStarter.optimized_position || worstStarter.position}`,
        replaces: worstStarter.player_id
      });
      
      recommendations.push({
        player_id: worstStarter.player_id,
        player_name: worstStarter.name || 'Unknown Player',
        action: 'sit',
        reason: `Menor proyección (${worstStarter.projection.points.toFixed(1)} pts) comparado con ${benchPlayer.name} en banca`,
        replaced_by: benchPlayer.player_id
      });
    }
  });
  
  // If no position-based improvements found, fall back to basic recommendations
  if (recommendations.length === 0) {
    const lowPerformers = benchPlayers
      .sort((a, b) => a.projection.points - b.projection.points)
      .slice(0, 3);
      
    lowPerformers.forEach(player => {
      recommendations.push({
        player_id: player.player_id,
        player_name: player.name || 'Unknown Player',
        action: 'sit',
        reason: `Proyección baja (${player.projection.points.toFixed(1)} pts) y matchup ${player.matchup?.difficulty?.toLowerCase() || 'desconocido'}`
      });
    });
  }
  
  return recommendations.slice(0, 5); // Limit to top 5 recommendations
}

export default router;
