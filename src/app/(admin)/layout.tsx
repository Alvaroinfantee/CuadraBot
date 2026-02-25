import Providers from "@/components/Providers";
import Link from "next/link";
import Image from "next/image";
import {
    LayoutDashboard,
    Users,
    CreditCard,
    LogOut,
    ArrowLeft,
} from "lucide-react";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Providers>
            <div style={{ display: "flex", minHeight: "100vh" }}>
                {/* Admin Sidebar */}
                <aside
                    style={{
                        width: 260,
                        background: "var(--navy-800)",
                        borderRight: "1px solid rgba(255,255,255,0.06)",
                        padding: "24px 16px",
                        display: "flex",
                        flexDirection: "column",
                        position: "fixed",
                        top: 0,
                        left: 0,
                        bottom: 0,
                        zIndex: 40,
                    }}
                    className="admin-sidebar"
                >
                    <Link
                        href="/"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            textDecoration: "none",
                            padding: "8px 12px",
                            marginBottom: 8,
                        }}
                    >
                        <Image src="/logo.jpeg" alt="CuadraBot" width={32} height={32} style={{ borderRadius: 8 }} />
                        <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "white" }}>
                            Cuadra<span style={{ color: "var(--accent-green)" }}>Bot</span>
                        </span>
                    </Link>

                    <div
                        style={{
                            padding: "6px 12px",
                            marginBottom: 24,
                            background: "rgba(239,68,68,0.1)",
                            border: "1px solid rgba(239,68,68,0.2)",
                            borderRadius: 8,
                            color: "#F87171",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            textAlign: "center",
                        }}
                    >
                        Panel Admin
                    </div>

                    <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                        <Link
                            href="/admin"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 12px",
                                borderRadius: 10,
                                color: "#94A3B8",
                                textDecoration: "none",
                                fontSize: "0.9rem",
                                fontWeight: 500,
                            }}
                        >
                            <LayoutDashboard size={18} />
                            Resumen
                        </Link>
                        <Link
                            href="/admin/usuarios"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 12px",
                                borderRadius: 10,
                                color: "#94A3B8",
                                textDecoration: "none",
                                fontSize: "0.9rem",
                                fontWeight: 500,
                            }}
                        >
                            <Users size={18} />
                            Usuarios
                        </Link>
                        <Link
                            href="/admin/suscripciones"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 12px",
                                borderRadius: 10,
                                color: "#94A3B8",
                                textDecoration: "none",
                                fontSize: "0.9rem",
                                fontWeight: 500,
                            }}
                        >
                            <CreditCard size={18} />
                            Suscripciones
                        </Link>

                        <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.06)", margin: "12px 0" }} />

                        <Link
                            href="/dashboard"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 12px",
                                borderRadius: 10,
                                color: "#64748B",
                                textDecoration: "none",
                                fontSize: "0.9rem",
                                fontWeight: 500,
                            }}
                        >
                            <ArrowLeft size={18} />
                            Volver a Dashboard
                        </Link>
                    </nav>

                    <div style={{ paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <Link
                            href="/api/auth/signout"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 12px",
                                borderRadius: 10,
                                color: "#EF4444",
                                textDecoration: "none",
                                fontSize: "0.9rem",
                                fontWeight: 500,
                            }}
                        >
                            <LogOut size={18} />
                            Cerrar Sesión
                        </Link>
                    </div>
                </aside>

                <main
                    style={{
                        flex: 1,
                        marginLeft: 260,
                        padding: "32px 40px",
                        background: "var(--navy-900)",
                        minHeight: "100vh",
                    }}
                    className="admin-main"
                >
                    {children}
                </main>
            </div>

        </Providers>
    );
}
