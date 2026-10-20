import type { PoolClient } from 'pg';
import { identifier } from './database-privileges.js';

// The only runtime membership write. Fixed search_path defeats caller-controlled
// objects (including temporary tables); PUBLIC gets no execution permission.
export async function migrateEnrollment(client: PoolClient) {
  const context = await client.query('SELECT current_schema() AS schema');
  const schema = identifier(context.rows[0].schema);
  await client.query(`
    CREATE FUNCTION enroll_member(actor uuid, target text, allow_personal boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ${schema}, pg_temp AS $body$
    DECLARE team uuid; account users%ROWTYPE; existing memberships%ROWTYPE;
    BEGIN
      PERFORM pg_advisory_xact_lock(603106);
      SELECT m.department_id INTO team FROM memberships m JOIN departments d ON d.id=m.department_id
        WHERE m.user_id=actor AND m.role='career-lead' AND m.deleted_at IS NULL AND d.deleted_at IS NULL;
      IF team IS NULL THEN RAISE EXCEPTION 'Only the career lead can add users.' USING ERRCODE='P0403'; END IF;
      SELECT * INTO account FROM users WHERE id::text=target;
      IF NOT FOUND THEN RAISE EXCEPTION 'Select a registered user.' USING ERRCODE='P0400'; END IF;
      IF NOT EXISTS (SELECT 1 FROM approved_emails WHERE email=lower(btrim(account.email)))
        OR NOT ((account.hosted_domain IS NULL AND allow_personal IS TRUE)
          OR EXISTS (SELECT 1 FROM allowed_domains WHERE domain=account.hosted_domain)) THEN
        RAISE EXCEPTION 'This account is not currently approved for access.' USING ERRCODE='P0403';
      END IF;
      SELECT * INTO existing FROM memberships WHERE user_id=account.id;
      IF FOUND THEN
        IF existing.department_id=team AND existing.deleted_at IS NULL THEN RETURN; END IF;
        IF existing.department_id=team THEN RAISE EXCEPTION 'Rejoining is not yet supported.' USING ERRCODE='P0409'; END IF;
        RAISE EXCEPTION 'This user belongs to another department.' USING ERRCODE='P0409';
      END IF;
      INSERT INTO memberships(user_id,department_id,role) VALUES(account.id,team,'member');
    END;
    $body$;
    REVOKE ALL ON FUNCTION enroll_member(uuid,text,boolean) FROM PUBLIC;
  `);
}

// Email-only enrollment; the legacy overload remains until the old app is replaced.
export async function migrateEmailEnrollment(client: PoolClient) {
  const context = await client.query('SELECT current_schema() AS schema');
  const schema = identifier(context.rows[0].schema);
  await client.query(`
    CREATE FUNCTION enroll_member(actor uuid, target text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ${schema}, pg_temp AS $body$
    DECLARE team uuid; account users%ROWTYPE; existing memberships%ROWTYPE;
    BEGIN
      PERFORM pg_advisory_xact_lock(603106);
      SELECT m.department_id INTO team FROM memberships m JOIN departments d ON d.id=m.department_id
        WHERE m.user_id=actor AND m.role='career-lead' AND m.deleted_at IS NULL AND d.deleted_at IS NULL;
      IF team IS NULL THEN RAISE EXCEPTION 'Only the career lead can add users.' USING ERRCODE='P0403'; END IF;
      SELECT * INTO account FROM users WHERE id::text=target;
      IF NOT FOUND THEN RAISE EXCEPTION 'Select a registered user.' USING ERRCODE='P0400'; END IF;
      IF NOT EXISTS (SELECT 1 FROM approved_emails WHERE email=lower(btrim(account.email))) THEN
        RAISE EXCEPTION 'This account is not currently approved for access.' USING ERRCODE='P0403';
      END IF;
      SELECT * INTO existing FROM memberships WHERE user_id=account.id;
      IF FOUND THEN
        IF existing.department_id=team AND existing.deleted_at IS NULL THEN RETURN; END IF;
        IF existing.department_id=team THEN RAISE EXCEPTION 'Rejoining is not yet supported.' USING ERRCODE='P0409'; END IF;
        RAISE EXCEPTION 'This user belongs to another department.' USING ERRCODE='P0409';
      END IF;
      INSERT INTO memberships(user_id,department_id,role) VALUES(account.id,team,'member');
    END;
    $body$;
    REVOKE ALL ON FUNCTION enroll_member(uuid,text) FROM PUBLIC;
  `);
}
