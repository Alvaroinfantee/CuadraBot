import { TradeLanding } from "@/components/site/trade-landing"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "es",
  path: "/door-window-takeoff",
  title: "Medición de puertas y ventanas",
  description:
    "Recuentos autoservicio de puertas, ventanas y huecos a partir de planos PDF a escala.",
})

export default function DoorWindowTakeoffPageEs() {
  return (
    <TradeLanding
      locale="es"
      eyebrow="Puertas, ventanas y huecos"
      title="Recuentos de huecos con etiquetas de tipo y ubicaciones visibles."
      body="Identifica puertas, ventanas y tipos de hueco admitidos en los planos, conservando la página, la etiqueta visible, la ubicación y las evidencias necesarias para conciliar los cuadros."
      measured={[
        "Recuentos por tipo visible de puerta, ventana o hueco aprobado.",
        "Página, nivel, zona, etiqueta visible y coordenadas en el plano para cada unidad.",
        "Identificadores estables para conciliar el PDF marcado con el libro de cálculo.",
        "PDF de origen marcado, libro de Excel, metodología, nivel de confianza y supuestos.",
      ]}
      assumptions={[
        "Confirma en cuadros y especificaciones los herrajes, marcos, vidrios, clasificaciones, acabados y accesorios.",
        "Confirma si los escaparates, muros cortina, lamas, vidrios interiores y conjuntos especiales están incluidos.",
        "Concilia las etiquetas de planta, los alzados, los cuadros, las adendas y las alternativas antes de comprar o cerrar la oferta.",
      ]}
    />
  )
}
