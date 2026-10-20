export type CartLine = {
  variant_id: number;
  quantity: number;
  label: string;
  unit_price?: string;
};
export type CheckoutBody = {
  items: { variant_id: number; quantity: number }[];
  address_id: number | null;
  delivery_mode: string;
};
export type QuoteLine = {
  variant_id: number;
  product_name: string;
  variant_name: string;
  sku: string;
  quantity: number;
  unit_price: string;
  discount: string;
  total: string;
};
export type Quote = {
  items: QuoteLine[];
  address: Record<string, string>;
  delivery_mode: string;
  subtotal: string;
  discount: string;
  shipping: string | null;
  total: string | null;
  can_confirm: boolean;
  quote_token: string;
  message: string;
};
export type StatusHistoryItem = {
  id: number;
  status: string;
  actor_email: string;
  reason?: string;
  created_at: string;
};
export type Payment = {
  id?: number;
  status: string;
  report_deadline_at: string;
  review_deadline_at: string | null;
  reported_at: string | null;
  reference: string;
  report_window_active: boolean;
  correction_deadline_at?: string | null;
  review_overdue?: boolean;
  history?: StatusHistoryItem[];
};
export type Order = {
  number: string;
  status: string;
  subtotal: string;
  discount: string;
  shipping: string;
  total: string;
  created_at: string;
  items: QuoteLine[];
  delivery: { mode: string; address: Record<string, string>; cost: string };
  payment: Payment;
  history?: StatusHistoryItem[];
};
export type AdminPayment = {
  id: number;
  order_number: string;
  customer_name: string;
  customer_email: string;
  order_total: string;
  order_status: string;
  status: string;
  reference: string;
  reported_at: string | null;
  report_deadline_at: string;
  review_deadline_at: string | null;
  report_window_active: boolean;
  correction_deadline_at?: string | null;
  review_overdue?: boolean;
  history: StatusHistoryItem[];
};
export type AdminOrder = {
  number: string;
  customer_name: string;
  customer_email: string;
  status: string;
  subtotal: string;
  discount: string;
  shipping: string;
  total: string;
  currency: string;
  created_at: string;
  items: QuoteLine[];
  delivery: { mode: string; address: Record<string, string>; cost: string };
  payment: Payment;
  history: StatusHistoryItem[];
};
export const cop = (value: string | null) =>
  value === null
    ? "Por confirmar"
    : new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 2,
      }).format(Number(value));
