'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/destinations.js'), 'utf8');

function dataWithFetch(fetch) {
  const context = { fetch, URL, URLSearchParams, AbortController, setTimeout, clearTimeout };
  vm.runInNewContext(source, context);
  return context.TravelData;
}

const paris = { name: 'Paris', country: 'France', countryCode: 'FR', lat: 48.85341, lon: 2.3488 };

test('discovery fetches coordinates for every result and batches summaries below the API cap', async () => {
  const requests = [];
  const data = dataWithFetch(async url => {
    requests.push(url);
    if (url.searchParams.get('generator') === 'search') {
      assert.equal(url.searchParams.get('colimit'), 'max');
      return { ok: true, json: async () => ({ query: { pages: Object.fromEntries(
        Array.from({ length: 40 }, (_, index) => [index + 1, {
          pageid: index + 1, title: `Museum ${index + 1}`, coordinates: [{ lat: 48.85, lon: 2.35 }]
        }])
      ) } }) };
    }
    const ids = url.searchParams.get('pageids').split('|');
    assert.ok(ids.length <= 20);
    assert.equal(url.searchParams.get('exlimit'), '20');
    return { ok: true, json: async () => ({ query: { pages: Object.fromEntries(
      ids.map(id => [id, { pageid: Number(id), title: `Museum ${id}`, extract: 'An art museum in the city.' }])
    ) } }) };
  });
  const places = await data.discoverPlaces(paris);
  assert.equal(places.length, 40);
  assert.equal(requests.length, 3);
  assert.ok(places.every(place => place.wiki.startsWith('https://en.wikipedia.org/')));
  assert.ok(places.every(place => place.image === ''));
});

test('empty discovery and provider errors are explicit, not fabricated successful trips', async () => {
  const empty = dataWithFetch(async () => ({ ok: true, json: async () => ({}) }));
  await assert.rejects(() => empty.discoverPlaces(paris), /No suitable places/);
  const failed = dataWithFetch(async () => ({ ok: false, status: 429 }));
  await assert.rejects(() => failed.searchCities('Paris'), /HTTP 429/);
  const network = dataWithFetch(async () => { throw new Error('Offline'); });
  await assert.rejects(() => network.discoverPlaces(paris), /Offline/);
});

test('offline Pune needs no fetch and known transit is matched by country as well as city', async () => {
  const data = dataWithFetch(async () => { throw new Error('Must not fetch for Pune'); });
  assert.ok((await data.discoverPlaces(data.pune)).length > 8);
  assert.equal((await data.searchCities('Pune'))[0].countryCode, 'IN');
  assert.ok(data.transport(paris));
  assert.equal(data.transport({ ...paris, countryCode: 'US' }), null);
});

test('emergency numbers are country-specific and unknown regions never get a fake default', () => {
  const data = dataWithFetch(() => {});
  assert.equal(data.contacts(paris).numbers[0][0], '112');
  assert.equal(data.contacts({ countryCode: 'US' }).numbers[0][0], '911');
  assert.equal(data.contacts({ countryCode: 'AU' }).numbers[0][0], '000');
  assert.equal(data.contacts({ countryCode: 'ZZ' }), null);
});
