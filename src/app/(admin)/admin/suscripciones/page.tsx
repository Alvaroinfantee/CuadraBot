import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const planNames: Record<string, string> = {
    basico: "Básico",
    profesional: "Profesional",
    empresarial: "Empresarial",
};

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
    ACTIVE: { label: "Activa", color: "var(--accent-green)", bg: "rgba(16,185,129,0.1)" },
    CANCELLED: { label: "Cancelada", color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
    PAST_DUE: { label: "Pago Pendiente", color: "var(--accent-gold)", bg: "rgba(245,158,11,0.1)" },
    TRIALING: { label: "Prueba", color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
    INCOMPLETE: { label: "Incompleta", color: "#64748B", bg: "rgba(100,116,139,0.1)" },
};

export default async function AdminSuscripcionesPage() {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/dashboard");

    const subscriptions = await prisma.subscription.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
            user: {
                select: { name: true, email: true },
            },
        },
    });

    const activeCount = subscriptions.filter((s) => s.status === "ACTIVE").length;
    const cancelledCount = subscriptions.filter((s) => s.status === "CANCELLED").length;
    const pastDueCount = subscriptions.filter((s) => s.status === "PAST_DUE").length;

    return (
        <div>
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: "1.8rem", fontWeight: 700, color: "white", marginBottom: 8 }}>
                    Suscripciones
                </h1>
                <p style={{ color: "#94A3B8" }}>Vista general de todas las suscripciones</p>
            </div>

            {/* Quick stats */}
            <div
                style={{
                    display: "flex",
                    gap: 16,
                    marginBottom: 24,
                    flexWrap: "wrap",
                }}
            >
                {[
                    { label: "Activas", value: activeCount, color: "var(--accent-green)" },
                    { label: "Canceladas", value: cancelledCount, color: "#EF4444" },
                    { label: "Pendientes", value: pastDueCount, color: "var(--accent-gold)" },
                    { label: "Total", value: subscriptions.length, color: "#3B82F6" },
                ].map((s, i) => (
                    <div
                        key={i}
                        className="glass-card"
                        style={{ padding: "16px 24px", minWidth: 140, textAlign: "center" }}
                    >
                        <p style={{ color: "#64748B", fontSize: "0.8rem", marginBottom: 4, fontWeight: 500 }}>
                            {s.label}
                        </p>
                        <p style={{ fontSize: "1.5rem", fontWeight: 700, color: s.color }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                                {["Usuario", "Email", "Plan", "Estado", "Vencimiento"].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            textAlign: "left",
                                            padding: "14px 20px",
                                            color: "#64748B",
                                            fontSize: "0.8rem",
                                            fontWeight: 600,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            borderBottom: "1px solid rgba(255,255,255,0.06)",
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {subscriptions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#64748B" }}>
                                        No hay suscripciones
                                    </td>
                                </tr>
                            ) : (
                                subscriptions.map((sub) => {
                                    const status = statusLabels[sub.status] || statusLabels.INCOMPLETE;
                                    return (
                                        <tr key={sub.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                                            <td style={{ padding: "14px 20px", color: "white", fontWeight: 500, fontSize: "0.9rem" }}>
                                                {sub.user.name || "—"}
                                            </td>
                                            <td style={{ padding: "14px 20px", color: "#94A3B8", fontSize: "0.9rem" }}>
                                                {sub.user.email}
                                            </td>
                                            <td style={{ padding: "14px 20px", color: "#CBD5E1", fontSize: "0.9rem" }}>
                                                {planNames[sub.plan] || sub.plan}
                                            </td>
                                            <td style={{ padding: "14px 20px" }}>
                                                <span
                                                    style={{
                                                        padding: "3px 12px",
                                                        borderRadius: 20,
                                                        fontSize: "0.8rem",
                                                        fontWeight: 600,
                                                        background: status.bg,
                                                        color: status.color,
                                                    }}
                                                >
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: "14px 20px", color: "#64748B", fontSize: "0.85rem" }}>
                                                {sub.currentPeriodEnd
                                                    ? sub.currentPeriodEnd.toLocaleDateString("es-DO", {
                                                        year: "numeric",
                                                        month: "short",
                                                        day: "numeric",
                                                    })
                                                    : "—"}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
