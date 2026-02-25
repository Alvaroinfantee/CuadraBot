import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

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
                const session = event.data.object;
                const userId = session.metadata?.userId;
                const planKey = session.metadata?.planKey || "basico";
                const subscriptionId = session.subscription as string;

                if (userId && subscriptionId) {
                    const subscription =
                        (await stripe.subscriptions.retrieve(subscriptionId)) as Stripe.Subscription;
                    const primaryItem = subscription.items.data[0];
                    const currentPeriodStart = new Date(
                        (primaryItem?.current_period_start ?? subscription.billing_cycle_anchor) * 1000
                    );
                    const currentPeriodEnd = new Date(
                        (primaryItem?.current_period_end ?? subscription.billing_cycle_anchor) * 1000
                    );

                    await prisma.subscription.upsert({
                        where: { userId },
                        create: {
                            userId,
                            stripeSubscriptionId: subscriptionId,
                            stripePriceId: subscription.items.data[0]?.price.id,
                            plan: planKey,
                            status: "ACTIVE",
                            currentPeriodStart,
                            currentPeriodEnd,
                        },
                        update: {
                            stripeSubscriptionId: subscriptionId,
                            stripePriceId: subscription.items.data[0]?.price.id,
                            plan: planKey,
                            status: "ACTIVE",
                            currentPeriodStart,
                            currentPeriodEnd,
                        },
                    });
                }
                break;
            }

            case "invoice.paid": {
                const invoice = event.data.object as Stripe.Invoice;
                const subscriptionRef = invoice.parent?.subscription_details?.subscription;
                const subscriptionId =
                    typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;

                if (subscriptionId) {
                    const subscription =
                        (await stripe.subscriptions.retrieve(subscriptionId)) as Stripe.Subscription;
                    const primaryItem = subscription.items.data[0];

                    await prisma.subscription.updateMany({
                        where: { stripeSubscriptionId: subscriptionId },
                        data: {
                            status: "ACTIVE",
                            currentPeriodStart: new Date(
                                (primaryItem?.current_period_start ?? subscription.billing_cycle_anchor) * 1000
                            ),
                            currentPeriodEnd: new Date(
                                (primaryItem?.current_period_end ?? subscription.billing_cycle_anchor) * 1000
                            ),
                        },
                    });
                }
                break;
            }

            case "customer.subscription.updated": {
                const subscription = event.data.object;

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
                        currentPeriodEnd: new Date(
                            (subscription.items.data[0]?.current_period_end ?? subscription.billing_cycle_anchor) *
                                1000
                        ),
                    },
                });
                break;
            }

            case "customer.subscription.deleted": {
                const subscription = event.data.object;

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
