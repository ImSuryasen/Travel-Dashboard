# Pune for Two — Interactive Travel Dashboard

A static, self-contained six-day Pune travel dashboard. The dashboard includes the six-day itinerary, Google Maps links, editable origin/destination fields, booking and accommodation status, budget tracker, packing checklist, travel notes, playlist links, and locally embedded destination imagery.

## Live site

Visit [Travel Dashboard](https://imsuryasen.github.io/Travel-Dashboard/).

GitHub Pages publishes the repository root from the `main` branch. Push changes to `main` to update the site; no build step or API key is needed. Checklist, route, and budget edits are saved only in the current browser and are not uploaded to GitHub.

## Run it

1. Extract the ZIP folder.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox, or Safari).
3. No package installation, build step, server, or API key is required.

The page loads its stylesheet from `src/styles.css` and its dashboard logic plus embedded image data from `src/dashboard.js`. The original image files used during assembly are also included under `assets/`. The `references/` folder contains preview screenshots only.

## Project structure

```text
Pune_for_Two_Source_Code/
├── index.html                 # Main dashboard page
├── src/
│   ├── styles.css             # Theme, layout, responsive styling
│   └── dashboard.js           # Interactions, itinerary rendering, embedded images
├── assets/
│   ├── images/                # Destination image assets
│   └── artwork/               # Collage and supporting artwork
└── references/               # Dashboard preview screenshots
```

## Notes

- Destination photographs/artwork embedded in the dashboard are available offline. Google Maps, music services, and any external links require an internet connection.
- The local image folders are retained as editable source assets; the dashboard itself uses embedded image data in `src/dashboard.js` so moving the project folder does not break the visuals.
- The itinerary is a planning document. Verify opening hours, ticket prices, restaurant availability, weather, road access, and transport before travel.
- Personal address and terminal fields are entered by the user in the dashboard.
