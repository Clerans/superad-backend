-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Categories enum (matches service categories exactly)
CREATE TYPE service_category AS ENUM (
  'Nameboard',
  'Hoarding',
  'Lightboard',
  'Wall Branding',
  'Glass Branding',
  'MDF Counter',
  'Iron Racks'
);

-- Projects table
CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  category    service_category NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project images table
CREATE TABLE project_images (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  image_url    TEXT NOT NULL,
  public_id    TEXT NOT NULL,  -- Cloudinary public_id for deletion
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_images_project_id ON project_images(project_id);
CREATE INDEX idx_projects_category ON projects(category);

-- Admin users table
CREATE TABLE admin_users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username     VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
