-- Handle identity: profile website + the once-per-6-months handle change lock

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS handle_changed_at TIMESTAMPTZ;
