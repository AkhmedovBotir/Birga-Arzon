ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uidx
  ON users (lower(username))
  WHERE username IS NOT NULL AND username <> '';

UPDATE users
SET username = 'admin'
WHERE role = 'admin' AND (username IS NULL OR username = '');
