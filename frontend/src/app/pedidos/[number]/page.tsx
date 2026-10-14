import { OrderDetail } from "@/features/orders/orders";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  return <OrderDetail number={number} />;
}
