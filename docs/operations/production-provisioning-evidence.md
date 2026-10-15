# Production resource provisioning evidence

Verified 16 October 2026 (Pacific/Auckland), Railway CLI 5.68.0. Operator explicitly authorized production resource provisioning; application activation remains prohibited.

- Project lantern: 9a445065-bde0-4184-bdb8-4161b033cc8f.
- Production environment: 873bb786-1c7b-407f-91aa-c79d7a5e97f7.
- Reused project-wide service definitions, creating distinct production instances rather than duplicate service names.
- App service lantern: 0cdc4637-a8e4-4d4f-b860-f2e1578cae53; production instance f1c1e8d8-ba64-4e99-9b86-59024f0e491a.
- Reserved origin: https://lantern-production-0bd8.up.railway.app. No app deployment exists; URL is not an activated application.
- Database service Postgres: e8865f44-8297-4b85-bc99-d4807a353ef7; production instance 69b5673a-a0ca-4014-a39d-303d87a06411.
- Distinct production volume 2b6ab1c7-87e4-4845-999b-713904e0e739 (postgres-volume-eyl0); instance 7829a3b4-7b68-4597-882d-a1b1af3f186f; /var/lib/postgresql/data; default capacity 50,000 MB. No staging volume mounted or copied.
- Production database deployment 4b6a0352-52c9-470d-ac09-306c2dca4f7d reached SUCCESS, using ghcr.io/railwayapp-templates/postgres-ssl:18.
- Both production services configured one replica us-west2; no custom CPU/memory limits or workspace budget changes.
- Generated independent production database password privately. Verified nonempty password differs from staging (boolean verification only); no credentials or participant identities in this report.
- App DATABASE_URL is environment-local Postgres.DATABASE_URL reference; privately verified resolved URL matches production DB and internal Railway host. No public DB TCP proxy.
- App verified NODE_ENV=production, LANTERN_ENV=production, LANTERN_HOSTING_ONLY=0, LOCAL_ACCESS=0, HOST=0.0.0.0, APP_ORIGIN as above. Google ID/secret absent pending provider decision. This configuration does not bypass authentication: application startup requires provider credentials and cannot use hosting-only mode in production.
- App source absent (no GitHub repo or image); no app autodeployment source attached. Database source has only image configured, without explicit update policy; platform default image auto-update behavior not independently established.
- No build/start/migration/health dashboard overrides; repository railway.json applies on eventual approved upload. No app upload, migrations, participant enrollment, token creation, backup policy, restore or production activation performed.
- Staging preserved: original PostgreSQL deployment 4bef7f5a-926e-40d9-b525-a4a78aa52b08 remains SUCCESS; staging app still no deployment; separate original volume and credentials retained.

Service IDs are shared project definitions. Environment IDs plus distinct service-instance IDs, volumes, variables and passwords establish isolation; release configuration MUST retain the intended environment ID.
