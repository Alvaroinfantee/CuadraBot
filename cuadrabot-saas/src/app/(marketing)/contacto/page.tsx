import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";

export const metadata: Metadata = {
    title: "Contacto",
    description: "Contáctanos para más información sobre CuadraBot. Estamos en Santo Domingo, República Dominicana. Soporte por email y teléfono.",
    alternates: { canonical: "/contacto" },
};

export default function ContactoPage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "LocalBusiness",
                        name: "CuadraBot",
                        description: "Contabilidad inteligente para República Dominicana",
                        address: {
                            "@type": "PostalAddress",
                            addressLocality: "Santo Domingo",
                            addressCountry: "DO",
                        },
                        email: "info@cuadrabot.com",
                    }),
                }}
            />

            <section style={{ padding: "100px 24px 60px" }}>
                <div className="section-container" style={{ textAlign: "center" }}>
                    <h1
                        style={{
                            fontSize: "clamp(2rem, 4vw, 3rem)",
                            fontWeight: 800,
                            color: "white",
                            marginBottom: 16,
                            letterSpacing: "-0.02em",
                        }}
                    >
                        <span className="gradient-text">Contáctanos</span>
                    </h1>
                    <p
                        style={{
                            color: "#94A3B8",
                            fontSize: "1.15rem",
                            maxWidth: 480,
                            margin: "0 auto",
                        }}
                    >
                        ¿Tienes preguntas? Nuestro equipo está listo para ayudarte
                    </p>
                </div>
            </section>

            <section style={{ padding: "0 24px 100px" }}>
                <div
                    className="section-container"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                        gap: 32,
                        maxWidth: 900,
                    }}
                >
                    {/* Contact Info */}
                    <div>
                        <h2
                            style={{
                                fontSize: "1.3rem",
                                fontWeight: 600,
                                color: "white",
                                marginBottom: 24,
                            }}
                        >
                            Información de Contacto
                        </h2>

                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                            <div
                                className="glass-card"
                                style={{ padding: 24, display: "flex", alignItems: "center", gap: 16 }}
                            >
                                <div
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 12,
                                        background: "rgba(16,185,129,0.1)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    <Mail size={20} color="var(--accent-green)" />
                                </div>
                                <div>
                                    <p style={{ color: "#64748B", fontSize: "0.85rem", marginBottom: 2 }}>Email</p>
                                    <p style={{ color: "white", fontWeight: 500 }}>info@cuadrabot.com</p>
                                </div>
                            </div>

                            <div
                                className="glass-card"
                                style={{ padding: 24, display: "flex", alignItems: "center", gap: 16 }}
                            >
                                <div
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 12,
                                        background: "rgba(245,158,11,0.1)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    <MapPin size={20} color="var(--accent-gold)" />
                                </div>
                                <div>
                                    <p style={{ color: "#64748B", fontSize: "0.85rem", marginBottom: 2 }}>Ubicación</p>
                                    <p style={{ color: "white", fontWeight: 500 }}>Santo Domingo, República Dominicana</p>
                                </div>
                            </div>

                            <div
                                className="glass-card"
                                style={{ padding: 24, display: "flex", alignItems: "center", gap: 16 }}
                            >
                                <div
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 12,
                                        background: "rgba(59,130,246,0.1)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    <Phone size={20} color="#3B82F6" />
                                </div>
                                <div>
                                    <p style={{ color: "#64748B", fontSize: "0.85rem", marginBottom: 2 }}>Teléfono</p>
                                    <p style={{ color: "white", fontWeight: 500 }}>+1 (809) 000-0000</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div className="glass-card" style={{ padding: 36 }}>
                        <h2
                            style={{
                                fontSize: "1.3rem",
                                fontWeight: 600,
                                color: "white",
                                marginBottom: 24,
                            }}
                        >
                            Envíanos un Mensaje
                        </h2>
                        <form
                            style={{ display: "flex", flexDirection: "column", gap: 16 }}
                            action="https://formspree.io/f/placeholder"
                            method="POST"
                        >
                            <div>
                                <label
                                    style={{ display: "block", color: "#94A3B8", fontSize: "0.9rem", marginBottom: 6 }}
                                >
                                    Nombre
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    className="input-field"
                                    placeholder="Tu nombre completo"
                                />
                            </div>
                            <div>
                                <label
                                    style={{ display: "block", color: "#94A3B8", fontSize: "0.9rem", marginBottom: 6 }}
                                >
                                    Email
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    className="input-field"
                                    placeholder="tu@email.com"
                                />
                            </div>
                            <div>
                                <label
                                    style={{ display: "block", color: "#94A3B8", fontSize: "0.9rem", marginBottom: 6 }}
                                >
                                    Mensaje
                                </label>
                                <textarea
                                    name="message"
                                    required
                                    rows={5}
                                    className="input-field"
                                    placeholder="¿En qué podemos ayudarte?"
                                    style={{ resize: "vertical" }}
                                />
                            </div>
                            <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>
                                Enviar Mensaje
                            </button>
                        </form>
                    </div>
                </div>
            </section>
        </>
    );
}
