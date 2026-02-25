import Link from "next/link";
import Image from "next/image";

export default function Footer() {
    return (
        <footer
            style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                background: "var(--navy-800)",
                padding: "64px 24px 32px",
            }}
        >
            <div
                style={{
                    maxWidth: 1200,
                    margin: "0 auto",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 48,
                }}
            >
                {/* Brand */}
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                        <Image src="/logo.jpeg" alt="CuadraBot" width={32} height={32} style={{ borderRadius: 8 }} />
                        <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "white" }}>
                            Cuadra<span style={{ color: "var(--accent-green)" }}>Bot</span>
                        </span>
                    </div>
                    <p style={{ color: "#64748B", fontSize: "0.9rem", lineHeight: 1.7 }}>
                        Contabilidad inteligente para República Dominicana. Automatiza tus reportes fiscales con IA.
                    </p>
                </div>

                {/* Product */}
                <div>
                    <h4 style={{ color: "white", fontWeight: 600, marginBottom: 16, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Producto
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <Link href="/caracteristicas" style={{ color: "#64748B", textDecoration: "none", fontSize: "0.9rem", transition: "color 0.2s" }}>
                            Características
                        </Link>
                        <Link href="/precios" style={{ color: "#64748B", textDecoration: "none", fontSize: "0.9rem" }}>
                            Precios
                        </Link>
                        <Link href="/contacto" style={{ color: "#64748B", textDecoration: "none", fontSize: "0.9rem" }}>
                            Contacto
                        </Link>
                    </div>
                </div>

                {/* Legal */}
                <div>
                    <h4 style={{ color: "white", fontWeight: 600, marginBottom: 16, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Legal
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <Link href="/terminos" style={{ color: "#64748B", textDecoration: "none", fontSize: "0.9rem" }}>
                            Términos de Servicio
                        </Link>
                        <Link href="/privacidad" style={{ color: "#64748B", textDecoration: "none", fontSize: "0.9rem" }}>
                            Política de Privacidad
                        </Link>
                    </div>
                </div>

                {/* Contact */}
                <div>
                    <h4 style={{ color: "white", fontWeight: 600, marginBottom: 16, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Contacto
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <span style={{ color: "#64748B", fontSize: "0.9rem" }}>
                            info@cuadrabot.com
                        </span>
                        <span style={{ color: "#64748B", fontSize: "0.9rem" }}>
                            Santo Domingo, RD
                        </span>
                    </div>
                </div>
            </div>

            <div
                style={{
                    maxWidth: 1200,
                    margin: "48px auto 0",
                    paddingTop: 24,
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 16,
                }}
            >
                <p style={{ color: "#475569", fontSize: "0.85rem" }}>
                    © {new Date().getFullYear()} CuadraBot. Todos los derechos reservados.
                </p>
            </div>
        </footer>
    );
}
