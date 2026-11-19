import type { Appearance } from "./appearance.js";
import type { SessionView } from "../../shared/access.js";
import { api } from "./api.js";
import { TeamAPIAccess } from "./TeamAPIAccess.js";
import { GitHubProfile } from './GitHubProfile.js';
import { InlineProfileField } from './InlineProfileField.js';
export function Account({
  user,
  onChange,
  appearance,
  onAppearanceChange,
  githubEnabled = false,
  teamAPIEnabled = false,
}: {
  appearance: Appearance;
  onAppearanceChange: (appearance: Appearance) => void;
  user: NonNullable<SessionView["user"]>;
  onChange: (user: NonNullable<SessionView["user"]>) => void;
  githubEnabled?: boolean;
  teamAPIEnabled?: boolean;
}) {
  return (
    <>
      <header>
        <div>
          <h1>Account</h1>
          <p className="muted">Your profile information.</p>
        </div>
      </header>
      <section className="read-section profile-card" aria-label="Account settings">
        <dl>
          <div>
            <dt>Display name</dt>
            <dd><InlineProfileField value={user.name} label="Display name" maxLength={100} onSave={async value => {
              const name = value.trim();
              if (!name) throw new Error('Enter a display name.');
              const saved = await api<NonNullable<SessionView['user']>>('/api/account', 'PATCH', { name });
              onChange(saved);
              return saved.name;
            }} /></dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          {githubEnabled && <GitHubProfile />}
          <div>
            <dt>Appearance</dt>
            <dd><fieldset className="appearance-options" aria-label="Appearance">
          {(["light", "dark", "system"] as const).map((option) => (
            <label key={option}>
              <input type="radio" name="appearance" value={option} checked={appearance === option} onChange={() => onAppearanceChange(option)} />
              {option[0]!.toUpperCase() + option.slice(1)}
            </label>
          ))}
            </fieldset></dd>
          </div>
        </dl>
      </section>
      {teamAPIEnabled && <TeamAPIAccess />}
    </>
  );
}
