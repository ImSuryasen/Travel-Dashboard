(function (root) {
  'use strict';

  const pune = { id: 'pune-in', name: 'Pune', region: 'Maharashtra', country: 'India', countryCode: 'IN', lat: 18.51957, lon: 73.85535 };
  const punePlaces = [
    ['shaniwar', 'Shaniwar Wada', 18.5195, 73.8553, 'Peshwa-era fortification and historic gateway. Check current visitor access and entry charges.', 'Shaniwar_Wada', 1.5],
    ['lalmahal', 'Lal Mahal', 18.5188, 73.8566, 'A reconstruction associated with Shivaji Maharaj’s childhood. Confirm visitor access.', 'Lal_Mahal', 1],
    ['dagdusheth', 'Dagdusheth Ganpati', 18.5164, 73.8561, 'A celebrated Ganapati temple in the old city. Follow local dress and photography rules.', 'Dagadusheth_Halwai_Ganapati_Temple', 0],
    ['market', 'Tulshibaug', 18.5136, 73.8565, 'Old-city market lanes. Shopping is optional and is not included in the entry allowance.', 'Tulshibaug', 0],
    ['kelkar', 'Raja Dinkar Kelkar Museum', 18.5106, 73.8544, 'Decorative arts, musical instruments and carved objects. Verify current tickets.', 'Raja_Dinkar_Kelkar_Museum', 2],
    ['pataleshwar', 'Pataleshwar Caves', 18.5268, 73.8497, 'Rock-cut temple complex. Check access and take care on uneven surfaces.', 'Pataleshwar_Caves', 0.5],
    ['parvati', 'Parvati Hill', 18.4971, 73.846, 'Hilltop temple precinct with steps. Skip the climb if it does not suit your group.', 'Parvati_Hill', 0.5],
    ['agakhan', 'Aga Khan Palace', 18.5523, 73.9015, 'Palace grounds and memorial history. Confirm ASI tickets and opening hours.', 'Aga_Khan_Palace', 2],
    ['chaturshringi', 'Chaturshringi Temple', 18.5397, 73.8274, 'Hillside temple with a stairway approach. Check accessibility before setting out.', 'Chaturshringi_Temple', 0.5],
    ['khadakwasla', 'Khadakwasla Dam', 18.4419, 73.7681, 'Reservoir views only from permitted public areas. Do not enter the water; check local restrictions.', 'Khadakwasla_Dam', 0.5],
    ['sinhagad', 'Sinhagad', 18.3663, 73.7559, 'Hill fort outside the city. Confirm road access, weather and a return ride; steep approaches may not suit everyone.', 'Sinhagad', 2]
  ].map(([id, title, lat, lon, summary, article, units]) => ({
    id: `pune-${id}`, title, lat, lon, summary, units,
    wiki: `https://en.wikipedia.org/wiki/${article}`,
    image: `assets/images/pune_photo_assets/${id}.webp`,
    imagePage: '', illustration: true
  }));

  const networks = {
    pune: ['Pune Metro', 'https://www.punemetrorail.org/route-map', 'PMPML city buses', 'https://pmpml.org/'],
    mumbai: ['Mumbai Metro', 'https://www.mmmocl.co.in/', 'BEST buses', 'https://www.bestundertaking.com/'],
    delhi: ['Delhi Metro', 'https://delhimetrorail.com/', 'DTC buses', 'https://dtc.delhi.gov.in/'],
    'new delhi': ['Delhi Metro', 'https://delhimetrorail.com/', 'DTC buses', 'https://dtc.delhi.gov.in/'],
    bengaluru: ['Namma Metro', 'https://english.bmrc.co.in/', 'BMTC buses', 'https://mybmtc.karnataka.gov.in/'],
    bangalore: ['Namma Metro', 'https://english.bmrc.co.in/', 'BMTC buses', 'https://mybmtc.karnataka.gov.in/'],
    chennai: ['Chennai Metro', 'https://chennaimetrorail.org/', 'MTC buses', 'https://mtcbus.tn.gov.in/'],
    hyderabad: ['Hyderabad Metro', 'https://www.ltmetro.com/', 'TGSRTC buses', 'https://www.tgsrtc.telangana.gov.in/'],
    kolkata: ['Metro Railway Kolkata', 'https://mtp.indianrailways.gov.in/', 'WBTC buses', 'https://wbtc.co.in/'],
    jaipur: ['Jaipur Metro', 'https://transport.rajasthan.gov.in/jmrc', 'JCTSL buses', 'https://transport.rajasthan.gov.in/jctsl'],
    kochi: ['Kochi Metro', 'https://kochimetro.org/', 'Kochi Water Metro', 'https://watermetro.co.in/'],
    paris: ['Île-de-France Metro, RER & bus maps', 'https://www.ratp.fr/en/plans', 'Île-de-France Mobilités', 'https://www.iledefrance-mobilites.fr/en'],
    london: ['Tube & rail maps', 'https://tfl.gov.uk/maps/track/tube', 'TfL bus maps', 'https://tfl.gov.uk/maps/bus'],
    tokyo: ['Tokyo Metro map', 'https://www.tokyometro.jp/en/subwaymap/', 'Toei transport', 'https://www.kotsu.metro.tokyo.jp/eng/'],
    singapore: ['MRT & LRT maps', 'https://www.lta.gov.sg/content/ltagov/en/getting_around/public_transport/rail_network.html', 'TransitLink journey planning', 'https://www.transitlink.com.sg/'],
    'new york': ['MTA subway map', 'https://www.mta.info/maps', 'MTA bus maps', 'https://www.mta.info/maps/bus'],
    dubai: ['RTA Metro & transport', 'https://www.rta.ae/', 'RTA buses', 'https://www.rta.ae/'],
    bangkok: ['BTS Skytrain routes', 'https://www.bts.co.th/eng/', 'Bangkok MRT', 'https://metro.bemplc.co.th/']
  };
  const networkCountries = { pune: 'IN', mumbai: 'IN', delhi: 'IN', 'new delhi': 'IN', bengaluru: 'IN', bangalore: 'IN', chennai: 'IN', hyderabad: 'IN', kolkata: 'IN', jaipur: 'IN', kochi: 'IN', paris: 'FR', london: 'GB', tokyo: 'JP', singapore: 'SG', 'new york': 'US', dubai: 'AE', bangkok: 'TH' };
  const emergency = {
    IN: { numbers: [['112', 'Police, fire & medical emergency'], ['1098', 'Child helpline']], source: 'https://www.india.gov.in/directory/helpline', extra: 'https://wcd.gov.in/public/child/child-helpline', extraLabel: 'Child helpline information' },
    US: { numbers: [['911', 'Police, fire & ambulance']], source: 'https://www.911.gov/' },
    CA: { numbers: [['911', 'Police, fire & ambulance']], source: 'https://parks.canada.ca/voyage-travel/securite-safety/urgence-emergency' },
    GB: { numbers: [['999', 'Police, fire & ambulance'], ['112', 'Alternative emergency number']], source: 'https://www.gov.uk/guidance/999-and-112-the-uks-national-emergency-numbers' },
    AU: { numbers: [['000', 'Police, fire & ambulance']], source: 'https://www.triplezero.gov.au/' },
    NZ: { numbers: [['111', 'Police, fire & ambulance']], source: 'https://www.police.govt.nz/call-111' },
    JP: { numbers: [['110', 'Police'], ['119', 'Fire & ambulance']], source: 'https://www.japan.travel/en/plan/emergencies/' },
    SG: { numbers: [['999', 'Police'], ['995', 'Fire & ambulance']], source: 'https://www.scdf.gov.sg/home/about-scdf/emergency-medical-services', extra: 'https://www.police.gov.sg/Contact-Us', extraLabel: 'Police emergency information' }
  };
  const eu = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']);

  async function json(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error(`Place service returned HTTP ${response.status}. Please retry.`);
      const data = await response.json();
      if (data.error) throw new Error(data.error.info || 'The place service could not complete this search.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Place lookup timed out. Check your connection and retry.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function searchCities(query) {
    if (query.trim().toLowerCase() === 'pune') return [pune];
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({ name: query.trim(), count: '8', language: 'en', format: 'json' });
    const data = await json(url);
    return (data.results || []).filter(city => city.country_code).map(city => ({
      id: String(city.id), name: city.name, region: city.admin1 || '', country: city.country || city.country_code,
      countryCode: city.country_code, lat: city.latitude, lon: city.longitude
    }));
  }

  function classify(title, summary) {
    const text = `${title} ${summary}`.toLowerCase();
    if (/battle|massacre|constituency|election|commune|university|school|hospital|railway station|metro station|embassy|demolished|destroyed/.test(text)) return null;
    if (/museum|gallery|palace|castle|fortress|fort\b|mausoleum|archaeological|monument/.test(text)) return 2;
    if (/temple|cathedral|mosque|basilica|church|shrine|pagoda|abbey/.test(text)) return 1;
    if (/park\b|garden|square|plaza|bridge|market|beach|lake|waterfront|tower|landmark/.test(text)) return 0.5;
    return null;
  }

  async function discoverPlaces(city) {
    if (city.countryCode === 'IN' && city.name.toLowerCase() === 'pune') return punePlaces;
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.search = new URLSearchParams({
      action: 'query', generator: 'search',
      gsrsearch: `nearcoord:10km,${city.lat},${city.lon} (museum OR monument OR palace OR park OR temple OR cathedral OR castle OR landmark OR garden OR tower OR bridge)`,
      gsrlimit: '60', gsrsort: 'incoming_links_desc', gsrnamespace: '0', prop: 'coordinates|info', colimit: 'max',
      inprop: 'url', format: 'json', origin: '*'
    });
    const data = await json(url);
    const pages = Object.values(data.query?.pages || {});
    // TextExtracts returns at most 20 extracts per request, including with a generator.
    const batches = [];
    for (let index = 0; index < pages.length; index += 20) {
      const details = new URL('https://en.wikipedia.org/w/api.php');
      details.search = new URLSearchParams({
        action: 'query', pageids: pages.slice(index, index + 20).map(page => page.pageid).join('|'),
        prop: 'extracts|pageimages', piprop: 'name', exlimit: '20',
        exintro: '1', explaintext: '1', exsentences: '2', format: 'json', origin: '*'
      });
      batches.push(json(details));
    }
    const details = await Promise.all(batches);
    const content = Object.assign({}, ...details.map(batch => batch.query?.pages || {}));
    const places = pages.flatMap(raw => {
      const page = { ...raw, ...content[raw.pageid] };
      const coordinate = page.coordinates?.[0];
      const units = classify(page.title, page.extract || '');
      if (!coordinate || units === null || !page.extract || page.title.toLowerCase() === city.name.toLowerCase()) return [];
      return [{
        id: `wiki-${page.pageid}`, title: page.title, lat: coordinate.lat, lon: coordinate.lon,
        summary: page.extract, wiki: page.canonicalurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`,
        image: '', imageFile: page.pageimage || '', units, priority: Number.isFinite(page.index) ? page.index : 100,
        imagePage: page.pageimage ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(page.pageimage)}` : '',
        illustration: false
      }];
    });
    if (!places.length) throw new Error(`No suitable places were found around ${city.name}. Try a nearby city. No itinerary has been invented.`);
    const files = [...new Set(places.map(place => place.imageFile).filter(Boolean))].slice(0, 50);
    if (files.length) {
      const commons = new URL('https://commons.wikimedia.org/w/api.php');
      commons.search = new URLSearchParams({
        action: 'query', titles: files.map(file => `File:${file}`).join('|'),
        prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '700', format: 'json', origin: '*'
      });
      const images = await json(commons);
      const plain = html => new DOMParser().parseFromString(html || '', 'text/html').body.textContent.trim();
      const credits = new Map(Object.values(images.query?.pages || {}).flatMap(file => {
        const info = file.imageinfo?.[0];
        const meta = info?.extmetadata;
        const license = plain(meta?.LicenseShortName?.value);
        if (!info || !/CC0|CC BY|public domain/i.test(license) || !meta.Artist?.value) return [];
        return [[file.title.replace(/^File:/, '').replaceAll('_', ' '), {
          image: info.thumburl || info.url, imagePage: info.descriptionurl,
          imageCredit: { author: plain(meta.Artist.value).slice(0, 240), license, licenseUrl: meta.LicenseUrl?.value || info.descriptionurl }
        }]];
      }));
      places.forEach(place => Object.assign(place, credits.get(place.imageFile.replaceAll('_', ' ')) || {}));
    }
    return places;
  }

  function transport(city) {
    const key = city.name.toLowerCase();
    return networkCountries[key] === city.countryCode ? networks[key] : null;
  }

  function contacts(city) {
    return emergency[city.countryCode] || (eu.has(city.countryCode)
      ? { numbers: [['112', 'Police, fire & ambulance across the EU']], source: 'https://digital-strategy.ec.europa.eu/en/policies/112' }
      : null);
  }

  root.TravelData = { pune, punePlaces, searchCities, discoverPlaces, transport, contacts };
})(globalThis);
