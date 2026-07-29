import { TradeLanding } from "@/components/site/trade-landing"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "es",
  path: "/fixture-takeoff",
  title: "Conteo de elementos desde leyendas de planos PDF",
  description:
    "Recuentos autoservicio de elementos y dispositivos desde leyendas legibles de planos PDF, entregados en horas con evidencias trazables.",
  keywords: [
    "conteo de elementos en planos",
    "conteo de símbolos PDF",
    "medición basada en leyenda",
    "cuantificación de dispositivos",
  ],
})

export default function FixtureTakeoffPageEs() {
  return (
    <TradeLanding
      locale="es"
      eyebrow="Medición de elementos y dispositivos"
      title="Convierte una leyenda legible del PDF en recuentos vinculados al plano."
      body="Cuadrabot utiliza la leyenda o el cuadro aplicable como catálogo, relaciona códigos y símbolos compatibles en las hojas válidas y registra cada ubicación instalada sin contar como unidades los ejemplos de la propia leyenda."
      measured={[
        "Ubicaciones de elementos y dispositivos agrupadas por código visible y descripción de la leyenda.",
        "Identificadores estables con página, plano, zona, nivel, confianza y geometría visible en el PDF.",
        "Totales conciliados por código, zona, página y planta; los símbolos ambiguos o sin resolver se señalan, no se adivinan.",
        "PDF de origen anotado, libro de Excel, metodología, nivel de confianza y supuestos.",
      ]}
      assumptions={[
        "Aporta una leyenda o cuadro legible que defina los códigos o símbolos incluidos.",
        "Indica los códigos, zonas, niveles, demoliciones, alternativas y vistas repetidas que se deben incluir o excluir.",
        "Cuadrabot no cuenta como instalaciones los ejemplos de la leyenda, las filas de cuadros, las plantas clave ni las vistas de referencia repetidas.",
      ]}
    />
  )
}
