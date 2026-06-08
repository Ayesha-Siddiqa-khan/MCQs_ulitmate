-- Add storage_mode to learning_materials for temporary practice support
-- Add expires_at to practice_sessions for temporary session cleanup

ALTER TABLE learning_materials
  ADD COLUMN IF NOT EXISTS storage_mode text NOT NULL DEFAULT 'saved';

ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Index for cleanup of expired temporary sessions
CREATE INDEX IF NOT EXISTS idx_practice_sessions_expires_at
  ON practice_sessions (expires_at)
  WHERE expires_at IS NOT NULL;

-- Index for filtering by storage_mode
CREATE INDEX IF NOT EXISTS idx_learning_materials_storage_mode
  ON learning_materials (storage_mode);
