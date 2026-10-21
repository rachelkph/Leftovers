import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, useAuth } from '../lib/auth';
import { actions, selectItems, selectSettings, useStore } from '../lib/store';
import { cloudEnabled } from '../lib/supabase';
import { useSyncStatus, type SyncStatus } from '../lib/sync';
import { showToast } from '../lib/toast';

export function Profile() {
  const settings = useStore(selectSettings);
  const items = useStore(selectItems);
  const [invite, setInvite] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const navigate = useNavigate();
  const sampleCount = items.filter((i) => i.source === 'sample' && i.status === 'active').length;

  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = items.filter((i) => i.finishedAt && new Date(i.finishedAt).getTime() > monthAgo);
  const finished = recent.filter((i) => i.status === 'finished').length;
  const tossed = recent.filter((i) => i.status === 'tossed').length;

  const addMember = () => {
    const name = invite.trim();
    if (!name || settings.members.includes(name)) return;
    actions.updateSettings({ members: [...settings.members, name] });
    setInvite('');
  };

  return (
    <div className="profile">
      <h1 className="serif profile__title">profile</h1>

      <section className="profile__section">
        <label className="field">
          <span className="mono">Your name</span>
          <input value={settings.name} onChange={(e) => actions.updateSettings({ name: e.target.value })} placeholder="What should we call you?" />
        </label>
      </section>

      <section className="profile__section">
        <h2 className="serif">sharing</h2>
        <div className="control control--row">
          <span className="meta">Just you, or sharing with others?</span>
          <div className="segmented">
            <button type="button" aria-pressed={settings.mode === 'solo'} onClick={() => actions.updateSettings({ mode: 'solo' })}>
              Just me
            </button>
            <button type="button" aria-pressed={settings.mode === 'shared'} onClick={() => actions.updateSettings({ mode: 'shared' })}>
              Share a fridge
            </button>
          </div>
        </div>
        {settings.mode === 'shared' && (
          <div className="stack">
            <label className="field">
              <span className="mono">Household name</span>
              <input
                value={settings.householdName}
                placeholder={settings.name ? `${settings.name}’s apartment` : 'Our apartment'}
                onChange={(e) => actions.updateSettings({ householdName: e.target.value })}
              />
            </label>
            <div className="field">
              <span className="mono">People</span>
              <div className="members">
                {settings.members.map((m) => (
                  <span key={m} className="member">
                    {m}
                    <button type="button" aria-label={`Remove ${m}`} onClick={() => actions.updateSettings({ members: settings.members.filter((x) => x !== m) })}>
                      ×
                    </button>
                  </span>
                ))}
                <form
                  className="members__add"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addMember();
                  }}
                >
                  <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Name or email" aria-label="Add a person" />
                  <button type="submit" className="btn btn--small">
                    Add
                  </button>
                </form>
              </div>
            </div>
            <p className="meta soft-note">
              Items stay <strong>Mine</strong> unless you mark them <strong>Shared</strong>. Invites go out once account sync is switched on — for now the
              household lives on this device.
            </p>
          </div>
        )}
      </section>

      <section className="profile__section">
        <h2 className="serif">the last 30 days</h2>
        <p className="meta">
          {finished + tossed === 0
            ? 'Nothing finished yet. Mark things done from the fridge and they’ll show up here.'
            : `You finished ${finished} ${finished === 1 ? 'thing' : 'things'}${tossed ? ` and tossed ${tossed}` : ''}.`}
        </p>
      </section>

      {cloudEnabled && <AccountSection />}

      <section className="profile__section">
        <h2 className="serif">data</h2>
        <div className="btn-row">
          {sampleCount > 0 ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                actions.removeSampleFood();
                showToast(`Removed ${sampleCount} sample ${sampleCount === 1 ? 'item' : 'items'}.`);
              }}
            >
              Remove sample food ({sampleCount})
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => {
                actions.loadSampleFridge();
                showToast('Added some sample food. Remove it here any time.');
              }}
            >
              Add sample food
            </button>
          )}
          {confirmReset ? (
            <>
              <span className="meta">This erases all your food and settings.</span>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  navigate('/', { replace: true });
                  actions.resetEverything();
                }}
              >
                Yes, erase everything
              </button>
              <button type="button" className="link-button" onClick={() => setConfirmReset(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button type="button" className="link-button link-button--danger" onClick={() => setConfirmReset(true)}>
              Start over…
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

const SYNC_LABEL: Record<SyncStatus, string> = {
  off: 'Sync is off.',
  syncing: 'Syncing…',
  synced: 'Synced across your devices.',
  offline: 'Offline. Changes will sync when you’re back online.',
  error: 'Couldn’t reach the cloud just now. Your changes are saved here and will sync later.',
};

/** Who's signed in, whether this device is in sync, and signing out. */
function AccountSection() {
  const { session } = useAuth();
  const status = useSyncStatus();
  return (
    <section className="profile__section">
      <h2 className="serif">account</h2>
      <p className="meta">
        Signed in as <strong>{session?.user.email}</strong>. {SYNC_LABEL[status]}
      </p>
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </section>
  );
}
