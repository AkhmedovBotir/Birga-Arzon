ALTER TABLE group_buys ADD COLUMN IF NOT EXISTS photo_urls TEXT[] NOT NULL DEFAULT '{}';

UPDATE group_buys
SET photo_urls = ARRAY[photo_url]
WHERE photo_url IS NOT NULL AND photo_url <> '' AND cardinality(photo_urls) = 0;
