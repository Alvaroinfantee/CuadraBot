import { LegalPage } from "@/components/takeoff/legal-page"

export const metadata = { title: "Alcance y exclusiones" }
export default function ScopePage() { return <LegalPage eyebrow="Producto estandar" title="Alcance y exclusiones" intro="El cliente compra cantidades revisadas y evidencia marcada, no un presupuesto completo de construccion." sections={[
  { title: "Incluido", bullets: ["Un proyecto, hasta 20 hojas seleccionadas, tabiques y techos de placa de yeso.", "Cantidades por planta, plano y tipo; Excel, PDF marcado y una correccion.", "Longitud de eje, areas a una y dos caras, huecos y perimetros de techo cuando corresponda."] },
  { title: "No incluido", bullets: ["Precios, mano de obra, proveedores o listas completas de compra.", "Montantes, tornillos, canales, pasta, accesorios o aislamiento.", "Demolicion, estructura, fabrica, suelos, pintura, MEP, BIM, IFC, CAD, diseno o verificacion de obra.", "Cambios posteriores, superficies curvas o complejas salvo aceptacion manual."] },
  { title: "Politica de medicion PLADUR-ES-1.0", bullets: ["Longitud al eje y altura desde cuadro, seccion o valor indicado por el cliente.", "Huecos acotados deducidos del area, mantenidos en longitud y registrados aparte.", "Tipos separados; revisiones contradictorias se marcan, no se combinan.", "Longitudes y areas se muestran a dos decimales conservando precision interna.", "No se entrega una cantidad sin fuente identificable."] },
]}/> }
