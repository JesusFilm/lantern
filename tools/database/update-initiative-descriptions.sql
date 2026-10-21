-- Update only the four initiative descriptions for ONE explicitly chosen department.
-- Deploy the initiative-description feature with its 500-character limit first.
-- Use your staging or production operator connection (not the runtime connection).
-- Replace the department UUID placeholder below after checking the selected database:
--   SELECT current_database(), current_user;
--   SELECT id, name FROM lantern.departments WHERE deleted_at IS NULL;
-- Run this entire file in one connection. With psql, use ON_ERROR_STOP=1.
--
-- Matches names case-insensitively, ignoring surrounding spaces. Each name must
-- match exactly one initiative, including archived entries, or everything rolls back.
-- Does not create, rename, archive or restore initiatives, or change their appearance.
-- Preserves IDs, ordering, other fields/initiatives, mission and all focus history.
-- Increments the configuration version only when a description changes, protecting
-- against stale application saves. Re-running unchanged data is a no-op.
BEGIN;
SET LOCAL search_path = lantern, pg_catalog;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(603106);

DO $update_descriptions$
DECLARE
  target_department uuid := 'REPLACE_WITH_DEPARTMENT_UUID';
  existing_items jsonb;
  updated_items jsonb;
  preset jsonb;
  matches integer;
  updated_version integer;
  descriptions constant jsonb := $descriptions$
[
  {
    "name": "Love What We Build",
    "description": "Understand who our work serves, why it matters to the mission, and whether it helps. This initiative connects meaningful ownership with access to the people and evidence needed to shape solutions. It includes understanding user needs, clarifying decisions we own, and using feedback after delivery to improve what we build and guide what happens next."
  },
  {
    "name": "Rethink How We Build",
    "description": "Improve how we move from an identified need to a validated outcome as AI changes the way we work. This includes stronger problem framing, effective use of agents, quality and validation throughout development, and shared tools and practices that help the whole team. Human judgment and responsibility remain central as we experiment, evaluate results and share useful capabilities."
  },
  {
    "name": "Role Clarity and Growth",
    "description": "Connect the team’s strategy to each person’s contribution, desired results and personal development. This initiative helps people understand their responsibilities, how their strengths complement others, and the capabilities they need to develop. Position Focus makes that connection practical over roughly six months, with support from the Career Leader and relevant managers, adapting as priorities change."
  },
  {
    "name": "Team Connectedness",
    "description": "Build a team where people know one another, understand what others are working on, and can find help and offer support. This includes sharing work and learning through Show and Tell, making space for relationships beyond delivery, and giving people regular opportunities to raise feedback. Visible responses and follow-through help that feedback improve our experience of working together."
  }
]
$descriptions$::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM departments WHERE id=target_department AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Choose an existing active department.';
  END IF;
  SELECT initiatives INTO existing_items FROM department_direction
    WHERE department_id=target_department FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The department has no initiative configuration. Configure its initiatives first.';
  END IF;
  updated_items := existing_items;
  FOR preset IN SELECT value FROM jsonb_array_elements(descriptions) LOOP
    SELECT count(*) INTO matches FROM jsonb_array_elements(existing_items) item
      WHERE lower(btrim(item->>'name'))=lower(preset->>'name');
    IF matches <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one initiative named "%", found %. No changes applied.', preset->>'name', matches;
    END IF;
    SELECT jsonb_agg(CASE WHEN lower(btrim(item->>'name'))=lower(preset->>'name')
      THEN item || jsonb_build_object('description', preset->>'description')
      ELSE item END ORDER BY ordinal)
      INTO updated_items FROM jsonb_array_elements(updated_items) WITH ORDINALITY AS entries(item,ordinal);
  END LOOP;
  UPDATE department_direction SET initiatives=updated_items, version=version+1
    WHERE department_id=target_department AND initiatives IS DISTINCT FROM updated_items
    RETURNING version INTO updated_version;
  IF FOUND THEN
    RAISE NOTICE 'Updated initiative descriptions for department %, configuration version %.', target_department, updated_version;
  ELSE
    RAISE NOTICE 'Descriptions already match for department %; no changes made.', target_department;
  END IF;
END
$update_descriptions$;
COMMIT;
