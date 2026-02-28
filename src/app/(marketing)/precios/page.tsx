"use client";

import { CheckoutButton } from "@/components/CheckoutButton";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { CheckCircle2, Zap, Clock } from "lucide-react";

const features = [
    "Empresas ilimitadas",
    "Todos los reportes fiscales DGII",
    "Clasificación con IA",
    "Exportación de reportes",
    "Soporte prioritario",
    "Actualizaciones continuas",
];

export default function PreciosPage() {
    const { data: session } = useSession();
    const isLoggedIn = !!session?.user;

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Product",
                        name: "CuadraBot Pro",
                        description:
                            "Contabilidad inteligente para República Dominicana",
                        offers: {
                            "@type": "Offer",
                            name: "CuadraBot Pro",
                            price: 30,
                            priceCurrency: "USD",
                            priceValidUntil: "2027-12-31",
                        },
                    }),
                }}
            />

            <section style={{ padding: "100px 24px 60px" }}>
                <div className="section-container" style={{ textAlign: "center", marginBottom: 40 }}>
                    <div style={{
                        background: "rgba(245, 158, 11, 0.1)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        padding: "16px 24px",
                        borderRadius: 12,
                        color: "#FCD34D",
                        maxWidth: 700,
                        margin: "0 auto",
                        textAlign: "left"
                    }}>
                        <h4 style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            ⚠️ Problemas Técnicos con Stripe
                        </h4>
                        <p style={{ fontSize: "0.95rem", lineHeight: 1.5 }}>
                            Debido a problemas técnicos con nuestra pasarela de pagos, temporalmente el acceso a la plataforma se realiza mediante <strong>códigos de acceso</strong>. Solicita tu código escribiéndonos a <strong>info@cuadrabot.com</strong>.
                        </p>
                    </div>
                </div>
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
                        Un solo plan.{" "}
                        <span className="gradient-text">Todo incluido.</span>
                    </h1>
                    <p
                        style={{
                            color: "#94A3B8",
                            fontSize: "1.15rem",
                            maxWidth: 520,
                            margin: "0 auto",
                        }}
                    >
                        Sin complicaciones. Sin niveles. Acceso completo a toda
                        la plataforma por un precio justo.
                    </p>
                </div>
            </section>

            <section style={{ padding: "0 24px 100px" }}>
                <div
                    className="section-container"
                    style={{
                        display: "flex",
                        justifyContent: "center",
                    }}
                >
                    <div
                        className="glass-card"
                        style={{
                            padding: 44,
                            position: "relative",
                            border: "1px solid rgba(16,185,129,0.3)",
                            maxWidth: 460,
                            width: "100%",
                        }}
                    >
                        {/* Trial badge */}
                        <div
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "6px 14px",
                                background: "rgba(16,185,129,0.1)",
                                border: "1px solid rgba(16,185,129,0.2)",
                                borderRadius: 20,
                                marginBottom: 24,
                                fontSize: "0.85rem",
                                color: "var(--accent-green)",
                                fontWeight: 600,
                            }}
                        >
                            <Clock size={14} />
                            48 horas de prueba gratis
                        </div>

                        <h3
                            style={{
                                fontSize: "1.4rem",
                                fontWeight: 700,
                                color: "white",
                                marginBottom: 8,
                            }}
                        >
                            CuadraBot Pro
                        </h3>
                        <p
                            style={{
                                color: "#94A3B8",
                                fontSize: "0.95rem",
                                marginBottom: 28,
                            }}
                        >
                            Acceso completo a la plataforma de contabilidad
                            inteligente
                        </p>

                        <div style={{ marginBottom: 32 }}>
                            <span
                                style={{
                                    fontSize: "3.5rem",
                                    fontWeight: 800,
                                    color: "white",
                                    letterSpacing: "-0.03em",
                                }}
                            >
                                $30
                            </span>
                            <span
                                style={{
                                    color: "#64748B",
                                    fontSize: "1rem",
                                }}
                            >
                                /mes
                            </span>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 14,
                                marginBottom: 36,
                            }}
                        >
                            {features.map((f, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                    }}
                                >
                                    <CheckCircle2
                                        size={18}
                                        color="var(--accent-green)"
                                    />
                                    <span
                                        style={{
                                            color: "#CBD5E1",
                                            fontSize: "0.95rem",
                                        }}
                                    >
                                        {f}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {isLoggedIn ? (
                            <CheckoutButton
                                label="Prueba 48 Horas Gratis"
                                style={{ width: "100%", textAlign: "center" }}
                            />
                        ) : (
                            <Link
                                href="/registrarse"
                                className="btn-gold"
                                style={{ width: "100%", textAlign: "center" }}
                            >
                                <Zap size={16} />
                                Prueba 48 Horas Gratis
                            </Link>
                        )}

                        <p
                            style={{
                                color: "#64748B",
                                fontSize: "0.8rem",
                                textAlign: "center",
                                marginTop: 16,
                            }}
                        >
                            Sin compromiso. Cancela cuando quieras.
                        </p>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section
                style={{
                    padding: "60px 24px 100px",
                    background: "var(--navy-800)",
                }}
            >
                <div
                    className="section-container"
                    style={{ maxWidth: 700 }}
                >
                    <h2
                        style={{
                            fontSize: "1.8rem",
                            fontWeight: 700,
                            color: "white",
                            textAlign: "center",
                            marginBottom: 48,
                        }}
                    >
                        Preguntas Frecuentes
                    </h2>
                    {[
                        {
                            q: "¿Cómo funciona la prueba gratis?",
                            a: "Al registrarte, tienes 48 horas de acceso completo sin costo. Si no cancelas, se activa la suscripción mensual de $30.",
                        },
                        {
                            q: "¿Qué métodos de pago aceptan?",
                            a: "Aceptamos todas las tarjetas de crédito y débito principales (Visa, Mastercard, American Express).",
                        },
                        {
                            q: "¿Puedo cancelar en cualquier momento?",
                            a: "Sí, puedes cancelar tu suscripción cuando quieras. No hay contratos ni penalidades.",
                        },
                        {
                            q: "¿Mis datos están seguros?",
                            a: "Absolutamente. Utilizamos encriptación de nivel bancario y cumplimos con los estándares de seguridad más altos.",
                        },
                    ].map((faq, i) => (
                        <div
                            key={i}
                            className="glass-card"
                            style={{
                                padding: 24,
                                marginBottom: 12,
                            }}
                        >
                            <h4
                                style={{
                                    color: "white",
                                    fontWeight: 600,
                                    marginBottom: 8,
                                }}
                            >
                                {faq.q}
                            </h4>
                            <p
                                style={{
                                    color: "#94A3B8",
                                    fontSize: "0.95rem",
                                }}
                            >
                                {faq.a}
                            </p>
                        </div>
                    ))}
                </div>
            </section>
        </>
    );
}
