create or replace function public.get_team_data()
RETURNS TABLE (
  first_name text ,
  last_name text ,
  role_type position_type ,
  member_id int ,
  role_id int ,
  email text ,
  linkedin text ,
  role_title text ,
  division_id int ,
  department_id int ,
  discord text ,
  origin text ,
  level_of_study text ,
  polito_id text ,
  program text ,
  started_at date ,
  mobile_number text

)

language plpgsql

as $$
BEGIN
return query
  select
  u.first_name,
  u.last_name,
  r.type,
  r.member_id,
  r.id,
  u.email ,
  u.linkedin ,
  r.title as role_title,
  r.division_id as division_id,
  r.dept_id as department_id,
  m.discord ,
  u.origin,
  u.level_of_study,
  u.polito_id ,
  u.program ,
  r.started_at ,
  m.mobile_number



FROM public.roles AS r
JOIN public.members AS m ON r.member_id = m.member_id
LEFT JOIN public.users AS u ON u.member = m.member_id;


end;
$$;