import Database from 'better-sqlite3';

const db = new Database('fantasy_coach.db');

export function createTables() {
  // Crear tabla usuarios
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Crear tabla jugadores  
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      position TEXT,
      team TEXT,
      projected_points REAL
    )
  `);

  // Insertar usuario demo
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (email, username, password_hash) VALUES (?, ?, ?)');
  insertUser.run('demo@example.com', 'Demo User', 'demo123');

  // Insertar jugadores
  const insertPlayer = db.prepare('INSERT OR IGNORE INTO players (name, position, team, projected_points) VALUES (?, ?, ?, ?)');
  const players = [
    ['Justin Jefferson', 'WR', 'MIN', 320],
    ['Breece Hall', 'RB', 'NYJ', 285],
    ['Patrick Mahomes', 'QB', 'KC', 380],
    ['Travis Kelce', 'TE', 'KC', 240],
    ['CeeDee Lamb', 'WR', 'DAL', 310],
    ['Saquon Barkley', 'RB', 'PHI', 275]
  ];

  players.forEach(p => insertPlayer.run(...p));
  
  console.log('✅ Database ready with better-sqlite3!');
}

export { db };
createTables();