"use client";

import { useState, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

interface UserData {
    id: string;
    name: string | null;
    email: string;
    role: string;
    createdAt: string;
    subscription: {
        plan: string;
        status: string;
        currentPeriodEnd: string | null;
    } | null;
}

const planNames: Record<string, string> = {
    basico: "Básico",
    profesional: "Profesional",
    empresarial: "Empresarial",
};

export default function AdminUsuariosPage() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "15" });
            if (search) params.set("search", search);
            const res = await fetch(`/api/admin/users?${params}`);
            const data = await res.json();
            setUsers(data.users || []);
            setTotalPages(data.pages || 1);
        } catch (err) {
            console.error("Error fetching users:", err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, [page]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchUsers();
    };

    return (
        <div>
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: "1.8rem", fontWeight: 700, color: "white", marginBottom: 8 }}>
                    Gestión de Usuarios
                </h1>
                <p style={{ color: "#94A3B8" }}>Busca y administra los usuarios de la plataforma</p>
            </div>

            {/* Search */}
            <form
                onSubmit={handleSearch}
                style={{ display: "flex", gap: 12, marginBottom: 24 }}
            >
                <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
                    <Search
                        size={18}
                        color="#64748B"
                        style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input-field"
                        placeholder="Buscar por nombre o email..."
                        style={{ paddingLeft: 42 }}
                    />
                </div>
                <button type="submit" className="btn-primary" style={{ padding: "10px 20px" }}>
                    Buscar
                </button>
            </form>

            {/* Table */}
            <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                                {["Nombre", "Email", "Rol", "Plan", "Estado", "Registro"].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            textAlign: "left",
                                            padding: "14px 20px",
                                            color: "#64748B",
                                            fontSize: "0.8rem",
                                            fontWeight: 600,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            borderBottom: "1px solid rgba(255,255,255,0.06)",
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#64748B" }}>
                                        Cargando...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#64748B" }}>
                                        No se encontraron usuarios
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr
                                        key={user.id}
                                        style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                                    >
                                        <td style={{ padding: "14px 20px", color: "white", fontWeight: 500, fontSize: "0.9rem" }}>
                                            {user.name || "—"}
                                        </td>
                                        <td style={{ padding: "14px 20px", color: "#94A3B8", fontSize: "0.9rem" }}>
                                            {user.email}
                                        </td>
                                        <td style={{ padding: "14px 20px" }}>
                                            <span
                                                style={{
                                                    padding: "3px 10px",
                                                    borderRadius: 20,
                                                    fontSize: "0.8rem",
                                                    fontWeight: 600,
                                                    background: user.role === "ADMIN" ? "rgba(239,68,68,0.1)" : "rgba(100,116,139,0.1)",
                                                    color: user.role === "ADMIN" ? "#F87171" : "#94A3B8",
                                                }}
                                            >
                                                {user.role}
                                            </span>
                                        </td>
                                        <td style={{ padding: "14px 20px", color: "#CBD5E1", fontSize: "0.9rem" }}>
                                            {user.subscription ? planNames[user.subscription.plan] || user.subscription.plan : "—"}
                                        </td>
                                        <td style={{ padding: "14px 20px" }}>
                                            <span
                                                style={{
                                                    padding: "3px 10px",
                                                    borderRadius: 20,
                                                    fontSize: "0.8rem",
                                                    fontWeight: 600,
                                                    background: user.subscription?.status === "ACTIVE" ? "rgba(16,185,129,0.1)" : "rgba(100,116,139,0.1)",
                                                    color: user.subscription?.status === "ACTIVE" ? "var(--accent-green)" : "#64748B",
                                                }}
                                            >
                                                {user.subscription?.status === "ACTIVE" ? "Activo" : "Inactivo"}
                                            </span>
                                        </td>
                                        <td style={{ padding: "14px 20px", color: "#64748B", fontSize: "0.85rem" }}>
                                            {new Date(user.createdAt).toLocaleDateString("es-DO")}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "16px 20px",
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    <span style={{ color: "#64748B", fontSize: "0.85rem" }}>
                        Página {page} de {totalPages}
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="btn-secondary"
                            style={{ padding: "6px 12px", opacity: page <= 1 ? 0.4 : 1 }}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="btn-secondary"
                            style={{ padding: "6px 12px", opacity: page >= totalPages ? 0.4 : 1 }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
