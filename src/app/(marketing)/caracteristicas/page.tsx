import type { Metadata } from "next";
import Link from "next/link";
import {
    FileSpreadsheet,
    Brain,
    Shield,
    Zap,
    TrendingUp,
    Clock,
    BarChart3,
    Download,
    ArrowRight,
    Globe,
    FileCheck,
    Calculator,
} from "lucide-react";

export const metadata: Metadata = {
    title: "Características",
    description: "Descubre todas las características de CuadraBot: reportes fiscales automatizados, cumplimiento DGII, análisis financiero, y más para tu negocio en República Dominicana.",
    alternates: { canonical: "/caracteristicas" },
};

const mainFeatures = [
    {
        icon: FileSpreadsheet,
        title: "Procesamiento Inteligente de CSV",
        description: "Sube tus archivos CSV y nuestro sistema los procesa automáticamente, identificando tipos de transacciones, clasificando gastos e ingresos, y organizando toda la información contable.",
        color: "var(--accent-green)",
    },
    {
        icon: Brain,
        title: "Inteligencia Artificial Contable",
        description: "Algoritmos avanzados de IA entrenados específicamente en la normativa fiscal dominicana. Detecta patrones, sugiere clasificaciones y minimiza errores humanos.",
        color: "var(--accent-gold)",
    },
    {
        icon: Shield,
        title: "Cumplimiento Total con la DGII",
        description: "Todos los reportes generados cumplen con los formatos y requerimientos de la Dirección General de Impuestos Internos. Siempre actualizado con los últimos cambios regulatorios.",
        color: "#3B82F6",
    },
    {
        icon: BarChart3,
        title: "Análisis Financiero Visual",
        description: "Dashboards interactivos que te muestran la salud financiera de tu empresa con gráficos claros y métricas importantes para la toma de decisiones.",
        color: "#8B5CF6",
    },
    {
        icon: Download,
        title: "Exportación Múltiple",
        description: "Descarga tus reportes en múltiples formatos: PDF, Excel, CSV. Listos para presentar ante la DGII o compartir con tu equipo.",
        color: "#EC4899",
    },
    {
        icon: Globe,
        title: "Acceso desde Cualquier Lugar",
        description: "Plataforma 100% web. Accede desde tu computadora, tablet o celular. Tus datos siempre disponibles, de forma segura.",
        color: "#14B8A6",
    },
];

const detailFeatures = [
    { icon: Calculator, text: "Cálculo automático de ITBIS" },
    { icon: FileCheck, text: "Formato 606 y 607 de la DGII" },
    { icon: TrendingUp, text: "Proyecciones de flujo de caja" },
    { icon: Clock, text: "Procesamiento en segundos" },
    { icon: Zap, text: "Actualizaciones automáticas" },
    { icon: Shield, text: "Encriptación de nivel bancario" },
];

export default function CaracteristicasPage() {
    return (
        <>
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
                        Características{" "}
                        <span className="gradient-text">poderosas</span>
                    </h1>
                    <p
                        style={{
                            color: "#94A3B8",
                            fontSize: "1.15rem",
                            maxWidth: 560,
                            margin: "0 auto",
                        }}
                    >
                        Herramientas diseñadas para contadores y empresas dominicanas que buscan eficiencia y precisión
                    </p>
                </div>
            </section>

            {/* Main features grid */}
            <section style={{ padding: "0 24px 80px" }}>
                <div
                    className="section-container"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                        gap: 24,
                    }}
                >
                    {mainFeatures.map((feature, i) => (
                        <div key={i} className="glass-card" style={{ padding: 36 }}>
                            <div
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 14,
                                    background: `${feature.color}15`,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginBottom: 24,
                                }}
                            >
                                <feature.icon size={28} color={feature.color} />
                            </div>
                            <h3
                                style={{
                                    fontSize: "1.2rem",
                                    fontWeight: 600,
                                    color: "white",
                                    marginBottom: 12,
                                }}
                            >
                                {feature.title}
                            </h3>
                            <p
                                style={{
                                    color: "#94A3B8",
                                    fontSize: "0.95rem",
                                    lineHeight: 1.7,
                                }}
                            >
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Detail features */}
            <section style={{ padding: "80px 24px", background: "var(--navy-800)" }}>
                <div className="section-container">
                    <h2
                        style={{
                            fontSize: "1.8rem",
                            fontWeight: 700,
                            color: "white",
                            textAlign: "center",
                            marginBottom: 48,
                        }}
                    >
                        Y mucho más...
                    </h2>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                            gap: 20,
                        }}
                    >
                        {detailFeatures.map((f, i) => (
                            <div
                                key={i}
                                className="glass-card"
                                style={{
                                    padding: "20px 24px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 14,
                                }}
                            >
                                <f.icon size={20} color="var(--accent-green)" />
                                <span style={{ color: "#CBD5E1", fontWeight: 500 }}>{f.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section style={{ padding: "100px 24px" }}>
                <div className="section-container" style={{ textAlign: "center" }}>
                    <h2
                        style={{
                            fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
                            fontWeight: 700,
                            color: "white",
                            marginBottom: 16,
                        }}
                    >
                        ¿Listo para simplificar tu contabilidad?
                    </h2>
                    <p
                        style={{
                            color: "#94A3B8",
                            fontSize: "1.1rem",
                            maxWidth: 440,
                            margin: "0 auto 32px",
                        }}
                    >
                        Únete a CuadraBot hoy y transforma la forma en que manejas tus impuestos
                    </p>
                    <Link href="/registrarse" className="btn-gold">
                        Empezar Gratis
                        <ArrowRight size={18} />
                    </Link>
                </div>
            </section>
        </>
    );
}
