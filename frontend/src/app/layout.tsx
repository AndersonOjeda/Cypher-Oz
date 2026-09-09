import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppButton } from "@/components/whatsapp-button";
import "./globals.css";
export const metadata: Metadata = {
  title: "TTI · Tienda Tecnológica Inteligente",
  description:
    "Tecnología cerca de ti. Tu tienda tecnológica en Pasto, Nariño.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <div className="location-bar">
          Desde Pasto, Nariño <span aria-hidden="true">·</span> Tecnología cerca
          de ti
        </div>
        <header className="site-header">
          <Link className="brand" href="/" aria-label="TTI, inicio">
            <span className="brand-mark">
              tti<span>·</span>
            </span>
            <span className="brand-description">
              TIENDA TECNOLÓGICA
              <br />
              INTELIGENTE
            </span>
          </Link>
          <nav aria-label="Navegación principal">
            <Link href="/cuenta">Mi cuenta</Link>
            <Link className="header-login" href="/login">
              Iniciar sesión <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </header>
        <main id="contenido">{children}</main>
        <footer>
          <Link className="brand-mark" href="/">
            tti<span>·</span>
          </Link>
          <p>
            Tecnología con atención cercana.
            <br />
            <span>Pasto, Nariño · Colombia</span>
          </p>
          <span className="footer-note">Tienda Tecnológica Inteligente</span>
        </footer>
        <WhatsAppButton />
      </body>
    </html>
  );
}
