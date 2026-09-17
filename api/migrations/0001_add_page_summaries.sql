ALTER TABLE `pages`
ADD COLUMN `summary_envelope` text
CONSTRAINT "pages_summary_envelope_valid"
CHECK(`summary_envelope` IS NULL OR json_valid(`summary_envelope`));
