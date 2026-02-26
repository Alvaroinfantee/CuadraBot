import Providers from "@/components/Providers";
import Link from "next/link";
import Image from "next/image";
import { LayoutDashboard, CreditCard, Settings, LogOut, Monitor } from "lucide-react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Providers>
            <div style={{ display: "flex", minHeight: "100vh" }}>
                {/* Sidebar */}
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
                    className="dashboard-sidebar"
                >
                    {/* Logo */}
                    <Link
                        href="/"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            textDecoration: "none",
                            padding: "8px 12px",
                            marginBottom: 32,
                        }}
                    >
                        <Image src="/logo.jpeg" alt="CuadraBot" width={32} height={32} style={{ borderRadius: 8 }} />
                        <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "white" }}>
                            Cuadra<span style={{ color: "var(--accent-green)" }}>Bot</span>
                        </span>
                    </Link>

                    <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                        <Link
                            href="/dashboard"
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
                                transition: "all 0.2s",
                            }}
                        >
                            <LayoutDashboard size={18} />
                            Panel Principal
                        </Link>
                        <Link
                            href="/dashboard/suscripcion"
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
                            Suscripción
                        </Link>
                        <Link
                            href="/dashboard/configuracion"
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
                            <Settings size={18} />
                            Configuración
                        </Link>

                        <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.06)", margin: "12px 0" }} />

                        <Link
                            href="/dashboard/app"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 12px",
                                borderRadius: 10,
                                color: "var(--accent-green)",
                                textDecoration: "none",
                                fontSize: "0.9rem",
                                fontWeight: 600,
                            }}
                        >
                            <Monitor size={18} />
                            CuadraBot App
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

                {/* Main content */}
                <main
                    style={{
                        flex: 1,
                        marginLeft: 260,
                        padding: "32px 40px",
                        background: "var(--navy-900)",
                        minHeight: "100vh",
                    }}
                    className="dashboard-main"
                >
                    {children}
                </main>
            </div>

        </Providers>
    );
}
