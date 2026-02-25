import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-12-18.acacia",
    typescript: true,
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
