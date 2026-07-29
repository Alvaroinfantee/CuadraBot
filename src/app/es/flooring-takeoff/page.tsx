import { TradeLanding } from "@/components/site/trade-landing"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "es",
  path: "/flooring-takeoff",
  title: "Medición de suelos y acabados",
  description:
    "Cantidades autoservicio de suelos y acabados a partir de planos PDF a escala.",
})

export default function FlooringTakeoffPageEs() {
  return (
    <TradeLanding
      locale="es"
      eyebrow="Suelos y acabados"
      title="Mediciones de suelos con evidencias por estancia vinculadas al plano."
      body="Convierte planos de acabados y plantas a escala en superficies marcadas, perímetros, códigos y cantidades estructuradas que tu equipo de estimación pueda revisar."
      measured={[
        "Superficies de acabado por código visible, estancia, zona, nivel y plano.",
        "Perímetros o longitudes cuando estén incluidos en el alcance aprobado.",
        "Identificadores estables y coordenadas visibles en el PDF para cada cantidad admitida.",
        "PDF de origen marcado, libro de Excel, metodología, nivel de confianza y supuestos.",
      ]}
      assumptions={[
        "Confirma si el desperdicio, el material de reserva, los umbrales, las transiciones, los rodapiés y los remates forman parte de la cantidad ofertada.",
        "Confirma por separado las demoliciones, la preparación, la nivelación, la mitigación de humedad y los trabajos sobre el soporte.",
        "Concilia las leyendas de acabados, los cuadros por estancia, las alternativas y las adendas con el conjunto completo de documentos contractuales.",
      ]}
    />
  )
}
