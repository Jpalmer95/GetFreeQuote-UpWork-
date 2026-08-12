-- ============================================================================
-- GetFreeQuote — Vendor Reviews flow
-- Apply this in Supabase Dashboard > SQL Editor.
--
-- Adds an atomic RPC that inserts a review AND updates the vendor's aggregate
-- rating/count in one transaction (prevents drift / race conditions).
-- The API route (/api/reviews) uses this when available; it also falls back to
-- a read-recompute-write so the feature works even before this is applied.
-- ============================================================================

create or replace function public.submit_vendor_review(
  p_vendor_profile_id uuid,
  p_reviewer_id uuid,
  p_reviewer_name text,
  p_job_id uuid,
  p_rating integer,
  p_comment text
)
returns public.vendor_reviews
language plpgsql security definer
as $$
declare
  v_review public.vendor_reviews;
  v_new_avg numeric;
  v_count integer;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  -- Block self-review: the reviewer must not be the vendor's owner.
  if exists (
    select 1 from public.vendor_profiles vp
    where vp.id = p_vendor_profile_id and vp.user_id = p_reviewer_id
  ) then
    raise exception 'You cannot review your own vendor profile';
  end if;

  insert into public.vendor_reviews
    (vendor_profile_id, reviewer_id, reviewer_name, job_id, rating, comment)
  values
    (p_vendor_profile_id, p_reviewer_id, p_reviewer_name, p_job_id, p_rating, coalesce(p_comment, ''))
  returning * into v_review;

  select avg(rating), count(*)
    into v_new_avg, v_count
  from public.vendor_reviews
  where vendor_profile_id = p_vendor_profile_id;

  update public.vendor_profiles
  set avg_rating = round(coalesce(v_new_avg, 0)::numeric, 2),
      total_reviews = v_count,
      updated_at = now()
  where id = p_vendor_profile_id;

  return v_review;
end;
$$;

-- The service_role key bypasses RLS, so no extra grant is needed for the route.
