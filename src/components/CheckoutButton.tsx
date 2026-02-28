"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Key } from "lucide-react";

export function CheckoutButton({
    variant = "gold",
    label = "Activar Código",
    className,
    style,
}: {
    variant?: "gold" | "primary" | "secondary";
    label?: string;
    className?: string;
    style?: React.CSSProperties;
}) {
    const [loading, setLoading] = useState(false);
    const [code, setCode] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!code.trim()) {
            setError("Ingresa un código");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/subscription/code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                window.location.href = data.url || "/dashboard?success=true";
            } else {
                setError(data.error || "Error al validar el código");
            }
        } catch {
            setError("Error de conexión. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const btnClass =
        variant === "gold"
            ? "btn-gold"
            : variant === "primary"
                ? "btn-primary"
                : "btn-secondary";

    return (
        <form onSubmit={handleSubmit} style={{ width: "100%", ...style }}>
            <div style={{ position: "relative", marginBottom: 12 }}>
                <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
                    <Key size={18} color="#94A3B8" />
                </div>
                <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                        setCode(e.target.value);
                        setError("");
                    }}
                    placeholder="CUADRA-PRO-XXXX"
                    style={{
                        width: "100%",
                        padding: "12px 14px 12px 42px",
                        background: "rgba(15, 23, 42, 0.6)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        color: "white",
                        fontSize: "0.95rem",
                        outline: "none",
                        transition: "all 0.2s"
                    }}
                    disabled={loading}
                />
            </div>

            {error && (
                <p style={{ color: "#F87171", fontSize: "0.85rem", marginBottom: 12, textAlign: "center" }}>
                    {error}
                </p>
            )}

            <button
                type="submit"
                disabled={loading || !code.trim()}
                className={className || btnClass}
                style={{ width: "100%", opacity: loading || !code.trim() ? 0.7 : 1 }}
            >
                {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                ) : (
                    <>
                        {label}
                        <ArrowRight size={16} />
                    </>
                )}
            </button>
        </form>
    );
}
