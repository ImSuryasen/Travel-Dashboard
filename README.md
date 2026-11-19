# Roam Together — All-in-one Travel Planner

A static, no-account travel journal for solo, couple, family and group trips. Create a trip through onboarding, then explore destination-specific plans, route links, budget allocations, booking checklists, postcard previews, transport resources, safety information, packing and music.

## Run / publish

Open [index.html](./index.html) in a modern browser, or serve this folder with any static web server. For example:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765>. No package installation, build, backend or API key is required. GitHub Pages can continue publishing the repository root.

The existing live site is <https://imsuryasen.github.io/Travel-Dashboard/>. Local changes are not deployed until pushed to the publishing branch.

## Planning workflow

1. Enter your origin, search for a destination and select its city / country.
2. Enter 1–60 days, optional departure date, travel style and up to 50 travellers. Include yourself; count older adults separately from other adults.
3. Enter an all-inclusive group or per-person budget and its currency. Per-person budgets include every traveller.
4. Review and rebalance the explicit round-trip travel, accommodation, food, local transport, activities and reserve allocations **during onboarding**. Their sum must match the group budget.
5. Save category changes to regenerate the plan, routes, booking checks and previews. This resets day completion because the itinerary may have changed. Existing packing edits and unchanged booking confirmations are retained. The category editor saves a canonical **group** budget.
6. Save a base / terminals for personalised Google Maps routes. Day completion is at the top of each card; an auto-rickshaw tracks overall progress.
7. Select your preferred places from the shortlist, or add a custom place using actual coordinates (within 150 km). Rebuilding applies duration / distance limits; not every shortlisted place is guaranteed a slot.
8. Pick, drop and add packing items. Reloading restores the active trip. Export JSON before replacing it or changing devices. Export includes the generated plan; there is no import or cloud sync.

## Discovery and honest limitations

- **Worldwide discovery:** city search uses Open-Meteo / GeoNames. English Wikipedia articles within 10 km are ranked by incoming links and filtered heuristically for visitor interest. Prominent daily anchors are paired with nearby stops. Coverage varies and is not a complete tourism directory. Missing results / network errors are shown explicitly; no itinerary is invented.
- **Pune offline:** the original Pune place shortlist and bundled illustrative / mockup-derived visuals remain available without discovery requests. A previously saved trip also reloads without discovery; remote images and external services still require connectivity.
- **Images / summaries:** Wikipedia summaries link to their source articles (CC BY-SA). Commons images are shown only with supported public-domain / Creative Commons metadata, author and licence links. Missing or failed images show labelled placeholders, not unrelated Pune images. Image crops are disclosed.
- **Budget:** allocations are not market quotes. Initial split: travel 25%, stay 30%, food 18%, local transport 12%, activities 10%, reserve 5%. Category inputs use whole currency units. Ten budget currencies are available; choosing one is not an exchange-rate conversion. Broad place-type / currency heuristics estimate group activity allowances without age discounts. Scheduled activity allowances never exceed that category; entries that do not fit become exterior-only suggestions, subject to public access. A local-transport allowance changes a heuristic inter-stop distance filter, not an actual fare calculation. Group composition also changes pace. Low-budget warnings do not guarantee affordability: verify real transport, room, meal and ticket costs.
- **Routes:** nearest-neighbour suggestions, with at most three attraction waypoints per day for mobile Maps compatibility. Times are flexible slots, not verified opening hours or live traffic. The first and last day are lighter. Long trips may contain unscheduled days rather than repeated places.
- **Bookings:** itinerary-specific search / map links and manual confirmations. No ticket prices, availability, account connections, inbox access or booking imports. Use official venue / operator pages before paying.
- **Transit:** known cities have operator / map links, matched by both city and country. Other cities show an explicit unverified-network message and bus / local-authority discovery links. A missing registry entry never means a city has no metro.
- **Emergency information:** core contacts are bundled for India, US, Canada, UK, Australia, New Zealand, Japan, Singapore and EU countries, with government / official references. Other countries explicitly require local verification; no country’s number is reused as a worldwide default. This is not an exhaustive directory or an emergency service. Confirm coverage before travel.
- **Packing / music / safety:** practical templates adapted to destination / group / duration, not forecasts, professional advice or automatically created music-service playlists. Check seasonal weather, accessibility, lyrics and current official travel advice yourself.

## Storage and privacy

One active trip is stored under `roam-together-trip-v1` in the current browser’s local storage. Origin, traveller counts, budget, route details, packing changes, confirmations and completion are not uploaded by the app. City searches and destination coordinates go to the documented discovery providers; Commons images contact Wikimedia. External links share the search / route details they contain when opened.

Private browsing, file-URL storage policies, cleared site data and storage quotas can prevent persistence. Storage failures show a persistent warning and in-memory-only updates; export before leaving. An unreadable saved trip is not overwritten without replacement confirmation. Existing `pune-*` storage remains untouched. Rebuilding / replacing trips is deliberate; editing onboarding replaces the current trip after confirmation, while “Back to my trip” cancels.

## Source structure

- [index.html](./index.html): onboarding and accessible dashboard sections.
- [src/planner-core.js](./src/planner-core.js): validation, allocations, distance-aware planning, route URLs and packing templates; also exports for Node tests.
- [src/destinations.js](./src/destinations.js): public API discovery, Pune shortlist, transit registry and emergency references.
- [src/app.js](./src/app.js): rendering, forms, local persistence, progress, checklists and export.
- [src/styles.css](./src/styles.css): original journal theme plus onboarding / multi-destination / responsive styles.
- [assets/](./assets/): original destination artwork and visual assets.
- [src/dashboard.js](./src/dashboard.js): retained original Pune implementation / embedded art source; no longer loaded by the page.
- [references/](./references/): original dashboard preview screenshots.

## Validate

No dependencies are needed:

```sh
node --check src/planner-core.js
node --check src/destinations.js
node --check src/app.js
node --test tests/planner-core.test.js tests/destinations.test.js
```

Browser checks should cover onboarding, ambiguous destination selection, offline Pune, live discovery, per-person budgets, saving revised allocations, shortlist changes, day / packing persistence, failed discovery, storage warnings, mobile layout and print / export.
