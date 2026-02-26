import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, PLAN } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { subscription: true },
        });

        if (!user) {
            return NextResponse.json(
                { error: "Usuario no encontrado" },
                { status: 404 }
            );
        }

        // If user already has an active subscription, redirect to dashboard
        if (
            user.subscription?.status === "ACTIVE" ||
            user.subscription?.status === "TRIALING"
        ) {
            return NextResponse.json({
                url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
            });
        }

        let customerId = user.stripeCustomerId;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.name || undefined,
            });
            customerId = customer.id;
            await prisma.user.update({
                where: { id: user.id },
                data: { stripeCustomerId: customerId },
            });
        }

        const checkoutSession = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [
                {
                    price: PLAN.priceId,
                    quantity: 1,
                },
            ],
            subscription_data: {
                trial_period_days: PLAN.trialDays,
            },
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/precios?cancelled=true`,
            metadata: {
                userId: user.id,
                planKey: PLAN.key,
            },
        });

        return NextResponse.json({ url: checkoutSession.url });
    } catch (error) {
        console.error("Checkout error:", error);
        const message =
            error instanceof Error ? error.message : "Error al crear la sesión de pago";
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
