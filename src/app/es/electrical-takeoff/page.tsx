import { TradeLanding } from "@/components/site/trade-landing"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "es",
  path: "/electrical-takeoff",
  title: "Medición de elementos eléctricos desde planos PDF",
  description:
    "Cuenta en horas luminarias y dispositivos eléctricos codificados en leyendas de planos PDF, con evidencias marcadas y cantidades en Excel.",
  keywords: [
    "medición de instalaciones eléctricas",
    "conteo de luminarias en planos",
    "conteo de símbolos eléctricos",
    "medición eléctrica PDF",
  ],
})

export default function ElectricalTakeoffPageEs() {
  return (
    <TradeLanding
      locale="es"
      eyebrow="Equipos eléctricos y luminarias"
      title="Recuentos de elementos eléctricos que siguen vinculados al plano."
      body="Relaciona leyendas eléctricas legibles con luminarias, dispositivos, equipos y otros símbolos instalados compatibles, conservando cada ubicación contada para su revisión."
      measured={[
        "Luminarias, dispositivos eléctricos y equipos compatibles codificados en la leyenda.",
        "Código visible, descripción, plano, zona, nivel y coordenadas de origen para cada unidad.",
        "Totales conciliados por código y ubicación, excluyendo ejemplos de leyenda y vistas de referencia duplicadas.",
        "PDF de origen anotado, libro de Excel, metodología, nivel de confianza y supuestos.",
      ]}
      assumptions={[
        "Confirma la leyenda eléctrica, los cuadros, las revisiones del plano, las adendas y las alternativas aplicables.",
        "Indica si se incluyen demoliciones, elementos existentes que permanecen, trabajos provisionales y equipos aportados por el cliente.",
        "Los símbolos sin resolver, contradictorios o ilegibles se indican como limitaciones en lugar de asignarles un código sin fundamento.",
      ]}
    />
  )
}
