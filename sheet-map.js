(function () {
    'use strict';

    const PUBLISHED_SHEET_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR0jl438oFGXjpUeNWNCxHUwwVtmt9GM5jEj6DteIq-VUQYgyWwH3m-_CuJN_TKagZ62vgSfT5JGOus/pub';
    const DEFAULT_CENTER = [30.2672, -97.7431];
    const SHEET_SOURCES = [
        {
            id: 'food',
            label: 'Food',
            gid: '0',
            scores: [
                { key: 'taste', label: 'Taste', headers: ['taste'] },
                { key: 'priceScore', label: 'Price', headers: ['price_score', 'price_rating'] },
                { key: 'setting', label: 'Setting', headers: ['setting', 'atmosphere'] },
                { key: 'customerService', label: 'Service', headers: ['customer_service', 'service'] },
                { key: 'waitTime', label: 'Wait time', headers: ['wait_time', 'wait'] }
            ]
        },
        {
            id: 'hot-spots',
            label: 'Hot Spots',
            gid: '26394551',
            scores: [
                { key: 'parkingAvailability', label: 'Parking', headers: ['parking_availability', 'parking'] },
                { key: 'priceScore', label: 'Price', headers: ['price_score', 'price_rating'] },
                { key: 'setting', label: 'Setting', headers: ['setting'] },
                { key: 'incidentFrequency', label: 'Incidents', headers: ['incident_frequency', 'safety', 'incidents'] },
                { key: 'busyness', label: 'Busyness', headers: ['busyness', 'busy'] }
            ]
        }
    ];

    let map = null;
    let markers = [];
    let locations = [];

    if (typeof window.initializeMap === 'function') window.initializeMap = function () {};
    if (typeof window.loadMockBusinessData === 'function') window.loadMockBusinessData = function () {};

    document.addEventListener('DOMContentLoaded', initializeSheetMap);

    async function initializeSheetMap() {
        if (!document.getElementById('map')) return;

        connectMapControls();

        if (!window.L) {
            showMapMessage('The map library did not load. Check the Leaflet links in map.html.');
            return;
        }

        createMap();

        try {
            const results = await Promise.all(SHEET_SOURCES.map(loadSourceLocations));
            locations = results.flat();
            renderLocations(locations);

            if (!locations.length) {
                showMapMessage('No complete locations were found. Check coordinates and all score columns.');
            }
        } catch (error) {
            console.error('Could not load locations:', error);
            renderLocations([]);
            showMapMessage('The spreadsheet could not be loaded. Make sure both tabs are published to the web.');
        }
    }

    async function loadSourceLocations(source) {
        const response = await fetch(buildCsvUrl(source.gid), { cache: 'no-store' });
        if (!response.ok) throw new Error(`${source.label} request failed (${response.status})`);
        return parseLocations(await response.text(), source);
    }

    function buildCsvUrl(gid) {
        return `${PUBLISHED_SHEET_BASE_URL}?gid=${encodeURIComponent(gid)}&single=true&output=csv`;
    }

    function createMap() {
        const mapElement = document.getElementById('map');
        mapElement.innerHTML = '';

        map = L.map(mapElement).setView(DEFAULT_CENTER, 12);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
    }

    function parseLocations(csvText, source) {
        const rows = parseCsvRows(csvText);
        if (rows.length < 2) return [];

        const headers = rows.shift().map(normalizeHeader);

        return rows.map((row, index) => {
            const record = {};
            headers.forEach((header, columnIndex) => {
                record[header] = String(row[columnIndex] || '').trim();
            });

            const scores = source.scores.map(score => ({
                ...score,
                value: parseScore(getValue(record, ...score.headers))
            }));

            const location = {
                id: `${source.id}-${index + 1}`,
                sourceId: source.id,
                sourceLabel: source.label,
                name: getValue(record, 'name', 'business_name', 'location'),
                category: getValue(record, 'category', 'type') || source.label,
                description: getValue(record, 'description', 'notes'),
                scores,
                lat: Number(getValue(record, 'latitude', 'lat')),
                lng: Number(getValue(record, 'longitude', 'lng', 'lon')),
                address: getValue(record, 'address'),
                website: safeWebsite(getValue(record, 'website', 'url')),
                ratingFromSheet: parseScore(getValue(record, 'overall_rating', 'rating'))
            };

            location.rating = Number.isFinite(location.ratingFromSheet)
                ? location.ratingFromSheet
                : averageScores(location.scores);

            return location;
        }).filter(isCompleteLocation);
    }

    function isCompleteLocation(location) {
        return Boolean(location.name)
            && Number.isFinite(location.lat)
            && Number.isFinite(location.lng)
            && location.scores.every(score => Number.isFinite(score.value))
            && Number.isFinite(location.rating);
    }

    function parseScore(value) {
        const score = Number(value);
        return Number.isFinite(score) && score >= 1 && score <= 5 ? score : NaN;
    }

    function averageScores(scores) {
        if (scores.some(score => !Number.isFinite(score.value))) return NaN;
        const total = scores.reduce((sum, score) => sum + score.value, 0);
        return Math.round((total / scores.length) * 10) / 10;
    }

    function renderLocations(filteredLocations) {
        renderMarkers(filteredLocations);
        renderLocationList(filteredLocations);
    }

    function renderMarkers(filteredLocations) {
        if (!map) return;

        markers.forEach(markerInfo => markerInfo.marker.remove());
        markers = [];

        if (!filteredLocations.length) {
            map.setView(DEFAULT_CENTER, 12);
            return;
        }

        const bounds = L.latLngBounds();
        filteredLocations.forEach(location => {
            const marker = L.marker([location.lat, location.lng])
                .addTo(map)
                .bindPopup(buildPopup(location), { autoPan: false, keepInView: false });

            markers.push({ id: location.id, marker });
            bounds.extend([location.lat, location.lng]);
        });

        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        window.setTimeout(() => map.invalidateSize(), 100);
    }

    function renderLocationList(filteredLocations) {
        const list = document.querySelector('.business-list, #business-list, .businesses-list');
        if (!list) return;

        list.innerHTML = '';

        if (!filteredLocations.length) {
            list.innerHTML = '<div class="sheet-empty-state">No locations match these filters.</div>';
            return;
        }

        filteredLocations.forEach(location => {
            const item = document.createElement('article');
            item.className = 'business-item sheet-business-item';
            item.innerHTML = `
                <div class="sheet-business-heading">
                    <div>
                        <span class="sheet-source-badge">${escapeHtml(location.sourceLabel)}</span>
                        <h3>${escapeHtml(location.name)}</h3>
                    </div>
                    <strong class="sheet-rating">&#9733; ${location.rating.toFixed(1)}/5</strong>
                </div>
                <p class="sheet-category">${escapeHtml(location.category)}</p>
                <div class="score-grid">${scoreBreakdown(location)}</div>
                ${location.address ? `<p>${escapeHtml(location.address)}</p>` : ''}
                ${location.description ? `<p>${escapeHtml(location.description)}</p>` : ''}
            `;

            item.addEventListener('click', () => focusLocation(location));

            list.appendChild(item);
        });
    }

    function focusLocation(location) {
        if (!map) return;

        const markerInfo = markers.find(candidate => candidate.id === location.id);
        const latLng = [location.lat, location.lng];
        const zoom = Math.max(map.getZoom(), 16);

        map.closePopup();
        map.flyTo(latLng, zoom, { animate: true, duration: 0.35 });

        window.setTimeout(() => {
            map.setView(latLng, zoom, { animate: false });
            if (markerInfo) markerInfo.marker.openPopup();
        }, 380);
    }

    function buildPopup(location) {
        const website = location.website
            ? `<p><a href="${escapeHtml(location.website)}" target="_blank" rel="noopener noreferrer">Visit website</a></p>`
            : '';

        return `
            <div class="sheet-popup">
                <span class="sheet-source-badge">${escapeHtml(location.sourceLabel)}</span>
                <strong>${escapeHtml(location.name)}</strong>
                <div class="sheet-popup-rating">&#9733; ${location.rating.toFixed(1)}/5</div>
                <div class="score-grid">${scoreBreakdown(location)}</div>
                ${location.address ? `<p>${escapeHtml(location.address)}</p>` : ''}
                ${website}
            </div>
        `;
    }

    function scoreBreakdown(location) {
        return location.scores.map(score => `
            <span><b>${escapeHtml(score.label)}</b> ${formatScore(score.value)}</span>
        `).join('');
    }

    function connectMapControls() {
        const applyButton = document.getElementById('apply-filters');
        const filterButton = document.getElementById('filter-btn');
        const filterDropdown = document.getElementById('filter-dropdown');
        const toggleMapButton = document.getElementById('toggle-map');
        const mapLayout = document.querySelector('.map-business-container');
        const searchInput = document.getElementById('map-search');

        filterButton?.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            filterDropdown?.classList.toggle('show');
        });

        filterDropdown?.addEventListener('click', event => event.stopPropagation());

        applyButton?.addEventListener('click', event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            applyFilters();
        }, true);

        searchInput?.addEventListener('input', applyFilters);

        toggleMapButton?.addEventListener('click', () => {
            if (!mapLayout) return;

            const expanded = mapLayout.classList.toggle('map-expanded');
            toggleMapButton.innerHTML = expanded
                ? '<i class="fas fa-list"></i> Show Locations'
                : '<i class="fas fa-expand-alt"></i> Expand Map';

            window.setTimeout(() => map?.invalidateSize(), 100);
        });

        document.addEventListener('click', event => {
            if (!event.target.closest('.filter-container')) {
                filterDropdown?.classList.remove('show');
            }
        });
    }

    function applyFilters() {
        const category = document.getElementById('category-filter')?.value.trim().toLowerCase() || '';
        const source = document.getElementById('source-filter')?.value.trim().toLowerCase() || '';
        const minimumRating = Number(document.getElementById('rating-filter')?.value || 0);
        const searchTerm = document.getElementById('map-search')?.value.trim().toLowerCase() || '';

        const filtered = locations.filter(location => {
            const matchesCategory = !category || location.category.toLowerCase() === category;
            const matchesSource = !source || location.sourceId === source;
            const matchesRating = !minimumRating || location.rating >= minimumRating;
            const searchableText = [location.name, location.category, location.sourceLabel, location.address, location.description]
                .join(' ')
                .toLowerCase();
            const matchesSearch = !searchTerm || searchableText.includes(searchTerm);
            return matchesCategory && matchesSource && matchesRating && matchesSearch;
        });

        renderLocations(filtered);
        document.getElementById('filter-dropdown')?.classList.remove('show');
    }

    function showMapMessage(message) {
        if (!map) return;

        L.popup({ closeButton: false, closeOnClick: false, autoClose: false })
            .setLatLng(DEFAULT_CENTER)
            .setContent(`<div class="sheet-map-message">${escapeHtml(message)}</div>`)
            .openOn(map);
    }

    function getValue(record, ...keys) {
        for (const key of keys) {
            if (record[key] !== undefined && record[key] !== '') return record[key];
        }
        return '';
    }

    function normalizeHeader(header) {
        return String(header).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    }

    function parseCsvRows(csvText) {
        const rows = [];
        let row = [];
        let value = '';
        let quoted = false;

        for (let index = 0; index < csvText.length; index += 1) {
            const character = csvText[index];
            const nextCharacter = csvText[index + 1];

            if (character === '"' && quoted && nextCharacter === '"') {
                value += '"';
                index += 1;
            } else if (character === '"') {
                quoted = !quoted;
            } else if (character === ',' && !quoted) {
                row.push(value);
                value = '';
            } else if ((character === '\n' || character === '\r') && !quoted) {
                if (value || row.length) {
                    row.push(value);
                    rows.push(row);
                    row = [];
                    value = '';
                }
                if (character === '\r' && nextCharacter === '\n') index += 1;
            } else {
                value += character;
            }
        }

        if (value || row.length) {
            row.push(value);
            rows.push(row);
        }

        return rows;
    }

    function safeWebsite(value) {
        if (!value) return '';
        const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
        try {
            const url = new URL(withProtocol);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch {
            return '';
        }
    }

    function formatScore(score) {
        return Number.isInteger(score) ? `${score}/5` : `${score.toFixed(1)}/5`;
    }

    function escapeHtml(value) {
        const element = document.createElement('div');
        element.textContent = String(value || '');
        return element.innerHTML;
    }

    const styles = document.createElement('style');
    styles.textContent = `
        #map { min-height: 420px; background: #eef1f4; }
        .sheet-map-message { max-width: 260px; text-align: center; line-height: 1.4; }
        .sheet-empty-state { padding: 32px 20px; color: #666; text-align: center; }
        .sheet-business-item { display: block; min-width: 0; cursor: pointer; }
        .business-list.grid-view {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
            align-content: start;
            gap: 16px;
            padding: 16px;
        }
        .business-list.grid-view .sheet-business-item {
            border: 1px solid #e1e5ea;
            border-radius: 6px;
            padding: 18px;
        }
        .map-business-container.map-expanded { grid-template-columns: minmax(0, 1fr); }
        .map-business-container.map-expanded .business-list-section { display: none; }
        .sheet-business-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .sheet-business-heading h3 { margin: 4px 0 0; }
        .sheet-source-badge { display: inline-flex; width: fit-content; padding: 3px 8px; color: #225c68; background: #e6f1f2; border-radius: 999px; font-size: 0.72rem; font-weight: 800; }
        .sheet-category { color: #58656c; font-weight: 600; }
        .sheet-rating, .sheet-popup-rating { color: #b45309; white-space: nowrap; }
        .score-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px 12px; margin: 10px 0; font-size: 0.85rem; }
        .score-grid span { display: flex; justify-content: space-between; gap: 8px; }
        .sheet-popup { min-width: 220px; }
        .sheet-popup strong { display: block; margin-top: 6px; }
        .sheet-popup p { margin: 8px 0 0; }
        @media (max-width: 560px) { .score-grid { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(styles);
}());
