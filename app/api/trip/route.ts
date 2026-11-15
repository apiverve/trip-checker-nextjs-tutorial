import { callApi, fail, fromCache, guard, respond, str, toCache } from '@/lib/apiverve';

// Visa and entry rules change slowly, so an hour of cache is safe and saves credits.
const TTL_MS = 60 * 60_000;
const CODE = /^[A-Z]{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/trip?passport=US&destination=JP&arrival=2027-03-01&expiry=2027-07-01 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const passport = str(params.get('passport'), 2).toUpperCase();
  const destination = str(params.get('destination'), 2).toUpperCase();
  const arrival = str(params.get('arrival'), 10);
  const expiry = str(params.get('expiry'), 10);
  if (!CODE.test(passport) || !CODE.test(destination)) return fail('Pick a passport and a destination');
  if (passport === destination) return fail('Pick a destination other than your own country');
  if ((arrival && !DATE.test(arrival)) || (expiry && !DATE.test(expiry))) return fail('Dates must be YYYY-MM-DD');

  const key = `trip:${passport}:${destination}:${arrival}:${expiry}`;
  const hit = fromCache(key, TTL_MS);
  if (hit) return Response.json(hit);

  const blocked = guard(request);
  if (blocked) return blocked;

  return respond(async () => {
    const entryQuery: Record<string, string> = { destination };
    if (arrival) entryQuery.arrivalDate = arrival;
    if (expiry) entryQuery.passportExpiry = expiry;
    // Two calls in parallel: can I go (Visa Requirements), and what does my passport need (Entry Requirements).
    // Entry rules aren't published for every destination, so a missing answer there still shows the visa.
    let entryLimited = false;
    const [visa, entry] = await Promise.all([
      callApi('visarequirements', { query: { passport, destination } }),
      callApi('entryrequirements', { query: entryQuery }).catch((err) => {
        entryLimited = err.status === 429; // rate limited, not "no rules": don't remember it
        return null;
      })
    ]);
    const data = { visa, entry };
    if (!entryLimited) toCache(key, data);
    return data;
  });
}
