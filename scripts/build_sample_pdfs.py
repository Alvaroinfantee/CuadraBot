from pathlib import Path
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

OUT = Path("output/pdf")
OUT.mkdir(parents=True, exist_ok=True)
PAGE = landscape(A3)

INK = HexColor("#243A45")
PALE = HexColor("#E7ECEF")
RED = HexColor("#F05A4F")
GREEN = HexColor("#05A783")
BLUE = HexColor("#316CF4")
ORANGE = HexColor("#FFB020")


def base_plan(c: canvas.Canvas, marked: bool) -> None:
    width, height = PAGE
    c.setTitle("Cuadrabot - Plano marcado de muestra" if marked else "Cuadrabot - Plano original de muestra")
    c.setAuthor("Cuadrabot")
    c.setFillColor(HexColor("#FFFFFF"))
    c.rect(0, 0, width, height, fill=1, stroke=0)

    c.setStrokeColor(PALE)
    c.setLineWidth(0.3)
    for x in range(25, int(width), 25):
        c.line(x, 40, x, height - 40)
    for y in range(40, int(height), 25):
        c.line(25, y, width - 25, y)

    x0, y0, w, h = 95, 125, 810, 560
    c.setStrokeColor(INK)
    c.setLineWidth(3)
    c.rect(x0, y0, w, h, fill=0, stroke=1)
    c.setLineWidth(1.6)
    walls = [
        ((x0 + 300, y0), (x0 + 300, y0 + h)),
        ((x0, y0 + 265), (x0 + 540, y0 + 265)),
        ((x0 + 540, y0), (x0 + 540, y0 + 265)),
        ((x0 + 300, y0 + 360), (x0 + w, y0 + 360)),
        ((x0 + 660, y0 + 360), (x0 + 660, y0 + h)),
    ]
    for start, end in walls:
        c.line(start[0], start[1], end[0], end[1])

    c.setFont("Helvetica", 10)
    c.setFillColor(INK)
    labels = [
        (x0 + 110, y0 + 410, "SALA DE REUNIONES 01"),
        (x0 + 400, y0 + 445, "OFICINA ABIERTA 02"),
        (x0 + 80, y0 + 120, "RECEPCION"),
        (x0 + 360, y0 + 135, "DISTRIBUIDOR"),
        (x0 + 640, y0 + 150, "ARCHIVO"),
    ]
    for x, y, label in labels:
        c.drawString(x, y, label)

    # Dimension strings and openings.
    c.setStrokeColor(HexColor("#7D8B92"))
    c.setLineWidth(0.7)
    c.line(x0, y0 - 28, x0 + w, y0 - 28)
    c.line(x0, y0 - 34, x0, y0 - 20)
    c.line(x0 + w, y0 - 34, x0 + w, y0 - 20)
    c.setFont("Helvetica", 8)
    c.drawCentredString(x0 + w / 2, y0 - 24, "24.80 m")
    c.setStrokeColor(HexColor("#FFFFFF"))
    c.setLineWidth(7)
    c.line(x0 + 125, y0, x0 + 190, y0)
    c.line(x0 + 300, y0 + 105, x0 + 300, y0 + 165)
    c.setStrokeColor(INK)
    c.setLineWidth(1)
    c.arc(x0 + 125, y0, x0 + 255, y0 + 130, 0, 90)
    c.arc(x0 + 300 - 65, y0 + 105, x0 + 300 + 65, y0 + 235, 90, 90)

    if marked:
        overlays = [
            (RED, (x0, y0 + h), (x0 + w, y0 + h), "P-001", x0 + 170, y0 + h + 13),
            (GREEN, (x0 + 300, y0), (x0 + 300, y0 + h), "P-002", x0 + 312, y0 + 460),
            (BLUE, (x0, y0 + 265), (x0 + 540, y0 + 265), "P-003", x0 + 210, y0 + 278),
            (ORANGE, (x0 + 540, y0), (x0 + 540, y0 + 265), "C-001", x0 + 552, y0 + 105),
        ]
        for color, start, end, identifier, lx, ly in overlays:
            c.setStrokeColor(color)
            c.setLineWidth(8)
            c.line(start[0], start[1], end[0], end[1])
            c.setFillColor(color)
            label_width = stringWidth(identifier, "Helvetica-Bold", 9) + 12
            c.roundRect(lx, ly, label_width, 17, 3, fill=1, stroke=0)
            c.setFillColor(HexColor("#FFFFFF"))
            c.setFont("Helvetica-Bold", 9)
            c.drawString(lx + 6, ly + 5, identifier)

        c.setFillColor(HexColor("#FFFFFF"))
        c.setStrokeColor(HexColor("#B9C5CA"))
        c.roundRect(955, 385, 180, 220, 8, fill=1, stroke=1)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(972, 575, "LEYENDA DE MEDICION")
        legend = [(RED, "P-001 · T1 · 98 mm"), (GREEN, "P-002 · T2 · 125 mm"), (BLUE, "P-003 · T3 · Acustico"), (ORANGE, "C-001 · Techo TC1")]
        y = 540
        for color, text in legend:
            c.setFillColor(color)
            c.rect(972, y, 24, 7, fill=1, stroke=0)
            c.setFillColor(INK)
            c.setFont("Helvetica", 9)
            c.drawString(1005, y - 1, text)
            y -= 28
        c.setFont("Helvetica", 8)
        c.setFillColor(HexColor("#52666F"))
        c.drawString(972, 420, "Calibracion: cota conocida 24.80 m")
        c.drawString(972, 404, "Escala comprobada: 1:100")

    # Title block.
    c.setFillColor(HexColor("#FFFFFF"))
    c.setStrokeColor(INK)
    c.setLineWidth(1)
    c.rect(930, 65, 230, 235, fill=1, stroke=1)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(950, 270, "CUADRABOT")
    c.setFont("Helvetica", 9)
    details = [
        "Proyecto: Oficinas Castellana",
        "Pedido: CB-260829-0149",
        "Plano fuente: A-101",
        "Revision utilizada: Rev. 03",
        "Escala: 1:100",
        "Unidades: metricas",
        "Politica: PLADUR-ES-1.0",
        "Estado: MUESTRA PUBLICA",
    ]
    y = 242
    for detail in details:
        c.drawString(950, y, detail)
        y -= 20
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(GREEN if marked else INK)
    c.drawString(950, 82, "PLANO MARCADO" if marked else "PLANO ORIGINAL")
    c.setFillColor(HexColor("#52666F"))
    c.setFont("Helvetica", 7)
    c.drawString(35, 24, "Muestra sintetica creada por Cuadrabot para demostrar el formato de entrega. No corresponde a una obra real.")


def make_pdf(path: Path, marked: bool) -> None:
    c = canvas.Canvas(str(path), pagesize=PAGE, pageCompression=1)
    base_plan(c, marked)
    c.showPage()
    c.save()


make_pdf(OUT / "cuadrabot-plano-original-muestra.pdf", False)
make_pdf(OUT / "cuadrabot-plano-marcado-muestra.pdf", True)
print("Created sample PDFs")
