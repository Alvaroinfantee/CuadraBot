import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
    Monitor,
    CreditCard,
    Calendar,
    CheckCircle2,
    AlertCircle,
    Crown,
    ArrowRight,
} from "lucide-react";

const planNames: Record<string, string> = {
    pro: "CuadraBot Pro",
};

const statusLabels: Record<string, { label: string; color: string }> = {
    ACTIVE: { label: "Activo", color: "var(--accent-green)" },
    CANCELLED: { label: "Cancelada", color: "#EF4444" },
    PAST_DUE: { label: "Pago Pendiente", color: "var(--accent-gold)" },
    TRIALING: { label: "Período de Prueba", color: "#3B82F6" },
    INCOMPLETE: { label: "Incompleta", color: "#64748B" },
};

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/iniciar-sesion");

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { subscription: true },
    });

    if (!user) redirect("/iniciar-sesion");

    const subscription = user.subscription;
    const isActive = subscription?.status === "ACTIVE" || subscription?.status === "TRIALING";
    const statusInfo = subscription
        ? statusLabels[subscription.status] || statusLabels.INCOMPLETE
        : null;

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: 40 }}>
                <h1 style={{ fontSize: "1.8rem", fontWeight: 700, color: "white", marginBottom: 8 }}>
                    ¡Hola, {user.name || "Usuario"}! 👋
                </h1>
                <p style={{ color: "#94A3B8", fontSize: "1rem" }}>
                    Bienvenido a tu panel de control
                </p>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                    gap: 24,
                    marginBottom: 32,
                }}
            >
                {/* Access CPA App Card */}
                <div
                    className="glass-card glow-green"
                    style={{
                        padding: 32,
                        background: isActive
                            ? "linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.02) 100%)"
                            : "var(--glass-bg)",
                    }}
                >
                    <div
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            background: isActive
                                ? "rgba(16,185,129,0.15)"
                                : "rgba(100,116,139,0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 20,
                        }}
                    >
                        <Monitor
                            size={24}
                            color={isActive ? "var(--accent-green)" : "#64748B"}
                        />
                    </div>
                    <h3
                        style={{
                            fontSize: "1.2rem",
                            fontWeight: 600,
                            color: "white",
                            marginBottom: 8,
                        }}
                    >
                        CuadraBot App
                    </h3>
                    <p
                        style={{
                            color: "#94A3B8",
                            fontSize: "0.9rem",
                            marginBottom: 20,
                            lineHeight: 1.6,
                        }}
                    >
                        {isActive
                            ? "Tu suscripción está activa. Accede a la aplicación para gestionar tu contabilidad."
                            : "Necesitas una suscripción activa para acceder a la aplicación."}
                    </p>
                    {isActive ? (
                        <Link
                            href="/dashboard/app"
                            className="btn-primary"
                            style={{ width: "100%", textAlign: "center" }}
                        >
                            Acceder a CuadraBot
                            <ArrowRight size={16} />
                        </Link>
                    ) : (
                        <Link
                            href="/precios"
                            className="btn-gold"
                            style={{ width: "100%", textAlign: "center" }}
                        >
                            Ver Planes
                            <ArrowRight size={16} />
                        </Link>
                    )}
                </div>

                {/* Subscription Status Card */}
                <div className="glass-card" style={{ padding: 32 }}>
                    <div
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            background: "rgba(245,158,11,0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 20,
                        }}
                    >
                        <Crown size={24} color="var(--accent-gold)" />
                    </div>
                    <h3
                        style={{
                            fontSize: "1.2rem",
                            fontWeight: 600,
                            color: "white",
                            marginBottom: 16,
                        }}
                    >
                        Tu Suscripción
                    </h3>

                    {subscription ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ color: "#64748B", fontSize: "0.9rem" }}>Plan</span>
                                <span style={{ color: "white", fontWeight: 600 }}>
                                    {planNames[subscription.plan] || subscription.plan}
                                </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ color: "#64748B", fontSize: "0.9rem" }}>Estado</span>
                                <span
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        color: statusInfo?.color,
                                        fontWeight: 600,
                                        fontSize: "0.9rem",
                                    }}
                                >
                                    {isActive ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                    {statusInfo?.label}
                                </span>
                            </div>
                            {subscription.currentPeriodEnd && (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ color: "#64748B", fontSize: "0.9rem" }}>Próximo cobro</span>
                                    <span style={{ color: "#CBD5E1", fontSize: "0.9rem" }}>
                                        {new Date(subscription.currentPeriodEnd).toLocaleDateString("es-DO", {
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric",
                                        })}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p style={{ color: "#94A3B8", fontSize: "0.9rem" }}>
                            No tienes una suscripción activa
                        </p>
                    )}

                    {subscription && (
                        <button
                            onClick={undefined}
                            className="btn-secondary"
                            style={{ width: "100%", marginTop: 20, textAlign: "center" }}
                        >
                            <CreditCard size={16} />
                            Gestionar Facturación
                        </button>
                    )}
                </div>
            </div>

            {/* Account Info */}
            <div className="glass-card" style={{ padding: 32 }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "white", marginBottom: 20 }}>
                    Información de la Cuenta
                </h3>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: 20,
                    }}
                >
                    <div>
                        <p style={{ color: "#64748B", fontSize: "0.85rem", marginBottom: 4 }}>Nombre</p>
                        <p style={{ color: "white", fontWeight: 500 }}>{user.name || "—"}</p>
                    </div>
                    <div>
                        <p style={{ color: "#64748B", fontSize: "0.85rem", marginBottom: 4 }}>Email</p>
                        <p style={{ color: "white", fontWeight: 500 }}>{user.email}</p>
                    </div>
                    <div>
                        <p style={{ color: "#64748B", fontSize: "0.85rem", marginBottom: 4 }}>Miembro desde</p>
                        <p style={{ color: "white", fontWeight: 500 }}>
                            {user.createdAt.toLocaleDateString("es-DO", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
