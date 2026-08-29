import { LegalPage } from "@/components/takeoff/legal-page"

export const metadata = { title: "Privacidad", alternates: { canonical: "/privacidad", languages: { es: "/privacidad", en: "/en/privacy" } } }
export default function PrivacyPage() { return <LegalPage eyebrow="Datos personales" title="Politica de privacidad" intro="Tratamos solo los datos necesarios para crear, cobrar, ejecutar y entregar tu pedido, atender correcciones y medir la eficacia de nuestras campanas." sections={[
  { title: "Datos tratados", bullets: ["Email profesional, empresa, proyecto, ubicacion y respuestas de alcance.", "Datos de facturacion y estado del pago gestionados por la pasarela segura.", "Atribucion: gclid, UTM, ruta, referencia, sesion, fecha, dispositivo y pais.", "Mensajes, historial de estado, auditoria y solicitudes de correccion o eliminacion."] },
  { title: "Finalidades y base", paragraphs: ["Usamos los datos para ejecutar el contrato, cumplir obligaciones legales, proteger el servicio y, con la configuración de consentimiento aplicable, medir conversiones de Google Ads."] },
  { title: "Conservación", paragraphs: ["Los planos y entregables se eliminan por defecto 90 días después de la entrega final, salvo una obligación legal, una incidencia abierta o una solicitud anterior. Los registros fiscales se conservan durante los plazos legales."] },
  { title: "Derechos", paragraphs: ["Puedes solicitar acceso, rectificación, supresión, limitación u oposición escribiendo a privacidad@cuadrabot.com."] },
]}/> }
