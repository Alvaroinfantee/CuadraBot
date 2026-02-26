"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Zap, CreditCard } from "lucide-react";

export function CheckoutButton({
    variant = "gold",
    label = "Prueba 48 Horas Gratis",
    className,
    style,
}: {
    variant?: "gold" | "primary" | "secondary";
    label?: string;
    className?: string;
    style?: React.CSSProperties;
}) {
    const [loading, setLoading] = useState(false);

    const handleCheckout = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/stripe/checkout", { method: "POST" });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert(data.error || "Error al iniciar el checkout");
            }
        } catch {
            alert("Error de conexión. Intenta de nuevo.");
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

    const icon =
        variant === "gold" ? (
            <Zap size={16} />
        ) : (
            <CreditCard size={16} />
        );

    return (
        <button
            onClick={handleCheckout}
            disabled={loading}
            className={className || btnClass}
            style={{ ...style, opacity: loading ? 0.7 : 1 }}
        >
            {loading ? (
                <Loader2 size={18} className="animate-spin" />
            ) : (
                <>
                    {icon}
                    {label}
                    <ArrowRight size={16} />
                </>
            )}
        </button>
    );
}
