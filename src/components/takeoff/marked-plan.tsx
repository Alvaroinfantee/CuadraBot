export function MarkedPlan({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative overflow-hidden border border-slate-300 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.12)] ${compact ? "aspect-[4/3]" : "min-h-[430px]"}`}>
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(#dce5ef_1px,transparent_1px),linear-gradient(90deg,#dce5ef_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="absolute left-[8%] top-[11%] h-[68%] w-[70%] border-2 border-slate-500" />
      <div className="absolute left-[37%] top-[11%] h-[68%] border border-slate-400" />
      <div className="absolute left-[8%] top-[44%] w-[70%] border border-slate-400" />
      <div className="absolute left-[55%] top-[44%] h-[35%] border border-slate-400" />
      <div className="absolute left-[12%] top-[16%] text-[9px] font-medium text-slate-400">SALA 01</div>
      <div className="absolute left-[42%] top-[16%] text-[9px] font-medium text-slate-400">OFICINA 02</div>
      <div className="absolute left-[12%] top-[50%] text-[9px] font-medium text-slate-400">DISTRIBUIDOR</div>
      <div className="absolute left-[8%] top-[10%] h-1 w-[70%] bg-[#ff5a4f] shadow-[0_0_0_1px_white]" />
      <div className="absolute left-[36.4%] top-[11%] h-[68%] w-1 bg-[#05a783] shadow-[0_0_0_1px_white]" />
      <div className="absolute left-[8%] top-[43.5%] h-1 w-[47%] bg-[#316cf4] shadow-[0_0_0_1px_white]" />
      <div className="absolute left-[54.5%] top-[44%] h-[35%] w-1 bg-[#ffb020] shadow-[0_0_0_1px_white]" />
      <span className="absolute left-[14%] top-[7%] rounded bg-[#ff5a4f] px-1.5 py-0.5 text-[9px] font-bold text-white">P-001</span>
      <span className="absolute left-[38%] top-[25%] rounded bg-[#05a783] px-1.5 py-0.5 text-[9px] font-bold text-white">P-002</span>
      <span className="absolute left-[23%] top-[40%] rounded bg-[#316cf4] px-1.5 py-0.5 text-[9px] font-bold text-white">P-003</span>
      <span className="absolute left-[56%] top-[61%] rounded bg-[#ffb020] px-1.5 py-0.5 text-[9px] font-bold text-white">C-001</span>
      <div className="absolute bottom-3 left-3 rounded border bg-white/95 p-2 text-[9px] leading-4 shadow-sm">
        <div className="font-bold text-slate-700">LEYENDA</div>
        <div><span className="mr-1 inline-block h-1.5 w-4 bg-[#ff5a4f]" /> T1 - 98 mm</div>
        <div><span className="mr-1 inline-block h-1.5 w-4 bg-[#05a783]" /> T2 - 125 mm</div>
        <div><span className="mr-1 inline-block h-1.5 w-4 bg-[#316cf4]" /> T3 - Acustico</div>
        <div><span className="mr-1 inline-block h-1.5 w-4 bg-[#ffb020]" /> TC1 - Techo</div>
      </div>
      <div className="absolute bottom-3 right-3 text-right text-[9px] font-medium text-slate-500">
        <div>CB-260829-0149</div>
        <div>A-101 · Rev. 03 · Escala 1:100</div>
      </div>
    </div>
  )
}
