-- Run after deploying initiative descriptions with the 500-character limit (schema 7+).
-- Use the intended environment's operator connection. Replace the one placeholder
-- below with the department UUID. Run the entire file in one connection.
-- Find the ID with: SELECT id, name FROM lantern.departments WHERE deleted_at IS NULL;
--
-- Icon keys select the application's bundled Lucide SVGs. No external icon URLs.
-- Matches names ignoring surrounding whitespace and case. Keeps IDs, names,
-- archive status, ordering, other initiatives, mission and all focus history.
-- Applies the agreed descriptions and preset appearances to matching initiatives.
-- For description-only updates, use update-initiative-descriptions.sql instead.
-- Archived matches stay archived; restore explicitly in the app if desired.
-- A repeat run with the same data does not increment the configuration version.
BEGIN;
SET LOCAL search_path = lantern, pg_catalog;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(603106);

DO $seed$
DECLARE
  target_department uuid := 'REPLACE_WITH_DEPARTMENT_UUID';
  existing_items jsonb;
  updated_items jsonb;
  preset jsonb;
  presets constant jsonb := $presets$
[
  {
    "name": "Love What We Build",
    "appearance": {
      "icon": "heart",
      "color": "#c74998"
    },
    "description": "Understand who our work serves, why it matters to the mission, and whether it helps. This initiative connects meaningful ownership with access to the people and evidence needed to shape solutions. It includes understanding user needs, clarifying decisions we own, and using feedback after delivery to improve what we build and guide what happens next."
  },
  {
    "name": "Rethink How We Build",
    "appearance": {
      "icon": "lightbulb",
      "color": "#3276b0"
    },
    "description": "Improve how we move from an identified need to a validated outcome as AI changes the way we work. This includes stronger problem framing, effective use of agents, quality and validation throughout development, and shared tools and practices that help the whole team. Human judgment and responsibility remain central as we experiment, evaluate results and share useful capabilities."
  },
  {
    "name": "Role Clarity And Growth",
    "appearance": {
      "icon": "sprout",
      "color": "#267c65"
    },
    "description": "Connect the team’s strategy to each person’s contribution, desired results and personal development. This initiative helps people understand their responsibilities, how their strengths complement others, and the capabilities they need to develop. Position Focus makes that connection practical over roughly six months, with support from the Career Leader and relevant managers, adapting as priorities change."
  },
  {
    "name": "Team Connectedness",
    "appearance": {
      "icon": "users",
      "color": "#e4bf24"
    },
    "description": "Build a team where people know one another, understand what others are working on, and can find help and offer support. This includes sharing work and learning through Show and Tell, making space for relationships beyond delivery, and giving people regular opportunities to raise feedback. Visible responses and follow-through help that feedback improve our experience of working together."
  }
]
$presets$::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM departments WHERE id=target_department AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Choose an existing active department.';
  END IF;
  INSERT INTO department_direction(department_id, mission, initiatives, version)
    VALUES(target_department, '', '[]', 1) ON CONFLICT(department_id) DO NOTHING;
  SELECT initiatives INTO existing_items FROM department_direction
    WHERE department_id=target_department FOR UPDATE;
  updated_items := existing_items;
  FOR preset IN SELECT value FROM jsonb_array_elements(presets) LOOP
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(updated_items) item
      WHERE lower(btrim(item->>'name'))=lower(preset->>'name')) THEN
      SELECT jsonb_agg(CASE WHEN lower(btrim(item->>'name'))=lower(preset->>'name')
        THEN item || jsonb_build_object('appearance', preset->'appearance', 'description', preset->>'description')
        ELSE item END ORDER BY ordinal)
        INTO updated_items FROM jsonb_array_elements(updated_items) WITH ORDINALITY AS entries(item,ordinal);
    ELSE
      updated_items := updated_items || jsonb_build_array(
        preset || jsonb_build_object('id', gen_random_uuid(), 'archived', false));
    END IF;
  END LOOP;
  IF jsonb_array_length(updated_items) > 100 THEN
    RAISE EXCEPTION 'The department would exceed the limit of 100 initiatives; no changes applied.';
  END IF;
  UPDATE department_direction SET initiatives=updated_items, version=version+1
    WHERE department_id=target_department AND initiatives IS DISTINCT FROM updated_items;
END
$seed$;
COMMIT;
