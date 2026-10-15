# Railway staging provisioning evidence

This records the initial staging setup. Production was subsequently provisioned separately: see [production evidence](production-provisioning-evidence.md). Both applications remain undeployed.

Verified 16 October 2026 (Pacific/Auckland), using Railway CLI 5.68.0.

- Existing project: lantern / 9a445065-bde0-4184-bdb8-4161b033cc8f (Jesus Film Project).
- Target environment: staging / 8e19675b-08a2-4bfb-9762-fd6d8561fcfd.
- Application service: lantern / 0cdc4637-a8e4-4d4f-b860-f2e1578cae53.
- Reserved generated origin: https://lantern-staging.up.railway.app (no app deployed yet).
- Database service: Postgres / e8865f44-8297-4b85-bc99-d4807a353ef7.
- Volume: postgres-volume / a285c6e9-3309-49cc-9dc0-71165e059c85, staging instance 4ac6ed21-f2d2-4e2f-abe6-dd879ac3b23b, mounted /var/lib/postgresql/data. Railway template default capacity 50,000 MB; this is provisioned capacity, not actual stored data. No custom volume enlargement or workspace budget change performed.
- PostgreSQL 18 template image ghcr.io/railwayapp-templates/postgres-ssl:18; deployment 4bef7f5a-926e-40d9-b525-a4a78aa52b08 reached SUCCESS / one RUNNING instance. Image digest sha256:fcc6686a3f4f1962fe4ed77a15884553b7bd611ae1cea3204687968c5c09d517.
- Both services configured for one replica in us-west2. No custom CPU/memory limits set.
- App has no GitHub repository source or image source and has never deployed. Accordingly no GitHub/image autodeployment source is attached. Explicit image update-policy inspection is not applicable to the empty app; DB template auto-update policy was not independently verified.
- App variables verified: NODE_ENV=production, LANTERN_ENV=stage, LANTERN_HOSTING_ONLY=1, LOCAL_ACCESS=0, HOST=0.0.0.0, APP_ORIGIN as above.
- App DATABASE_URL uses the Postgres.DATABASE_URL Railway reference; privately verified its resolved host is Railway internal networking and matches this database. No public database TCP proxy exists. Google client ID/secret absent.
- No dashboard build/start/migration/healthcheck overrides configured. Repository railway.json will govern these on the eventual approved source upload; no source upload or application migrations performed.
- Production environment 873bb786-1c7b-407f-91aa-c79d7a5e97f7 still has zero service instances and zero volume instances.
- No project token, app deployment, stage-delivery enablement, production activation, participant enrollment, backup policy or restore rehearsal performed.

Pending: user service sanity check, PR approval/merge, passing CI on selected merged SHA, manual hosting-only deployment and live hosting checks. Authenticated smoke remains pending. Database container success is provisioning evidence, not application/schema readiness or live workflow acceptance.
