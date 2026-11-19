'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../src/planner-core.js');

const profile = {
  origin: 'Mumbai',
  destination: { id: 'pune', name: 'Pune', country: 'India', countryCode: 'IN', lat: 18.52, lon: 73.85 },
  days: 6, startDate: '', style: 'couple', currency: 'INR', budgetMode: 'person', amount: 15000,
  travelers: { male: 1, female: 1, children: 0, older: 0 }
};
const place = (id, offset = 0, units = 2) => ({
  id, title: `Place ${id}`, lat: 18.52 + offset, lon: 73.85, summary: 'A place to explore.', units
});

test('per-person budgets include every traveller once and category totals reconcile exactly', () => {
  const family = { ...profile, amount: 12347, travelers: { male: 1, female: 1, children: 2, older: 1 } };
  const budget = Core.allocateBudget(family);
  assert.equal(Core.totalBudget(budget), 12347 * 5);
  assert.ok(Object.values(budget).every(value => Number.isInteger(value) && value >= 0));
  assert.equal(Core.totalBudget(Core.allocateBudget({ ...family, budgetMode: 'group', amount: 1 })), 1);
});

test('invalid trip counts and invalid budgets are rejected rather than silently coerced', () => {
  assert.throws(() => Core.validateProfile({ ...profile, travelers: { male: 0, female: 0, children: 0, older: 0 } }), /travellers/);
  assert.throws(() => Core.validateProfile({ ...profile, days: 0 }), /1 and 60/);
  assert.throws(() => Core.validateProfile({ ...profile, destination: null }), /destination/);
  assert.throws(() => Core.validateProfile({ ...profile, travelers: { ...profile.travelers, male: 1.5 } }), /travellers/);
  const budget = Core.allocateBudget(profile);
  for (const bad of [-1, NaN, 1.5, Infinity, '10']) {
    assert.throws(() => Core.validateBudget({ ...budget, food: bad }), /non-negative/);
  }
});

test('activity allowances never exceed the saved category and shortfalls become exterior-only', () => {
  const budget = { ...Core.allocateBudget(profile), activities: 300 };
  const plan = Core.makePlan(profile, budget, [place('a'), place('b', 0.001), place('c', 0.002, 0.5)]);
  assert.ok(plan.activities <= budget.activities);
  assert.equal(plan.activities + plan.unallocatedActivities, budget.activities);
  assert.equal(plan.days.flatMap(day => day.stops).filter(stop => stop.exteriorOnly).length, 2);
  assert.ok(plan.days.flatMap(day => day.stops).filter(stop => stop.exteriorOnly).every(stop => stop.allowance === 0));
});

test('saving a new activity allocation meaningfully changes the generated visit mode', () => {
  const places = [place('a')];
  const budget = Core.allocateBudget(profile);
  const low = Core.makePlan(profile, { ...budget, activities: 0 }, places);
  const high = Core.makePlan(profile, { ...budget, activities: 2000 }, places);
  assert.equal(low.days[0].stops[0].exteriorOnly, true);
  assert.equal(high.days[0].stops[0].exteriorOnly, false);
  assert.ok(high.activities > low.activities);
});

test('local transport budget limits distant suggestions instead of scheduling unaffordable transfers', () => {
  const places = [place('near'), place('far', 0.13)];
  const budget = Core.allocateBudget(profile);
  const walk = Core.makePlan(profile, { ...budget, local: 0 }, places);
  const ride = Core.makePlan(profile, { ...budget, local: 20000 }, places);
  assert.deepEqual(walk.days.flatMap(day => day.stops).map(stop => stop.id), ['near']);
  assert.equal(ride.days.flatMap(day => day.stops).length, 2);
});

test('days are unique, first/last days stay lighter, and children get a gentler pace', () => {
  const places = Array.from({ length: 30 }, (_, index) => place(String(index), index / 10000));
  const budget = Core.allocateBudget(profile);
  const adultPlan = Core.makePlan(profile, budget, places);
  const familyPlan = Core.makePlan({ ...profile, travelers: { ...profile.travelers, children: 1 } }, budget, places);
  assert.equal(adultPlan.days.length, profile.days);
  assert.equal(adultPlan.days[0].stops.length, 2);
  assert.equal(adultPlan.days.at(-1).stops.length, 2);
  assert.equal(adultPlan.days[1].stops.length, 3);
  assert.ok(familyPlan.days.every(day => day.stops.length <= 2));
  const ids = adultPlan.days.flatMap(day => day.stops.map(stop => stop.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('excluded, duplicate and invalid places cannot create extra stops; empty days remain honest', () => {
  const plan = Core.makePlan(profile, Core.allocateBudget(profile), [
    place('a'), place('a'), { ...place('b'), enabled: false }, { ...place('c'), lat: NaN }
  ]);
  assert.equal(plan.days.flatMap(day => day.stops).length, 1);
  assert.equal(plan.days.length, 6);
  assert.equal(plan.days[5].stops.length, 0);
});

test('prominent daily anchors are paired with nearby stops instead of only minor city-centre places', () => {
  const places = [
    { ...place('small-square'), priority: 40 },
    { ...place('landmark', 0.02), priority: 1 },
    { ...place('near-landmark', 0.021), priority: 20 }
  ];
  const plan = Core.makePlan(profile, Core.allocateBudget(profile), places);
  assert.deepEqual(plan.days[0].stops.map(stop => stop.id), ['landmark', 'near-landmark']);
});

test('day routes preserve destination country, actual terminals, mode and stop coordinates', () => {
  const paris = { ...profile, destination: { ...profile.destination, name: 'Paris', country: 'France', countryCode: 'FR', lat: 48.85, lon: 2.35 } };
  const url = new URL(Core.routeUrl({ n: 6, stops: [{ lat: 48.86, lon: 2.36 }] }, paris,
    { base: 'Hotel & Garden, Paris', departure: 'CDG Airport', mode: 'transit' }));
  assert.equal(url.searchParams.get('origin'), 'Hotel & Garden, Paris');
  assert.equal(url.searchParams.get('destination'), 'CDG Airport');
  assert.equal(url.searchParams.get('waypoints'), '48.86,2.36');
  assert.equal(url.searchParams.get('travelmode'), 'transit');
  const defaultUrl = new URL(Core.routeUrl({ n: 1, stops: [] }, paris));
  assert.equal(defaultUrl.searchParams.get('origin'), 'Paris, France');
  assert.ok(!defaultUrl.href.includes('India'));
});

test('packing suggestions respond to destination, duration and group needs', () => {
  const family = { ...profile, days: 12, style: 'family', travelers: { ...profile.travelers, children: 1, older: 1 } };
  const items = Core.packingItems(family);
  assert.ok(items.some(item => item.label.includes('Child ID')));
  assert.ok(items.some(item => item.label.includes('Mobility')));
  assert.ok(items.some(item => item.label.includes('Laundry')));
  assert.ok(items.some(item => item.label.includes('Pune')));
  assert.equal(new Set(items.map(item => item.id)).size, items.length);
});

test('saved state validation rejects damaged data without rejecting a valid empty packing list', () => {
  const saved = {
    version: 1, profile, budget: Core.allocateBudget(profile), places: [place('a')],
    packing: [], completed: [1], bookings: { outbound: true },
    routes: { base: '', arrival: '', departure: '', mode: 'transit' }
  };
  assert.equal(Core.validateState(saved), saved);
  assert.throws(() => Core.validateState({ ...saved, completed: [7] }), /damaged/);
  assert.throws(() => Core.validateState({ ...saved, routes: {} }), /damaged/);
  assert.throws(() => Core.validateState({ ...saved, version: 999 }), /unsupported/);
});
