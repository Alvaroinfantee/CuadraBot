"use client";

import { useSession } from "next-auth/react";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";

export default function SuscripcionPage() {
    const { data: session } = useSession();
    const [loading, setLoading] = useState(false);

    const handleManageBilling = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/stripe/portal", { method: "POST" });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            }
        } catch {
            alert("Error al abrir el portal de facturación");
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/stripe/checkout", { method: "POST" });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            }
        } catch {
            alert("Error al iniciar el checkout");
        } finally {
            setLoading(false);
        }
    };

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
                Suscripción
            </h1>
            <p style={{ color: "#94A3B8", marginBottom: 32 }}>
                Gestiona tu plan y facturación
            </p>

            <div
                className="glass-card"
                style={{ padding: 32, maxWidth: 500 }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                    <div
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: "rgba(16,185,129,0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <CreditCard size={22} color="var(--accent-green)" />
                    </div>
                    <div>
                        <h2 style={{ color: "white", fontWeight: 600, fontSize: "1.1rem" }}>
                            CuadraBot Pro
                        </h2>
                        <p style={{ color: "#94A3B8", fontSize: "0.85rem" }}>$30 USD/mes</p>
                    </div>
                </div>

                {session?.user ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <button
                            onClick={handleSubscribe}
                            className="btn-gold"
                            disabled={loading}
                            style={{ width: "100%" }}
                        >
                            {loading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    Comenzar Prueba Gratis (48h)
                                    <ExternalLink size={16} />
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleManageBilling}
                            className="btn-secondary"
                            disabled={loading}
                            style={{ width: "100%" }}
                        >
                            Gestionar Facturación
                            <ExternalLink size={16} />
                        </button>
                    </div>
                ) : (
                    <p style={{ color: "#64748B" }}>Cargando...</p>
                )}
            </div>
        </div>
    );
}
