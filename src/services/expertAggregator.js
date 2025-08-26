const mockPlayerData = [
  {
    name: 'Justin Jefferson',
    position: 'WR',
    team: 'MIN',
    espnRank: 2,
    sleeperADP: 3.2,
    redditSentiment: 'positive',
    consensusScore: 95
  },
  {
    name: 'Christian McCaffrey',
    position: 'RB',
    team: 'SF',
    espnRank: 1,
    sleeperADP: 2.1,
    redditSentiment: 'positive',
    consensusScore: 98
  },
  {
    name: 'Tyreek Hill',
    position: 'WR',
    team: 'MIA',
    espnRank: 4,
    sleeperADP: 5.8,
    redditSentiment: 'positive',
    consensusScore: 92
  },
  {
    name: 'Austin Ekeler',
    position: 'RB',
    team: 'LAC',
    espnRank: 8,
    sleeperADP: 9.4,
    redditSentiment: 'neutral',
    consensusScore: 85
  },
  {
    name: 'Travis Kelce',
    position: 'TE',
    team: 'KC',
    espnRank: 6,
    sleeperADP: 7.1,
    redditSentiment: 'positive',
    consensusScore: 89
  },
  {
    name: 'Patrick Mahomes',
    position: 'QB',
    team: 'KC',
    espnRank: 3,
    sleeperADP: 4.5,
    redditSentiment: 'positive',
    consensusScore: 94
  },
  {
    name: 'Stefon Diggs',
    position: 'WR',
    team: 'BUF',
    espnRank: 7,
    sleeperADP: 8.2,
    redditSentiment: 'positive',
    consensusScore: 88
  },
  {
    name: 'Josh Allen',
    position: 'QB',
    team: 'BUF',
    espnRank: 5,
    sleeperADP: 6.1,
    redditSentiment: 'positive',
    consensusScore: 91
  },
  {
    name: 'Ja\'Marr Chase',
    position: 'WR',
    team: 'CIN',
    espnRank: 9,
    sleeperADP: 10.3,
    redditSentiment: 'positive',
    consensusScore: 86
  },
  {
    name: 'Nick Chubb',
    position: 'RB',
    team: 'CLE',
    espnRank: 12,
    sleeperADP: 11.8,
    redditSentiment: 'neutral',
    consensusScore: 82
  },
  {
    name: 'Cooper Kupp',
    position: 'WR',
    team: 'LAR',
    espnRank: 15,
    sleeperADP: 16.2,
    redditSentiment: 'neutral',
    consensusScore: 78
  },
  {
    name: 'Davante Adams',
    position: 'WR',
    team: 'LV',
    espnRank: 11,
    sleeperADP: 12.5,
    redditSentiment: 'positive',
    consensusScore: 83
  }
];

function calculateConsensusScore(espnRank, sleeperADP, redditSentiment) {
  const avgRank = (espnRank + sleeperADP) / 2;
  let baseScore = Math.max(10, 110 - (avgRank * 2.5));
  
  const sentimentBonus = {
    'positive': 5,
    'neutral': 0,
    'negative': -5
  };
  
  return Math.min(100, Math.max(10, Math.round(baseScore + sentimentBonus[redditSentiment])));
}

function getPlayerConsensus(playerName = '') {
  const searchTerm = playerName.toLowerCase().trim();
  
  let results = mockPlayerData;
  
  if (searchTerm) {
    results = mockPlayerData.filter(player => 
      player.name.toLowerCase().includes(searchTerm)
    );
  }
  
  return results.map(player => ({
    ...player,
    consensusScore: calculateConsensusScore(player.espnRank, player.sleeperADP, player.redditSentiment)
  }));
}

export default { getPlayerConsensus };