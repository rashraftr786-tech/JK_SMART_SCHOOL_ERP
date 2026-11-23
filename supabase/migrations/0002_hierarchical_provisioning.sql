-- JK SMART SCHOOLS ERP: secure hierarchical role/scope assignment
-- Review and apply in Supabase SQL Editor before deploying the Edge Function.
-- Existing tables, role IDs, records and audit triggers are preserved.

CREATE OR REPLACE FUNCTION public.provision_user_access(
  p_user_id uuid,
  p_role_name text,
  p_district_id uuid DEFAULT NULL,
  p_zone_id uuid DEFAULT NULL,
  p_school_id uuid DEFAULT NULL,
  p_designation text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role_id uuid;
  v_actor_super boolean;
  v_actor_district boolean;
  v_actor_zone boolean;
  v_actor_school boolean;
  v_target_district uuid;
  v_target_zone uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_role_name NOT IN ('district_admin','zone_admin','school_admin','teacher','student','parent') THEN
    RAISE EXCEPTION 'Role cannot be provisioned through this workflow';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id
    WHERE ur.user_id=v_actor AND r.role_name='super_admin'
  ) INTO v_actor_super;

  IF NOT v_actor_super THEN
    IF p_role_name <> 'zone_admin' AND p_role_name <> 'school_admin'
       AND p_role_name <> 'teacher' AND p_role_name <> 'student' THEN
      RAISE EXCEPTION 'Your role cannot create this account';
    END IF;

    IF p_role_name='zone_admin' THEN
      IF p_district_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM district_admin_assignments a
        WHERE a.user_id=v_actor AND a.district_id=p_district_id AND a.is_active
      ) THEN RAISE EXCEPTION 'District scope violation'; END IF;
    ELSIF p_role_name='school_admin' THEN
      IF p_zone_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM zone_admin_assignments a
        WHERE a.user_id=v_actor AND a.zone_id=p_zone_id AND a.is_active
      ) THEN RAISE EXCEPTION 'Zone scope violation'; END IF;
    ELSE
      IF p_school_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM school_memberships m JOIN user_roles ur ON ur.user_id=m.user_id
        JOIN roles r ON r.id=ur.role_id
        WHERE m.user_id=v_actor AND m.school_id=p_school_id AND m.is_active AND r.role_name='school_admin'
      ) AND NOT EXISTS (
        SELECT 1 FROM school_memberships m JOIN user_roles ur ON ur.user_id=m.user_id
        JOIN roles r ON r.id=ur.role_id
        WHERE m.user_id=v_actor AND m.school_id=p_school_id AND m.is_active AND r.role_name='teacher' AND p_role_name='student'
      ) THEN RAISE EXCEPTION 'School scope violation'; END IF;
    END IF;
  END IF;

  SELECT id INTO v_role_id FROM roles WHERE role_name=p_role_name;
  IF v_role_id IS NULL THEN RAISE EXCEPTION 'Role % is not configured', p_role_name; END IF;
  INSERT INTO user_roles(user_id,role_id) VALUES(p_user_id,v_role_id)
  ON CONFLICT(user_id,role_id) DO NOTHING;

  IF p_role_name='district_admin' THEN
    IF p_district_id IS NULL THEN RAISE EXCEPTION 'District is required'; END IF;
    INSERT INTO district_admin_assignments(user_id,district_id,assigned_by,is_active)
    VALUES(p_user_id,p_district_id,v_actor,true)
    ON CONFLICT(user_id,district_id) DO UPDATE SET is_active=true,assigned_by=v_actor;
  ELSIF p_role_name='zone_admin' THEN
    IF p_zone_id IS NULL OR NOT EXISTS (SELECT 1 FROM zones WHERE id=p_zone_id AND district_id=p_district_id) THEN
      RAISE EXCEPTION 'Selected zone does not belong to the selected district';
    END IF;
    INSERT INTO zone_admin_assignments(user_id,zone_id,assigned_by,is_active)
    VALUES(p_user_id,p_zone_id,v_actor,true)
    ON CONFLICT(user_id,zone_id) DO UPDATE SET is_active=true,assigned_by=v_actor;
  ELSIF p_role_name IN ('school_admin','teacher','student') THEN
    IF p_school_id IS NULL THEN RAISE EXCEPTION 'School is required'; END IF;
    IF p_role_name='school_admin' AND NOT EXISTS (SELECT 1 FROM schools WHERE id=p_school_id AND zone_id=p_zone_id) THEN
      RAISE EXCEPTION 'Selected school does not belong to the selected zone';
    END IF;
    INSERT INTO school_memberships(user_id,school_id,designation,is_active)
    VALUES(p_user_id,p_school_id,COALESCE(NULLIF(trim(p_designation),''),initcap(replace(p_role_name,'_',' '))),true)
    ON CONFLICT(user_id,school_id) DO UPDATE SET is_active=true,designation=EXCLUDED.designation;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_user_access(uuid,text,uuid,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_user_access(uuid,text,uuid,uuid,uuid,text) TO authenticated;

-- Parent links: parent may link only themselves; school admins may link within their school;
-- super admins may manage all. The function checks the student role and membership.
CREATE POLICY parent_student_links_insert_authorized ON public.parent_student_links
FOR INSERT TO authenticated WITH CHECK (
  private.is_super_admin()
  OR (private.has_role('school_admin'::text) AND private.can_access_school(school_id)
      AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id
                  WHERE ur.user_id=student_user_id AND r.role_name='student')
      AND EXISTS (SELECT 1 FROM school_memberships sm
                  WHERE sm.user_id=student_user_id AND sm.school_id=parent_student_links.school_id AND sm.is_active))
);
CREATE POLICY parent_student_links_delete_authorized ON public.parent_student_links
FOR DELETE TO authenticated USING (
  private.is_super_admin()
  OR (parent_user_id=auth.uid() AND private.has_role('parent'::text))
  OR (private.has_role('school_admin'::text) AND private.can_access_school(school_id))
);

COMMENT ON FUNCTION public.provision_user_access(uuid,text,uuid,uuid,uuid,text)
IS 'Assigns a role and organizational scope after validating the authenticated actor hierarchy; audit triggers retain auth.uid() attribution.';
