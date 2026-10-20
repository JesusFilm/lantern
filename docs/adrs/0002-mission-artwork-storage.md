# Store bounded mission artwork with department direction

Date: 2026-10-20
Status: Accepted by the repository owner

Store one optional mission image in PostgreSQL on `department_direction`, alongside the mission and initiatives. The owner chose the existing database over a separate object-storage service. Migration 8 adds a nullable text column with the bundled default asset path as its default. Null means no artwork; a normalized WebP data URL means custom artwork. Existing departments retain the geometric image.

The existing authenticated direction HTTP interface reads and saves the image. The server resolves active membership and requires career-lead authority for writes; the image shares the direction version and transaction. Omitted image fields preserve the previous value for older clients. No public upload bucket, URL fetching, filesystem persistence, or new credentials are required.

The browser accepts PNG/JPEG/WebP up to 10 MB and 16 million pixels, fitting it within 1280 pixels before submission. The server independently validates raster bytes (at most 512 KiB, 16 million pixels, one frame), rejects URLs/SVGs, and re-encodes to metadata-free WebP within 1280 pixels and 512 KiB. A database constraint bounds stored text. Existing JSON request limits remain unchanged.

Images are returned only with authorized department direction and inherit database backup and retention behavior. Replacing an image replaces the stored value; objective history does not snapshot mission artwork. Base64 adds overhead to direction responses and database storage, acceptable for one bounded image per department. A larger media library or frequent high-volume image delivery should reconsider object storage.

The additive migration is compatible with the previous app: its writes leave the new column intact. Runtime receives column-level update permission, never schema-changing access. Delivery follows [ADR 0001](0001-release-migrations.md).
