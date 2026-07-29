import { TradeLanding } from "@/components/site/trade-landing"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "es",
  path: "/drywall-takeoff",
  title: "Medición de tabiquería y techos",
  description:
    "Cantidades autoservicio de tabiquería, placas de yeso y techos a partir de planos PDF a escala.",
})

export default function DrywallTakeoffPageEs() {
  return (
    <TradeLanding
      locale="es"
      eyebrow="Tabiquería, placas de yeso y techos"
      title="Cantidades de particiones y techos que siguen vinculadas al plano."
      body="Mide recorridos visibles de particiones y superficies de techo conservando el tipo de muro, la zona, el plano y el nivel de confianza para su revisión."
      measured={[
        "Longitudes de particiones por tipo visible, nivel, plano y zona.",
        "Superficies de techo y códigos visibles de techo dentro del alcance aprobado.",
        "Identificadores estables y coordenadas visibles en el PDF para cada cantidad admitida.",
        "PDF de origen marcado, libro de Excel, metodología, nivel de confianza y supuestos.",
      ]}
      assumptions={[
        "Confirma en cuadros y secciones las alturas, capas, tipos de placa, cerramientos de patinillos, resistencia al fuego, aislamiento y calibres de perfilería.",
        "Confirma por separado los cajones, falsos techos, muros curvos, registros, elementos suspendidos y sistemas especiales de techo.",
        "Concilia los planos de techos reflejados, las plantas de particiones, los detalles, las alternativas y las adendas antes de cerrar el precio.",
      ]}
    />
  )
}
