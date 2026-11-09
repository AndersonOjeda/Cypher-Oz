"use client";

import { useEffect, useId, useState } from "react";
import { api, ApiError } from "@/services/api";
import type { CustomerReview } from "@/features/orders/types";

type Page<T> = { count: number; next: string | null; previous: string | null; results: T[]; summary?: ReviewSummary };
type ReviewSummary = { average_rating: number | null; average_rating_display: string | null; review_count: number; empty_message?: string | null; distribution?: Record<string, number> };
type Report = { id: number; review_id: number; reporter_name: string; reason: string; status: string; created_at: string };
type ModerationReview = CustomerReview & { product_name: string; visibility: "VISIBLE" | "HIDDEN"; open_reports_count: number; reports: Report[]; moderation_logs: { id: number; action: string; reason: string; created_at: string }[] };

export function ProductReviews({ slug, summary }: { slug: string; summary?: ReviewSummary }) {
  const [page, setPage] = useState<Page<CustomerReview> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let current = true;
    Promise.resolve()
      .then(() => {
        if (current) { setLoading(true); setError(""); setPage(null); }
        return api<Page<CustomerReview>>(`/products/${encodeURIComponent(slug)}/reviews/?page=${pageNumber}`);
      })
      .then((result) => { if (current) { if (!result || !Array.isArray(result.results)) { setError("No pudimos cargar las opiniones."); return; } setPage(result); setError(""); } })
      .catch((cause: unknown) => { if (current) setError(cause instanceof Error ? cause.message : "No pudimos cargar las opiniones."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [slug, pageNumber, refreshKey]);
  const rating = page?.summary ?? summary;
  return <section className="review-section" aria-labelledby="product-reviews-title">
    <h2 id="product-reviews-title">Opiniones de compradores</h2>
    {rating?.review_count ? <p className="review-average"><strong>{rating.average_rating_display}</strong> de 5 · {rating.review_count} {rating.review_count === 1 ? "reseña" : "reseñas"}</p> : <p>{rating?.empty_message ?? "Este producto aún no tiene reseñas"}</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => setRefreshKey((key) => key + 1)}>Reintentar</button></p>}
    {loading && <p role="status">Cargando opiniones…</p>}
    {page && page.results.length > 0 && <ul className="review-list">{page.results.map((review) => <li key={review.id} className="review-card">
      <div className="review-card-heading"><strong>{review.author_name}</strong><span aria-label={`${review.rating} de 5 estrellas`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></div>
      <p>{review.comment}</p><p className="review-meta">{review.verified_label} · {new Date(review.created_at).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}{review.is_edited ? " · Editada" : ""}</p><ReportReviewButton reviewId={review.id} />
    </li>)}</ul>}
    {page && (page.previous || page.next) && <nav className="review-pager" aria-label="Páginas de opiniones">
      <button type="button" disabled={!page.previous} onClick={() => setPageNumber((n) => Math.max(1, n - 1))}>Anterior</button><span>Página {pageNumber}</span><button type="button" disabled={!page.next} onClick={() => setPageNumber((n) => n + 1)}>Siguiente</button>
    </nav>}
  </section>;
}

export function OrderReviewForm({ orderItemId, existing, onSaved }: { orderItemId: number; existing: CustomerReview | null; onSaved: (review: CustomerReview) => void }) {
  const fieldId = useId();
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setSaved(false);
    try {
      const review = existing
        ? await api<CustomerReview>(`/reviews/${existing.id}/`, { method: "PATCH", body: JSON.stringify({ rating, comment }) })
        : await api<CustomerReview>("/reviews/", { method: "POST", body: JSON.stringify({ order_item_id: orderItemId, rating, comment }) });
      onSaved(review);
      setSaved(true);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409 && typeof cause.details.review_id === "number") setError("Ya tienes una reseña para este producto. Recarga el pedido para editarla.");
      else setError(cause instanceof Error ? cause.message : "No pudimos guardar la reseña.");
    } finally { setBusy(false); }
  }
  return <form className="review-form" onSubmit={submit}>
    <label>Calificación <select value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map((n) => <option value={n} key={n}>{n} {n === 1 ? "estrella" : "estrellas"}</option>)}</select></label>
    <label>Tu opinión <textarea required minLength={1} maxLength={1000} rows={3} value={comment} aria-invalid={Boolean(error)} aria-describedby={`${fieldId}-count${error ? ` ${fieldId}-error` : ""}`} onChange={(event) => { setComment(event.target.value); setSaved(false); }} /></label>
    <p id={`${fieldId}-count`}>{comment.length}/1000 caracteres</p>
    {saved && <p role="status">Reseña guardada.</p>}
    {error && <p id={`${fieldId}-error`} role="alert">{error}</p>}<button type="submit" disabled={busy}>{busy ? "Guardando…" : existing ? "Guardar cambios" : "Publicar reseña"}</button>
  </form>;
}

export function ReportReviewButton({ reviewId }: { reviewId: number }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { await api(`/reviews/${reviewId}/report/`, { method: "POST", body: JSON.stringify({ reason }) }); setMessage("Reporte recibido. La opinión sigue visible mientras la revisamos."); setOpen(false); } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos enviar el reporte."); } finally { setBusy(false); } }
  return <div className="review-report">{message ? <p role="status">{message}</p> : !open ? <button type="button" onClick={() => setOpen(true)}>Reportar opinión</button> : <form onSubmit={submit}><label>Motivo <textarea required minLength={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} /></label>{error && <p role="alert">{error}</p>}<button disabled={busy}>Enviar reporte</button><button type="button" onClick={() => setOpen(false)}>Cancelar</button></form>}</div>;
}

export function ReviewModeration() {
  const [reviews, setReviews] = useState<ModerationReview[]>([]); const [reports, setReports] = useState<Report[]>([]); const [error, setError] = useState(""); const [reason, setReason] = useState<Record<number, string>>({}); const [busyId, setBusyId] = useState<number | null>(null); const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => { let current = true; Promise.all([api<Page<ModerationReview>>("/admin/reviews/?page_size=100"), api<Page<Report>>("/admin/review-reports/?status=OPEN&page_size=100")]).then(([reviewPage, reportPage]) => { if (current) { setReviews(reviewPage.results); setReports(reportPage.results); setError(""); } }).catch((cause: unknown) => { if (current) setError(cause instanceof Error ? cause.message : "No pudimos cargar la moderación."); }); return () => { current = false; }; }, [refreshKey]);
  async function moderate(reviewId: number, action: "HIDE" | "RESTORE" | "DISMISS_REPORTS") { const why = reason[reviewId]?.trim(); if (!why) { setError("Escribe un motivo para registrar la acción de moderación."); return; } setBusyId(reviewId); setError(""); try { await api(`/admin/reviews/${reviewId}/moderate/`, { method: "POST", body: JSON.stringify({ action, reason: why }) }); setRefreshKey((key) => key + 1); } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos completar la moderación."); } finally { setBusyId(null); } }
  return <section className="review-moderation"><div className="review-heading"><div><h1>Moderación de reseñas</h1><p>Una valoración negativa, incluso de 1 estrella, no es motivo para retirar una opinión.</p></div><button type="button" onClick={() => setRefreshKey((key) => key + 1)}>Actualizar</button></div>
    {error && <p role="alert">{error}</p>}{reviews.length === 0 && !error && <p>No hay reseñas para revisar.</p>}
    <h2>Reportes abiertos ({reports.length})</h2>{reports.length > 0 && <ul>{reports.map((report) => <li key={report.id}>Reseña #{report.review_id}: {report.reporter_name} — {report.reason}</li>)}</ul>}
    {reviews.map((review) => <article className="review-moderation-card" key={review.id}><header><div><strong>{review.product_name}</strong><p>{review.author_name} · {review.verified_label}</p></div><span>{review.visibility} · {review.open_reports_count} reportes abiertos</span></header><p>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)} — {review.comment}</p>{review.reports.length > 0 && <details><summary>Reportes ({review.reports.length})</summary><ul>{review.reports.map((report) => <li key={report.id}>{report.status}: {report.reporter_name} — {report.reason}</li>)}</ul></details>}{review.moderation_logs.length > 0 && <details><summary>Historial de moderación</summary><ul>{review.moderation_logs.map((log) => <li key={log.id}>{log.action}: {log.reason} ({new Date(log.created_at).toLocaleString("es-CO")})</li>)}</ul></details>}<label>Motivo (obligatorio)<textarea value={reason[review.id] ?? ""} maxLength={300} onChange={(event) => setReason((old) => ({ ...old, [review.id]: event.target.value }))} /></label><div className="review-actions">{review.visibility === "VISIBLE" ? <button disabled={busyId === review.id} onClick={() => void moderate(review.id, "HIDE")}>Ocultar</button> : <button disabled={busyId === review.id} onClick={() => void moderate(review.id, "RESTORE")}>Restaurar</button>}{review.open_reports_count > 0 && <button disabled={busyId === review.id} onClick={() => void moderate(review.id, "DISMISS_REPORTS")}>Descartar reportes</button>}</div></article>)}
  </section>;
}

export function CommercialInfo() {
  const [info, setInfo] = useState<{ payment: { reported_meaning: string; confirmed_meaning: string; manual_verification_notice: string }; delivery: { modes: { mode: string; label: string; summary: string }[] }; warranty: { policy_summary: string; missing_warranty_notice: string }; contact: { configured: boolean; whatsapp_number: string; whatsapp_message: string; unavailable_notice: string | null } } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let current = true; Promise.resolve().then(() => api<typeof info>("/settings/commercial/")).then((result) => { if (!current) return; if (!result?.payment || !result.delivery || !result.contact) { setError("No pudimos cargar la información de compra."); return; } setInfo(result); }).catch((cause: unknown) => { if (current) setError(cause instanceof Error ? cause.message : "No pudimos cargar la información de compra."); }); return () => { current = false; }; }, []);
  if (error) return <section className="commercial-info" aria-label="Información de compra"><p role="alert">{error}</p></section>;
  if (!info) return <section className="commercial-info" aria-label="Información de compra"><p role="status">Cargando información de compra…</p></section>;
  return <section className="commercial-info" aria-labelledby="commercial-info-title"><h2 id="commercial-info-title">Información de compra</h2><p><strong>Pago reportado:</strong> {info.payment.reported_meaning}</p><p><strong>Pago confirmado:</strong> {info.payment.confirmed_meaning}</p><p>{info.payment.manual_verification_notice}</p><ul>{info.delivery.modes.map((mode) => <li key={mode.mode}><strong>{mode.label}:</strong> {mode.summary}</li>)}</ul><p>{info.warranty.policy_summary}</p><p>{info.contact.configured ? <>Atención por WhatsApp: <a href={`https://wa.me/${info.contact.whatsapp_number}?text=${encodeURIComponent(info.contact.whatsapp_message)}`} target="_blank" rel="noreferrer">Escribirnos por WhatsApp</a></> : info.contact.unavailable_notice}</p></section>;
}
