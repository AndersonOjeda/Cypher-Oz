export type Taxonomy = {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
};
export type ProductImage = {
  id: number;
  url: string;
  alt_text: string;
  sort_order: number;
  width: number;
  height: number;
  byte_size: number;
};
export type Product = {
  id: number;
  name: string;
  slug: string;
  description: string;
  warranty: string;
  category: number;
  brand: number;
  category_name: string;
  brand_name: string;
  is_active: boolean;
  catalog_visible: boolean;
  images: ProductImage[];
};
export type Page<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
export type Limits = {
  max_image_bytes: number;
  max_image_dimension: number;
  max_images: number;
};
