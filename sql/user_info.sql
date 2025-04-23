
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
  member_department_id int ,
  division_name text ,
  division_code text ,
  departments_name text ,
  department_code text
  
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
  r.dept_id ,
  div.name as division_name ,
  div.code as division_code ,
  dep.name as departments_name ,
  dep.code as department_code
    
     
     
     
    
  from public.users as u
  join public.members as m on u.member = m.member_id
  join public.roles as r on r.member_id = m.member_id
  LEFT JOIN public.divisions as div ON div.id = r.division_id
  LEFT JOIN public.departments as dep ON dep.id = r.dept_id 
  where u.id = auth.uid();
end;
$$;

----