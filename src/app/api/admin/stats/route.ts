import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }

        const [totalUsers, activeSubscriptions, recentUsers, subscriptionsByPlan] =
            await Promise.all([
                prisma.user.count(),
                prisma.subscription.count({ where: { status: "ACTIVE" } }),
                prisma.user.findMany({
                    take: 10,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        createdAt: true,
                        subscription: {
                            select: { plan: true, status: true },
                        },
                    },
                }),
                prisma.subscription.groupBy({
                    by: ["plan"],
                    _count: { plan: true },
                    where: { status: "ACTIVE" },
                }),
            ]);

        return NextResponse.json({
            totalUsers,
            activeSubscriptions,
            recentUsers,
            subscriptionsByPlan,
        });
    } catch (error) {
        console.error("Admin stats error:", error);
        return NextResponse.json(
            { error: "Error al obtener estadísticas" },
            { status: 500 }
        );
    }
}
