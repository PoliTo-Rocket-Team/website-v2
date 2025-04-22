create or replace function get_user_info()
returns table (
  user_id uuid,
  type position_type,
  member_id int,
  role_id int
  
)
language plpgsql

as $$
begin
  return query
  select 
    u.id as user_id, 
    r.type, 
    r.member_id, 
    r.id 
    
  from public.users as u
  join public.members as m on u.member = m.member_id
  join public.roles as r on r.member_id = m.member_id
  where u.id = auth.uid();
end;
$$;

-- version: 2.0.0


create or replace function get_user_info()
returns table (
  first_name text,
  last_name text,
  role_type position_type,
  member_id int,
  role_id int ,
  email text ,
  linkedin text
  
)
language plpgsql

as $$
begin
  return query
  select 
  u.first_name,
  u.last_name,
  r.type,
  r.member_id,
  r.id ,
  u.email ,
  u.linkedin 
    
     
     
     
    
  from public.users as u
  join public.members as m on u.member = m.member_id
  join public.roles as r on r.member_id = m.member_id
  where u.id = auth.uid();
end;
$$;

-- version: 3.0.0
create or replace function get_user_info()
returns table (
  first_name text,
  last_name text,
  member_role_type position_type,
  member_id int,
  member_role_id int ,
  member_email text ,
  member_linkedin text ,
  member_role_title text,
  member_division_id int,
  member_department_id int
  
)
language plpgsql

as $$
begin
  return query
  select 
  u.first_name,
  u.last_name,
  r.type,
  r.member_id,
  r.id ,
  u.email ,
  u.linkedin ,
  r.title,
  r.division_id,
  r.dept_id
    
     
     
     
    
  from public.users as u
  join public.members as m on u.member = m.member_id
  join public.roles as r on r.member_id = m.member_id
  where u.id = auth.uid();
end;
$$;

----