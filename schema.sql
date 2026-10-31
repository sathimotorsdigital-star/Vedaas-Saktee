-- Cloudflare D1 (private server-side DB, never accessible as static files)
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY NOT NULL,
  received_at TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT DEFAULT '',
  product TEXT NOT NULL,
  price_inr INTEGER NOT NULL,
  page_url TEXT DEFAULT '',
  campaign TEXT DEFAULT '',
  source TEXT DEFAULT '',
  consent TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New Lead'
);
CREATE INDEX IF NOT EXISTS idx_leads_time ON leads(received_at);
CREATE TABLE IF NOT EXISTS events_daily (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  campaign TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day,event,campaign,source)
);
