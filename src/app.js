(function () {
  'use strict';

  const Core = TravelCore;
  const Data = TravelData;
  const storageKey = 'roam-together-trip-v1';
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const search = query => `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  const map = query => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  const labels = { intercity: 'Round-trip travel', stay: 'Accommodation', food: 'Food & drinks', local: 'Local transport', activities: 'Activities & entry', reserve: 'Other / contingency' };
  const colours = ['#b29fe5', '#8cb7d1', '#e8b946', '#76b68a', '#d99976', '#a8a39a'];
  let state = null;
  let plan = null;
  let selectedCity = null;
  let cityResults = [];
  let allOpen = true;
  let storageWorking = true;
  let damagedSave = false;
  let toastTimer;
  let tipIndex = 0;
  let busy = false;

  function safeUrl(url) {
    try {
      const parsed = new URL(url);
      return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : '';
    } catch {
      return '';
    }
  }

  function link(label, url, classes = 'btn small ghost') {
    const href = safeUrl(url);
    return href ? `<a class="${classes}" href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>` : '';
  }

  function money(amount) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: state.profile.currency, maximumFractionDigits: 0 }).format(amount);
  }

  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3500);
  }

  function errorAt(id, message) {
    $(id).textContent = message;
    $(id).hidden = !message;
  }

  function storageError(error) {
    storageWorking = false;
    $('storageNotice').hidden = false;
    $('storageNotice').textContent = `Changes are only in memory: browser storage could not be written (${error.message}). Export your trip before closing this page.`;
  }

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      storageWorking = true;
      damagedSave = false;
      $('storageNotice').hidden = true;
      return true;
    } catch (error) {
      storageError(error);
      return false;
    }
  }

  function saved(message) {
    const persisted = persist();
    toast(persisted ? message : 'Updated in memory only. Export your trip to keep these changes.');
  }

  function image(place, className = '') {
    const src = place.image?.startsWith('assets/images/pune_photo_assets/') ? place.image : safeUrl(place.image);
    const alt = place.illustration ? `Illustrative Pune visual: ${place.title}` : place.title;
    return src
      ? `<img class="${className}" src="${escape(src)}" alt="${escape(alt)}" loading="lazy" referrerpolicy="no-referrer">`
      : `<div class="image-placeholder ${className}" role="img" aria-label="No verified image for ${escape(place.title)}"><span aria-hidden="true">🧭</span><span>${escape(place.title)}</span><small>No verified image available</small></div>`;
  }

  function imageCredit(place) {
    if (place.illustration) return '<div class="photo-source">Bundled illustrative / mockup visual · not documentary photography</div>';
    if (!place.imageCredit || !place.image) return '';
    const credit = place.imageCredit;
    return `<div class="photo-source">${escape(credit.author)} · ${link(credit.license, credit.licenseUrl, '')} · ${link('Original & attribution', place.imagePage, '')} · cropped to fit</div>`;
  }

  function handleImageError(event) {
    if (event.target.tagName !== 'IMG') return;
    const img = event.target;
    const note = document.createElement('div');
    note.className = `image-placeholder ${img.className}`;
    note.textContent = `🧭 ${img.alt} — image unavailable offline or from this provider`;
    img.replaceWith(note);
  }
  $('dashboard').addEventListener('error', handleImageError, true);

  function scheduledPlaces() {
    return [...new Map(plan.days.flatMap(day => day.stops).map(place => [place.id, place])).values()];
  }

  function currentProfile() {
    return Core.validateProfile({
      origin: $('origin').value.trim(), destination: selectedCity,
      days: Number($('tripDays').value), startDate: $('startDate').value,
      style: $('tripStyle').value, currency: $('currency').value,
      budgetMode: $('budgetMode').value, amount: Number($('budgetAmount').value),
      travelers: {
        male: Number($('maleCount').value), female: Number($('femaleCount').value),
        children: Number($('childCount').value), older: Number($('olderCount').value)
      }
    });
  }

  function showSelectedCity() {
    $('chosenCity').textContent = selectedCity
      ? `Destination: ${selectedCity.name}, ${selectedCity.region ? `${selectedCity.region}, ` : ''}${selectedCity.country}`
      : 'No destination selected yet.';
  }

  function onboardingTotal() {
    const group = ['maleCount', 'femaleCount', 'childCount', 'olderCount'].reduce((sum, id) => sum + Number($(id).value), 0);
    return Math.round(Number($('budgetAmount').value) * ($('budgetMode').value === 'person' ? group : 1));
  }

  function onboardingBudget() {
    const budget = Core.validateBudget(Object.fromEntries(Core.categories.map(key => {
      const value = $(`onboard-${key}`).value;
      return [key, value.trim() === '' ? NaN : Number(value)];
    })));
    if (Core.totalBudget(budget) !== onboardingTotal()) throw new Error('Your category amounts must add up to the group total. Rebalance the categories or change the overall budget.');
    return budget;
  }

  function onboardingBudgetSummary() {
    const currency = $('currency').value;
    const total = onboardingTotal();
    const allocated = Core.categories.reduce((sum, key) => sum + Number($(`onboard-${key}`)?.value || 0), 0);
    const format = amount => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
    $('onboardingBudgetSummary').textContent = `Group total: ${format(total)} · Categories: ${format(allocated)} · ${allocated === total ? 'Ready to plan' : `${format(total - allocated)} left to allocate (negative means over budget)`}`;
  }

  function resetOnboardingBudget() {
    try {
      const budget = Core.splitBudget(onboardingTotal());
      $('onboardingBudgetInputs').innerHTML = Core.categories.map(key =>
        `<div class="budget-line"><label for="onboard-${key}">${labels[key]}</label><input id="onboard-${key}" type="number" min="0" max="1000000000" step="1" value="${budget[key]}" required></div>`
      ).join('');
      onboardingBudgetSummary();
    } catch (error) {
      $('onboardingBudgetSummary').textContent = error.message;
    }
  }
  ['budgetAmount', 'budgetMode', 'currency', 'maleCount', 'femaleCount', 'childCount', 'olderCount'].forEach(id => $(id).addEventListener('input', resetOnboardingBudget));
  $('onboardingBudgetInputs').addEventListener('input', onboardingBudgetSummary);

  function setBusy(value) {
    busy = value;
    $('tripForm').querySelectorAll('input, select, button').forEach(input => { input.disabled = value; });
    $('createTrip').textContent = value ? 'Finding your next adventure…' : 'Build my travel journal 🧭';
    $('tripForm').setAttribute('aria-busy', String(value));
  }

  async function findCities() {
    const query = $('destinationQuery').value.trim();
    if (query.length < 2) {
      errorAt('onboardingError', 'Enter at least two characters to find a city.');
      return;
    }
    errorAt('onboardingError', '');
    selectedCity = null;
    showSelectedCity();
    $('cityResults').innerHTML = '';
    setBusy(true);
    $('discoveryStatus').textContent = 'Looking up matching cities…';
    try {
      cityResults = await Data.searchCities(query);
      if (!cityResults.length) throw new Error('No matching cities found. Try the city name without a country or postcode.');
      $('cityResults').innerHTML = cityResults.map((city, index) =>
        `<button type="button" class="city-option" data-city="${index}">${escape(city.name)}<span>${escape([city.region, city.country].filter(Boolean).join(', '))}</span></button>`
      ).join('');
      $('discoveryStatus').textContent = 'Choose the correct destination below the search field.';
    } catch (error) {
      errorAt('onboardingError', `City search failed: ${error.message}`);
      $('discoveryStatus').textContent = '';
    } finally {
      setBusy(false);
    }
  }

  $('findCity').addEventListener('click', findCities);
  $('destinationQuery').addEventListener('input', () => {
    selectedCity = null;
    $('cityResults').innerHTML = '';
    showSelectedCity();
  });
  $('destinationQuery').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); findCities(); }
  });
  $('cityResults').addEventListener('click', event => {
    const button = event.target.closest('[data-city]');
    if (!button || busy) return;
    selectedCity = cityResults[Number(button.dataset.city)];
    $('cityResults').querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    showSelectedCity();
  });

  $('tripForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    errorAt('onboardingError', '');
    let profile, budget;
    try {
      profile = currentProfile();
      budget = onboardingBudget();
    } catch (error) {
      errorAt('onboardingError', error.message);
      return;
    }
    if ((state || damagedSave) && !confirm(damagedSave
      ? 'Replace the unreadable saved trip? This overwrites its stored data.'
      : 'Replace the current trip? Export first if you want to keep a backup. A replacement gets a fresh budget, packing list and completion record.')) return;
    setBusy(true);
    $('discoveryStatus').textContent = 'Discovering nearby places, overviews and licensed images. This may take a moment…';
    try {
      const places = state && state.profile.destination.id === profile.destination.id
        ? state.places : await Data.discoverPlaces(profile.destination);
      const next = {
        version: 1, profile, places, budget,
        packing: Core.packingItems(profile), completed: [], bookings: {},
        routes: { base: '', arrival: '', departure: '', mode: 'transit' },
        discoveredAt: new Date().toISOString()
      };
      Core.validateState(next);
      state = next;
      plan = Core.makePlan(state.profile, state.budget, state.places);
      const persisted = persist();
      renderDashboard();
      toast(persisted ? 'Your travel journal is ready. Review the budget before booking.' : 'Trip created in memory only. Export it before closing.');
    } catch (error) {
      errorAt('onboardingError', `Could not build your trip: ${error.message} Your existing trip has not been replaced.`);
    } finally {
      setBusy(false);
      $('discoveryStatus').textContent = '';
    }
  });

  function renderHero() {
    const { profile, budget } = state;
    const city = profile.destination;
    const group = Core.people(profile);
    $('heroKicker').textContent = `${profile.days} days · ${city.name}, ${city.country}`;
    $('heroTitle').textContent = `${city.name}, your way`;
    $('heroSubtitle').textContent = `From ${profile.origin} to ${city.name}. ${group === 1 ? 'A little solo freedom' : `${group} travellers, one shared adventure`} — local stories, unhurried discoveries and a plan you can make your own.`;
    $('heroMeta').innerHTML = [
      `📍 ${city.name}, ${city.country}`, `🗓️ ${profile.startDate || 'Flexible dates'} · ${profile.days} days`,
      `🎒 ${profile.style} · ${group} ${group === 1 ? 'traveller' : 'travellers'}`, `💰 ${money(Core.totalBudget(budget))} group allowance`
    ].map(text => `<span class="chip">${escape(text)}</span>`).join('');
    $('groupTag').textContent = `${profile.style} · ${group} ${group === 1 ? 'traveller' : 'travellers'}`;
    $('mascotName').textContent = `${city.name} ${city.countryCode === 'IN' ? 'Mitra' : 'Compass'} · tap for a tip`;
    $('mascot').setAttribute('aria-label', `Get a tip from your ${city.name} travel companion`);
    document.title = `${city.name}, your way — Roam Together`;
    $('overviewCards').innerHTML = [
      ['The journey', `${profile.days} days`, `${profile.startDate || 'Flexible departure'} · ${Math.max(0, profile.days - 1)} nights assumed`],
      ['Your people', String(group), `${profile.travelers.male + profile.travelers.female} adults · ${profile.travelers.children} children · ${profile.travelers.older} older people`],
      ['Group allowance', money(Core.totalBudget(budget)), `${money(Core.totalBudget(budget) / group)} per person · all-inclusive`],
      ['Discoveries', `${scheduledPlaces().length} places`, `${plan.days.filter(day => day.stops.length).length} days with suggested stops · editable shortlist`]
    ].map(([label, big, desc]) => `<div class="card overview-card"><div class="label">${escape(label)}</div><div class="big">${escape(big)}</div><div class="desc">${escape(desc)}</div></div>`).join('');
    const preview = scheduledPlaces().slice(0, 4);
    $('filmLabel').textContent = `✦ POSTCARDS FROM ${city.name.toUpperCase()} ✦`;
    $('filmTiles').innerHTML = preview.length ? preview.map(place =>
      `<a href="${escape(map(`${place.title}, ${city.name}, ${city.country}`))}" target="_blank" rel="noopener noreferrer">${image(place)}<span>${escape(place.title)}</span></a>`
    ).join('') : '<p class="small-copy">Add a place to start your postcard collection.</p>';
    nextTip();
  }

  function renderTravel() {
    const { profile, budget, routes } = state;
    const city = profile.destination;
    $('travelSummary').innerHTML = `<div><div class="kicker">There &amp; back</div><h3>${escape(profile.origin)} ⇄ ${escape(city.name)}</h3><p class="small-copy">Round-trip allocation: ${escape(money(budget.intercity))}. Compare actual fares and baggage costs.</p>${link('Compare travel options', search(`${profile.origin} to ${city.name} ${city.country} train bus flights`))}</div><div><div class="kicker">Your home base</div><h3>${Math.max(0, profile.days - 1)} nights in ${escape(city.name)}</h3><p class="small-copy">Stay allocation: ${escape(money(budget.stay))} for the entire group. Taxes and room capacity need checking.</p>${link('Find accommodation', map(`accommodation in ${city.name}, ${city.country}`))}</div>`;
    $('baseAddress').value = routes.base;
    $('arrivalPoint').value = routes.arrival;
    $('departurePoint').value = routes.departure;
    $('routeMode').value = routes.mode;
  }

  function bookingRow(id, title, note, links) {
    return `<div class="booking"><div><label class="booking-check"><input type="checkbox" data-booking="${escape(id)}" ${state.bookings[id] ? 'checked' : ''}><b>${escape(title)}</b></label><p>${escape(note)}</p></div><div class="actions">${links}</div></div>`;
  }

  function renderBookings() {
    const { profile, budget } = state;
    const city = profile.destination;
    const cityText = `${city.name}, ${city.country}`;
    $('bookingList').innerHTML = [
      bookingRow('outbound', `${profile.origin} → ${city.name}`, 'Confirm outbound tickets, baggage and arrival transfer.', link('Find travel', search(`${profile.origin} to ${cityText} transport booking`))),
      bookingRow('return', `${city.name} → ${profile.origin}`, 'Confirm the return journey and leave a terminal buffer.', link('Find return travel', search(`${cityText} to ${profile.origin} transport booking`))),
      bookingRow('stay', `Stay in ${city.name}`, `${Math.max(0, profile.days - 1)} nights assumed · ${money(budget.stay)} group allocation. Check actual dates, room capacity and cancellation rules.`, link('Find stays', map(`hotels in ${cityText}`))),
      ...plan.days.flatMap(day => day.stops.map(place =>
        bookingRow(place.id, `Day ${day.n} · ${place.title}`,
          place.exteriorOnly ? 'Exterior / public-area visit only: no admission allocated. Verify public access; skip if restricted.'
            : `${money(place.allowance)} group activity allowance, not a quoted ticket. Check opening hours, age rules and actual prices.`,
          link('Map', map(`${place.title}, ${cityText}`)) + (!place.exteriorOnly ? link('Find official tickets / hours', search(`${place.title} ${cityText} official tickets opening hours`)) : ''))
      ))
    ].join('');
  }

  function stopHtml(place, index, day) {
    const time = day.gentle ? ['10:00', '15:00'][index] : ['09:30', '12:00', '15:30'][index];
    return `<div class="stop"><div class="stop-icon" aria-hidden="true">${index === 0 ? '🏛️' : index === 1 ? '🌿' : '📸'}</div><div class="time">${time}</div><div><h4>${escape(place.title)}</h4><p>${escape(place.summary)}</p><p class="allowance">${place.exteriorOnly ? '🚶 Exterior / public area only · no entry allocation; verify access' : `🎟️ ${escape(money(place.allowance))} group activity allowance · verify actual fee`}</p><div class="duration">Allow 60–90 minutes plus travel. Check opening times and accessibility before leaving.</div></div><div class="stop-actions">${link('Map', map(`${place.title}, ${state.profile.destination.name}, ${state.profile.destination.country}`))}${link('Wikipedia', place.wiki)}</div></div><div class="travel-gap">↳ Flexible transfer / rest buffer · no live travel-time estimate</div>`;
  }

  function renderDays() {
    allOpen = true;
    $('toggleDays').textContent = 'Collapse all days';
    $('daysContainer').innerHTML = plan.days.map(day => {
      const title = day.stops.length ? day.stops.map(place => place.title).join(' → ') : 'Room for your own discoveries';
      return `<article class="day" id="day${day.n}"><div class="day-top"><div><div class="day-heading"><div class="day-no">Day ${day.n} · ${day.gentle ? 'A gentler pace' : 'Time to explore'}</div><label class="checkline day-complete"><input class="day-check" type="checkbox" data-day="${day.n}" ${state.completed.includes(day.n) ? 'checked' : ''}> Day ${day.n} complete</label></div><h3>${escape(title)}</h3><div class="day-route">${escape(money(day.activityAllowance))} activity allowance · food &amp; transport allocated separately</div><div class="day-actions"><a class="btn small" href="${escape(Core.routeUrl(day, state.profile, state.routes))}" target="_blank" rel="noopener noreferrer">Full Day ${day.n} Google Maps route ↗</a><button type="button" class="btn small ghost" data-toggle-day="${day.n}" aria-expanded="true" aria-controls="daybody${day.n}">Show / hide schedule</button></div></div>${day.stops[0] ? image(day.stops[0], 'day-hero-img') : '<div class="free-day-art" aria-hidden="true">🎒 ☕ 🌿</div>'}</div><div class="day-body" id="daybody${day.n}"><div class="good-to-know"><b>Before you head out:</b> ${day.n === 1 ? 'Settle in and allow arrival time. Move these flexible slots if your journey arrives later. ' : ''}${day.n === state.profile.days ? 'Keep room for checkout and your return journey. ' : ''}${day.gentle ? 'Plan seated breaks, toilets and accessible transfers. ' : ''}Check local conditions and carry water. Meals are suggestions, not restaurant reservations.</div><div class="timeline"><div class="routine-stop">☕ Breakfast near your base · use your food allowance</div>${day.stops.map((place, index) => `${index === 1 ? '<div class="routine-stop">🍲 Lunch &amp; a rest break · near your chosen stops</div>' : ''}${stopHtml(place, index, day)}`).join('') || '<p class="notice">No additional suitable stops remain within this budget / shortlist. Rest, revisit independently or add your own place below. No new attraction or opening time is assumed.</p>'}${day.stops.length < 2 ? '<div class="routine-stop">🍲 Flexible lunch &amp; rest break near your base</div>' : ''}<div class="routine-stop">🌇 Flexible evening · dinner and return to your base on a trusted route</div></div></div></article>`;
    }).join('');
    $('shortlistChoices').innerHTML = state.places.map(place => `<label class="task"><input type="checkbox" data-shortlist="${escape(place.id)}" ${place.enabled !== false ? 'checked' : ''}>${escape(place.title)}</label>`).join('');
    updateTripProgress();
  }

  function updateTripProgress() {
    const completed = new Set(state.completed).size;
    const percent = Math.round(completed / state.profile.days * 100);
    $('tripProgressText').textContent = `${completed} / ${state.profile.days} days complete · ${state.profile.days - completed} to go`;
    $('tripProgress').setAttribute('aria-valuenow', String(percent));
    $('tripProgressFill').style.width = `${percent}%`;
    $('journeyIcon').style.left = `${percent}%`;
    document.querySelectorAll('.day').forEach(day => day.classList.toggle('completed-day', state.completed.includes(Number(day.id.slice(3)))));
  }

  function renderGallery() {
    $('galleryGrid').innerHTML = scheduledPlaces().map(place => `<figure class="photo">${image(place)}<figcaption><b>${escape(place.title)}</b><p class="small-copy">${escape(place.summary)}</p><div class="actions">${link('Google Maps', map(`${place.title}, ${state.profile.destination.name}, ${state.profile.destination.country}`))}${link('Wikipedia', place.wiki)}</div></figcaption>${imageCredit(place)}</figure>`).join('');
  }

  function draftBudget() {
    return Core.validateBudget(Object.fromEntries(Core.categories.map(key => {
      const raw = $(`budget-${key}`).value;
      return [key, raw.trim() === '' ? NaN : Number(raw)];
    })));
  }

  function updateBudgetPreview() {
    try {
      const draft = draftBudget();
      const total = Core.totalBudget(draft);
      $('budgetTotal').textContent = money(total);
      $('budgetPerPerson').textContent = `${money(total / Core.people(state.profile))} per person · ${money(total / state.profile.days)} per group-day`;
      $('allocationBar').innerHTML = Core.categories.map((key, index) => `<span style="width:${draft[key] / total * 100}%;background:${colours[index]}"></span>`).join('');
      const dirty = Core.categories.some(key => draft[key] !== state.budget[key]);
      $('budgetDraftNote').textContent = dirty ? `Unsaved draft: ${money(total)}. Save to apply this allocation.` : 'Saved allocation. Change any category to model a different trip.';
      errorAt('budgetError', '');
    } catch (error) {
      errorAt('budgetError', error.message);
      $('budgetDraftNote').textContent = 'Invalid draft — your saved budget and itinerary have not changed.';
    }
  }

  function renderBudget() {
    const total = Core.totalBudget(state.budget);
    $('budgetSubtitle').textContent = `All amounts in ${state.profile.currency}, for ${Core.people(state.profile)} travellers and ${state.profile.days} days. Adjust every category explicitly; no automatic currency conversion.`;
    $('budgetInputs').innerHTML = Core.categories.map((key, index) => `<div class="budget-line"><label for="budget-${key}"><span class="category-dot" style="background:${colours[index]}"></span>${labels[key]}</label><input id="budget-${key}" name="${key}" type="number" min="0" max="1000000000" step="1" value="${state.budget[key]}" required></div>`).join('');
    $('budgetInsights').innerHTML = `<p><b>${escape(money(total / Core.people(state.profile) / state.profile.days))}</b> per person / day across every category.</p><p class="small-copy">Scheduled activity allowances: ${escape(money(plan.activities))} of ${escape(money(state.budget.activities))}. Unassigned activity buffer: ${escape(money(plan.unallocatedActivities))}.</p><p class="small-copy">Distance filter: up to ${plan.maxLegKm} km between stops, based on your local transport allowance. This is a planning heuristic, not a quoted fare or a walking recommendation. ${state.places.filter(place => place.enabled !== false).length - scheduledPlaces().length} shortlisted places are not scheduled within this duration / distance allowance.</p><p class="small-copy">Nightly stay allowance: ${escape(money(state.budget.stay / Math.max(1, state.profile.days - 1)))} for the group (${Math.max(0, state.profile.days - 1)} nights assumed). Food: ${escape(money(state.budget.food / Core.people(state.profile) / state.profile.days))} per person / day.</p><ul class="insight-list">${Core.budgetWarnings(state.profile, state.budget).map(note => `<li>${escape(note)}</li>`).join('')}</ul>`;
    updateBudgetPreview();
  }

  function renderTransport() {
    const city = state.profile.destination;
    const network = Data.transport(city);
    const daily = state.budget.local / state.profile.days;
    $('transportDetails').innerHTML = `<div class="kicker">${escape(city.name)} · Getting around</div><p>Local transport allocation: <b>${escape(money(daily))} per group-day</b>. Compare the real fares before choosing a pass or cab.</p>${network ? `<div class="actions">${link(network[0], network[1])}${link(network[2], network[3])}</div><p class="small-copy">Open the operator’s current network map, service information and fare pages. Network links do not confirm a service is operating on your dates.</p>` : `<p class="notice">Metro availability has not been verified for ${escape(city.name)}. No network map is assumed. Use the local authority’s current information for buses, ferries, trams or metro services.</p><div class="actions">${link('Find official local transport', search(`${city.name} ${city.country} official public transport bus metro map`))}</div>`}<div class="actions">${link('Transit / bus stops nearby', map(`public transport bus stations in ${city.name}, ${city.country}`))}${link('Plan a transit journey', `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination: `${city.name}, ${city.country}`, travelmode: 'transit' })}`)}</div><p class="small-copy">Check last departures, accessibility, luggage rules and child / senior fares. Only use licensed vehicles and confirm the fare before boarding. Never reduce essential safety spending to fit an allocation.</p>`;
  }

  function renderSafety() {
    const { profile, budget } = state;
    const city = profile.destination;
    const notes = [
      [`🧭 Before exploring ${city.name}`, `Check the local weather and official travel advice. Save your stay address offline. Do not assume nearby places are open or that a route is accessible.`],
      ['🚕 Getting around', `Confirm vehicles and fares, use well-lit active streets and check the last service. Your local transport allowance is ${money(budget.local)} for the group; keep a safe return option even if it costs more.`],
      ['🏛️ Respect the place', 'Follow religious-site dress codes, photography restrictions and barriers. Keep away from water edges, steep drops and restricted buildings. Exterior-only stops still need public-access checks.'],
      ['📱 Keep a backup', `Carry ID, charged phones, water and offline copies. ${money(budget.reserve)} is allocated as a reserve; actual emergency costs can exceed it. Do not store sensitive document scans in this dashboard.`]
    ];
    if (profile.travelers.children || profile.travelers.older) notes.push(['🌿 A pace for everyone', 'Check step-free access, toilets, rest breaks and travel insurance. Keep prescriptions available. Children should have guardian contact details; agree a meeting point if separated.']);
    if (profile.style === 'solo') notes.push(['🎒 Solo, not unsupported', 'Share your plans with a trusted contact, arrange check-ins and avoid publicly posting your accommodation or real-time location.']);
    if (city.countryCode === 'IN') notes.push(['☀️ India essentials', 'Check heat / monsoon conditions for your dates, carry safe drinking water and verify road access for hill outings. Respect local guidance at temples and markets.']);
    else notes.push([`🌍 Arriving in ${city.country}`, 'Check entry and visa requirements for your passport, local laws, payment methods, insurance and the nearest embassy / consulate. No visa eligibility is inferred.']);
    $('safetyNotes').innerHTML = notes.map(([title, note]) => `<div class="safety-item"><b>${escape(title)}</b><p class="small-copy">${escape(note)}</p></div>`).join('');
    const contacts = Data.contacts(city);
    $('emergencyDetails').innerHTML = `<h3>Emergency help in ${escape(city.country)}</h3>${contacts ? `<div class="helplines">${contacts.numbers.map(([number, label]) => `<a href="tel:${number}">${escape(number)} · ${escape(label)}</a>`).join('')}</div><p class="small-copy">${link('Official emergency information', contacts.source, '')} ${contacts.extra ? link(contacts.extraLabel || 'Additional official information', contacts.extra, '') : ''}</p>` : '<p class="notice error">No verified emergency-number set is bundled for this country. Check the official government / embassy information now and save the correct local numbers offline. Do not rely on another country’s numbers.</p>'}<p class="small-copy">These are core contacts, not an exhaustive directory or a live emergency service. Confirm regional coverage before travel; hotel staff can help identify local services.</p><div class="actions">${link('Hospitals / emergency departments', map(`hospitals emergency department in ${city.name}, ${city.country}`))}${link('Pharmacies', map(`pharmacies in ${city.name}, ${city.country}`))}${link('Police stations', map(`police stations in ${city.name}, ${city.country}`))}${link('Government / consulate help', search(`${city.country} official emergency numbers tourist helpline embassy`))}</div>`;
  }

  function renderPacking() {
    const count = state.packing.filter(item => item.packed).length;
    const total = state.packing.length;
    const percent = total ? Math.round(count / total * 100) : 0;
    $('packingCount').textContent = `${count} / ${total} picked`;
    $('packingProgress').style.width = `${percent}%`;
    $('packingMeter').setAttribute('aria-valuenow', String(percent));
    $('packingList').innerHTML = state.packing.length ? state.packing.map(item => `<div class="task ${item.packed ? 'done' : ''}"><label class="packing-label"><input type="checkbox" data-pack="${escape(item.id)}" ${item.packed ? 'checked' : ''}><span>${escape(item.label)}</span><span class="picked-label">${item.packed ? 'Picked' : 'To pack'}</span></label><button class="drop-item" data-drop="${escape(item.id)}" type="button" aria-label="Drop ${escape(item.label)}">Drop</button></div>`).join('') : '<p class="small-copy">Your bag is a blank canvas. Add an item below.</p>';
  }

  function renderPlaylist() {
    const { profile } = state;
    const city = profile.destination;
    const mood = { solo: 'solo discovery acoustic', couple: 'romantic slow travel', family: 'family friendly road trip', friends: 'friends road trip upbeat', group: 'group road trip singalong' }[profile.style];
    const tracks = city.countryCode === 'IN'
      ? [['Ilahi · Arijit Singh', 'For the first glimpse of somewhere new'], ['Safarnama · Lucky Ali', 'A little more journey, a little less hurry']]
      : [['Send Me On My Way · Rusted Root', 'For the day you finally set off'], ['On Top of the World · Imagine Dragons', 'For your postcard moment']];
    const cards = [
      ...tracks,
      [`${city.name} ${mood}`, 'Destination + travel-style discovery search'],
      [`${city.country} local music ${profile.style === 'family' ? 'family friendly' : 'travel'}`, 'Find a local soundtrack; preview lyrics and suitability yourself'],
      ...(city.countryCode === 'IN' && city.region === 'Maharashtra' ? [['Marathi travel songs Ajay Atul', 'A little local colour for the journey']] : []),
      ['Quiet journey instrumental', 'For rest breaks and the way home']
    ];
    $('playlistTitle').textContent = `${city.name} · the ${profile.style} soundtrack`;
    $('playlistTracks').innerHTML = cards.map(([title, note]) => `<div class="track"><b>${escape(title)}</b><span>${escape(note)}</span>${link('Spotify', `https://open.spotify.com/search/${encodeURIComponent(title)}`, '')} · ${link('YouTube Music', `https://music.youtube.com/search?q=${encodeURIComponent(title)}`, '')}</div>`).join('');
  }

  function renderResources() {
    const city = state.profile.destination;
    $('resourceLinks').innerHTML = `<div class="resource-grid">${[
      ['Official tourism & visitor rules', search(`${city.name} ${city.country} official tourism visitor information`)],
      ['Weather forecast', search(`${city.name} ${city.country} official weather forecast`)],
      ['Entry / visa requirements', search(`${city.country} official immigration visa requirements`)],
      ['Official travel advisories', 'https://www.gov.uk/foreign-travel-advice'],
      ['Accessible travel information', search(`${city.name} official tourism accessibility step free`)],
      ['Destination overview', `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(`${city.name} ${city.country}`)}`]
    ].map(([title, url]) => link(title, url)).join('')}</div><p>Before you book: confirm dates, real prices, travel documents, insurance, cancellation rules, baggage, accessibility and your group’s needs. Before each day: check weather, opening hours, local access and return transport.</p><p><b>Discovery:</b> ${state.profile.destination.countryCode === 'IN' && city.name.toLowerCase() === 'pune' ? 'Bundled Pune shortlist; local imagery is illustrative / mockup-derived, not documentary photography.' : 'Nearby English Wikipedia articles within 10 km of the destination centre, filtered heuristically for visitor interest. Coverage is not exhaustive; missing photos or articles are not invented.'} Discovery saved: ${escape(state.discoveredAt ? new Date(state.discoveredAt).toLocaleDateString() : 'unknown')}.</p><p><b>Sources &amp; licences:</b> ${link('Open-Meteo / GeoNames geocoding', 'https://open-meteo.com/en/docs/geocoding-api', '')} (CC BY 4.0) · ${link('Wikipedia text', 'https://en.wikipedia.org/wiki/Wikipedia:Copyrights', '')} (CC BY-SA; summaries link to their source articles) · Wikimedia Commons photo authors and licences appear under each preview. Photo crops are for layout only.</p><p><b>Budget methodology:</b> Initial split: travel 25%, stay 30%, food 18%, local transport 12%, activities 10%, reserve 5%. Activity allowances use broad place-type / currency planning units × all travellers, without child discounts. They are not verified local prices, conversions or an affordability guarantee. Unaffordable entries become exterior-only suggestions, subject to public access. Get actual quotes and edit all categories.</p><p><b>Privacy &amp; persistence:</b> One active trip is stored locally in this browser. No accounts, analytics, live bookings, email import or AI service. Searches send only destination text / coordinates to public discovery providers; remote images contact Wikimedia. External routes and searches share their details with the chosen provider only when you follow the link. Exported JSON contains your route details and checklists; keep it private. Old Pune dashboard storage is left untouched.</p>`;
  }

  function nextTip() {
    if (!state) return;
    const city = state.profile.destination;
    const tips = [
      `Save your base in ${city.name} before opening full-day routes.`,
      `${money(state.budget.food / Core.people(state.profile) / state.profile.days)} per person / day is your food allowance. Check local menu prices.`,
      `Download an offline map of ${city.name}, and save local emergency numbers before setting out.`,
      state.profile.travelers.children || state.profile.travelers.older ? 'Plan shade, seated breaks and step-free transfers for your group.' : 'Leave space between stops. Your favourite moment may not be on the schedule.',
      `Confirm tickets on the venue’s own site; your ${city.name} itinerary does not reserve admission.`,
      'Mark completed days at the top of each card and watch your rickshaw move along the journey.'
    ];
    $('tipText').textContent = tips[tipIndex++ % tips.length];
  }

  function renderDashboard() {
    $('onboarding').hidden = true;
    $('dashboard').hidden = false;
    renderHero();
    renderTravel();
    renderBookings();
    renderDays();
    renderGallery();
    renderBudget();
    renderTransport();
    renderSafety();
    renderPacking();
    renderPlaylist();
    renderResources();
    $('heroTitle').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function rebuild() {
    plan = Core.makePlan(state.profile, state.budget, state.places);
    state.completed = [];
    renderHero();
    renderTravel();
    renderBookings();
    renderDays();
    renderGallery();
    renderBudget();
    renderTransport();
    renderSafety();
    renderResources();
  }

  $('budgetInputs').addEventListener('input', updateBudgetPreview);
  $('budgetForm').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const budget = draftBudget();
      const total = Core.totalBudget(budget);
      state.budget = budget;
      state.profile.budgetMode = 'group';
      state.profile.amount = total;
      rebuild();
      saved('Budget saved. Your plan has been rebuilt and day completion reset.');
    } catch (error) {
      errorAt('budgetError', error.message);
    }
  });
  $('routeForm').addEventListener('submit', event => {
    event.preventDefault();
    state.routes = {
      base: $('baseAddress').value.trim(), arrival: $('arrivalPoint').value.trim(),
      departure: $('departurePoint').value.trim(), mode: $('routeMode').value
    };
    renderDays();
    saved('Route details saved. Google Maps links have been updated.');
  });
  $('shortlistForm').addEventListener('submit', event => {
    event.preventDefault();
    const enabled = new Set([...$('shortlistChoices').querySelectorAll('input:checked')].map(input => input.dataset.shortlist));
    state.places.forEach(place => { place.enabled = enabled.has(place.id); });
    rebuild();
    saved('Place preferences saved. Your itinerary was rebuilt; day completion reset.');
  });
  $('bookingList').addEventListener('change', event => {
    const input = event.target.closest('[data-booking]');
    if (!input) return;
    state.bookings[input.dataset.booking] = input.checked;
    saved(input.checked ? 'Marked confirmed in your trip checklist.' : 'Booking reopened in your checklist.');
  });
  $('daysContainer').addEventListener('change', event => {
    const input = event.target.closest('[data-day]');
    if (!input) return;
    const n = Number(input.dataset.day);
    state.completed = state.completed.filter(day => day !== n);
    if (input.checked) state.completed.push(n);
    updateTripProgress();
    saved(input.checked ? `Day ${n} complete. Another story collected!` : `Day ${n} reopened.`);
  });
  $('daysContainer').addEventListener('click', event => {
    const button = event.target.closest('[data-toggle-day]');
    if (!button) return;
    const body = $(`daybody${button.dataset.toggleDay}`);
    body.hidden = !body.hidden;
    button.setAttribute('aria-expanded', String(!body.hidden));
  });
  $('toggleDays').addEventListener('click', () => {
    allOpen = !allOpen;
    plan.days.forEach(day => { $(`daybody${day.n}`).hidden = !allOpen; });
    $('daysContainer').querySelectorAll('[data-toggle-day]').forEach(button => button.setAttribute('aria-expanded', String(allOpen)));
    $('toggleDays').textContent = allOpen ? 'Collapse all days' : 'Expand all days';
  });
  $('routeInfo').addEventListener('click', () => {
    $('routeNote').hidden = !$('routeNote').hidden;
    $('routeInfo').setAttribute('aria-expanded', String(!$('routeNote').hidden));
  });
  $('packingList').addEventListener('change', event => {
    const input = event.target.closest('[data-pack]');
    if (!input) return;
    const item = state.packing.find(item => item.id === input.dataset.pack);
    item.packed = input.checked;
    renderPacking();
    saved('Packing list saved.');
    const updated = [...$('packingList').querySelectorAll('[data-pack]')].find(input => input.dataset.pack === item.id);
    updated?.focus({ preventScroll: true });
  });
  $('packingList').addEventListener('click', event => {
    const button = event.target.closest('[data-drop]');
    if (!button) return;
    state.packing = state.packing.filter(item => item.id !== button.dataset.drop);
    renderPacking();
    saved('Item dropped from your packing list.');
    $('newPackingItem').focus({ preventScroll: true });
  });
  $('packingForm').addEventListener('submit', event => {
    event.preventDefault();
    const label = $('newPackingItem').value.trim();
    if (!label) {
      $('newPackingItem').setCustomValidity('Enter an item name, not just spaces.');
      $('newPackingItem').reportValidity();
      return;
    }
    state.packing.push({ id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, label, packed: false });
    $('packingForm').reset();
    renderPacking();
    saved('Packing item added and saved.');
    $('newPackingItem').focus();
  });
  $('newPackingItem').addEventListener('input', () => $('newPackingItem').setCustomValidity(''));
  $('placeForm').addEventListener('submit', event => {
    event.preventDefault();
    errorAt('placeError', '');
    const title = $('placeName').value.trim();
    const summary = $('placeSummary').value.trim();
    if (!title || !summary) {
      errorAt('placeError', 'Enter a place name and overview, not just spaces.');
      return;
    }
    const place = { id: `custom-${Date.now()}`, title, summary, lat: Number($('placeLat').value), lon: Number($('placeLon').value), units: 2, image: '', wiki: '' };
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon) || Math.abs(place.lat) > 90 || Math.abs(place.lon) > 180) {
      errorAt('placeError', 'Enter valid latitude and longitude coordinates.');
      return;
    }
    if (Core.distance(place, state.profile.destination) > 150) {
      errorAt('placeError', 'This place is more than 150 km from your destination. Create a separate destination trip instead.');
      return;
    }
    state.places.push(place);
    rebuild();
    $('placeForm').reset();
    saved('Place added. Your plan was rebuilt; day completion reset.');
  });
  $('mascot').addEventListener('click', nextTip);
  $('printTrip').addEventListener('click', () => window.print());
  $('exportTrip').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ ...state, plan }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `roam-${state.profile.destination.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-trip.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Trip export downloaded. Keep it private: it includes route details.');
  });
  $('editTrip').addEventListener('click', () => {
    const profile = state.profile;
    $('origin').value = profile.origin;
    $('destinationQuery').value = profile.destination.name;
    selectedCity = profile.destination;
    $('tripDays').value = profile.days;
    $('startDate').value = profile.startDate;
    $('tripStyle').value = profile.style;
    $('currency').value = profile.currency;
    $('budgetMode').value = profile.budgetMode;
    $('budgetAmount').value = Math.round(profile.amount);
    $('maleCount').value = profile.travelers.male;
    $('femaleCount').value = profile.travelers.female;
    $('childCount').value = profile.travelers.children;
    $('olderCount').value = profile.travelers.older;
    resetOnboardingBudget();
    $('cityResults').innerHTML = '';
    errorAt('onboardingError', '');
    showSelectedCity();
    $('onboarding').hidden = false;
    $('dashboard').hidden = true;
    $('cancelEdit').hidden = false;
    $('welcomeTitle').focus();
    window.scrollTo(0, 0);
  });
  $('cancelEdit').addEventListener('click', () => renderDashboard());

  window.addEventListener('beforeprint', () => {
    document.querySelectorAll('.day-body').forEach(body => { body.dataset.printHidden = String(body.hidden); body.hidden = false; });
  });
  window.addEventListener('afterprint', () => {
    document.querySelectorAll('.day-body').forEach(body => { body.hidden = body.dataset.printHidden === 'true'; });
  });
  window.addEventListener('beforeunload', event => {
    if (!storageWorking && state) { event.preventDefault(); event.returnValue = ''; }
  });

  resetOnboardingBudget();
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      state = Core.validateState(JSON.parse(raw));
      plan = Core.makePlan(state.profile, state.budget, state.places);
      renderDashboard();
    }
  } catch (error) {
    state = null;
    damagedSave = true;
    $('storageNotice').hidden = false;
    $('storageNotice').textContent = `The saved trip could not be loaded: ${error.message} It has not been overwritten. You can create a replacement after confirming; existing storage remains untouched until then.`;
    $('onboarding').hidden = false;
    $('dashboard').hidden = true;
  }
})();
