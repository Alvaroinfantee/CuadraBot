import { ImageResponse } from "next/og"

export const alt =
  "Cuadrabot: mediciones de obra autoservicio con planos marcados"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background: "#f5f7fa",
        color: "#0b1f3a",
        display: "flex",
        fontFamily: "sans-serif",
        height: "100%",
        padding: "56px",
        width: "100%",
      }}
    >
      <div
        style={{
          border: "2px solid #0b1f3a",
          display: "flex",
          flex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "52px",
          }}
        >
          <div
            style={{
              color: "#2563eb",
              display: "flex",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 3,
            }}
          >
            CUADRABOT
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: 62,
                fontWeight: 700,
                letterSpacing: -2,
                lineHeight: 1.05,
                maxWidth: 690,
              }}
            >
              Mediciones de obra autoservicio en horas.
            </div>
            <div
              style={{
                color: "#526071",
                display: "flex",
                fontSize: 25,
                lineHeight: 1.4,
                marginTop: 28,
              }}
            >
              Sube planos. Elige una especialidad. Descarga el PDF marcado y las
              cantidades en Excel.
            </div>
          </div>
        </div>
        <div
          style={{
            background: "#0b1f3a",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "44px",
            width: 340,
          }}
        >
          <div
            style={{
              border: "2px solid #60a5fa",
              display: "flex",
              flex: 1,
              flexDirection: "column",
              padding: 28,
            }}
          >
            <div
              style={{
                borderBottom: "2px solid #60a5fa",
                color: "#bfdbfe",
                display: "flex",
                fontSize: 18,
                paddingBottom: 18,
              }}
            >
              A-201 · PLANO
            </div>
            <div
              style={{
                border: "2px solid #60a5fa",
                display: "flex",
                flex: 1,
                marginTop: 28,
                position: "relative",
              }}
            >
              <div
                style={{
                  background: "#2563eb",
                  color: "white",
                  display: "flex",
                  fontSize: 18,
                  left: 20,
                  padding: "9px 12px",
                  position: "absolute",
                  top: 30,
                }}
              >
                FL-03 · 42,6 m²
              </div>
              <div
                style={{
                  background: "#059669",
                  bottom: 34,
                  color: "white",
                  display: "flex",
                  fontSize: 18,
                  padding: "9px 12px",
                  position: "absolute",
                  right: 20,
                }}
              >
                D-02 · 3 uds.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    size
  )
}
