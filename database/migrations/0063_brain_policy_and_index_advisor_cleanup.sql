-- Business Brain advisor cleanup.
-- Adds covering FK indexes and splits write RLS policies to avoid duplicate SELECT policies.

create index if not exists brain_runs_created_by_empresa_fkey_idx
  on public.brain_runs (created_by, empresa_id);
create index if not exists brain_daily_metrics_run_empresa_fkey_idx
  on public.brain_daily_metrics (run_id, empresa_id);
create index if not exists brain_insights_run_empresa_fkey_idx
  on public.brain_insights (run_id, empresa_id);
create index if not exists brain_signals_run_empresa_fkey_idx
  on public.brain_signals (run_id, empresa_id);

create index if not exists brain_recommendations_insight_empresa_fkey_idx
  on public.brain_recommendations (insight_id, empresa_id);
create index if not exists brain_recommendations_created_by_empresa_fkey_idx
  on public.brain_recommendations (created_by, empresa_id);
create index if not exists brain_recommendations_updated_by_empresa_fkey_idx
  on public.brain_recommendations (updated_by, empresa_id);

create index if not exists brain_memory_created_by_empresa_fkey_idx
  on public.brain_memory (created_by, empresa_id);
create index if not exists brain_memory_updated_by_empresa_fkey_idx
  on public.brain_memory (updated_by, empresa_id);

create index if not exists brain_action_plans_recommendation_empresa_fkey_idx
  on public.brain_action_plans (recommendation_id, empresa_id);
create index if not exists brain_action_plans_approved_by_empresa_fkey_idx
  on public.brain_action_plans (approved_by, empresa_id);
create index if not exists brain_action_plans_created_by_empresa_fkey_idx
  on public.brain_action_plans (created_by, empresa_id);

create index if not exists brain_plan_steps_plan_empresa_fkey_idx
  on public.brain_plan_steps (plan_id, empresa_id);

drop policy if exists brain_memory_write_permission on public.brain_memory;
drop policy if exists brain_memory_insert_permission on public.brain_memory;
create policy brain_memory_insert_permission
on public.brain_memory
for insert
to authenticated
with check (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('brain.settings.manage'))
    or (select public.current_user_has_permission('brain.recommendations.manage'))
  )
);
drop policy if exists brain_memory_update_permission on public.brain_memory;
create policy brain_memory_update_permission
on public.brain_memory
for update
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('brain.settings.manage'))
    or (select public.current_user_has_permission('brain.recommendations.manage'))
  )
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('brain.settings.manage'))
    or (select public.current_user_has_permission('brain.recommendations.manage'))
  )
);

drop policy if exists brain_signals_write_permission on public.brain_signals;
drop policy if exists brain_signals_insert_permission on public.brain_signals;
create policy brain_signals_insert_permission
on public.brain_signals
for insert
to authenticated
with check (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('brain.settings.manage'))
    or (select public.current_user_has_permission('brain.recommendations.manage'))
  )
);
drop policy if exists brain_signals_update_permission on public.brain_signals;
create policy brain_signals_update_permission
on public.brain_signals
for update
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('brain.settings.manage'))
    or (select public.current_user_has_permission('brain.recommendations.manage'))
  )
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('brain.settings.manage'))
    or (select public.current_user_has_permission('brain.recommendations.manage'))
  )
);

drop policy if exists brain_action_plans_write_permission on public.brain_action_plans;
drop policy if exists brain_action_plans_insert_permission on public.brain_action_plans;
create policy brain_action_plans_insert_permission
on public.brain_action_plans
for insert
to authenticated
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.recommendations.manage'))
);
drop policy if exists brain_action_plans_update_permission on public.brain_action_plans;
create policy brain_action_plans_update_permission
on public.brain_action_plans
for update
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.recommendations.manage'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.recommendations.manage'))
);

drop policy if exists brain_plan_steps_write_permission on public.brain_plan_steps;
drop policy if exists brain_plan_steps_insert_permission on public.brain_plan_steps;
create policy brain_plan_steps_insert_permission
on public.brain_plan_steps
for insert
to authenticated
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.recommendations.manage'))
);
drop policy if exists brain_plan_steps_update_permission on public.brain_plan_steps;
create policy brain_plan_steps_update_permission
on public.brain_plan_steps
for update
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.recommendations.manage'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.recommendations.manage'))
);

drop policy if exists brain_recommendations_manage_permission on public.brain_recommendations;
drop policy if exists brain_recommendations_insert_permission on public.brain_recommendations;
create policy brain_recommendations_insert_permission
on public.brain_recommendations
for insert
to authenticated
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.recommendations.manage'))
);
drop policy if exists brain_recommendations_update_permission on public.brain_recommendations;
create policy brain_recommendations_update_permission
on public.brain_recommendations
for update
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.recommendations.manage'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.recommendations.manage'))
);
