import { TradeLanding } from "@/components/site/trade-landing"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "es",
  path: "/cable-takeoff",
  title: "Medición de cables y canalizaciones desde planos PDF",
  description:
    "Mediciones autoservicio de cables y canalizaciones cuando el PDF muestra la ruta, indica la escala y contiene códigos de leyenda legibles.",
  keywords: [
    "medición de cableado",
    "medición de canalizaciones",
    "longitud de cable en planos PDF",
    "medición por leyenda",
  ],
})

export default function CableTakeoffPageEs() {
  return (
    <TradeLanding
      locale="es"
      eyebrow="Recorridos de cables y canalizaciones"
      title="Cantidades trazables solo cuando el plano muestra la ruta y la escala."
      body="Cuadrabot puede cuantificar recorridos compatibles de cables y canalizaciones cuando la ruta está dibujada de forma visible, la leyenda aplicable es legible y la hoja indica una escala utilizable. Lo que no pueda resolverse se señala, no se adivina."
      measured={[
        "Recorridos visibles compatibles agrupados por código de leyenda, sistema, zona, nivel y plano.",
        "Evidencias de ruta vinculadas al origen y cantidades solo cuando la ruta y la escala indicada permiten medirlas.",
        "Totales conciliados por código y zona, con extremos, ramales o escalas ambiguos indicados como limitaciones.",
        "PDF de origen anotado, libro de Excel, metodología, nivel de confianza y supuestos.",
      ]}
      assumptions={[
        "Para medir recorridos se necesita una ruta visible, una leyenda o cuadro legible y una escala indicada en el plano.",
        "Confirma por separado tolerancias de trazado, subidas verticales, holguras, bucles, terminaciones, desperdicio y condiciones ocultas.",
        "Los diagramas unifilares, montantes, enlaces esquemáticos y símbolos sin geometría de ruta defendible no se convierten en longitudes mediante supuestos.",
      ]}
    />
  )
}
