-- Read-only, owner-run production verification. No email/account data is returned.
SELECT
  EXISTS (SELECT 1 FROM lantern.schema_migrations WHERE version=6) AS migration_6_applied,
  to_regclass('lantern.allowed_domains') IS NULL AS domain_table_removed,
  NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='lantern' AND table_name='users' AND column_name='hosted_domain') AS domain_column_removed,
  to_regprocedure('lantern.enroll_member(uuid,text,boolean)') IS NULL AS legacy_function_removed;
