import { TakeoffLanding } from "@/components/takeoff/takeoff-landing"

export const metadata = {
  alternates: {
    canonical: "/",
    languages: { es: "/", "x-default": "/" },
  },
}

export default function HomePage() {
  return <TakeoffLanding />
}
