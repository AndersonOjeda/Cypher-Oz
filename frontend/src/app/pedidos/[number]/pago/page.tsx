import { PaymentInstructions } from "@/features/orders/payment-instructions";

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  return <PaymentInstructions key={number} number={number} />;
}
