import Link from "next/link";
export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="blue-dot" /> CONECTADOS CONTIGO
          </p>
          <h1>
            La tecnología
            <br />
            empieza con
            <br />
            <span>una buena conexión.</span>
          </h1>
          <p className="hero-description">
            Estamos construyendo tu tienda tecnológica en Pasto. Crea tu cuenta
            y encuentra un lugar para conectar con lo que necesitas.
          </p>
          <Link className="button primary hero-cta" href="/registro">
            Crear mi cuenta <span aria-hidden="true">↗</span>
          </Link>
          <p className="hero-secondary">
            ¿Ya eres parte de TTI? <Link href="/login">Inicia sesión</Link>
          </p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-grid" />
          <span className="art-label">TECNOLOGÍA + PERSONAS</span>
          <div className="orb orb-back" />
          <div className="orb orb-front">
            <span>
              tti<span className="orb-dot">·</span>
            </span>
          </div>
          <div className="art-caption">
            <span className="blue-dot" />
            Una conexión más cercana.
          </div>
          <span className="art-coordinate">01 / PASTO, COLOMBIA</span>
        </div>
      </section>
      <section className="values" aria-label="Sobre TTI">
        <article>
          <span className="value-number">01</span>
          <h2>Hecha desde Pasto</h2>
          <p>Una tienda local, con una visión que crece contigo.</p>
        </article>
        <article>
          <span className="value-number">02</span>
          <h2>Tu cuenta, tu espacio</h2>
          <p>Un acceso sencillo para mantenerte conectado con TTI.</p>
        </article>
        <article>
          <span className="value-number">03</span>
          <h2>Atención humana</h2>
          <p>Personas dispuestas a ayudarte con tus preguntas.</p>
        </article>
      </section>
    </>
  );
}
