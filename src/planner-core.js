(function (root) {
  'use strict';

  const categories = ['intercity', 'stay', 'food', 'local', 'activities', 'reserve'];
  const shares = [25, 30, 18, 12, 10, 5];
  const currencyUnits = { INR: 120, USD: 5, EUR: 5, GBP: 4, JPY: 600, AUD: 7, CAD: 7, SGD: 7, AED: 18, THB: 150 };

  function people(profile) {
    return ['male', 'female', 'children', 'older'].reduce((sum, key) => sum + profile.travelers[key], 0);
  }

  function totalBudget(budget) {
    return categories.reduce((sum, key) => sum + budget[key], 0);
  }

  function validateProfile(profile) {
    if (!profile.origin?.trim()) throw new Error('Enter where you are travelling from.');
    const city = profile.destination;
    if (!city?.name || !city.countryCode || !Number.isFinite(city.lat) || !Number.isFinite(city.lon) ||
        Math.abs(city.lat) > 90 || Math.abs(city.lon) > 180) throw new Error('Choose a destination from the city search results.');
    if (!Number.isInteger(profile.days) || profile.days < 1 || profile.days > 60) throw new Error('Choose between 1 and 60 days.');
    if (!profile.travelers || !['male', 'female', 'children', 'older'].every(key =>
      Number.isInteger(profile.travelers[key]) && profile.travelers[key] >= 0 && profile.travelers[key] <= 50
    ) || people(profile) < 1 || people(profile) > 50) throw new Error('Enter 1–50 travellers, counting each person only once.');
    if (!['solo', 'couple', 'family', 'friends', 'group'].includes(profile.style)) throw new Error('Choose your travel style.');
    if (!Object.hasOwn(currencyUnits, profile.currency)) throw new Error('Choose a supported budget currency.');
    if (!['group', 'person'].includes(profile.budgetMode) || !Number.isFinite(profile.amount) ||
        profile.amount <= 0 || profile.amount > 1e9) throw new Error('Enter a budget greater than zero and at most 1,000,000,000.');
    if (profile.amount * (profile.budgetMode === 'person' ? people(profile) : 1) > 1e9) throw new Error('The group budget must not exceed 1,000,000,000.');
    if (profile.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(profile.startDate)) throw new Error('Choose a valid departure date.');
    return profile;
  }

  function allocateBudget(profile) {
    validateProfile(profile);
    const amount = Math.round(profile.amount * (profile.budgetMode === 'person' ? people(profile) : 1));
    return splitBudget(amount);
  }

  function splitBudget(amount) {
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1e9) throw new Error('The group budget must be a whole amount between 1 and 1,000,000,000.');
    const budget = {};
    categories.forEach((key, index) => {
      budget[key] = index === categories.length - 1
        ? amount - totalBudget({ ...Object.fromEntries(categories.map(name => [name, 0])), ...budget })
        : Math.floor(amount * shares[index] / 100);
    });
    return budget;
  }

  function validateBudget(budget) {
    if (!budget || !categories.every(key => Number.isSafeInteger(budget[key]) && budget[key] >= 0) ||
        totalBudget(budget) <= 0 || totalBudget(budget) > 1e9) {
      throw new Error('Enter whole, non-negative amounts in every category, with a total between 1 and 1,000,000,000.');
    }
    return budget;
  }

  function distance(a, b) {
    const rad = value => value * Math.PI / 180;
    const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  }

  function validPlace(place) {
    return place && typeof place.id === 'string' && typeof place.title === 'string' &&
      Number.isFinite(place.lat) && Number.isFinite(place.lon) &&
      Math.abs(place.lat) <= 90 && Math.abs(place.lon) <= 180 &&
      Number.isFinite(place.units) && place.units >= 0 && typeof place.summary === 'string';
  }

  function makePlan(profile, budget, places) {
    validateProfile(profile);
    validateBudget(budget);
    const group = people(profile);
    const unit = currencyUnits[profile.currency];
    let remaining = budget.activities;
    const pool = [...new Map(places.filter(place => validPlace(place) && place.enabled !== false).map(place => [place.id, place])).values()];
    const gentle = profile.travelers.children > 0 || profile.travelers.older > 0;
    const perDay = gentle ? 2 : 3;
    const transportUnits = budget.local / (profile.days * group * unit);
    const maxLegKm = transportUnits >= 4 ? 40 : transportUnits >= 1 ? 12 : transportUnits > 0 ? 5 : 2.5;
    const days = [];
    for (let index = 0; index < profile.days; index++) {
      let point = profile.destination;
      const stops = [];
      // Short arrival/departure days leave room for the journey, not another attraction.
      const limit = index === 0 || index === profile.days - 1 ? Math.min(2, perDay) : perDay;
      while (stops.length < limit && pool.length) {
        pool.sort((a, b) => (stops.length === 0 ? (a.priority ?? 100) - (b.priority ?? 100) : 0) ||
          distance(point, a) - distance(point, b) || a.title.localeCompare(b.title));
        const next = pool.findIndex(place => distance(point, place) <= maxLegKm && distance(profile.destination, place) <= maxLegKm * 1.5);
        if (next === -1) break;
        const [place] = pool.splice(next, 1);
        const allowance = Math.ceil(place.units * unit * group);
        const exteriorOnly = allowance > remaining;
        const cost = exteriorOnly ? 0 : allowance;
        remaining -= cost;
        stops.push({ ...place, allowance: cost, exteriorOnly });
        point = place;
      }
      days.push({
        n: index + 1,
        stops,
        activityAllowance: stops.reduce((sum, stop) => sum + stop.allowance, 0),
        gentle
      });
    }
    return { days, activities: budget.activities - remaining, unallocatedActivities: remaining, maxLegKm };
  }

  function budgetWarnings(profile, budget) {
    const unit = currencyUnits[profile.currency];
    const personDays = people(profile) * profile.days;
    const warnings = ['Intercity fares, hotel availability, entry fees and opening hours are not live quotes. Confirm them before booking; an allocation is not proof the trip is affordable.'];
    if (budget.intercity === 0) warnings.push('No arrival/return travel allowance: confirm prepaid travel or add a quote.');
    if (budget.stay === 0 && profile.days > 1) warnings.push('No accommodation allowance: confirm a free or prepaid stay.');
    if (budget.food / personDays < unit * 2) warnings.push('Food allocation is very lean for this group and duration. Verify meal prices or increase it.');
    if (budget.stay / Math.max(1, profile.days - 1) < unit * 5 && profile.days > 1 && budget.stay > 0) warnings.push('The nightly stay allowance is low. Get a room quote for the entire group.');
    if (budget.local === 0) warnings.push('No local transport allowance: routes may need paid transit. Check walking distances and accessibility.');
    if (budget.reserve === 0) warnings.push('No contingency reserve. Keep funds available for delays and emergencies.');
    return warnings;
  }

  function routeUrl(day, profile, routes = {}) {
    const base = routes.base?.trim() || `${profile.destination.name}, ${profile.destination.country}`;
    const origin = day.n === 1 && routes.arrival?.trim() ? routes.arrival.trim() : base;
    const destination = day.n === profile.days && routes.departure?.trim() ? routes.departure.trim() : base;
    const params = new URLSearchParams({ api: '1', origin, destination, travelmode: routes.mode || 'transit' });
    // At most three waypoints also works in mobile browsers.
    if (day.stops.length) params.set('waypoints', day.stops.map(stop => `${stop.lat},${stop.lon}`).join('|'));
    return `https://www.google.com/maps/dir/?${params}`;
  }

  function packingItems(profile) {
    const items = [
      'Photo ID and secure document copies', 'Tickets, reservations and accommodation details',
      'Wallet, payment cards and emergency cash', 'Phone and charging cable', 'Power bank (check airline limits)',
      'Comfortable walking shoes', 'Clothes and underwear for the trip', 'Light layers for changing temperatures',
      'Sleepwear and spare socks', 'Toiletries and toothbrush', 'Sunscreen, sunglasses and sun hat',
      'Reusable water bottle', 'Small day bag', 'Rain jacket or compact umbrella',
      'Personal prescriptions and copies', 'Small first-aid kit', 'Offline maps and saved emergency numbers',
      'Reusable bag and laundry pouch', 'Travel insurance details', 'Destination-compatible plug adapter'
    ];
    if (profile.travelers.children) items.push('Child ID and guardian contact card', 'Child snacks and comfort toy', 'Age-appropriate child restraints / carrier', 'Nappies or spare child clothes as needed');
    if (profile.travelers.older) items.push('Mobility aids and spare batteries if used', 'Medication organiser and prescription list', 'Accessible accommodation and transport confirmations');
    if (profile.style === 'solo') items.push('Trusted-contact check-in schedule');
    if (profile.days > 7) items.push('Laundry supplies for a longer trip');
    if (profile.destination.countryCode === 'IN') items.push('Modest clothing for religious sites', 'Insect repellent');
    if (profile.destination.lat > 40 || profile.destination.lat < -35) items.push('Check seasonal temperatures; add warm / waterproof layers if needed');
    items.push(`Seasonal weather check for ${profile.destination.name}`);
    return items.map((label, index) => ({ id: `pack-${index}`, label, packed: false }));
  }

  function validateState(state) {
    if (state?.version !== 1) throw new Error('This saved trip uses an unsupported format.');
    validateProfile(state.profile);
    validateBudget(state.budget);
    if (!Array.isArray(state.places) || !state.places.every(validPlace) ||
        !Array.isArray(state.completed) || !state.completed.every(n => Number.isInteger(n) && n >= 1 && n <= state.profile.days) ||
        !Array.isArray(state.packing) || !state.packing.every(item => typeof item.id === 'string' && typeof item.label === 'string' && typeof item.packed === 'boolean') ||
        !state.bookings || typeof state.bookings !== 'object' || Array.isArray(state.bookings) ||
        !Object.values(state.bookings).every(value => typeof value === 'boolean') ||
        !state.routes || !['base', 'arrival', 'departure', 'mode'].every(key => typeof state.routes[key] === 'string') ||
        !['transit', 'walking', 'driving', 'bicycling'].includes(state.routes.mode)) {
      throw new Error('The saved trip is incomplete or damaged. Replace it only when you are ready to overwrite its stored data.');
    }
    return state;
  }

  const api = { categories, people, totalBudget, validateProfile, allocateBudget, splitBudget, validateBudget, distance, makePlan, budgetWarnings, routeUrl, packingItems, validateState };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TravelCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
