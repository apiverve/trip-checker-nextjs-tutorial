'use client';

import { useEffect, useState } from 'react';
import { COUNTRIES } from '@/lib/countries';

type Visa = {
  passportName: string;
  destinationName: string;
  requirement: string;
  requirementLabel: string;
  visaRequiredInAdvance: boolean;
  allowedStay: string | null;
  onlineApplication: { scheme: string; officialUrl: string } | null;
};
type Entry = {
  passportValidity: { summary: string | null; guidance: string | null };
  blankPagesRequired: number | null;
  passportCheck: { requiredValidUntil: string | null; meetsRequirement: boolean | null } | null;
  yellowFever: { certificateLabel: string | null };
  advisories: { uk: { level: number | string; label: string } | null; us: { level: number | string; label: string } | null } | null;
};
type Result = { visa: Visa; entry: Entry };

// How each answer feels: green to go, amber needs a form, red needs a visa first.
const TONE: Record<string, string> = {
  visa_free: 'go',
  eta: 'form',
  evisa: 'form',
  visa_on_arrival: 'form',
  visa_required: 'stop',
  restricted: 'stop'
};

const fmt = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Home() {
  const [passport, setPassport] = useState('US');
  const [destination, setDestination] = useState('JP');
  const [arrival, setArrival] = useState('');
  const [expiry, setExpiry] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [missingKey, setMissingKey] = useState(false);
  const [loading, setLoading] = useState(false);

  async function check(p = passport, d = destination, a = arrival, e = expiry) {
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams({ passport: p, destination: d });
      if (a) q.set('arrival', a);
      if (e) q.set('expiry', e);
      const res = await fetch(`/api/trip?${q}`);
      const body = await res.json();
      if (body.code === 'missing_key') return setMissingKey(true);
      if (!res.ok) throw new Error(body.error || 'Something went wrong');
      setResult(body);
      try { localStorage.setItem('passport', p); } catch {}
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ?passport=US&destination=JP opens straight onto an answer; otherwise remember the last passport.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    let p = q.get('passport')?.toUpperCase() || '';
    if (!p) try { p = localStorage.getItem('passport') || ''; } catch {}
    const d = q.get('destination')?.toUpperCase() || 'JP';
    const a = q.get('arrival') || '';
    const e = q.get('expiry') || '';
    if (p) setPassport(p);
    setDestination(d);
    setArrival(a);
    setExpiry(e);
    check(p || 'US', d, a, e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (missingKey) {
    return (
      <main className="shell">
        <section className="ticket missing">
          <h1>Add your API key</h1>
          <p>
            Trip Checker needs an APIVerve key. Set <code>APIVERVE_API_KEY</code> in <code>.env</code>, or in your
            Vercel project&rsquo;s environment variables, then restart or redeploy.
          </p>
          <a className="cta" href="https://dashboard.apiverve.com/signup?api=visarequirements" target="_blank" rel="noreferrer">
            Get a free key
          </a>
        </section>
      </main>
    );
  }

  const v = result?.visa;
  const e = result?.entry;
  const tone = v ? TONE[v.requirement] || 'form' : '';
  const advisories = [e?.advisories?.uk && ['UK', e.advisories.uk], e?.advisories?.us && ['US', e.advisories.us]].filter(
    Boolean
  ) as [string, { level: number | string; label: string }][];

  return (
    <main className="shell">
      <header className="brand">
        <span className="plane" aria-hidden>✈</span>
        <div>
          <h1>Trip Checker</h1>
          <p>Visa and passport rules before you book</p>
        </div>
      </header>

      <form
        className="form"
        onSubmit={(ev) => {
          ev.preventDefault();
          check();
        }}
      >
        <label>
          <span>My passport</span>
          <select value={passport} onChange={(ev) => setPassport(ev.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Going to</span>
          <select value={destination} onChange={(ev) => setDestination(ev.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Arriving <i>optional</i></span>
          <input type="date" value={arrival} onChange={(ev) => setArrival(ev.target.value)} />
        </label>
        <label>
          <span>Passport expires <i>optional</i></span>
          <input type="date" value={expiry} onChange={(ev) => setExpiry(ev.target.value)} />
        </label>
        <button disabled={loading}>{loading ? 'Checking…' : 'Check my trip'}</button>
      </form>

      {error && <p className="error">{error}</p>}

      {v && e && (
        <section className={`ticket tone-${tone}`} aria-live="polite">
          <div className="route">
            <div>
              <small>From</small>
              <strong>{v.passportName}</strong>
            </div>
            <span className="dash" aria-hidden>- - ✈ - -</span>
            <div className="right">
              <small>To</small>
              <strong>{v.destinationName}</strong>
            </div>
          </div>

          <div className="verdict">
            <span className="stamp">{v.requirementLabel}</span>
            {v.allowedStay && <span className="stay">Stay up to {v.allowedStay}</span>}
          </div>
          <p className="note">
            {v.visaRequiredInAdvance
              ? 'Arrange your visa before you travel.'
              : tone === 'go'
                ? 'No visa to arrange before you go.'
                : 'Nothing to arrange at an embassy, but check the form below.'}
          </p>
          {v.onlineApplication?.officialUrl && (
            <a className="cta" href={v.onlineApplication.officialUrl} target="_blank" rel="noreferrer">
              Apply for the {v.onlineApplication.scheme} at {new URL(v.onlineApplication.officialUrl).hostname.replace(/^www\./, '')}
            </a>
          )}

          <div className="perforation" aria-hidden />

          <dl className="facts">
            <div>
              <dt>Passport validity</dt>
              <dd>{e.passportValidity.summary || 'No minimum stated'}</dd>
            </div>
            {e.passportCheck?.requiredValidUntil && (
              <div>
                <dt>Your passport</dt>
                <dd className={e.passportCheck.meetsRequirement ? 'ok' : 'bad'}>
                  {e.passportCheck.meetsRequirement ? 'Passes' : 'Too short'}: must be valid until{' '}
                  {fmt(e.passportCheck.requiredValidUntil)}
                </dd>
              </div>
            )}
            {e.blankPagesRequired != null && (
              <div>
                <dt>Blank pages</dt>
                <dd>{e.blankPagesRequired}</dd>
              </div>
            )}
            <div>
              <dt>Yellow fever</dt>
              <dd>{e.yellowFever.certificateLabel || 'Not listed'}</dd>
            </div>
            {advisories.map(([who, a]) => (
              <div key={who}>
                <dt>{who} advice</dt>
                <dd>{typeof a.level === 'number' ? `Level ${a.level}: ` : ''}{a.label}</dd>
              </div>
            ))}
          </dl>
          {e.passportValidity.guidance && <p className="guidance">{e.passportValidity.guidance}</p>}
        </section>
      )}

      <footer className="foot">
        Rules change. Check with official sources before you travel. Data by{' '}
        <a href="https://apiverve.com/marketplace/visarequirements" target="_blank" rel="noreferrer">APIVerve</a>.
      </footer>
    </main>
  );
}
