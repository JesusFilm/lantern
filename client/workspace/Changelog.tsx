import { useEffect, useRef, useState } from 'react';
import type {
  ChangelogView,
  ChangelogEntry,
  Product,
} from '../../shared/changelog.js';
import { ChangelogPicker } from './ChangelogPicker.js';
import { api } from './api.js';
import { day, monday, shift } from './week-dates.js';
import './changelog.css';

const path = '/api/changelog';
function ProductDialog({
  onAdd,
  onClose,
}: {
  onAdd: (product: Product) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function add() {
    setBusy(true);
    try {
      onAdd(await api<Product>(path + '/products', 'POST', { name }));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-label="Add product"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <h2>Add product</h2>
        <label>
          Product name
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="changelog-actions">
          <button disabled={busy}>Add</button>
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
function Editor({
  entry,
  week,
  products,
  onSaved,
  onClose,
}: {
  entry?: ChangelogEntry;
  week: string;
  products: Product[];
  onSaved: (week: string) => void;
  onClose: () => void;
}) {
  const [publicationKey] = useState(() => entry ? undefined : crypto.randomUUID());
  const [fields, setFields] = useState({
    week: entry?.week ?? week,
    productId: entry?.productId ?? '',
    title: entry?.title ?? '',
    changed: entry?.changed ?? '',
    benefit: entry?.benefit ?? '',
    links: entry?.links.map((pr) => pr.url).join('\n') ?? '',
  });
  const [catalogue, setCatalogue] = useState(products),
    [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  function field(key: keyof typeof fields, value: string) {
    setFields((previous) => ({ ...previous, [key]: value }));
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      await api(
        path + '/entries' + (entry ? '/' + entry.id : ''),
        entry ? 'PUT' : 'POST',
        {
          ...fields,
          ...(entry ? { revision: entry.revision } : { publicationKey }),
          links: fields.links.split(/\s+/).filter(Boolean),
        },
      );
      onSaved(fields.week);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="changelog">
      <h1>{entry ? 'Edit entry' : 'Write an entry'}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Week starting
            <input
              type="date"
              required
              value={fields.week}
              onChange={(e) =>
                field('week', e.target.value ? monday(e.target.value) : '')
              }
            />
          </label>
          <label>
            Product
            <select
              required
              value={fields.productId}
              onChange={(e) => field('productId', e.target.value)}
            >
              <option value="">Choose a product</option>
              {catalogue.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setAdding(true)}>
            Add product
          </button>
          <label>
            Title
            <input
              required
              value={fields.title}
              onChange={(e) => field('title', e.target.value)}
            />
          </label>
          <label>
            What changed
            <textarea
              required
              value={fields.changed}
              onChange={(e) => field('changed', e.target.value)}
            />
          </label>
          <label>
            Why it helps
            <textarea
              required
              value={fields.benefit}
              onChange={(e) => field('benefit', e.target.value)}
            />
          </label>
          <ChangelogPicker key={fields.week} week={fields.week} links={fields.links}
            onAdd={url => setFields(previous => ({ ...previous, links: [previous.links.trim(), url].filter(Boolean).join('\n') }))} />
          <label>
            Pull request links
            <textarea
              required
              placeholder="One GitHub PR link per line"
              value={fields.links}
              onChange={(e) => field('links', e.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <div className="changelog-actions">
            <button>{entry ? 'Save changes' : 'Publish'}</button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </fieldset>
      </form>
      {adding && (
        <ProductDialog
          onClose={() => setAdding(false)}
          onAdd={(p) => {
            setCatalogue((prev) =>
              prev.some((item) => item.id === p.id) ? prev : [...prev, p],
            );
            field('productId', p.id);
            setAdding(false);
          }}
        />
      )}
    </section>
  );
}
export function Changelog({ userId }: { userId: string }) {
  const [week, setWeek] = useState(() => monday(day())),
    [view, setView] = useState('team'),
    [revision, reload] = useState(0);
  const [data, setData] = useState<ChangelogView>(),
    [error, setError] = useState(''),
    [editor, setEditor] = useState<ChangelogEntry | 'new'>();
  useEffect(() => {
    const controller = new AbortController();
    setData(undefined);
    setError('');
    void api<ChangelogView>(
      path + '?week=' + week + '&view=' + view,
      'GET',
      undefined,
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [week, view, revision]);
  function close() {
    setEditor(undefined);
    reload((n) => n + 1);
  }
  if (editor && data)
    return (
      <Editor
        entry={editor === 'new' ? undefined : editor}
        week={week}
        products={data.products}
        onClose={close}
        onSaved={(w) => {
          setWeek(w);
          close();
        }}
      />
    );
  return (
    <section className="changelog">
      <h1>Changelog</h1>
      <div className="changelog-actions">
        {(['team', 'mine'] as const).map((v) => (
          <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
            {v === 'team' ? 'Team' : 'Mine'}
          </button>
        ))}
        <button disabled={!data} onClick={() => setEditor('new')}>
          Write an entry
        </button>
      </div>
      <div className="changelog-actions">
        <button onClick={() => setWeek(shift(week, -7))}>Previous week</button>
        <span>Week of {week}</span>
        <button onClick={() => setWeek(shift(week, 7))}>Next week</button>
      </div>
      {error ? (
        <p role="alert">
          {error} <button onClick={() => reload((n) => n + 1)}>Retry</button>
        </p>
      ) : !data ? (
        <p role="status">Loading…</p>
      ) : data.entries.length === 0 ? (
        <p>No entries for this week.</p>
      ) : (
        data.entries.map((e) => (
          <article className="read-section" key={e.id}>
            <small>
              {e.product} · {e.author}
            </small>
            <h2>{e.title}</h2>
            <h3>What changed</h3>
            <p>{e.changed}</p>
            <h3>Why it helps</h3>
            <p>{e.benefit}</p>
            <ul>
              {e.links.map((pr, i) => (
                <li key={i}>
                  <a href={pr.url}>{pr.title}</a>
                </li>
              ))}
            </ul>
            {e.authorId === userId && (
              <button onClick={() => setEditor(e)}>Edit entry</button>
            )}
          </article>
        ))
      )}
    </section>
  );
}
