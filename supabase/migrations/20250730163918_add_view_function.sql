CREATE OR REPLACE FUNCTION set_or_update_view_scope()
RETURNS TRIGGER AS $$
BEGIN

  -- Prevent running logic when member_id is null
  IF NEW.member_id IS NULL THEN
      RETURN NEW;
  END IF;

    
  IF NEW.leaved_at IS NULL THEN
    -- Role active: insert the new scope, do NOT delete existing scopes
    
    IF NEW.type = 'president' THEN
      -- Insert 'all' scope if not exists, ignore duplicates
      INSERT INTO view_scopes (viewer_member_id, scope, access_level)
      VALUES (NEW.member_id, 'all', 'edit')
      ON CONFLICT DO NOTHING;

    ELSIF NEW.type = 'head' THEN
      -- Insert department scope if not exists
      INSERT INTO view_scopes (viewer_member_id, scope, dept_id, access_level)
      VALUES (NEW.member_id, 'department', NEW.dept_id, 'edit')
      ON CONFLICT DO NOTHING;

    ELSIF NEW.type = 'lead' THEN
      -- Insert division scope if not exists
      INSERT INTO view_scopes (viewer_member_id, scope, division_id, access_level)
      VALUES (NEW.member_id, 'division', NEW.division_id, 'edit')
      ON CONFLICT DO NOTHING;

    END IF;

  ELSE
    -- Role inactive: delete only scopes related to this role
    IF OLD.type = 'president' THEN
      DELETE FROM view_scopes 
      WHERE viewer_member_id = OLD.member_id AND scope = 'all';

    ELSIF OLD.type = 'head' THEN
      DELETE FROM view_scopes 
      WHERE viewer_member_id = OLD.member_id AND scope = 'department' AND dept_id = OLD.dept_id;

    ELSIF OLD.type = 'lead' THEN
      DELETE FROM view_scopes 
      WHERE viewer_member_id = OLD.member_id AND scope = 'division' AND division_id = OLD.division_id;

    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trigger_set_view_scope ON roles;

CREATE TRIGGER trigger_set_view_scope
AFTER INSERT OR UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION set_or_update_view_scope();

