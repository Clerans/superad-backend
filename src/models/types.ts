export type ServiceCategory =
  | 'Nameboard'
  | 'Hoarding'
  | 'Lightboard'
  | 'Wall Branding'
  | 'Glass Branding'
  | 'MDF Counter'
  | 'Iron Racks';

export interface ProjectImage {
  id: string;
  project_id: string;
  image_url: string;
  public_id: string;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  category: ServiceCategory;
  created_at: string;
  updated_at: string;
  images: ProjectImage[];
}

export interface ProjectRow {
  id: string;
  title: string;
  description: string;
  category: ServiceCategory;
  created_at: string;
  updated_at: string;
}
