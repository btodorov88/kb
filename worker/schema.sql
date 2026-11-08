-- D1 schema for the deployed app. Same columns as server/db.ts (minus the unused last_reviewed_at).
CREATE TABLE IF NOT EXISTS books (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  author      TEXT    NOT NULL DEFAULT '',
  group_name  TEXT,
  cover_url   TEXT,
  status      TEXT    NOT NULL DEFAULT 'finished',
  rating      INTEGER,
  started_at  TEXT,
  finished_at TEXT,
  tags        TEXT    NOT NULL DEFAULT '[]',
  summary     TEXT    NOT NULL DEFAULT '',
  takeaways   TEXT    NOT NULL DEFAULT '[]',
  quotes      TEXT    NOT NULL DEFAULT '[]',
  cards       TEXT    NOT NULL DEFAULT '[]',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
