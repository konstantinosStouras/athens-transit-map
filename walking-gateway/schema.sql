-- Never delete/reset a current month's row: it is the durable billing guard.
CREATE TABLE IF NOT EXISTS walking_usage (
  month TEXT PRIMARY KEY,
  used INTEGER NOT NULL CHECK (used >= 0),
  day TEXT NOT NULL,
  day_used INTEGER NOT NULL CHECK (day_used >= 0)
);
