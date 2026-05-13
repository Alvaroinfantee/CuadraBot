import type { Locale } from "@/lib/i18n"

export type GalleryExample = {
  title: string
  category: string
  description: string
  image: string
}

export const galleryExamples = {
  en: [
    {
      title: "Mediterranean villa exterior",
      category: "Exterior",
      description:
        "Elevation and floor plan inputs translated into a warm, polished residential exterior.",
      image: "/images/gallery-mediterranean-villa.png",
    },
    {
      title: "Warm interior renovation",
      category: "Interior",
      description:
        "A living room plan and elevation turned into a finished material and lighting concept.",
      image: "/images/gallery-interior-renovation.png",
    },
    {
      title: "Multi-unit development",
      category: "Site / Massing",
      description:
        "Site plan and massing sketch converted into a presentation-ready development view.",
      image: "/images/gallery-multi-unit-development.png",
    },
  ],
  es: [
    {
      title: "Villa mediterránea moderna",
      category: "Exterior",
      description:
        "Planta y elevación convertidas en una fachada residencial cálida y pulida.",
      image: "/images/gallery-mediterranean-villa.png",
    },
    {
      title: "Renovación interior cálida",
      category: "Interior",
      description:
        "Plano y elevación de sala transformados en una propuesta terminada de materiales e iluminación.",
      image: "/images/gallery-interior-renovation.png",
    },
    {
      title: "Desarrollo residencial compacto",
      category: "Sitio / Volumen",
      description:
        "Plano de conjunto y masa inicial convertidos en una vista lista para presentación.",
      image: "/images/gallery-multi-unit-development.png",
    },
  ],
} satisfies Record<Locale, GalleryExample[]>
