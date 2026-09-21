-- Brain approvals are server-verifiable records bound to the exact proposal.

alter table public.brain_approvals
  alter column conversation_id drop not null,
  add column if not exists proposal_hash text,
  add column if not exists proposal_version text,
  add column if not exists expires_at timestamptz,
  add column if not exists consumed_at timestamptz,
  add column if not exists idempotency_key text;

create index if not exists brain_approvals_hash_idx
  on public.brain_approvals (empresa_id, proposal_hash)
  where proposal_hash is not null;

revoke update on table public.brain_approvals from authenticated;

drop policy if exists brain_approvals_owner_policy on public.brain_approvals;
drop policy if exists brain_approvals_owner_read on public.brain_approvals;
create policy brain_approvals_owner_read
on public.brain_approvals for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and requested_by = (select auth.uid())
);

drop policy if exists brain_approvals_owner_request on public.brain_approvals;
create policy brain_approvals_owner_request
on public.brain_approvals for insert to authenticated
with check (
  empresa_id = (select public.current_empresa_id())
  and requested_by = (select auth.uid())
  and status = 'pending'
  and decided_by is null
  and decided_at is null
  and consumed_at is null
  and proposal_hash is not null
  and expires_at > now()
);

create or replace function public.decide_brain_proposal(
  p_approval_id text,
  p_proposal_hash text,
  p_approved boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_empresa_id();
  v_approval public.brain_approvals%rowtype;
begin
  if v_user_id is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  select a.* into v_approval
  from public.brain_approvals as a
  where a.empresa_id = v_company_id
    and a.approval_id = p_approval_id
    and a.requested_by = v_user_id
  for update;
  if v_approval.id is null or v_approval.proposal_hash <> p_proposal_hash then return false; end if;
  if v_approval.expires_at is null or v_approval.expires_at <= now() then
    update public.brain_approvals set status = 'expired'
    where id = v_approval.id and status = 'pending';
    return false;
  end if;
  if v_approval.status = (case when p_approved then 'approved' else 'denied' end)
    and v_approval.consumed_at is null then return true; end if;
  if v_approval.status <> 'pending' or v_approval.consumed_at is not null then return false; end if;
  update public.brain_approvals
  set status = case when p_approved then 'approved' else 'denied' end,
      decided_by = v_user_id,
      decided_at = now(),
      decision_reason = case when p_approved
        then 'Explicit confirmation through the authenticated Brain confirmation route'
        else 'Explicit rejection through the authenticated Brain confirmation route'
      end
  where id = v_approval.id;
  return true;
end;
$$;

create or replace function public.approve_brain_proposal(
  p_approval_id text,
  p_proposal_hash text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select public.decide_brain_proposal(p_approval_id, p_proposal_hash, true);
$$;

create or replace function public.consume_brain_proposal(
  p_approval_id text,
  p_proposal_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.brain_approvals as a
  set consumed_at = now()
  where a.empresa_id = public.current_empresa_id()
    and a.approval_id = p_approval_id
    and a.requested_by = auth.uid()
    and a.proposal_hash = p_proposal_hash
    and a.status = 'approved'
    and a.consumed_at is null;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.decide_brain_proposal(text, text, boolean) from public, anon;
revoke all on function public.approve_brain_proposal(text, text) from public, anon;
revoke all on function public.consume_brain_proposal(text, text) from public, anon;
grant execute on function public.decide_brain_proposal(text, text, boolean) to authenticated;
grant execute on function public.approve_brain_proposal(text, text) to authenticated;
grant execute on function public.consume_brain_proposal(text, text) to authenticated;
