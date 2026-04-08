/**
 * Inspiration Gallery Block
 *
 * Document table structure (authored in Google Docs / SharePoint):
 * | Inspiration Gallery |           |
 * |---------------------|-----------|
 * | categories          | Living Area, Bedroom, Bathroom, Kitchen, Outdoor |
 * | data source         | /inspiration-tiles.json |
 * | cta label           | Create New Board |
 * | cta link            | /create-board |
 *
 * JSON data shape (each row in the spreadsheet):
 * { title, image, category, brand, surface, colour, theme, application, size }
 */

const FILTER_FIELDS = ['brand', 'surface', 'colour', 'theme', 'application', 'size'];
const DEFAULT_CATEGORIES = ['All', 'Living Area', 'Bedroom', 'Bathroom', 'Kitchen', 'Outdoor'];

// Heart / favourite SVG
const HEART_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
</svg>`;

// Chevron-down for custom select
const CHEVRON_SVG = `<svg class="ig-chevron" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
  <path d="M1 1l5 5 5-5"/>
</svg>`;

async function fetchTiles(dataSource) {
  try {
    const resp = await fetch(dataSource);
    if (!resp.ok) return [];
    const json = await resp.json();
    return json.data || [];
  } catch {
    return [];
  }
}

function normalize(tile, field) {
  // Field names may be Title-cased in spreadsheet
  return tile[field] || tile[field.charAt(0).toUpperCase() + field.slice(1)] || '';
}

function buildCategoryPills(categories, activeCategory, onSelect) {
  const nav = document.createElement('div');
  nav.className = 'ig-categories';

  categories.forEach((cat) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ig-pill${cat === activeCategory ? ' active' : ''}`;
    btn.textContent = cat;
    btn.setAttribute('aria-pressed', cat === activeCategory ? 'true' : 'false');
    btn.addEventListener('click', () => onSelect(cat));
    nav.append(btn);
  });

  return nav;
}

function buildFilters(tiles, activeFilters, onFilterChange) {
  const row = document.createElement('div');
  row.className = 'ig-filters';

  FILTER_FIELDS.forEach((field) => {
    const values = [...new Set(tiles.map((t) => normalize(t, field)).filter(Boolean))].sort();
    if (!values.length) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'ig-filter';

    const label = document.createElement('label');
    label.className = 'ig-filter-label';
    label.textContent = field.toUpperCase();

    const selectWrap = document.createElement('div');
    selectWrap.className = 'ig-select-wrap';

    const select = document.createElement('select');
    select.setAttribute('aria-label', field);

    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'All';
    select.append(allOpt);

    values.forEach((val) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      if (activeFilters[field] === val) opt.selected = true;
      select.append(opt);
    });

    select.addEventListener('change', () => {
      onFilterChange(field, select.value || null);
    });

    selectWrap.innerHTML = CHEVRON_SVG;
    selectWrap.prepend(select);

    label.htmlFor = `ig-filter-${field}`;
    select.id = `ig-filter-${field}`;

    wrapper.append(label, selectWrap);
    row.append(wrapper);
  });

  return row;
}

function buildGrid(tiles) {
  const grid = document.createElement('div');
  grid.className = 'ig-grid';
  grid.setAttribute('role', 'list');

  tiles.forEach((tile) => {
    const title = normalize(tile, 'title');
    const imageSrc = normalize(tile, 'image');

    const card = document.createElement('div');
    card.className = 'ig-card';
    card.setAttribute('role', 'listitem');

    const imgWrap = document.createElement('div');
    imgWrap.className = 'ig-card-img-wrap';

    const img = document.createElement('img');
    img.src = imageSrc;
    img.alt = title;
    img.loading = 'lazy';
    imgWrap.append(img);

    const heart = document.createElement('button');
    heart.type = 'button';
    heart.className = 'ig-heart';
    heart.setAttribute('aria-label', `Favourite ${title}`);
    heart.innerHTML = HEART_SVG;
    heart.addEventListener('click', (e) => {
      e.stopPropagation();
      const active = heart.classList.toggle('active');
      heart.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const labelEl = document.createElement('div');
    labelEl.className = 'ig-card-label';
    labelEl.textContent = title;

    card.append(imgWrap, heart, labelEl);
    grid.append(card);
  });

  return grid;
}

export default async function decorate(block) {
  // --- Read config from block table rows ---
  let dataSource = '';
  let ctaLabel = 'Create New Board';
  let ctaLink = '#';
  let categories = DEFAULT_CATEGORIES;

  [...block.children].forEach((row) => {
    const [keyCell, valCell] = [...row.children];
    const key = keyCell?.textContent?.trim().toLowerCase();
    const val = valCell?.textContent?.trim();
    if (!key || !val) return;

    if (key === 'categories') {
      categories = ['All', ...val.split(',').map((s) => s.trim()).filter(Boolean)];
    } else if (key === 'data source') {
      dataSource = val;
    } else if (key === 'cta label') {
      ctaLabel = val;
    } else if (key === 'cta link') {
      ctaLink = valCell?.querySelector('a')?.href || val;
    }
  });

  // Clear authored content, show loading state
  block.textContent = '';
  block.classList.add('loading');

  const allTiles = dataSource ? await fetchTiles(dataSource) : [];
  block.classList.remove('loading');

  let activeCategory = 'All';
  const activeFilters = {};

  function getFiltered() {
    return allTiles.filter((tile) => {
      const cat = normalize(tile, 'category');
      if (activeCategory !== 'All' && cat !== activeCategory) return false;
      for (const [field, val] of Object.entries(activeFilters)) {
        if (val && normalize(tile, field) !== val) return false;
      }
      return true;
    });
  }

  function render() {
    block.textContent = '';
    const filtered = getFiltered();

    // Category pills
    const pills = buildCategoryPills(categories, activeCategory, (cat) => {
      activeCategory = cat;
      render();
    });
    block.append(pills);

    // Attribute filters (only render if we have tile data)
    if (allTiles.length) {
      const filters = buildFilters(allTiles, activeFilters, (field, val) => {
        if (val) activeFilters[field] = val;
        else delete activeFilters[field];
        render();
      });
      block.append(filters);
    }

    // CTA button row
    const ctaRow = document.createElement('div');
    ctaRow.className = 'ig-cta-row';
    const ctaBtn = document.createElement('a');
    ctaBtn.className = 'ig-cta-btn';
    ctaBtn.href = ctaLink;
    ctaBtn.textContent = ctaLabel;
    ctaRow.append(ctaBtn);
    block.append(ctaRow);

    // Results count
    if (allTiles.length) {
      const count = document.createElement('p');
      count.className = 'ig-count';
      count.textContent = `${filtered.length} space${filtered.length !== 1 ? 's' : ''} found`;
      block.append(count);
    }

    // Image grid
    if (filtered.length) {
      block.append(buildGrid(filtered));
    } else if (allTiles.length) {
      const empty = document.createElement('p');
      empty.className = 'ig-empty';
      empty.textContent = 'No spaces match your filters.';
      block.append(empty);
    }
  }

  render();
}
