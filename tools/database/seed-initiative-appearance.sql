-- Run after deploying the initiative-appearance application change (schema 7+).
-- Use the intended environment's operator connection. Replace the one placeholder
-- below with the department UUID. Run the entire file in one connection.
-- Find the ID with: SELECT id, name FROM lantern.departments WHERE deleted_at IS NULL;
--
-- Icon keys select the application's bundled Lucide SVGs. No external icon URLs.
-- Matches names ignoring surrounding whitespace and case. Keeps IDs, names,
-- archive status, ordering, other initiatives, mission and all focus history.
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
  presets constant jsonb := '[
    {"name":"Love What We Build","appearance":{"icon":"heart","color":"#d13d46"}},
    {"name":"Rethink How We Build","appearance":{"icon":"lightbulb","color":"#8560bb"}},
    {"name":"Role Clarity And Growth","appearance":{"icon":"sprout","color":"#267c65"}},
    {"name":"Team Connectedness","appearance":{"icon":"users","color":"#df741b"}}
  ]';
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
        THEN item || jsonb_build_object('appearance', preset->'appearance')
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
