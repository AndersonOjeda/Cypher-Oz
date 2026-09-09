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
  catalog_available: boolean;
  images: ProductImage[];
};
export type CategoryAttribute = {
  id: number;
  category: number;
  code: string;
  name: string;
};
export type Variant = {
  id: number;
  product: number;
  name: string;
  sku: string;
  price: string;
  is_active: boolean;
  catalog_available: boolean;
  attributes: {
    attribute: number;
    code: string;
    name: string;
    value: string;
  }[];
  updated_at: string;
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
