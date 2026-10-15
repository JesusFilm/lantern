import { useState } from "react";
import type { SessionView } from "../../shared/access.js";
import { Dialog } from "./Dialog.js";
import { api } from "./api.js";
export function Account({
  user,
  onChange,
}: {
  user: NonNullable<SessionView["user"]>;
  onChange: (user: NonNullable<SessionView["user"]>) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <header>
        <div>
          <h1>Account</h1>
          <p className="muted">Your profile information.</p>
        </div>
      </header>
      <section className="read-section profile-card">
        <div className="row">
          <h2>Profile</h2>
          <button className="link edit-action" onClick={() => setEditing(true)}>
            Edit name
          </button>
        </div>
        <dl>
          <div>
            <dt>Display name</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
        </dl>
      </section>
      {editing && (
        <Dialog
          title="Edit display name"
          onClose={() => setEditing(false)}
          onSave={async (data) => {
            const name = String(data.get("name")).trim();
            if (!name) throw new Error("Enter a display name.");
            onChange(await api("/api/account", "PATCH", { name }));
            setEditing(false);
          }}
        >
          <label htmlFor="profile-name">Display name</label>
          <input
            id="profile-name"
            name="name"
            required
            maxLength={100}
            defaultValue={user.name}
          />
        </Dialog>
      )}
    </>
  );
}
