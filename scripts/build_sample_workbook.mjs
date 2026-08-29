import fs from "node:fs/promises"
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool"

const outputDir = "../samples"
await fs.mkdir(outputDir, { recursive: true })

const workbook = Workbook.create()
const summary = workbook.worksheets.add("Resumen")
const partitions = workbook.worksheets.add("Tabiques")
const ceilings = workbook.worksheets.add("Techos")
const openings = workbook.worksheets.add("Huecos")
const assumptions = workbook.worksheets.add("Supuestos")
const revisions = workbook.worksheets.add("Revisiones")

const colors = {
  ink: "#17342D",
  green: "#1C7A65",
  pale: "#E7F1ED",
  orange: "#E35E38",
  sand: "#F6F7F4",
  line: "#D8E0DC",
  muted: "#607069",
  white: "#FFFFFF",
}

function setTitle(sheet, range, title, subtitle) {
  sheet.showGridLines = false
  sheet.getRange(range).merge()
  sheet.getRange(range).values = [[title]]
  sheet.getRange(range).format = { fill: colors.ink, font: { bold: true, color: colors.white, size: 18 }, verticalAlignment: "center" }
  sheet.getRange(range).format.rowHeight = 34
  const subtitleRange = sheet.getRangeByIndexes(1, 0, 1, sheet.getRange(range).columnCount)
  subtitleRange.merge()
  subtitleRange.values = [[subtitle]]
  subtitleRange.format = { fill: colors.pale, font: { color: colors.ink, size: 9 }, verticalAlignment: "center" }
  subtitleRange.format.rowHeight = 26
}

function setHeader(range) {
  range.format = {
    fill: colors.green,
    font: { bold: true, color: colors.white, size: 9 },
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: colors.green },
  }
  range.format.rowHeight = 32
}

function setBody(range) {
  range.format = {
    font: { color: "#273B35", size: 9 },
    verticalAlignment: "center",
    borders: { insideHorizontal: { style: "thin", color: colors.line } },
  }
  range.format.rowHeight = 25
}

setTitle(summary, "A1:F1", "CUADRABOT · MEDICION DE PLADUR", "Proyecto de muestra · Politica de medicion PLADUR-ES-1.0 · Unidades metricas")
summary.getRange("A4:B10").values = [
  ["Proyecto", "Oficinas Castellana"],
  ["Pedido", "CB-260829-0149"],
  ["Empresa", "Constructora Demo SL"],
  ["Ubicacion", "Madrid"],
  ["Revision de planos", "Rev. 03"],
  ["Version de entrega", 1],
  ["Fecha completada", new Date("2026-08-29T00:00:00Z")],
]
summary.getRange("A4:A10").format = { fill: colors.sand, font: { bold: true, color: colors.muted, size: 9 } }
summary.getRange("B4:B10").format = { font: { bold: true, color: colors.ink, size: 10 } }
summary.getRange("B10").setNumberFormat("yyyy-mm-dd")

summary.getRange("D4:F4").values = [["Indicador", "Total", "Unidad"]]
setHeader(summary.getRange("D4:F4"))
summary.getRange("D5:D11").values = [
  ["Longitud total de tabiques"], ["Superficie bruta (una cara)"], ["Superficie neta (una cara)"],
  ["Superficie neta (dos caras)"], ["Superficie total de techos"], ["Perimetro total de techos"], ["Huecos contabilizados"],
]
summary.getRange("E5:E11").formulas = [
  ["=SUM('Tabiques'!F5:F7)"], ["=SUM('Tabiques'!H5:H7)"], ["=SUM('Tabiques'!J5:J7)"],
  ["=SUM('Tabiques'!K5:K7)"], ["=SUM('Techos'!F5:F6)"], ["=SUM('Techos'!G5:G6)"], ["=SUM('Huecos'!E5:E7)"],
]
summary.getRange("F5:F11").values = [["m"],["m²"],["m²"],["m²"],["m²"],["m"],["uds"]]
setBody(summary.getRange("D5:F11"))
summary.getRange("E5:E10").format.numberFormat = "0.00"
summary.getRange("E11").format.numberFormat = "0"
summary.getRange("E5:E11").format = { fill: colors.pale, font: { bold: true, color: colors.ink, size: 10 } }

summary.getRange("A13:F13").merge()
summary.getRange("A13:F13").values = [["CRITERIOS IMPORTANTES"]]
summary.getRange("A13:F13").format = { fill: colors.orange, font: { bold: true, color: colors.white, size: 10 } }
summary.getRange("A14:F16").merge(true)
summary.getRange("A14:F16").values = [
  ["Supuesto principal: altura 2,70 m aplicada a P-003 por ausencia de seccion acotada; afecta al distribuidor y queda pendiente de confirmacion."],
  ["Exclusion principal: mobiliario, trasdosados existentes, nucleo de ascensores y cualquier partida ajena a tabiques o techos de placa de yeso."],
  ["Regla de huecos: se deducen del area, permanecen en la longitud lineal y se registran por separado."],
]
summary.getRange("A14:F16").format = { fill: colors.sand, font: { color: colors.ink, size: 9 }, wrapText: true, borders: { insideHorizontal: { style: "thin", color: colors.line } } }
summary.getRange("A14:F16").format.rowHeight = 34
summary.getRange("A1:F18").format.columnWidth = 20
summary.getRange("A1:A18").format.columnWidth = 24
summary.getRange("B1:B18").format.columnWidth = 28
summary.getRange("D1:D18").format.columnWidth = 31
summary.getRange("E1:E18").format.columnWidth = 16
summary.getRange("F1:F18").format.columnWidth = 12
summary.freezePanes.freezeRows(2)

setTitle(partitions, "A1:L1", "DETALLE DE TABIQUES", "Longitud al eje · Huecos deducidos del area · Areas a una y dos caras")
partitions.getRange("A4:L7").values = [
  ["Planta", "Plano fuente", "ID medicion", "Tipo", "Descripcion", "Longitud (m)", "Altura (m)", "Area bruta 1 cara (m²)", "Deduccion huecos (m²)", "Area neta 1 cara (m²)", "Area neta 2 caras (m²)", "Notas"],
  ["Planta baja", "A-101", "P-001", "T1", "Tabique 98 mm, doble placa", 24.8, 2.7, null, 4.2, null, null, "Altura de cuadro de tipos"],
  ["Planta baja", "A-101", "P-002", "T2", "Tabique 125 mm reforzado", 18.65, 2.8, null, 7.13, null, null, "Altura de seccion S-201"],
  ["Planta primera", "A-102", "P-003", "T3", "Tabique acustico 146 mm", 42.97, 2.7, null, 1.92, null, null, "Altura asumida; ver Supuestos"],
]
partitions.getRange("H5:H7").formulas = [["=F5*G5"],["=F6*G6"],["=F7*G7"]]
partitions.getRange("J5:J7").formulas = [["=H5-I5"],["=H6-I6"],["=H7-I7"]]
partitions.getRange("K5:K7").formulas = [["=J5*2"],["=J6*2"],["=J7*2"]]
setHeader(partitions.getRange("A4:L4")); setBody(partitions.getRange("A5:L7"))
partitions.getRange("F5:K7").format.numberFormat = "0.00"
partitions.getRange("A1:L7").format.columnWidth = 14
partitions.getRange("E1:E7").format.columnWidth = 31
partitions.getRange("H1:K7").format.columnWidth = 20
partitions.getRange("L1:L7").format.columnWidth = 28
partitions.freezePanes.freezeRows(4)
partitions.tables.add("A4:L7", true, "TabiquesTable").style = "TableStyleMedium4"

setTitle(ceilings, "A1:H1", "DETALLE DE TECHOS", "Superficies y perimetros medidos desde planos de falsos techos identificados")
ceilings.getRange("A4:H6").values = [
  ["Planta", "Plano fuente", "ID medicion", "Tipo", "Descripcion", "Area (m²)", "Perimetro (m)", "Notas"],
  ["Planta baja", "A-121", "C-001", "TC1", "Techo continuo placa 13 mm", 96.35, 48.2, "RCP escala 1:100"],
  ["Planta primera", "A-122", "C-002", "TC2", "Techo acustico perforado", 68.45, 37.65, "RCP escala 1:100"],
]
setHeader(ceilings.getRange("A4:H4")); setBody(ceilings.getRange("A5:H6"))
ceilings.getRange("F5:G6").format.numberFormat = "0.00"
ceilings.getRange("A1:H6").format.columnWidth = 16
ceilings.getRange("E1:E6").format.columnWidth = 34
ceilings.getRange("H1:H6").format.columnWidth = 28
ceilings.freezePanes.freezeRows(4)
ceilings.tables.add("A4:H6", true, "TechosTable").style = "TableStyleMedium4"

setTitle(openings, "A1:J1", "HUECOS", "Huecos claramente dimensionados registrados por separado")
openings.getRange("A4:J7").values = [
  ["Planta", "Plano fuente", "ID hueco", "Tipo", "Cantidad", "Ancho (m)", "Alto (m)", "Area deducida (m²)", "Tipo de muro", "Notas"],
  ["Planta baja", "A-101", "O-001", "Puerta", 2, 0.9, 2.1, null, "T1", "Dos puertas P01"],
  ["Planta baja", "A-101", "O-002", "Mampara acristalada", 1, 2.55, 2.8, null, "T2", "Hueco acotado"],
  ["Planta primera", "A-102", "O-003", "Puerta", 1, 0.8, 2.4, null, "T3", "Puerta P03"],
]
openings.getRange("H5:H7").formulas = [["=E5*F5*G5"],["=E6*F6*G6"],["=E7*F7*G7"]]
setHeader(openings.getRange("A4:J4")); setBody(openings.getRange("A5:J7"))
openings.getRange("F5:H7").format.numberFormat = "0.00"
openings.getRange("A1:J7").format.columnWidth = 15
openings.getRange("J1:J7").format.columnWidth = 25
openings.freezePanes.freezeRows(4)
openings.tables.add("A4:J7", true, "HuecosTable").style = "TableStyleMedium4"

setTitle(assumptions, "A1:E1", "SUPUESTOS Y EXCLUSIONES", "Toda condicion desconocida se documenta o se convierte en una aclaracion")
assumptions.getRange("A4:E7").values = [
  ["Condicion poco clara", "Interpretacion utilizada", "Plano / zona afectada", "Confirmacion del cliente", "Tipo"],
  ["Sin altura acotada en distribuidor P1", "Altura por defecto de 2,70 m", "A-102 / P-003", "Pendiente", "Supuesto"],
  ["Revision 02 presente en paquete", "Se utiliza Rev.03; Rev.02 excluida", "A-101 y A-102", "Si", "Revision"],
  ["Nucleo de ascensores fuera de pladur", "Zona no medida", "A-101 / nucleo central", "Si", "Exclusion"],
]
setHeader(assumptions.getRange("A4:E4")); setBody(assumptions.getRange("A5:E7"))
assumptions.getRange("A1:E7").format.columnWidth = 27
assumptions.getRange("B1:B7").format.columnWidth = 35
assumptions.getRange("C1:C7").format.columnWidth = 28
assumptions.freezePanes.freezeRows(4)
assumptions.tables.add("A4:E7", true, "SupuestosTable").style = "TableStyleMedium4"

setTitle(revisions, "A1:E1", "HISTORIAL DE REVISIONES", "Cada entrega conserva su version y el motivo de los cambios")
revisions.getRange("A4:E5").values = [
  ["Version", "Fecha", "Motivo del cambio", "Elementos modificados", "Responsable"],
  [1, new Date("2026-08-29T00:00:00Z"), "Entrega inicial", "Medicion completa", "Equipo Cuadrabot"],
]
setHeader(revisions.getRange("A4:E4")); setBody(revisions.getRange("A5:E5"))
revisions.getRange("B5").setNumberFormat("yyyy-mm-dd")
revisions.getRange("A1:E5").format.columnWidth = 23
revisions.getRange("C1:D5").format.columnWidth = 34
revisions.freezePanes.freezeRows(4)

const overview = await workbook.inspect({ kind: "table", sheetId: "Resumen", range: "A1:F16", include: "values,formulas", tableMaxRows: 20, tableMaxCols: 8, maxChars: 5000 })
console.log(overview.ndjson)
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 100 }, summary: "formula error scan" })
console.log(errors.ndjson)

const preview = await workbook.render({ sheetName: "Resumen", range: "A1:F16", scale: 1.35, format: "png" })
await fs.writeFile(`${outputDir}/cuadrabot-excel-muestra.png`, new Uint8Array(await preview.arrayBuffer()))
const xlsx = await SpreadsheetFile.exportXlsx(workbook)
await xlsx.save(`${outputDir}/cuadrabot-mediciones-muestra.xlsx`)
