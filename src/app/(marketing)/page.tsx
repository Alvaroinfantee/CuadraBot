import type { Metadata } from "next";
import Link from "next/link";
import {
    FileSpreadsheet,
    Brain,
    Shield,
    Zap,
    TrendingUp,
    Clock,
    CheckCircle2,
    ArrowRight,
    Star,
} from "lucide-react";

export const metadata: Metadata = {
    title: "CuadraBot — Contabilidad Inteligente para República Dominicana",
    description:
        "Automatiza tu contabilidad fiscal en República Dominicana. Sube tus CSVs y obtén todos los reportes necesarios para pagar tus impuestos con inteligencia artificial. Ahorra tiempo y elimina errores.",
    alternates: { canonical: "/" },
};

const features = [
    {
        icon: FileSpreadsheet,
        title: "Sube tus CSVs",
        description: "Carga los archivos de tu empresa y deja que la IA haga el trabajo pesado.",
    },
    {
        icon: Brain,
        title: "IA Contable",
        description: "Algoritmos inteligentes que analizan y clasifican tus transacciones automáticamente.",
    },
    {
        icon: Shield,
        title: "Cumplimiento DGII",
        description: "Reportes 100% alineados con los requerimientos de la DGII.",
    },
    {
        icon: Zap,
        title: "Resultados Instantáneos",
        description: "Obtén tus reportes fiscales en segundos, no en horas.",
    },
    {
        icon: TrendingUp,
        title: "Análisis Financiero",
        description: "Visualiza el estado financiero de tu empresa con gráficos claros.",
    },
    {
        icon: Clock,
        title: "Ahorro de Tiempo",
        description: "Reduce horas de trabajo manual a solo minutos con automatización.",
    },
];

const steps = [
    {
        number: "01",
        title: "Crea tu cuenta",
        description: "Regístrate en menos de 2 minutos y elige el plan que mejor se adapte a tu negocio.",
    },
    {
        number: "02",
        title: "Sube tus datos",
        description: "Carga los archivos CSV de tu empresa. Nosotros nos encargamos del resto.",
    },
    {
        number: "03",
        title: "Obtén tus reportes",
        description: "Recibe todos los reportes fiscales listos para presentar ante la DGII.",
    },
];

const testimonials = [
    {
        name: "María García",
        role: "Contadora Pública",
        text: "CuadraBot me ahorra al menos 15 horas por semana. Mis clientes reciben sus reportes más rápido que nunca.",
        rating: 5,
    },
    {
        name: "Carlos Rodríguez",
        role: "Dueño de PYME",
        text: "Antes pagaba mucho en servicios contables. Ahora con CuadraBot manejo todo yo mismo sin errores.",
        rating: 5,
    },
    {
        name: "Ana Martínez",
        role: "Firma Contable",
        text: "La mejor herramienta para contadores en RD. Los reportes de la DGII salen perfectos cada vez.",
        rating: 5,
    },
];

export default function HomePage() {
    return (
        <>
            {/* JSON-LD Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "SoftwareApplication",
                        name: "CuadraBot",
                        applicationCategory: "FinanceApplication",
                        operatingSystem: "Web",
                        description: "Contabilidad inteligente para República Dominicana. Automatiza reportes fiscales con IA.",
                        offers: {
                            "@type": "Offer",
                            price: "30",
                            priceCurrency: "USD",
                        },
                        aggregateRating: {
                            "@type": "AggregateRating",
                            ratingValue: "4.9",
                            reviewCount: "150",
                        },
                    }),
                }}
            />

            {/* Hero Section */}
            <section
                style={{
                    position: "relative",
                    overflow: "hidden",
                    padding: "120px 24px 100px",
                    minHeight: "85vh",
                    display: "flex",
                    alignItems: "center",
                }}
            >
                {/* Background gradient orbs */}
                <div
                    style={{
                        position: "absolute",
                        top: -200,
                        right: -200,
                        width: 600,
                        height: 600,
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)",
                        pointerEvents: "none",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        bottom: -100,
                        left: -200,
                        width: 500,
                        height: 500,
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)",
                        pointerEvents: "none",
                    }}
                />

                <div className="section-container" style={{ width: "100%", position: "relative", zIndex: 1 }}>
                    <div
                        style={{
                            maxWidth: 720,
                            margin: "0 auto",
                            textAlign: "center",
                        }}
                    >
                        {/* Badge */}
                        <div
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "6px 16px",
                                background: "rgba(16,185,129,0.1)",
                                border: "1px solid rgba(16,185,129,0.2)",
                                borderRadius: 24,
                                marginBottom: 32,
                                fontSize: "0.85rem",
                                color: "var(--accent-green)",
                                fontWeight: 500,
                            }}
                            className="animate-fade-in"
                        >
                            <Zap size={14} />
                            Contabilidad con Inteligencia Artificial
                        </div>

                        <h1
                            style={{
                                fontSize: "clamp(2.2rem, 5vw, 3.8rem)",
                                fontWeight: 800,
                                lineHeight: 1.1,
                                marginBottom: 24,
                                letterSpacing: "-0.03em",
                                color: "white",
                            }}
                            className="animate-slide-up"
                        >
                            Tu contador inteligente para{" "}
                            <span className="gradient-text">República Dominicana</span>
                        </h1>

                        <p
                            style={{
                                fontSize: "clamp(1rem, 2vw, 1.25rem)",
                                color: "#94A3B8",
                                marginBottom: 40,
                                lineHeight: 1.7,
                                maxWidth: 580,
                                margin: "0 auto 40px",
                            }}
                            className="animate-slide-up"
                        >
                            Sube los CSVs de tu empresa y obtén automáticamente todos los reportes
                            fiscales que necesitas para cumplir con la DGII. Sin errores. Sin estrés.
                        </p>

                        <div
                            style={{
                                display: "flex",
                                gap: 16,
                                justifyContent: "center",
                                flexWrap: "wrap",
                            }}
                            className="animate-slide-up"
                        >
                            <Link href="/registrarse" className="btn-gold">
                                Prueba 48 Horas Gratis
                                <ArrowRight size={18} />
                            </Link>
                            <Link href="/caracteristicas" className="btn-secondary">
                                Ver Características
                            </Link>
                        </div>

                        {/* Social proof */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 24,
                                marginTop: 48,
                                flexWrap: "wrap",
                            }}
                            className="animate-fade-in"
                        >
                            <div style={{ display: "flex", gap: 2 }}>
                                {[...Array(5)].map((_, i) => (
                                    <Star
                                        key={i}
                                        size={16}
                                        fill="var(--accent-gold)"
                                        color="var(--accent-gold)"
                                    />
                                ))}
                            </div>
                            <span style={{ color: "#64748B", fontSize: "0.9rem" }}>
                                Más de <strong style={{ color: "#94A3B8" }}>150 profesionales</strong>{" "}
                                confían en CuadraBot
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section style={{ padding: "100px 24px", background: "var(--navy-800)" }}>
                <div className="section-container">
                    <div style={{ textAlign: "center", marginBottom: 64 }}>
                        <h2
                            style={{
                                fontSize: "clamp(1.8rem, 3vw, 2.5rem)",
                                fontWeight: 700,
                                color: "white",
                                marginBottom: 16,
                                letterSpacing: "-0.02em",
                            }}
                        >
                            Todo lo que necesitas para tu{" "}
                            <span className="gradient-text">contabilidad</span>
                        </h2>
                        <p style={{ color: "#94A3B8", fontSize: "1.1rem", maxWidth: 500, margin: "0 auto" }}>
                            Herramientas potentes diseñadas específicamente para el mercado dominicano
                        </p>
                    </div>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                            gap: 24,
                        }}
                    >
                        {features.map((feature, i) => (
                            <div
                                key={i}
                                className="glass-card"
                                style={{ padding: 32 }}
                            >
                                <div
                                    style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 12,
                                        background: "rgba(16,185,129,0.1)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        marginBottom: 20,
                                    }}
                                >
                                    <feature.icon size={24} color="var(--accent-green)" />
                                </div>
                                <h3
                                    style={{
                                        fontSize: "1.15rem",
                                        fontWeight: 600,
                                        color: "white",
                                        marginBottom: 8,
                                    }}
                                >
                                    {feature.title}
                                </h3>
                                <p style={{ color: "#94A3B8", fontSize: "0.95rem", lineHeight: 1.6 }}>
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section style={{ padding: "100px 24px" }}>
                <div className="section-container">
                    <div style={{ textAlign: "center", marginBottom: 64 }}>
                        <h2
                            style={{
                                fontSize: "clamp(1.8rem, 3vw, 2.5rem)",
                                fontWeight: 700,
                                color: "white",
                                marginBottom: 16,
                                letterSpacing: "-0.02em",
                            }}
                        >
                            Cómo funciona
                        </h2>
                        <p style={{ color: "#94A3B8", fontSize: "1.1rem" }}>
                            Tres simples pasos para automatizar tu contabilidad
                        </p>
                    </div>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: 32,
                        }}
                    >
                        {steps.map((step, i) => (
                            <div key={i} style={{ textAlign: "center", padding: "0 16px" }}>
                                <div
                                    style={{
                                        fontSize: "3rem",
                                        fontWeight: 800,
                                        background: "linear-gradient(135deg, var(--accent-green), var(--accent-gold))",
                                        WebkitBackgroundClip: "text",
                                        WebkitTextFillColor: "transparent",
                                        marginBottom: 20,
                                    }}
                                >
                                    {step.number}
                                </div>
                                <h3
                                    style={{
                                        fontSize: "1.3rem",
                                        fontWeight: 600,
                                        color: "white",
                                        marginBottom: 12,
                                    }}
                                >
                                    {step.title}
                                </h3>
                                <p style={{ color: "#94A3B8", lineHeight: 1.7 }}>{step.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section style={{ padding: "100px 24px", background: "var(--navy-800)" }}>
                <div className="section-container">
                    <div style={{ textAlign: "center", marginBottom: 64 }}>
                        <h2
                            style={{
                                fontSize: "clamp(1.8rem, 3vw, 2.5rem)",
                                fontWeight: 700,
                                color: "white",
                                marginBottom: 16,
                                letterSpacing: "-0.02em",
                            }}
                        >
                            Lo que dicen nuestros clientes
                        </h2>
                    </div>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                            gap: 24,
                        }}
                    >
                        {testimonials.map((t, i) => (
                            <div key={i} className="glass-card" style={{ padding: 32 }}>
                                <div style={{ display: "flex", gap: 2, marginBottom: 16 }}>
                                    {[...Array(t.rating)].map((_, j) => (
                                        <Star key={j} size={16} fill="var(--accent-gold)" color="var(--accent-gold)" />
                                    ))}
                                </div>
                                <p
                                    style={{
                                        color: "#CBD5E1",
                                        fontSize: "0.95rem",
                                        lineHeight: 1.7,
                                        marginBottom: 20,
                                        fontStyle: "italic",
                                    }}
                                >
                                    &ldquo;{t.text}&rdquo;
                                </p>
                                <div>
                                    <p style={{ color: "white", fontWeight: 600, fontSize: "0.95rem" }}>
                                        {t.name}
                                    </p>
                                    <p style={{ color: "#64748B", fontSize: "0.85rem" }}>{t.role}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section style={{ padding: "100px 24px" }}>
                <div className="section-container">
                    <div
                        className="glass-card glow-green"
                        style={{
                            padding: "64px 48px",
                            textAlign: "center",
                            background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(245,158,11,0.05) 100%)",
                        }}
                    >
                        <h2
                            style={{
                                fontSize: "clamp(1.8rem, 3vw, 2.5rem)",
                                fontWeight: 700,
                                color: "white",
                                marginBottom: 16,
                                letterSpacing: "-0.02em",
                            }}
                        >
                            ¿Listo para automatizar tu contabilidad?
                        </h2>
                        <p
                            style={{
                                color: "#94A3B8",
                                fontSize: "1.1rem",
                                maxWidth: 500,
                                margin: "0 auto 32px",
                            }}
                        >
                            Únete a cientos de profesionales que ya confían en CuadraBot
                        </p>
                        <div
                            style={{
                                display: "flex",
                                gap: 16,
                                justifyContent: "center",
                                flexWrap: "wrap",
                            }}
                        >
                            <Link href="/registrarse" className="btn-gold">
                                Prueba 48 Horas Gratis
                                <ArrowRight size={18} />
                            </Link>
                            <Link href="/precios" className="btn-secondary">
                                Ver Precios
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
