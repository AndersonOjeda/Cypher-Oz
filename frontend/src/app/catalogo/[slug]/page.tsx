import { ProductDetail } from "@/features/catalog/product-detail";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProductDetail key={slug} slug={slug} />;
}

