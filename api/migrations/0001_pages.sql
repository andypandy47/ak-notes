CREATE TABLE pages (
  id TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  updated_at TEXT NOT NULL,
  envelope TEXT NOT NULL CHECK (json_valid(envelope))
);
