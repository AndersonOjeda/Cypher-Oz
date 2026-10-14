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
export type PromotionVariant = {
  id?: number;
  variant: number;
  variant_sku?: string;
  variant_name?: string;
  product_name?: string;
  base_price?: string;
  price: string;
};
export type Promotion = {
  id: number;
  name: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  prices: PromotionVariant[];
};

export type PublicProductSummary = {
  id: number;
  name: string;
  slug: string;
  category: { id: number; name: string; slug: string };
  brand: { id: number; name: string; slug: string };
  image_url: string | null;
  min_price: string;
  max_price: string;
  promotional_min_price: string | null;
  has_promotion: boolean;
  total_stock: number;
  is_available: boolean;
  variants_count: number;
};

export type PublicVariantAttribute = {
  code: string;
  name: string;
  value: string;
};

export type PublicVariant = {
  id: number;
  name: string;
  sku: string;
  price: string;
  promotional_price: string | null;
  promotion_name: string | null;
  stock: number;
  attributes: PublicVariantAttribute[];
};

export type PublicProductImage = {
  id: number;
  url: string;
  alt_text: string;
  sort_order: number;
};

export type PublicProductDetail = {
  id: number;
  name: string;
  slug: string;
  description: string;
  warranty: string;
  category: { id: number; name: string; slug: string };
  brand: { id: number; name: string; slug: string };
  images: PublicProductImage[];
  variants: PublicVariant[];
  total_stock: number;
  is_available: boolean;
};
