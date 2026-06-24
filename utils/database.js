const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataFolder = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataFolder)) {
  fs.mkdirSync(dataFolder, { recursive: true });
}

const dbPath = path.join(dataFolder, "giveaways.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.prepare(`
  CREATE TABLE IF NOT EXISTS giveaways (
    messageId TEXT PRIMARY KEY,
    guildId TEXT NOT NULL,
    channelId TEXT NOT NULL,
    hostId TEXT NOT NULL,
    prize TEXT NOT NULL,
    winnerCount INTEGER NOT NULL,
    endAt INTEGER NOT NULL,
    paused INTEGER DEFAULT 0,
    ended INTEGER DEFAULT 0,
    participants TEXT DEFAULT '[]',
    winners TEXT DEFAULT '[]',
    createdAt INTEGER NOT NULL
  )
`).run();

function createGiveaway(data) {
  const stmt = db.prepare(`
    INSERT INTO giveaways (
      messageId, guildId, channelId, hostId, prize, winnerCount, endAt,
      paused, ended, participants, winners, createdAt
    ) VALUES (
      @messageId, @guildId, @channelId, @hostId, @prize, @winnerCount, @endAt,
      @paused, @ended, @participants, @winners, @createdAt
    )
  `);

  stmt.run({
    messageId: data.messageId,
    guildId: data.guildId,
    channelId: data.channelId,
    hostId: data.hostId,
    prize: data.prize,
    winnerCount: data.winnerCount,
    endAt: data.endAt,
    paused: data.paused ? 1 : 0,
    ended: data.ended ? 1 : 0,
    participants: JSON.stringify(data.participants || []),
    winners: JSON.stringify(data.winners || []),
    createdAt: data.createdAt || Date.now()
  });
}

function getGiveaway(messageId) {
  const row = db
    .prepare(`SELECT * FROM giveaways WHERE messageId = ?`)
    .get(messageId);

  if (!row) return null;

  return {
    ...row,
    paused: Boolean(row.paused),
    ended: Boolean(row.ended),
    participants: JSON.parse(row.participants || "[]"),
    winners: JSON.parse(row.winners || "[]")
  };
}

function getAllGiveaways() {
  const rows = db.prepare(`SELECT * FROM giveaways`).all();

  return rows.map((row) => ({
    ...row,
    paused: Boolean(row.paused),
    ended: Boolean(row.ended),
    participants: JSON.parse(row.participants || "[]"),
    winners: JSON.parse(row.winners || "[]")
  }));
}

function updateGiveaway(messageId, updates = {}) {
  const current = getGiveaway(messageId);
  if (!current) return null;

  const merged = {
    ...current,
    ...updates
  };

  db.prepare(`
    UPDATE giveaways
    SET guildId = @guildId,
        channelId = @channelId,
        hostId = @hostId,
        prize = @prize,
        winnerCount = @winnerCount,
        endAt = @endAt,
        paused = @paused,
        ended = @ended,
        participants = @participants,
        winners = @winners,
        createdAt = @createdAt
    WHERE messageId = @messageId
  `).run({
    messageId: merged.messageId,
    guildId: merged.guildId,
    channelId: merged.channelId,
    hostId: merged.hostId,
    prize: merged.prize,
    winnerCount: merged.winnerCount,
    endAt: merged.endAt,
    paused: merged.paused ? 1 : 0,
    ended: merged.ended ? 1 : 0,
    participants: JSON.stringify(merged.participants || []),
    winners: JSON.stringify(merged.winners || []),
    createdAt: merged.createdAt
  });

  return getGiveaway(messageId);
}

function deleteGiveaway(messageId) {
  db.prepare(`DELETE FROM giveaways WHERE messageId = ?`).run(messageId);
}

module.exports = {
  db,
  createGiveaway,
  getGiveaway,
  getAllGiveaways,
  updateGiveaway,
  deleteGiveaway
};
