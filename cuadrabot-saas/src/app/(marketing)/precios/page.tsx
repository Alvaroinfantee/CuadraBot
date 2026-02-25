import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
    title: "Precios",
    description: "Planes accesibles de contabilidad inteligente para República Dominicana. Desde $29/mes. Elige el plan perfecto para tu negocio.",
    alternates: { canonical: "/precios" },
};

const plans = [
    {
        key: "basico",
        name: "Básico",
        description: "Ideal para freelancers y negocios pequeños",
        price: 29,
        features: [
            "1 empresa",
            "Reportes fiscales básicos",
            "Soporte por email",
            "Actualizaciones mensuales",
        ],
    },
    {
        key: "profesional",
        name: "Profesional",
        description: "Para contadores y firmas en crecimiento",
        price: 59,
        popular: true,
        features: [
            "Hasta 5 empresas",
            "Reportes fiscales completos",
            "Soporte prioritario",
            "Actualizaciones semanales",
            "Exportación avanzada",
        ],
    },
    {
        key: "empresarial",
        name: "Empresarial",
        description: "Para grandes firmas y corporaciones",
        price: 99,
        features: [
            "Empresas ilimitadas",
            "Reportes fiscales completos",
            "Soporte 24/7",
            "Actualizaciones en tiempo real",
            "API de integración",
            "Gestor de cuenta dedicado",
        ],
    },
];

export default function PreciosPage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Product",
                        name: "CuadraBot",
                        description: "Contabilidad inteligente para República Dominicana",
                        offers: plans.map((p) => ({
                            "@type": "Offer",
                            name: p.name,
                            price: p.price,
                            priceCurrency: "USD",
                            priceValidUntil: "2027-12-31",
                        })),
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
                        Planes que se adaptan a tu{" "}
                        <span className="gradient-text">negocio</span>
                    </h1>
                    <p
                        style={{
                            color: "#94A3B8",
                            fontSize: "1.15rem",
                            maxWidth: 520,
                            margin: "0 auto",
                        }}
                    >
                        Sin contratos largos. Cancela cuando quieras. Comienza hoy y automatiza tu contabilidad.
                    </p>
                </div>
            </section>

            <section style={{ padding: "0 24px 100px" }}>
                <div
                    className="section-container"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                        gap: 24,
                        alignItems: "start",
                    }}
                >
                    {plans.map((plan) => (
                        <div
                            key={plan.key}
                            className="glass-card"
                            style={{
                                padding: 36,
                                position: "relative",
                                border: plan.popular
                                    ? "1px solid rgba(245,158,11,0.3)"
                                    : "1px solid rgba(255,255,255,0.1)",
                            }}
                        >
                            {plan.popular && <div className="badge-popular">Más Popular</div>}
                            <h3
                                style={{
                                    fontSize: "1.3rem",
                                    fontWeight: 700,
                                    color: "white",
                                    marginBottom: 8,
                                }}
                            >
                                {plan.name}
                            </h3>
                            <p style={{ color: "#94A3B8", fontSize: "0.9rem", marginBottom: 24 }}>
                                {plan.description}
                            </p>
                            <div style={{ marginBottom: 28 }}>
                                <span
                                    style={{
                                        fontSize: "3rem",
                                        fontWeight: 800,
                                        color: "white",
                                        letterSpacing: "-0.03em",
                                    }}
                                >
                                    ${plan.price}
                                </span>
                                <span style={{ color: "#64748B", fontSize: "0.95rem" }}>/mes</span>
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 14,
                                    marginBottom: 32,
                                }}
                            >
                                {plan.features.map((f, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <CheckCircle2 size={18} color="var(--accent-green)" />
                                        <span style={{ color: "#CBD5E1", fontSize: "0.95rem" }}>{f}</span>
                                    </div>
                                ))}
                            </div>
                            <Link
                                href="/registrarse"
                                className={plan.popular ? "btn-gold" : "btn-primary"}
                                style={{ width: "100%", textAlign: "center" }}
                            >
                                Empezar Ahora
                                <ArrowRight size={16} />
                            </Link>
                        </div>
                    ))}
                </div>
            </section>

            {/* FAQ */}
            <section style={{ padding: "60px 24px 100px", background: "var(--navy-800)" }}>
                <div className="section-container" style={{ maxWidth: 700 }}>
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
                            q: "¿Puedo cambiar de plan en cualquier momento?",
                            a: "Sí, puedes actualizar o degradar tu plan cuando quieras. Los cambios se aplican inmediatamente.",
                        },
                        {
                            q: "¿Qué métodos de pago aceptan?",
                            a: "Aceptamos todas las tarjetas de crédito y débito principales (Visa, Mastercard, American Express).",
                        },
                        {
                            q: "¿Hay un período de prueba?",
                            a: "Sí, puedes crear tu cuenta gratis y explorar la plataforma antes de suscribirte.",
                        },
                        {
                            q: "¿Mis datos están seguros?",
                            a: "Absolutamente. Utilizamos encriptación de nivel bancario y cumplimos con los estándares de seguridad más altos.",
                        },
                    ].map((faq, i) => (
                        <div
                            key={i}
                            className="glass-card"
                            style={{ padding: 24, marginBottom: 12 }}
                        >
                            <h4 style={{ color: "white", fontWeight: 600, marginBottom: 8 }}>{faq.q}</h4>
                            <p style={{ color: "#94A3B8", fontSize: "0.95rem" }}>{faq.a}</p>
                        </div>
                    ))}
                </div>
            </section>
        </>
    );
}
