-- Add detailed_log column to crawl_logs table for storing step-by-step logs
ALTER TABLE crawl_logs ADD COLUMN IF NOT EXISTS detailed_log TEXT;

-- Add comment for documentation
COMMENT ON COLUMN crawl_logs.detailed_log IS 'Detailed step-by-step log of the crawling process';
