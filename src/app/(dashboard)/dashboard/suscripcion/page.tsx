"use client";

import { useSession } from "next-auth/react";
import { CreditCard } from "lucide-react";
import { CheckoutButton } from "@/components/CheckoutButton";

export default function SuscripcionPage() {
    const { data: session } = useSession();

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
                        <p style={{ color: "#94A3B8", fontSize: "0.85rem" }}>Acceso Completo</p>
                    </div>
                </div>

                <div style={{
                    background: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    padding: "16px",
                    borderRadius: 12,
                    color: "#FCD34D",
                    marginBottom: 24,
                    fontSize: "0.9rem"
                }}>
                    <p style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, marginBottom: 4 }}>
                        ⚠️ Aviso Importante
                    </p>
                    <p>
                        Por problemas técnicos con Stripe, los pagos directos están desactivados. Solicita tu <strong>código de acceso</strong> escribiendo a <strong>info@cuadrabot.com</strong>.
                    </p>
                </div>

                {session?.user ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <CheckoutButton label="Activar Código" style={{ width: "100%" }} />
                    </div>
                ) : (
                    <p style={{ color: "#64748B" }}>Cargando...</p>
                )}
            </div>
        </div>
    );
}
