import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
    if (!_stripe) {
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    }
    return _stripe;
}

// Lazy proxy: stripe.xxx() calls are forwarded to the real instance at runtime
export const stripe = new Proxy({} as Stripe, {
    get(_target, prop, receiver) {
        const instance = getStripe();
        const value = Reflect.get(instance, prop, receiver);
        if (typeof value === "function") {
            return value.bind(instance);
        }
        return value;
    },
});

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
