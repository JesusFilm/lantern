# Hosted GitHub access for the changelog

Accepted 27 November 2026.

Use a dedicated GitHub App installed on all repositories in the JesusFilm organization. Grant read-only Pull requests and Metadata permissions. The hosted server issues short-lived installation tokens, keeps them in memory, and uses them for weekly discovery and publication-time verification. A personal token would couple the service to one person's access and rotation. The existing local GitHub integration is tied to a development member and department.

Use separate app registrations and keys for staging and production. Store the private key only in its Railway web service environment. Exclude the credentials from PR preview environments, build jobs, client configuration and source control. Rotate the key in its environment before revoking the old key.

Every active member with the changelog flag can discover matching PR titles and URLs across the organization, including private repositories, using a self-entered username. Lantern resolves membership and authorship from the session. Published titles are readable by the entry's department. Opening a private PR still requires the viewer's own GitHub access.

[Changelog requirements](https://github.com/JesusFilm/lantern/issues/254)
