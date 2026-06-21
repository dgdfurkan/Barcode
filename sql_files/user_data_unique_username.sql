-- user_data: kullanıcı başına tek satır (duplicate INSERT engeli)
-- Supabase SQL Editor'da bir kez çalıştırın.

-- Önce duplicate varsa temizle (en güncel kalsın)
DELETE FROM user_data
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY username
             ORDER BY updated_at DESC NULLS LAST, id DESC
           ) AS rn
    FROM user_data
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_data_username_unique ON user_data (username);
