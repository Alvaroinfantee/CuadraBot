"use client";

import { useSession } from "next-auth/react";
import { User, Mail, Calendar } from "lucide-react";

export default function ConfiguracionPage() {
    const { data: session } = useSession();
    const user = session?.user;

    return (
        <div>
            <h1
                style={{
                    fontSize: "1.8rem",
                    fontWeight: 700,
                    color: "white",
                    marginBottom: 8,
                }}
            >
                Configuración
            </h1>
            <p style={{ color: "#94A3B8", marginBottom: 32 }}>
                Tu información de cuenta
            </p>

            <div className="glass-card" style={{ padding: 32, maxWidth: 500 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: "rgba(16,185,129,0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <User size={18} color="var(--accent-green)" />
                        </div>
                        <div>
                            <p style={{ color: "#64748B", fontSize: "0.8rem" }}>Nombre</p>
                            <p style={{ color: "white", fontWeight: 500 }}>
                                {user?.name || "—"}
                            </p>
                        </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: "rgba(245,158,11,0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <Mail size={18} color="var(--accent-gold)" />
                        </div>
                        <div>
                            <p style={{ color: "#64748B", fontSize: "0.8rem" }}>Email</p>
                            <p style={{ color: "white", fontWeight: 500 }}>
                                {user?.email || "—"}
                            </p>
                        </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: "rgba(59,130,246,0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <Calendar size={18} color="#3B82F6" />
                        </div>
                        <div>
                            <p style={{ color: "#64748B", fontSize: "0.8rem" }}>Cuenta</p>
                            <p style={{ color: "white", fontWeight: 500 }}>Activa</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
