import { LegalPage } from "@/components/takeoff/legal-page"

export const metadata = { title: "Confidencialidad" }
export default function ConfidentialityPage() { return <LegalPage eyebrow="Planos privados" title="Compromiso de confidencialidad" intro="Los documentos de construccion contienen informacion sensible. El producto se disena para que no sean publicos ni se mezclen entre clientes." sections={[
  { title: "Controles obligatorios de producción", bullets: ["HTTPS, cifrado en tránsito y en reposo cuando el proveedor lo soporte.", "Almacenamiento privado y descargas mediante enlaces firmados de corta duración.", "Aislamiento por proyecto, autenticación de administrador y rol verificado en el servidor.", "Registro de descargas y cambios de estado, y sesiones con caducidad.", "Sin contenido de archivos en logs y sin secretos en el código o navegador."] },
  { title: "Acceso humano", paragraphs: ["Solo el personal asignado que necesita medir o revisar el pedido accede a los planos. Las notas internas nunca son visibles al cliente."] },
  { title: "Eliminación", paragraphs: ["La conservación predeterminada es de 90 días después de la entrega final. El cliente puede solicitar una eliminación anticipada escribiendo a privacidad@cuadrabot.com."] },
]}/> }
