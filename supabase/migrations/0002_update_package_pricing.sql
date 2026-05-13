update public.packages
set
  name = 'Basic Render',
  description = 'One clear, polished view to validate your idea quickly.',
  price_cents = 14900,
  included_views = 1,
  revision_rounds = 0,
  estimated_delivery_days_min = 3,
  estimated_delivery_days_max = 5,
  sort_order = 1,
  updated_at = now()
where slug = 'basic-render';

update public.packages
set
  name = 'Pro Render',
  description = 'The most balanced option for presenting your project with more detail.',
  price_cents = 29900,
  included_views = 2,
  revision_rounds = 2,
  estimated_delivery_days_min = 3,
  estimated_delivery_days_max = 5,
  sort_order = 2,
  updated_at = now()
where slug = 'pro-render';

update public.packages
set
  name = 'Premium Render Pack',
  description = 'Four views ready for presentation, sales, or client approval.',
  price_cents = 54900,
  included_views = 4,
  revision_rounds = 2,
  estimated_delivery_days_min = 2,
  estimated_delivery_days_max = 4,
  sort_order = 3,
  updated_at = now()
where slug = 'premium-render-pack';
