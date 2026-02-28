import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripeInstance(): Stripe {
    if (!_stripe) {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error("STRIPE_SECRET_KEY environment variable is not set");
        }
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
    return _stripe;
}

// Use this in API routes — lazily initialized at runtime
export const stripe = {
    get customers() { return getStripeInstance().customers; },
    get checkout() { return getStripeInstance().checkout; },
    get subscriptions() { return getStripeInstance().subscriptions; },
    get webhooks() { return getStripeInstance().webhooks; },
    get prices() { return getStripeInstance().prices; },
    get products() { return getStripeInstance().products; },
    get invoices() { return getStripeInstance().invoices; },
} as unknown as Stripe;

export const PLAN = {
    key: "pro",
    name: "CuadraBot Pro",
    description: "Acceso completo a la plataforma de contabilidad inteligente",
    price: 30,
    currency: "USD",
    trialDays: 2, // 48 hours
    priceId: process.env.STRIPE_PRICE_PRO!,
    features: [
        "Empresas ilimitadas",
        "Todos los reportes fiscales DGII",
        "Clasificación con IA",
        "Exportación de reportes",
        "Soporte prioritario",
        "Actualizaciones continuas",
    ],
} as const;

// Keep backwards-compatible PLANS export for any code that references it
export const PLANS = {
    pro: PLAN,
} as const;

export type PlanKey = keyof typeof PLANS;
