"use client";

import { useEffect, useRef, useState } from "react";
import {
  Pencil,
  Trash2,
  LogOut,
  User as UserIcon,
  MapPin,
  Package,
  ArrowLeft,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Address, api, ApiError, User } from "@/services/api";
import { AdminAccountMenu } from "@/components/admin-navigation";

type AddressForm = Omit<Address, "id">;

const emptyAddress: AddressForm = {
  label: "",
  recipient_name: "",
  phone: "",
  address_line: "",
  city: "Pasto",
  state: "Nariño",
  notes: "",
  is_default: false,
};

export function Account() {
  const router = useRouter();
  const [user, setUser] = useState<User>();
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [addressForm, setAddressForm] = useState<AddressForm>(emptyAddress);
  const [editingAddressId, setEditingAddressId] = useState<number>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const addressEditor = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let active = true;
    api<User>("/users/me/")
      .then((data) => {
        if (!active) return;
        setUser(data);
        setProfile({ name: data.name, email: data.email });
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401)
          router.replace("/login");
        else setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [router]);

  function showError(err: unknown, prefix = "") {
    if (err instanceof ApiError && err.status === 401) {
      router.replace("/login");
      return;
    }
    setError(err instanceof Error ? err.message : "Inténtalo de nuevo.");
    if (err instanceof ApiError) {
      const fields: Record<string, string> = {};
      for (const [key, value] of Object.entries(err.details ?? {})) {
        if (Array.isArray(value)) fields[`${prefix}${key}`] = value.join(" ");
      }
      if (err.code === "EMAIL_ALREADY_EXISTS")
        fields["profile-email"] = err.message;
      setFieldErrors(fields);
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setFieldErrors({});
    try {
      const updated = await api<User>("/users/me/", {
        method: "PATCH",
        body: JSON.stringify(profile),
      });
      setUser(updated);
      setProfile({ name: updated.name, email: updated.email });
      setMessage("Perfil actualizado.");
    } catch (err) {
      showError(err, "profile-");
    } finally {
      setBusy(false);
    }
  }

  function editAddress(address: Address) {
    setError("");
    setMessage("");
    setFieldErrors({});
    setEditingAddressId(address.id);
    setAddressForm({
      label: address.label,
      recipient_name: address.recipient_name,
      phone: address.phone,
      address_line: address.address_line,
      city: address.city,
      state: address.state,
      notes: address.notes,
      is_default: address.is_default,
    });
    addressEditor.current?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
    addressEditor.current
      ?.querySelector("input")
      ?.focus({ preventScroll: true });
  }

  function resetAddressForm() {
    setEditingAddressId(undefined);
    setAddressForm(emptyAddress);
    setFieldErrors({});
  }

  async function saveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setFieldErrors({});
    const path = editingAddressId
      ? `/users/me/addresses/${editingAddressId}/`
      : "/users/me/addresses/";
    try {
      const address = await api<Address>(path, {
        method: editingAddressId ? "PATCH" : "POST",
        body: JSON.stringify(addressForm),
      });
      setUser((current) => {
        if (!current) return current;
        const addresses = (current.addresses ?? []).map((item) =>
          address.is_default ? { ...item, is_default: false } : item,
        );
        return {
          ...current,
          addresses: editingAddressId
            ? addresses.map((item) => (item.id === address.id ? address : item))
            : [address, ...addresses],
        };
      });
      setMessage(
        editingAddressId ? "Dirección actualizada." : "Dirección creada.",
      );
      resetAddressForm();
    } catch (err) {
      showError(err, "address-");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAddress(id: number) {
    if (!window.confirm("¿Eliminar esta dirección?")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/users/me/addresses/${id}/`, { method: "DELETE" });
      setUser((current) =>
        current
          ? {
              ...current,
              addresses: (current.addresses ?? []).filter(
                (item) => item.id !== id,
              ),
            }
          : current,
      );
      if (editingAddressId === id) resetAddressForm();
      setMessage("Dirección eliminada.");
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    setBusy(true);
    setError("");
    try {
      await api("/auth/logout/", { method: "POST" });
      setUser(undefined);
      router.replace("/login");
      router.refresh();
    } catch (err) {
      showError(err);
      setBusy(false);
      setLoggingOut(false);
    }
  }

  return (
    <section className="account-card" aria-busy={busy}>
      {user ? (
        <>
          <div className="account-hero">
            <div className="account-hero-identity">
              <div className="account-avatar" aria-hidden="true">
                {(user.name || "U").trim().slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="eyebrow">
                  <span className="blue-dot" /> MI CUENTA
                </p>
                <h1>Hola, {user.name}</h1>
                <p className="account-status-pill">
                  <span className="status-dot" aria-hidden="true" />
                  Tu sesión está activa.
                </p>
              </div>
            </div>

            <dl className="account-meta">
              <div className="account-meta-box">
                <dt>Correo electrónico</dt>
                <dd>{user.email}</dd>
              </div>
              <div className="account-meta-box">
                <dt>Tipo de cuenta</dt>
                <dd
                  className={
                    user.role === "ADMIN"
                      ? "account-role-badge is-admin"
                      : "account-role-badge is-client"
                  }
                >
                  {user.role === "ADMIN" ? "Administrador" : "Cliente"}
                </dd>
              </div>
            </dl>
          </div>

          {message && (
            <p role="status" className="success-message">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}

          {user.role === "ADMIN" && <AdminAccountMenu />}

          <div
            className={`account-columns${user.role === "ADMIN" ? " is-admin" : ""}`}
          >
            <form className="account-panel" onSubmit={saveProfile}>
              <div className="account-panel-header">
                <span className="account-panel-icon" aria-hidden="true">
                  <UserIcon size={20} />
                </span>
                <div>
                  <h2>Datos personales</h2>
                  <p className="account-panel-subtitle">
                    {user.role === "ADMIN"
                      ? "Información de contacto de tu cuenta administrativa."
                      : "Mantén tu nombre y correo actualizados para tus pedidos."}
                  </p>
                </div>
              </div>
              <fieldset disabled={busy}>
                <div className="field">
                  <label htmlFor="profile-name">Nombre completo</label>
                  <input
                    id="profile-name"
                    maxLength={150}
                    autoComplete="name"
                    aria-invalid={!!fieldErrors["profile-name"]}
                    aria-describedby={
                      fieldErrors["profile-name"]
                        ? "profile-name-error"
                        : undefined
                    }
                    value={profile.name}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                  />
                  {fieldErrors["profile-name"] && (
                    <span id="profile-name-error" className="field-error">
                      {fieldErrors["profile-name"]}
                    </span>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="profile-email">Correo electrónico</label>
                  <input
                    id="profile-email"
                    maxLength={254}
                    autoComplete="email"
                    aria-invalid={!!fieldErrors["profile-email"]}
                    aria-describedby={
                      fieldErrors["profile-email"]
                        ? "profile-email-error"
                        : undefined
                    }
                    type="email"
                    value={profile.email}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                  />
                  {fieldErrors["profile-email"] && (
                    <span id="profile-email-error" className="field-error">
                      {fieldErrors["profile-email"]}
                    </span>
                  )}
                </div>
                <button className="button primary" disabled={busy}>
                  Guardar perfil
                </button>
              </fieldset>
            </form>

            {user.role === "ADMIN" ? (
              <section
                className="account-panel account-admin-privileges"
                aria-labelledby="admin-privileges-title"
              >
                <div className="account-panel-header">
                  <span
                    className="account-panel-icon is-admin-shield"
                    aria-hidden="true"
                  >
                    <ShieldCheck size={20} />
                  </span>
                  <div>
                    <h2 id="admin-privileges-title">Perfil de Administrador</h2>
                    <p className="account-panel-subtitle">
                      Control operativo y seguridad de la tienda Cypher Oz.
                    </p>
                  </div>
                </div>

                <div className="admin-privileges-content">
                  <div className="admin-privilege-item">
                    <strong>Rol en la plataforma</strong>
                    <p>
                      Administrador general con acceso de lectura y escritura
                      en todos los módulos operativos.
                    </p>
                  </div>
                  <div className="admin-privilege-item">
                    <strong>Direcciones de entrega</strong>
                    <p>
                      Las cuentas administrativas gestionan la logística y
                      cobertura de entregas en Pasto y Nariño desde la sección
                      de configuración, sin necesidad de asociar direcciones de
                      compra personal.
                    </p>
                  </div>
                  <div className="admin-privilege-item">
                    <strong>Gestión del sistema</strong>
                    <p>
                      Control total sobre catálogo de productos, inventario en
                      bodega, validación y confirmación de pagos de clientes y
                      reportes de ventas.
                    </p>
                  </div>
                  <Link
                    className="button subtle admin-config-shortcut"
                    href="/admin/configuracion"
                  >
                    <SlidersHorizontal size={17} aria-hidden="true" />
                    Configuración de tienda y envíos
                  </Link>
                </div>
              </section>
            ) : (
              <section
                className="address-section account-panel"
                aria-labelledby="addresses-title"
              >
                <div className="account-panel-header">
                  <span className="account-panel-icon" aria-hidden="true">
                    <MapPin size={20} />
                  </span>
                  <div>
                    <h2 id="addresses-title">Direcciones</h2>
                    <p className="account-panel-subtitle">
                      Gestiona tus puntos de entrega en Pasto y Nariño.
                    </p>
                  </div>
                </div>
                {(user.addresses ?? []).length > 0 ? (
                  <div className="address-list">
                    {(user.addresses ?? []).map((address) => (
                      <article
                        className={`address-item${address.is_default ? " is-default" : ""}`}
                        key={address.id}
                      >
                        <div className="address-item-info">
                          <strong>
                            {address.label}
                            {address.is_default ? " - principal" : ""}
                          </strong>
                          <p>
                            {address.recipient_name} - {address.phone}
                          </p>
                          <p>
                            {address.address_line}, {address.city},{" "}
                            {address.state}
                          </p>
                          {address.notes && <p>{address.notes}</p>}
                        </div>
                        <div className="address-actions">
                          <button
                            className="button subtle"
                            type="button"
                            onClick={() => editAddress(address)}
                            title={`Editar ${address.label}`}
                            aria-label={`Editar ${address.label}`}
                            disabled={busy}
                          >
                            <Pencil size={18} aria-hidden="true" />
                          </button>
                          <button
                            className="button danger"
                            type="button"
                            onClick={() => deleteAddress(address.id)}
                            title={`Eliminar ${address.label}`}
                            aria-label={`Eliminar ${address.label}`}
                            disabled={busy}
                          >
                            <Trash2 size={18} aria-hidden="true" />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="address-empty-state">
                    No tienes direcciones guardadas.
                  </p>
                )}

                <form
                  ref={addressEditor}
                  className="address-editor-form"
                  onSubmit={saveAddress}
                >
                  <h3>
                    {editingAddressId ? "Editar dirección" : "Nueva dirección"}
                  </h3>
                  <fieldset disabled={busy}>
                    <div className="field-grid">
                      <div className="field">
                        <label htmlFor="address-label">Etiqueta</label>
                        <input
                          id="address-label"
                          maxLength={60}
                          placeholder="Ej. Casa, Oficina"
                          aria-invalid={!!fieldErrors["address-label"]}
                          aria-describedby={
                            fieldErrors["address-label"]
                              ? "address-label-error"
                              : undefined
                          }
                          value={addressForm.label}
                          onChange={(event) =>
                            setAddressForm((current) => ({
                              ...current,
                              label: event.target.value,
                            }))
                          }
                          required
                        />
                        {fieldErrors["address-label"] && (
                          <span id="address-label-error" className="field-error">
                            {fieldErrors["address-label"]}
                          </span>
                        )}
                      </div>
                      <div className="field">
                        <label htmlFor="address-recipient">Recibe</label>
                        <input
                          id="address-recipient"
                          maxLength={150}
                          autoComplete="shipping name"
                          aria-invalid={!!fieldErrors["address-recipient_name"]}
                          aria-describedby={
                            fieldErrors["address-recipient_name"]
                              ? "address-recipient-error"
                              : undefined
                          }
                          value={addressForm.recipient_name}
                          onChange={(event) =>
                            setAddressForm((current) => ({
                              ...current,
                              recipient_name: event.target.value,
                            }))
                          }
                          required
                        />
                        {fieldErrors["address-recipient_name"] && (
                          <span
                            id="address-recipient-error"
                            className="field-error"
                          >
                            {fieldErrors["address-recipient_name"]}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="field-grid">
                      <div className="field">
                        <label htmlFor="address-phone">Teléfono</label>
                        <input
                          id="address-phone"
                          type="tel"
                          maxLength={30}
                          autoComplete="shipping tel"
                          aria-invalid={!!fieldErrors["address-phone"]}
                          aria-describedby={
                            fieldErrors["address-phone"]
                              ? "address-phone-error"
                              : undefined
                          }
                          value={addressForm.phone}
                          onChange={(event) =>
                            setAddressForm((current) => ({
                              ...current,
                              phone: event.target.value,
                            }))
                          }
                          required
                        />
                        {fieldErrors["address-phone"] && (
                          <span id="address-phone-error" className="field-error">
                            {fieldErrors["address-phone"]}
                          </span>
                        )}
                      </div>
                      <div className="field">
                        <label htmlFor="address-line">Dirección</label>
                        <input
                          id="address-line"
                          maxLength={240}
                          autoComplete="shipping street-address"
                          aria-invalid={!!fieldErrors["address-address_line"]}
                          aria-describedby={
                            fieldErrors["address-address_line"]
                              ? "address-line-error"
                              : undefined
                          }
                          value={addressForm.address_line}
                          onChange={(event) =>
                            setAddressForm((current) => ({
                              ...current,
                              address_line: event.target.value,
                            }))
                          }
                          required
                        />
                        {fieldErrors["address-address_line"] && (
                          <span id="address-line-error" className="field-error">
                            {fieldErrors["address-address_line"]}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="field-grid">
                      <div className="field">
                        <label htmlFor="address-city">Ciudad</label>
                        <input
                          id="address-city"
                          maxLength={80}
                          autoComplete="shipping address-level2"
                          aria-invalid={!!fieldErrors["address-city"]}
                          aria-describedby={
                            fieldErrors["address-city"]
                              ? "address-city-error"
                              : undefined
                          }
                          value={addressForm.city}
                          onChange={(event) =>
                            setAddressForm((current) => ({
                              ...current,
                              city: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                      {fieldErrors["address-city"] && (
                        <span id="address-city-error" className="field-error">
                          {fieldErrors["address-city"]}
                        </span>
                      )}
                      <div className="field">
                        <label htmlFor="address-state">Departamento</label>
                        <input
                          id="address-state"
                          maxLength={80}
                          autoComplete="shipping address-level1"
                          aria-invalid={!!fieldErrors["address-state"]}
                          aria-describedby={
                            fieldErrors["address-state"]
                              ? "address-state-error"
                              : undefined
                          }
                          value={addressForm.state}
                          onChange={(event) =>
                            setAddressForm((current) => ({
                              ...current,
                              state: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    </div>
                    {fieldErrors["address-state"] && (
                      <span id="address-state-error" className="field-error">
                        {fieldErrors["address-state"]}
                      </span>
                    )}
                    <div className="field">
                      <label htmlFor="address-notes">Notas</label>
                      <input
                        id="address-notes"
                        maxLength={300}
                        placeholder="Barrio, edificio, punto de referencia (opcional)"
                        aria-invalid={!!fieldErrors["address-notes"]}
                        aria-describedby={
                          fieldErrors["address-notes"]
                            ? "address-notes-error"
                            : undefined
                        }
                        value={addressForm.notes}
                        onChange={(event) =>
                          setAddressForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                      />
                    </div>
                    {fieldErrors["address-notes"] && (
                      <span id="address-notes-error" className="field-error">
                        {fieldErrors["address-notes"]}
                      </span>
                    )}
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={addressForm.is_default}
                        onChange={(event) =>
                          setAddressForm((current) => ({
                            ...current,
                            is_default: event.target.checked,
                          }))
                        }
                      />
                      Usar como dirección principal
                    </label>
                    <div className="form-actions">
                      <button className="button primary" disabled={busy}>
                        {editingAddressId
                          ? "Guardar dirección"
                          : "Agregar dirección"}
                      </button>
                      {editingAddressId && (
                        <button
                          className="button subtle"
                          type="button"
                          onClick={resetAddressForm}
                          disabled={busy}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </fieldset>
                </form>
              </section>
            )}
          </div>

          <div className="account-footer-bar">
            <div className="account-footer-links">
              {user.role === "ADMIN" ? (
                <Link className="button subtle" href="/admin/catalogo">
                  <SlidersHorizontal size={18} aria-hidden="true" />
                  Panel de administración
                </Link>
              ) : (
                <Link className="button subtle" href="/pedidos">
                  <Package size={18} aria-hidden="true" />
                  Mis pedidos
                </Link>
              )}
              <Link className="back-link" href="/">
                <ArrowLeft size={15} aria-hidden="true" />
                Volver al inicio
              </Link>
            </div>
            <button
              className="button danger-outline"
              onClick={logout}
              disabled={busy}
            >
              <LogOut size={18} aria-hidden="true" />
              {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
            </button>
          </div>
        </>
      ) : (
        <div className="account-loading-box">
          <p className="eyebrow">MI CUENTA</p>
          {!error && <p role="status">Cargando tu cuenta...</p>}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <Link className="back-link" href="/">
            Volver al inicio
          </Link>
        </div>
      )}
    </section>
  );
}
