create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text not null,
    role text not null check (role in ('student', 'coach')),
    grade_level text,
    school_name text,
    department text,
    institution_name text,
    coach_code text unique,
    created_at timestamptz not null default now(),
    constraint profile_role_fields check (
        (role = 'student' and coach_code is null)
        or (role = 'coach' and coach_code is not null)
    )
);

create table if not exists public.coach_students (
    coach_id uuid not null references public.profiles (id) on delete cascade,
    student_id uuid primary key references public.profiles (id) on delete cascade,
    linked_at timestamptz not null default now(),
    constraint coach_students_distinct check (coach_id <> student_id)
);

create table if not exists public.exam_results (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.profiles (id) on delete cascade,
    exam_name text not null,
    exam_date date not null,
    tyt_net numeric(5, 2),
    ayt_net numeric(5, 2),
    notes text,
    created_at timestamptz not null default now()
);

create table if not exists public.student_tasks (
    id uuid primary key default gen_random_uuid(),
    coach_id uuid not null references public.profiles (id) on delete cascade,
    student_id uuid not null references public.profiles (id) on delete cascade,
    subject text not null,
    title text not null,
    details text,
    due_date date,
    status text not null default 'pending' check (status in ('pending', 'completed')),
    created_at timestamptz not null default now(),
    completed_at timestamptz,
    constraint student_tasks_distinct check (coach_id <> student_id)
);

create table if not exists public.study_plans (
    id uuid primary key default gen_random_uuid(),
    coach_id uuid not null references public.profiles (id) on delete cascade,
    student_id uuid not null references public.profiles (id) on delete cascade,
    subject text not null,
    title text not null,
    details text,
    starts_at timestamptz not null,
    created_at timestamptz not null default now(),
    constraint study_plans_distinct check (coach_id <> student_id)
);

create index if not exists coach_students_coach_id_idx on public.coach_students (coach_id);
create index if not exists exam_results_student_date_idx on public.exam_results (student_id, exam_date desc);
create index if not exists student_tasks_student_due_idx on public.student_tasks (student_id, due_date);
create index if not exists study_plans_student_start_idx on public.study_plans (student_id, starts_at);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
    generated_code text;
begin
    if requested_role not in ('student', 'coach') then
        raise exception 'Unsupported account role';
    end if;

    if requested_role = 'coach' then
        loop
            generated_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
            exit when not exists (
                select 1 from public.profiles where coach_code = generated_code
            );
        end loop;
    end if;

    insert into public.profiles (
        id,
        display_name,
        role,
        grade_level,
        school_name,
        department,
        institution_name,
        coach_code
    ) values (
        new.id,
        coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
        requested_role,
        nullif(trim(new.raw_user_meta_data ->> 'grade_level'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'school_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'department'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'institution_name'), ''),
        generated_code
    );

    return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
    after insert on auth.users
    for each row execute function public.handle_new_auth_user();

create or replace function public.protect_profile_permissions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.id is distinct from old.id
        or new.role is distinct from old.role
        or new.coach_code is distinct from old.coach_code then
        raise exception 'Account role and coach code cannot be changed';
    end if;
    return new;
end;
$$;

drop trigger if exists protect_profile_permissions on public.profiles;
create trigger protect_profile_permissions
    before update on public.profiles
    for each row execute function public.protect_profile_permissions();

create or replace function private.is_linked_coach(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.coach_students cs
        where cs.coach_id = (select auth.uid())
          and cs.student_id = p_student_id
    );
$$;

create or replace function private.is_linked_student(p_coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.coach_students cs
        where cs.student_id = (select auth.uid())
          and cs.coach_id = p_coach_id
    );
$$;

revoke all on function private.is_linked_coach(uuid) from public, anon;
revoke all on function private.is_linked_student(uuid) from public, anon;
grant execute on function private.is_linked_coach(uuid) to authenticated;
grant execute on function private.is_linked_student(uuid) to authenticated;

create or replace function public.link_student_to_coach(p_coach_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
    coach_record public.profiles%rowtype;
    existing_coach_id uuid;
begin
    if current_user_id is null then
        raise exception 'Sign in before linking a coach';
    end if;

    if not exists (
        select 1 from public.profiles p
        where p.id = current_user_id and p.role = 'student'
    ) then
        raise exception 'Only student accounts can link to a coach';
    end if;

    select * into coach_record
    from public.profiles p
    where p.role = 'coach'
      and p.coach_code = upper(trim(p_coach_code));

    if coach_record.id is null then
        raise exception 'Coach code was not found';
    end if;

    select cs.coach_id into existing_coach_id
    from public.coach_students cs
    where cs.student_id = current_user_id;

    if existing_coach_id is not null and existing_coach_id <> coach_record.id then
        raise exception 'Student is already linked to another coach';
    end if;

    insert into public.coach_students (coach_id, student_id)
    values (coach_record.id, current_user_id)
    on conflict (student_id) do nothing;

    select cs.coach_id into existing_coach_id
    from public.coach_students cs
    where cs.student_id = current_user_id;

    if existing_coach_id is distinct from coach_record.id then
        raise exception 'Student is already linked to another coach';
    end if;

    return jsonb_build_object(
        'coach_id', coach_record.id,
        'display_name', coach_record.display_name,
        'institution_name', coach_record.institution_name
    );
end;
$$;

create or replace function public.complete_student_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.student_tasks
    set status = 'completed', completed_at = now()
    where id = p_task_id
      and student_id = auth.uid();

    if not found then
        raise exception 'Task not found for this student';
    end if;
end;
$$;

revoke all on function public.link_student_to_coach(text) from public, anon;
revoke all on function public.complete_student_task(uuid) from public, anon;
grant execute on function public.link_student_to_coach(text) to authenticated;
grant execute on function public.complete_student_task(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.coach_students enable row level security;
alter table public.exam_results enable row level security;
alter table public.student_tasks enable row level security;
alter table public.study_plans enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.coach_students from anon, authenticated;
revoke all on table public.exam_results from anon, authenticated;
revoke all on table public.student_tasks from anon, authenticated;
revoke all on table public.study_plans from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, grade_level, school_name, department, institution_name)
    on table public.profiles to authenticated;
grant select, delete on table public.coach_students to authenticated;
grant select, insert, update, delete on table public.exam_results to authenticated;
grant select, insert, delete on table public.student_tasks to authenticated;
grant update (status) on table public.student_tasks to authenticated;
grant select, insert, update, delete on table public.study_plans to authenticated;

drop policy if exists profiles_read_self_or_linked on public.profiles;
create policy profiles_read_self_or_linked
on public.profiles for select to authenticated
using (
    id = (select auth.uid())
    or (select private.is_linked_coach(id))
    or (select private.is_linked_student(id))
);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists coach_students_read_members on public.coach_students;
create policy coach_students_read_members
on public.coach_students for select to authenticated
using (coach_id = (select auth.uid()) or student_id = (select auth.uid()));

drop policy if exists coach_students_delete_members on public.coach_students;
create policy coach_students_delete_members
on public.coach_students for delete to authenticated
using (coach_id = (select auth.uid()) or student_id = (select auth.uid()));

drop policy if exists exam_results_read_student_or_coach on public.exam_results;
create policy exam_results_read_student_or_coach
on public.exam_results for select to authenticated
using (student_id = (select auth.uid()) or (select private.is_linked_coach(student_id)));

drop policy if exists exam_results_insert_self on public.exam_results;
create policy exam_results_insert_self
on public.exam_results for insert to authenticated
with check (student_id = (select auth.uid()));

drop policy if exists exam_results_update_self on public.exam_results;
create policy exam_results_update_self
on public.exam_results for update to authenticated
using (student_id = (select auth.uid()))
with check (student_id = (select auth.uid()));

drop policy if exists exam_results_delete_self on public.exam_results;
create policy exam_results_delete_self
on public.exam_results for delete to authenticated
using (student_id = (select auth.uid()));

drop policy if exists student_tasks_read_members on public.student_tasks;
create policy student_tasks_read_members
on public.student_tasks for select to authenticated
using (coach_id = (select auth.uid()) or student_id = (select auth.uid()));

drop policy if exists student_tasks_create_linked on public.student_tasks;
create policy student_tasks_create_linked
on public.student_tasks for insert to authenticated
with check (
    coach_id = (select auth.uid())
    and (select private.is_linked_coach(student_id))
);

drop policy if exists student_tasks_complete_self on public.student_tasks;
create policy student_tasks_complete_self
on public.student_tasks for update to authenticated
using (student_id = (select auth.uid()))
with check (student_id = (select auth.uid()));

drop policy if exists student_tasks_delete_coach on public.student_tasks;
create policy student_tasks_delete_coach
on public.student_tasks for delete to authenticated
using (coach_id = (select auth.uid()));

drop policy if exists study_plans_read_members on public.study_plans;
create policy study_plans_read_members
on public.study_plans for select to authenticated
using (coach_id = (select auth.uid()) or student_id = (select auth.uid()));

drop policy if exists study_plans_create_linked on public.study_plans;
create policy study_plans_create_linked
on public.study_plans for insert to authenticated
with check (
    coach_id = (select auth.uid())
    and (select private.is_linked_coach(student_id))
);

drop policy if exists study_plans_update_coach on public.study_plans;
create policy study_plans_update_coach
on public.study_plans for update to authenticated
using (coach_id = (select auth.uid()))
with check (
    coach_id = (select auth.uid())
    and (select private.is_linked_coach(student_id))
);

drop policy if exists study_plans_delete_coach on public.study_plans;
create policy study_plans_delete_coach
on public.study_plans for delete to authenticated
using (coach_id = (select auth.uid()));