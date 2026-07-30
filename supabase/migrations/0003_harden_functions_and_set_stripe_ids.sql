create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.claim_order_for_worker(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_order_for_worker(uuid, text) to service_role;

update public.packages
set stripe_price_id = case slug
  when 'basic-render' then 'price_1TWQnLIc24tuLpgmGOqxVRLO'
  when 'pro-render' then 'price_1TWQnMIc24tuLpgmIdNQvROx'
  when 'premium-render-pack' then 'price_1TWQnMIc24tuLpgmWKu2LNj4'
  else stripe_price_id
end,
updated_at = now()
where slug in ('basic-render', 'pro-render', 'premium-render-pack');
