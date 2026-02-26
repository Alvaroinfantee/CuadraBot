"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { User, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

async function redirectToCheckout() {
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) {
        window.location.href = data.url;
    } else {
        // Fallback: if checkout fails, go to dashboard (subscription guard will handle)
        window.location.href = "/dashboard";
    }
}

export default function RegistrarsePage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (password !== confirmPassword) {
            setError("Las contraseñas no coinciden");
            setLoading(false);
            return;
        }

        if (password.length < 8) {
            setError("La contraseña debe tener al menos 8 caracteres");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Error al crear la cuenta");
                return;
            }

            // Auto sign in after registration
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError("Cuenta creada. Por favor inicia sesión.");
            } else {
                // Redirect to Stripe checkout instead of dashboard
                await redirectToCheckout();
            }
        } catch {
            setError("Error al crear la cuenta");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                background: "var(--navy-900)",
            }}
        >
            <div
                style={{
                    position: "fixed",
                    bottom: -200,
                    left: -200,
                    width: 500,
                    height: 500,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)",
                    pointerEvents: "none",
                }}
            />

            <div
                className="glass-card"
                style={{
                    width: "100%",
                    maxWidth: 440,
                    padding: "40px 36px",
                }}
            >
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", marginBottom: 24 }}>
                        <Image src="/logo.jpeg" alt="CuadraBot" width={40} height={40} style={{ borderRadius: 10 }} />
                        <span style={{ fontSize: "1.4rem", fontWeight: 700, color: "white" }}>
                            Cuadra<span style={{ color: "var(--accent-green)" }}>Bot</span>
                        </span>
                    </Link>
                    <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "white", marginBottom: 8 }}>
                        Crea tu cuenta
                    </h1>
                    <p style={{ color: "#94A3B8", fontSize: "0.95rem" }}>
                        Regístrate y comienza tu prueba gratis de 48 horas
                    </p>
                </div>

                {error && (
                    <div
                        style={{
                            padding: "12px 16px",
                            background: "rgba(239,68,68,0.1)",
                            border: "1px solid rgba(239,68,68,0.2)",
                            borderRadius: 10,
                            marginBottom: 20,
                            color: "#F87171",
                            fontSize: "0.9rem",
                            textAlign: "center",
                        }}
                    >
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                        <label style={{ display: "block", color: "#94A3B8", fontSize: "0.9rem", marginBottom: 6 }}>
                            Nombre completo
                        </label>
                        <div style={{ position: "relative" }}>
                            <User
                                size={18}
                                color="#64748B"
                                style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
                            />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className="input-field"
                                placeholder="Juan Pérez"
                                style={{ paddingLeft: 42 }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: "block", color: "#94A3B8", fontSize: "0.9rem", marginBottom: 6 }}>
                            Email
                        </label>
                        <div style={{ position: "relative" }}>
                            <Mail
                                size={18}
                                color="#64748B"
                                style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
                            />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="input-field"
                                placeholder="tu@email.com"
                                style={{ paddingLeft: 42 }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: "block", color: "#94A3B8", fontSize: "0.9rem", marginBottom: 6 }}>
                            Contraseña
                        </label>
                        <div style={{ position: "relative" }}>
                            <Lock
                                size={18}
                                color="#64748B"
                                style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
                            />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                                className="input-field"
                                placeholder="Mínimo 8 caracteres"
                                style={{ paddingLeft: 42, paddingRight: 42 }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: "absolute",
                                    right: 14,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#64748B",
                                    padding: 0,
                                }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: "block", color: "#94A3B8", fontSize: "0.9rem", marginBottom: 6 }}>
                            Confirmar contraseña
                        </label>
                        <div style={{ position: "relative" }}>
                            <Lock
                                size={18}
                                color="#64748B"
                                style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
                            />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="input-field"
                                placeholder="Repite tu contraseña"
                                style={{ paddingLeft: 42 }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn-gold"
                        disabled={loading}
                        style={{ width: "100%", marginTop: 8, opacity: loading ? 0.7 : 1 }}
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : "Crear Cuenta y Comenzar Prueba"}
                    </button>
                </form>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        margin: "24px 0",
                    }}
                >
                    <hr style={{ flex: 1, border: "none", borderTop: "1px solid rgba(255,255,255,0.06)" }} />
                    <span style={{ color: "#64748B", fontSize: "0.85rem" }}>o</span>
                    <hr style={{ flex: 1, border: "none", borderTop: "1px solid rgba(255,255,255,0.06)" }} />
                </div>

                <button
                    onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                    className="btn-secondary"
                    style={{ width: "100%" }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Registrarse con Google
                </button>

                <p style={{ textAlign: "center", marginTop: 24, color: "#94A3B8", fontSize: "0.9rem" }}>
                    ¿Ya tienes cuenta?{" "}
                    <Link
                        href="/iniciar-sesion"
                        style={{ color: "var(--accent-green)", textDecoration: "none", fontWeight: 600 }}
                    >
                        Inicia sesión
                    </Link>
                </p>
            </div>
        </div>
    );
}
