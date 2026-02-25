"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, LogOut, LayoutDashboard } from "lucide-react";

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const { data: session } = useSession();

    return (
        <nav
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 50,
                background: "rgba(10, 22, 40, 0.85)",
                backdropFilter: "blur(20px)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
        >
            <div
                style={{
                    maxWidth: 1200,
                    margin: "0 auto",
                    padding: "0 24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    height: 72,
                }}
            >
                {/* Logo */}
                <Link
                    href="/"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        textDecoration: "none",
                        color: "white",
                    }}
                >
                    <Image
                        src="/logo.jpeg"
                        alt="CuadraBot"
                        width={36}
                        height={36}
                        style={{ borderRadius: 8 }}
                    />
                    <span
                        style={{
                            fontSize: "1.3rem",
                            fontWeight: 700,
                            letterSpacing: "-0.02em",
                        }}
                    >
                        Cuadra<span style={{ color: "var(--accent-green)" }}>Bot</span>
                    </span>
                </Link>

                {/* Desktop Nav */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 32,
                    }}
                    className="desktop-nav"
                >
                    <Link
                        href="/caracteristicas"
                        style={{
                            color: "#94A3B8",
                            textDecoration: "none",
                            fontSize: "0.9rem",
                            fontWeight: 500,
                            transition: "color 0.2s",
                        }}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.color = "white")
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.color = "#94A3B8")
                        }
                    >
                        Características
                    </Link>
                    <Link
                        href="/precios"
                        style={{
                            color: "#94A3B8",
                            textDecoration: "none",
                            fontSize: "0.9rem",
                            fontWeight: 500,
                            transition: "color 0.2s",
                        }}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.color = "white")
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.color = "#94A3B8")
                        }
                    >
                        Precios
                    </Link>
                    <Link
                        href="/contacto"
                        style={{
                            color: "#94A3B8",
                            textDecoration: "none",
                            fontSize: "0.9rem",
                            fontWeight: 500,
                            transition: "color 0.2s",
                        }}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.color = "white")
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.color = "#94A3B8")
                        }
                    >
                        Contacto
                    </Link>

                    {session ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Link href="/dashboard" className="btn-secondary" style={{ padding: "8px 20px", fontSize: "0.9rem" }}>
                                <LayoutDashboard size={16} />
                                Dashboard
                            </Link>
                            <button
                                onClick={() => signOut({ callbackUrl: "/" })}
                                className="btn-secondary"
                                style={{ padding: "8px 16px", fontSize: "0.9rem" }}
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Link
                                href="/iniciar-sesion"
                                className="btn-secondary"
                                style={{ padding: "8px 20px", fontSize: "0.9rem" }}
                            >
                                Iniciar Sesión
                            </Link>
                            <Link
                                href="/registrarse"
                                className="btn-primary"
                                style={{ padding: "8px 20px", fontSize: "0.9rem" }}
                            >
                                Empezar Gratis
                            </Link>
                        </div>
                    )}
                </div>

                {/* Mobile menu button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    style={{
                        display: "none",
                        background: "none",
                        border: "none",
                        color: "white",
                        cursor: "pointer",
                        padding: 8,
                    }}
                    className="mobile-menu-btn"
                    aria-label="Menu"
                >
                    {isOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile menu */}
            {isOpen && (
                <div
                    style={{
                        padding: "16px 24px 24px",
                        background: "rgba(10, 22, 40, 0.98)",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                    className="mobile-dropdown"
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 16,
                        }}
                    >
                        <Link
                            href="/caracteristicas"
                            onClick={() => setIsOpen(false)}
                            style={{ color: "#94A3B8", textDecoration: "none", fontSize: "1rem" }}
                        >
                            Características
                        </Link>
                        <Link
                            href="/precios"
                            onClick={() => setIsOpen(false)}
                            style={{ color: "#94A3B8", textDecoration: "none", fontSize: "1rem" }}
                        >
                            Precios
                        </Link>
                        <Link
                            href="/contacto"
                            onClick={() => setIsOpen(false)}
                            style={{ color: "#94A3B8", textDecoration: "none", fontSize: "1rem" }}
                        >
                            Contacto
                        </Link>
                        <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.06)" }} />
                        {session ? (
                            <>
                                <Link href="/dashboard" className="btn-primary" onClick={() => setIsOpen(false)}>
                                    Dashboard
                                </Link>
                                <button onClick={() => signOut({ callbackUrl: "/" })} className="btn-secondary">
                                    Cerrar Sesión
                                </button>
                            </>
                        ) : (
                            <>
                                <Link href="/iniciar-sesion" className="btn-secondary" onClick={() => setIsOpen(false)}>
                                    Iniciar Sesión
                                </Link>
                                <Link href="/registrarse" className="btn-primary" onClick={() => setIsOpen(false)}>
                                    Empezar Gratis
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            )}

            <style jsx global>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
        @media (min-width: 769px) {
          .mobile-dropdown { display: none !important; }
        }
      `}</style>
        </nav>
    );
}
