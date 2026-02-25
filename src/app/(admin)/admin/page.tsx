import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Users, CreditCard, TrendingUp, UserPlus } from "lucide-react";

export default async function AdminPage() {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/dashboard");

    const [totalUsers, activeSubscriptions, recentUsers, subsByPlan] = await Promise.all([
        prisma.user.count(),
        prisma.subscription.count({ where: { status: "ACTIVE" } }),
        prisma.user.findMany({
            take: 8,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
                subscription: { select: { plan: true, status: true } },
            },
        }),
        prisma.subscription.groupBy({
            by: ["plan"],
            _count: { plan: true },
            where: { status: "ACTIVE" },
        }),
    ]);

    const planNames: Record<string, string> = {
        basico: "Básico",
        profesional: "Profesional",
        empresarial: "Empresarial",
    };

    const planPrices: Record<string, number> = {
        basico: 29,
        profesional: 59,
        empresarial: 99,
    };

    const mrr = subsByPlan.reduce((sum, s) => sum + (planPrices[s.plan] || 0) * s._count.plan, 0);

    const stats = [
        { label: "Total Usuarios", value: totalUsers, icon: Users, color: "#3B82F6" },
        { label: "Suscripciones Activas", value: activeSubscriptions, icon: CreditCard, color: "var(--accent-green)" },
        { label: "MRR (USD)", value: `$${mrr.toLocaleString()}`, icon: TrendingUp, color: "var(--accent-gold)" },
        { label: "Nuevos (7 días)", value: recentUsers.filter((u) => u.createdAt > new Date(Date.now() - 7 * 86400000)).length, icon: UserPlus, color: "#8B5CF6" },
    ];

    return (
        <div>
            <div style={{ marginBottom: 40 }}>
                <h1 style={{ fontSize: "1.8rem", fontWeight: 700, color: "white", marginBottom: 8 }}>
                    Panel de Administración
                </h1>
                <p style={{ color: "#94A3B8" }}>Resumen general de la plataforma</p>
            </div>

            {/* Stats Grid */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 20,
                    marginBottom: 40,
                }}
            >
                {stats.map((stat, i) => (
                    <div key={i} className="glass-card" style={{ padding: 24 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                            <span style={{ color: "#64748B", fontSize: "0.85rem", fontWeight: 500 }}>{stat.label}</span>
                            <div
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    background: `${stat.color}15`,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <stat.icon size={18} color={stat.color} />
                            </div>
                        </div>
                        <p style={{ fontSize: "1.8rem", fontWeight: 700, color: "white" }}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Subscriptions by plan */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginBottom: 40 }}>
                <div className="glass-card" style={{ padding: 28 }}>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "white", marginBottom: 20 }}>
                        Suscripciones por Plan
                    </h3>
                    {subsByPlan.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {subsByPlan.map((s) => (
                                <div key={s.plan} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ color: "#CBD5E1", fontWeight: 500 }}>{planNames[s.plan] || s.plan}</span>
                                    <span
                                        style={{
                                            background: "rgba(16,185,129,0.1)",
                                            color: "var(--accent-green)",
                                            padding: "4px 12px",
                                            borderRadius: 20,
                                            fontSize: "0.85rem",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {s._count.plan} activas
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: "#64748B", fontSize: "0.9rem" }}>Sin suscripciones activas</p>
                    )}
                </div>
            </div>

            {/* Recent Users Table */}
            <div className="glass-card" style={{ padding: 28 }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "white", marginBottom: 20 }}>
                    Usuarios Recientes
                </h3>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr>
                                {["Nombre", "Email", "Plan", "Estado", "Registro"].map((header) => (
                                    <th
                                        key={header}
                                        style={{
                                            textAlign: "left",
                                            padding: "12px 16px",
                                            color: "#64748B",
                                            fontSize: "0.8rem",
                                            fontWeight: 600,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            borderBottom: "1px solid rgba(255,255,255,0.06)",
                                        }}
                                    >
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {recentUsers.map((user) => (
                                <tr key={user.id}>
                                    <td style={{ padding: "12px 16px", color: "white", fontWeight: 500, fontSize: "0.9rem" }}>
                                        {user.name || "—"}
                                    </td>
                                    <td style={{ padding: "12px 16px", color: "#94A3B8", fontSize: "0.9rem" }}>
                                        {user.email}
                                    </td>
                                    <td style={{ padding: "12px 16px", color: "#CBD5E1", fontSize: "0.9rem" }}>
                                        {user.subscription ? planNames[user.subscription.plan] || user.subscription.plan : "Sin plan"}
                                    </td>
                                    <td style={{ padding: "12px 16px" }}>
                                        <span
                                            style={{
                                                padding: "4px 10px",
                                                borderRadius: 20,
                                                fontSize: "0.8rem",
                                                fontWeight: 600,
                                                background: user.subscription?.status === "ACTIVE"
                                                    ? "rgba(16,185,129,0.1)"
                                                    : "rgba(100,116,139,0.1)",
                                                color: user.subscription?.status === "ACTIVE"
                                                    ? "var(--accent-green)"
                                                    : "#64748B",
                                            }}
                                        >
                                            {user.subscription?.status === "ACTIVE" ? "Activo" : "Inactivo"}
                                        </span>
                                    </td>
                                    <td style={{ padding: "12px 16px", color: "#64748B", fontSize: "0.85rem" }}>
                                        {user.createdAt.toLocaleDateString("es-DO")}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
