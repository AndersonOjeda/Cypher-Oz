import { AdminOrderList } from "@/features/orders/admin-order-list";

export default async function AdminPedidoPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return <main className="min-h-screen bg-gray-50 py-8"><AdminOrderList initialOrderNumber={number} /></main>;
}
