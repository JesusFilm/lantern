# Local application user service

The example [systemd user service](lantern-app.service) runs Lantern on loopback with explicit local access. First follow the [local setup](../../README.md) to configure a synthetic database and `.env`, and run `npm run build`. The local account and its data persist; this service does not reset or migrate an existing database.

On Linux, copy the unit without overwriting an existing service, then edit the copy's `WorkingDirectory` to your checkout path (the default is `~/lantern`):

```sh
mkdir -p ~/.config/systemd/user ~/.config/lantern
cp -n tools/local-app/lantern-app.service ~/.config/systemd/user/
${EDITOR:-vi} ~/.config/systemd/user/lantern-app.service
```

Optionally create `~/.config/lantern/local-app.env` to override `APP_ORIGIN` with the browser-facing origin when using a reverse proxy. If Node is installed outside the system service's default PATH, set `PATH` there too, including the directory containing Node. For example, replace the placeholder in:

```ini
PATH=/absolute/path/to/node/bin:/usr/local/bin:/usr/bin:/bin
```

Environment-file values are not shell-expanded; use absolute paths instead of `$HOME` or `~`. Set file permissions with `chmod 600 ~/.config/lantern/local-app.env` if you create it.

```sh
systemctl --user daemon-reload
systemctl --user enable --now lantern-app.service
systemctl --user status lantern-app.service
```

The backend listens only on loopback. The service does not configure a reverse proxy or authentication; expose local access only through a separately protected private viewer. Rebuild and restart after changing application code.
