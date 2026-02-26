import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { hasActiveSubscription: false },
                { status: 200 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { subscription: true },
        });

        const hasActiveSubscription =
            user?.subscription?.status === "ACTIVE" ||
            user?.subscription?.status === "TRIALING";

        return NextResponse.json({ hasActiveSubscription });
    } catch (error) {
        console.error("Subscription status error:", error);
        return NextResponse.json(
            { hasActiveSubscription: false },
            { status: 200 }
        );
    }
}
