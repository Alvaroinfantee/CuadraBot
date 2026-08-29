import { TakeoffLanding } from "@/components/takeoff/takeoff-landing"

export const metadata = {
  alternates: {
    canonical: "/",
    languages: { es: "/", en: "/en", "x-default": "/" },
  },
}

export default function HomePage() {
  return <TakeoffLanding locale="es" />
}
