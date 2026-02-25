import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPeriodDates(subscription: any) {
    const start = subscription.current_period_start;
    const end = subscription.current_period_end;
    return {
        currentPeriodStart: start ? new Date(start * 1000) : new Date(),
        currentPeriodEnd: end ? new Date(end * 1000) : new Date(),
    };
}

export async function POST(req: Request) {
    const body = await req.text();
    const headersList = await headers();
    const sig = headersList.get("stripe-signature")!;

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return NextResponse.json(
            { error: "Webhook signature verification failed" },
            { status: 400 }
        );
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const session = event.data.object as any;
                const userId = session.metadata?.userId;
                const planKey = session.metadata?.planKey || "basico";
                const subscriptionId = session.subscription as string;

                if (userId && subscriptionId) {
                    const subscription =
                        await stripe.subscriptions.retrieve(subscriptionId);
                    const periods = getPeriodDates(subscription);

                    await prisma.subscription.upsert({
                        where: { userId },
                        create: {
                            userId,
                            stripeSubscriptionId: subscriptionId,
                            stripePriceId: subscription.items.data[0]?.price.id,
                            plan: planKey,
                            status: "ACTIVE",
                            ...periods,
                        },
                        update: {
                            stripeSubscriptionId: subscriptionId,
                            stripePriceId: subscription.items.data[0]?.price.id,
                            plan: planKey,
                            status: "ACTIVE",
                            ...periods,
                        },
                    });
                }
                break;
            }

            case "invoice.paid": {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const invoice = event.data.object as any;
                const subscriptionId = invoice.subscription as string;

                if (subscriptionId) {
                    const subscription =
                        await stripe.subscriptions.retrieve(subscriptionId);
                    const periods = getPeriodDates(subscription);

                    await prisma.subscription.updateMany({
                        where: { stripeSubscriptionId: subscriptionId },
                        data: {
                            status: "ACTIVE",
                            ...periods,
                        },
                    });
                }
                break;
            }

            case "customer.subscription.updated": {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const subscription = event.data.object as any;
                const periods = getPeriodDates(subscription);

                const statusMap: Record<string, string> = {
                    active: "ACTIVE",
                    past_due: "PAST_DUE",
                    canceled: "CANCELLED",
                    trialing: "TRIALING",
                    incomplete: "INCOMPLETE",
                };

                await prisma.subscription.updateMany({
                    where: { stripeSubscriptionId: subscription.id },
                    data: {
                        status:
                            (statusMap[subscription.status] as
                                | "ACTIVE"
                                | "CANCELLED"
                                | "PAST_DUE"
                                | "TRIALING"
                                | "INCOMPLETE") || "INCOMPLETE",
                        cancelAtPeriodEnd: subscription.cancel_at_period_end,
                        currentPeriodEnd: periods.currentPeriodEnd,
                    },
                });
                break;
            }

            case "customer.subscription.deleted": {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const subscription = event.data.object as any;

                await prisma.subscription.updateMany({
                    where: { stripeSubscriptionId: subscription.id },
                    data: {
                        status: "CANCELLED",
                        cancelAtPeriodEnd: false,
                    },
                });
                break;
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("Webhook handler error:", error);
        return NextResponse.json(
            { error: "Webhook handler error" },
            { status: 500 }
        );
    }
}
