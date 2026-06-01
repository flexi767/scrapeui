CREATE TABLE IF NOT EXISTS dealer_enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_id INTEGER NOT NULL REFERENCES dealers(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dealer_enquiries_dealer
  ON dealer_enquiries(dealer_id, created_at);
