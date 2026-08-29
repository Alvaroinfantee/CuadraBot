export const DRYWALL_ORDER_STORAGE_KEY = "cuadrabot.drywall-order.v1"
export const MEASUREMENT_POLICY_VERSION = "PLADUR-ES-1.0"

export type DrywallFile = {
  id: string
  name: string
  size: number
  pageCount: number
  checksum: string
  uploaded: boolean
}

export type DrywallPage = {
  id: string
  fileId: string
  fileName: string
  pageNumber: number
  sheetName: string
  selected: boolean
}

export type DrywallOrderDraft = {
  step: number
  email: string
  company: string
  projectName: string
  location: string
  projectType: string
  bidDate: string
  notes: string
  files: DrywallFile[]
  pages: DrywallPage[]
  scope: {
    partitions: string
    ceilings: string
    wallSchedules: string
    reflectedCeilings: string
    visibleScale: string
    defaultHeight: string
    deductOpenings: string
    supersededDrawings: string
    excludedAreas: string
    estimatorNotes: string
  }
  acceptedScope: boolean
  uploadAuthority: boolean
  marketing: Record<string, string>
  sessionId: string
  firstVisitAt: string
  projectId: string
  accessToken: string
  uploadVerified: boolean
}

export function createEmptyDrywallOrder(): DrywallOrderDraft {
  return {
    step: 1,
    email: "",
    company: "",
    projectName: "",
    location: "",
    projectType: "",
    bidDate: "",
    notes: "",
    files: [],
    pages: [],
    scope: {
      partitions: "si",
      ceilings: "si",
      wallSchedules: "si",
      reflectedCeilings: "si",
      visibleScale: "si",
      defaultHeight: "2.70",
      deductOpenings: "si",
      supersededDrawings: "",
      excludedAreas: "",
      estimatorNotes: "",
    },
    acceptedScope: false,
    uploadAuthority: false,
    marketing: {},
    sessionId: "",
    firstVisitAt: "",
    projectId: "",
    accessToken: "",
    uploadVerified: false,
  }
}

export function readDrywallOrder() {
  if (typeof window === "undefined") return createEmptyDrywallOrder()
  const raw = window.localStorage.getItem(DRYWALL_ORDER_STORAGE_KEY)
  if (!raw) return createEmptyDrywallOrder()
  try {
    return {
      ...createEmptyDrywallOrder(),
      ...(JSON.parse(raw) as DrywallOrderDraft),
    }
  } catch {
    return createEmptyDrywallOrder()
  }
}

export function saveDrywallOrder(order: DrywallOrderDraft) {
  window.localStorage.setItem(DRYWALL_ORDER_STORAGE_KEY, JSON.stringify(order))
}
