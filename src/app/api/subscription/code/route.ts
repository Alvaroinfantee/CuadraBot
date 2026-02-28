import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_CODES = [
    "CUADRA-PRO-9X2F",
    "CUADRA-PRO-M4K7",
    "CUADRA-PRO-8V1N",
    "CUADRA-PRO-T6L3",
    "CUADRA-PRO-P9W2",
    "CUADRA-PRO-J5D8",
    "CUADRA-PRO-R2H6",
    "CUADRA-PRO-C7B4",
    "CUADRA-PRO-E3Y9",
    "CUADRA-PRO-A1G5"
];

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { code } = await req.json();

        if (!code || typeof code !== "string") {
            return NextResponse.json({ error: "Código inválido" }, { status: 400 });
        }

        const upperCode = code.trim().toUpperCase();

        if (!VALID_CODES.includes(upperCode)) {
            return NextResponse.json({ error: "Este código no es válido" }, { status: 400 });
        }

        const userId = session.user.id;

        // Gran 1 year of access
        const now = new Date();
        const nextYear = new Date();
        nextYear.setFullYear(now.getFullYear() + 1);

        await prisma.subscription.upsert({
            where: { userId },
            create: {
                userId,
                plan: "pro",
                status: "ACTIVE",
                currentPeriodStart: now,
                currentPeriodEnd: nextYear,
            },
            update: {
                plan: "pro",
                status: "ACTIVE",
                currentPeriodStart: now,
                currentPeriodEnd: nextYear,
            },
        });

        // Update the user's role to admin/pro if needed, or just let the subscription guard handle it
        return NextResponse.json({
            success: true,
            message: "Suscripción activada con éxito",
            url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard`
        });

    } catch (error) {
        console.error("Code validation error:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
