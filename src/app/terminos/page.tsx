import { LegalPage } from "@/components/takeoff/legal-page"

export const metadata = { title: "Terminos del servicio" }
export default function TermsPage() { return <LegalPage eyebrow="Condiciones" title="Terminos del servicio de medicion" intro="Cuadrabot entrega cantidades de pladur trazables a partir de los documentos facilitados por el cliente. Este texto define el servicio estandar de 149 € + IVA." sections={[
  { title: "Servicio contratado", bullets: ["Un proyecto y hasta 20 hojas PDF seleccionadas.", "Tabiques de pladur y techos de placa cuando existan planos de techo.", "Excel de cantidades, PDF marcado, supuestos, exclusiones y una correccion.", "Compromiso de dos dias laborables desde pago e informacion completa."] },
  { title: "Responsabilidad del cliente", paragraphs: ["El cliente confirma que puede compartir los planos, identifica la revision aplicable y responde con diligencia a las aclaraciones. Debe comprobar las cantidades antes de comprar materiales o presentar una oferta vinculante."] },
  { title: "Supuestos, aclaraciones y plazo", paragraphs: ["Las condiciones desconocidas se registran como supuesto o pregunta. El plazo puede pausarse mientras Cuadrabot espera una aclaracion; el portal lo mostrara de forma expresa."] },
  { title: "Correccion incluida", paragraphs: ["La correccion cubre errores relacionados con los planos originales. Nuevas revisiones, planos o ampliaciones requieren otro pedido o presupuesto."] },
  { title: "Limites", paragraphs: ["No se verifican condiciones de obra. El lenguaje de comprobacion no reduce la obligacion de Cuadrabot de entregar un resultado revisado, coherente y trazable."] },
]}/> }
