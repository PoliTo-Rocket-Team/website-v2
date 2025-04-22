CREATE OR REPLACE FUNCTION public.get_subteam_data( )
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

DECLARE
  div_id int;
  dept_id int;
  u_role_type position_type;
BEGIN
  -- Get the user role type
  SELECT member_role_type INTO u_role_type FROM get_user_info();
  CASE u_role_type
    WHEN 'president' THEN
      RETURN QUERY SELECT * FROM public.get_team_data();

    WHEN 'head' THEN
      SELECT member_department_id INTO dept_id FROM get_user_info();
      RETURN QUERY
        SELECT * FROM public.get_team_data() as team_data
        WHERE team_data.department_id = dept_id;

    WHEN 'lead' THEN
      SELECT member_division_id INTO div_id FROM get_user_info();
      RETURN QUERY
        SELECT * FROM public.get_team_data() as team_data
        WHERE team_data.division_id = div_id;

    ELSE
      RAISE NOTICE 'Using CASE: Unknown role';
  END CASE;

end;
$$;
