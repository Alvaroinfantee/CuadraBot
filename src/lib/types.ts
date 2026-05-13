export const orderStatuses = [
  "draft",
  "awaiting_payment",
  "paid_pending_processing",
  "processing",
  "needs_review",
  "completed",
  "cancelled",
  "refunded",
  "failed",
] as const

export type OrderStatus = (typeof orderStatuses)[number]

export const renderTypes = [
  "Exterior",
  "Interior",
  "Floor plan visualization",
  "Site/massing",
  "Other",
] as const

export const projectTypes = [
  "House",
  "Apartment",
  "Commercial",
  "Real estate development",
  "Renovation",
  "Other",
] as const

export const stylePreferences = [
  "Modern",
  "Minimal",
  "Luxury",
  "Mediterranean",
  "Tropical",
  "Realistic",
  "Conceptual",
  "Other",
] as const

export type PackagePlan = {
  id: string
  slug: string
  name: string
  description: string
  price_cents: number
  currency: string
  stripe_price_id: string | null
  included_views: number
  revision_rounds: number
  estimated_delivery_days_min: number
  estimated_delivery_days_max: number
  active: boolean
  sort_order: number
}

export type Order = {
  id: string
  public_token: string
  order_number: string
  customer_name: string | null
  customer_email: string
  package_id: string | null
  status: OrderStatus
  render_type: string | null
  project_type: string | null
  style_preference: string | null
  number_of_floors: number | null
  estimated_square_meters: number | null
  customer_notes: string | null
  deadline_preference: string | null
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  amount_cents: number | null
  currency: string | null
  paid_at: string | null
  processing_started_at: string | null
  completed_at: string | null
  internal_notes: string | null
  assigned_worker_id: string | null
  created_at: string
  updated_at: string
}

export type OrderFile = {
  id: string
  order_id: string
  bucket: string
  storage_path: string
  original_filename: string
  mime_type: string | null
  size_bytes: number | null
  file_role: "customer_upload" | "final_render" | "reference" | "admin_upload"
  created_at: string
}

export type WorkerJob = Pick<
  Order,
  | "id"
  | "public_token"
  | "order_number"
  | "customer_email"
  | "package_id"
  | "status"
  | "render_type"
  | "project_type"
  | "style_preference"
  | "number_of_floors"
  | "estimated_square_meters"
  | "customer_notes"
  | "deadline_preference"
  | "assigned_worker_id"
  | "created_at"
>

export type PublicOrderStatus = Order & {
  packages?: PackagePlan | null
  order_files?: OrderFile[]
}
