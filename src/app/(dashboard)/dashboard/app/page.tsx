import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle, ArrowRight } from "lucide-react";

export default async function CpaAppPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/iniciar-sesion");

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { subscription: true },
    });

    if (!user) redirect("/iniciar-sesion");

    const isActive =
        user.subscription?.status === "ACTIVE" ||
        user.subscription?.status === "TRIALING";

    const appUrl =
        process.env.CPA_APP_URL ||
        "https://cpa-app-7xheb.ondigitalocean.app/";

    if (!isActive) {
        return (
            <div>
                <div style={{ marginBottom: 32 }}>
                    <Link
                        href="/dashboard"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            color: "#94A3B8",
                            textDecoration: "none",
                            fontSize: "0.9rem",
                            marginBottom: 16,
                        }}
                    >
                        <ArrowLeft size={16} />
                        Volver al panel
                    </Link>
                </div>
                <div
                    className="glass-card"
                    style={{
                        padding: 48,
                        textAlign: "center",
                        maxWidth: 500,
                        margin: "80px auto",
                    }}
                >
                    <div
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 16,
                            background: "rgba(245,158,11,0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 24px",
                        }}
                    >
                        <AlertCircle size={32} color="var(--accent-gold)" />
                    </div>
                    <h2
                        style={{
                            fontSize: "1.4rem",
                            fontWeight: 700,
                            color: "white",
                            marginBottom: 12,
                        }}
                    >
                        Suscripción Requerida
                    </h2>
                    <p
                        style={{
                            color: "#94A3B8",
                            fontSize: "0.95rem",
                            lineHeight: 1.6,
                            marginBottom: 28,
                        }}
                    >
                        Necesitas una suscripción activa para acceder a
                        CuadraBot App. Elige un plan para comenzar.
                    </p>
                    <Link
                        href="/precios"
                        className="btn-gold"
                        style={{ width: "100%", textAlign: "center" }}
                    >
                        Ver Planes
                        <ArrowRight size={16} />
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "calc(100vh - 64px)",
                margin: "-32px -40px",
            }}
        >
            {/* Thin top bar */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 24px",
                    background: "rgba(15,23,42,0.6)",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    backdropFilter: "blur(12px)",
                    flexShrink: 0,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                    }}
                >
                    <Link
                        href="/dashboard"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            color: "#94A3B8",
                            textDecoration: "none",
                            fontSize: "0.85rem",
                            padding: "4px 10px",
                            borderRadius: 6,
                            border: "1px solid rgba(255,255,255,0.08)",
                            transition: "all 0.2s",
                        }}
                    >
                        <ArrowLeft size={14} />
                        Panel
                    </Link>
                    <span
                        style={{
                            color: "white",
                            fontSize: "0.95rem",
                            fontWeight: 600,
                        }}
                    >
                        CuadraBot App
                    </span>
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: "var(--accent-green)",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                    }}
                >
                    <div
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "var(--accent-green)",
                        }}
                    />
                    Conectado
                </div>
            </div>

            {/* Iframe - full remaining height */}
            <iframe
                src={appUrl}
                title="CuadraBot App"
                style={{
                    flex: 1,
                    width: "100%",
                    border: "none",
                    background: "var(--navy-900)",
                }}
                allow="clipboard-read; clipboard-write"
            />
        </div>
    );
}
