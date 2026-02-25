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

export const PLANS = {
    basico: {
        name: "Básico",
        description: "Ideal para freelancers y negocios pequeños",
        price: 29,
        currency: "USD",
        priceId: process.env.STRIPE_PRICE_BASICO!,
        features: [
            "1 empresa",
            "Reportes fiscales básicos",
            "Soporte por email",
            "Actualizaciones mensuales",
        ],
    },
    profesional: {
        name: "Profesional",
        description: "Para contadores y firmas en crecimiento",
        price: 59,
        currency: "USD",
        priceId: process.env.STRIPE_PRICE_PROFESIONAL!,
        features: [
            "Hasta 5 empresas",
            "Reportes fiscales completos",
            "Soporte prioritario",
            "Actualizaciones semanales",
            "Exportación avanzada",
        ],
        popular: true,
    },
    empresarial: {
        name: "Empresarial",
        description: "Para grandes firmas y corporaciones",
        price: 99,
        currency: "USD",
        priceId: process.env.STRIPE_PRICE_EMPRESARIAL!,
        features: [
            "Empresas ilimitadas",
            "Reportes fiscales completos",
            "Soporte 24/7",
            "Actualizaciones en tiempo real",
            "API de integración",
            "Gestor de cuenta dedicado",
        ],
    },
} as const;

export type PlanKey = keyof typeof PLANS;

