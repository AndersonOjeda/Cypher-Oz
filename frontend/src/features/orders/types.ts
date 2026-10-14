export type CartLine = { variant_id: number; quantity: number; label: string };
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
export type Payment = {
  status: string;
  report_deadline_at: string;
  review_deadline_at: string | null;
  reported_at: string | null;
  reference: string;
  report_window_active: boolean;
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
};
export const cop = (value: string | null) =>
  value === null
    ? "Por confirmar"
    : new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 2,
      }).format(Number(value));
