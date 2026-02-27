-- Migration 0004: Add AI pipeline fields to trees table
-- New columns for species genus, dual-condition model, imperial units, crown width, stems

ALTER TABLE trees ADD COLUMN IF NOT EXISTS species_genus VARCHAR(200);
ALTER TABLE trees ADD COLUMN IF NOT EXISTS condition_structural VARCHAR(50);
ALTER TABLE trees ADD COLUMN IF NOT EXISTS condition_leaf VARCHAR(50);
ALTER TABLE trees ADD COLUMN IF NOT EXISTS observations TEXT;
ALTER TABLE trees ADD COLUMN IF NOT EXISTS estimated_dbh_in DOUBLE PRECISION;
ALTER TABLE trees ADD COLUMN IF NOT EXISTS estimated_height_ft DOUBLE PRECISION;
ALTER TABLE trees ADD COLUMN IF NOT EXISTS estimated_crown_width_m DOUBLE PRECISION;
ALTER TABLE trees ADD COLUMN IF NOT EXISTS estimated_crown_width_ft DOUBLE PRECISION;
ALTER TABLE trees ADD COLUMN IF NOT EXISTS num_stems INTEGER DEFAULT 1;
