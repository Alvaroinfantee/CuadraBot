import { LegalPage } from "@/components/takeoff/legal-page"

export const metadata = { title: "Reembolsos", alternates: { canonical: "/reembolsos", languages: { es: "/reembolsos", en: "/en/refunds" } } }
export default function RefundPage() { return <LegalPage eyebrow="Pago unico" title="Politica de reembolso" intro="Queremos que el tratamiento del pago sea claro antes de empezar una medicion." sections={[
  { title: "Antes de iniciar el trabajo", paragraphs: ["Si cancelas antes de que comience la revision inicial, podemos emitir un reembolso total. El portal mostrara el estado actualizado cuando el proveedor de pagos confirme la operacion."] },
  { title: "Proyecto fuera de alcance", paragraphs: ["Si tras el pago determinamos que el proyecto no encaja en el alcance estandar y no aceptas una alternativa, emitiremos un reembolso total."] },
  { title: "Despues de iniciar", paragraphs: ["Primero aplicamos la correccion incluida a errores sobre los planos originales. Esto no limita los derechos legales del consumidor o cliente que resulten aplicables."] },
  { title: "Como solicitarlo", paragraphs: ["Escribe a soporte@cuadrabot.com indicando el numero de pedido. Los reembolsos se devuelven al medio de pago original y quedan registrados de forma auditable."] },
]}/> }
