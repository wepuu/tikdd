ALTER TABLE admin_platform_presentation_revisions
  ADD COLUMN IF NOT EXISTS revision_kind TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS previous_revision BIGINT,
  ADD COLUMN IF NOT EXISTS public_display_name TEXT,
  ADD COLUMN IF NOT EXISTS support_label TEXT;

UPDATE admin_platform_presentation_revisions
SET public_display_name = platform,
    support_label = CASE public_availability
      WHEN 'listed' THEN 'Supported'
      WHEN 'preview' THEN 'Preview'
      WHEN 'paused' THEN 'Temporarily paused'
      ELSE 'Hidden'
    END
WHERE public_display_name IS NULL OR support_label IS NULL;

ALTER TABLE admin_platform_presentation_revisions
  ALTER COLUMN public_display_name SET NOT NULL,
  ALTER COLUMN support_label SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_platform_public_display_name_length') THEN
    ALTER TABLE admin_platform_presentation_revisions ADD CONSTRAINT admin_platform_public_display_name_length
      CHECK (char_length(public_display_name) BETWEEN 1 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_platform_support_label_length') THEN
    ALTER TABLE admin_platform_presentation_revisions ADD CONSTRAINT admin_platform_support_label_length
      CHECK (char_length(support_label) BETWEEN 1 AND 80);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_platform_revision_kind') THEN
    ALTER TABLE admin_platform_presentation_revisions ADD CONSTRAINT admin_platform_revision_kind
      CHECK (revision_kind IN ('draft', 'published', 'rollback'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_platform_previous_revision') THEN
    ALTER TABLE admin_platform_presentation_revisions ADD CONSTRAINT admin_platform_previous_revision
      CHECK (previous_revision IS NULL OR previous_revision < revision);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS admin_platform_presentation_revision_lookup_idx
  ON admin_platform_presentation_revisions (platform, region, revision DESC);
