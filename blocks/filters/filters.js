/**
 * AEM EDS Filters block
 * - Authorable labels + options via table rows
 * - Tabs (pills) + dropdown filters
 * - Filters a target list of items using data-* attributes
 *
 * Authoring rows:
 *  - Tabs Label (optional) => label for the tabs group (not required)
 *  - Tabs => pipe-separated values: "All|Living Area|Bedroom"
 *  - Dropdown: <Label> => "All|Option1|Option2"
 *  - Target selector => CSS selector to find items to filter
 */

function normaliseKey(label) {
  return label
    .toLowerCase()
    .trim()
    .replace(/^dropdown:\s*/i, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function splitOptions(text) {
  return (text || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

function readTableConfig(block) {
  const cfg = {
    tabsLabel: '',
    tabs: [],
    dropdowns: [],
    targetSelector: '',
  };

  const rows = [...block.querySelectorAll(':scope > div')];
  rows.forEach((row) => {
    const cells = [...row.children];
    const key = cells[0]?.textContent?.trim() || '';
    const value = cells[1]?.textContent?.trim() || '';

    if (!key) return;

    if (/^tabs label/i.test(key)) {
      cfg.tabsLabel = value;
      return;
    }

    if (/^tabs$/i.test(key)) {
      cfg.tabs = splitOptions(value);
      return;
    }

    if (/^target selector$/i.test(key)) {
      cfg.targetSelector = value;
      return;
    }

    if (/^dropdown:/i.test(key)) {
      cfg.dropdowns.push({
        label: key.replace(/^dropdown:\s*/i, '').trim(),
        key: normaliseKey(key),
        options: splitOptions(value),
      });
    }
  });

  // Sensible defaults
  if (!cfg.tabs.length) cfg.tabs = ['All'];
  if (!cfg.targetSelector) cfg.targetSelector = '.product-card';

  return cfg;
}

function buildTabs(cfg, state, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'filters-tabs';

  // Optional label (kept for accessibility / future)
  if (cfg.tabsLabel) {
    const sr = document.createElement('span');
    sr.className = 'filters-sr-only';
    sr.textContent = cfg.tabsLabel;
    wrap.append(sr);
  }

  const list = document.createElement('div');
  list.className = 'filters-tablist';
  list.setAttribute('role', 'tablist');

  cfg.tabs.forEach((tab) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filters-tab';
    btn.textContent = tab;
    btn.dataset.value = tab;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', tab === state.tab ? 'true' : 'false');

    btn.addEventListener('click', () => {
      state.tab = tab;
      onChange();
    });

    list.append(btn);
  });

  wrap.append(list);
  return wrap;
}

function buildDropdowns(cfg, state, onChange) {
  const row = document.createElement('div');
  row.className = 'filters-dropdowns';

  cfg.dropdowns.forEach((dd) => {
    const field = document.createElement('div');
    field.className = 'filters-field';

    const label = document.createElement('span');
    label.className = 'filters-field-label';
    label.textContent = dd.label;

    const select = document.createElement('select');
    select.className = 'filters-select';
    select.dataset.key = dd.key;

    dd.options.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      select.append(o);
    });

    // default selection
    const selected = state.filters[dd.key] ?? (dd.options[0] || 'All');
    select.value = selected;

    select.addEventListener('change', (e) => {
      state.filters[dd.key] = e.target.value;
      onChange();
    });

    field.append(label, select);
    row.append(field);
  });

  return row;
}

function updateActiveUI(root, state) {
  // tabs
  root.querySelectorAll('.filters-tab').forEach((btn) => {
    const active = btn.dataset.value === state.tab;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function matchesFilterValue(itemValue, selectedValue) {
  if (!selectedValue || /^all$/i.test(selectedValue)) return true;
  if (!itemValue) return false;

  // allow multi-values in item: "Modern|Minimal"
  const parts = String(itemValue)
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  return parts.some((p) => p.toLowerCase() === selectedValue.toLowerCase());
}

function applyFilters(cfg, state, root) {
  const targetRoot = document.querySelector(cfg.targetSelector)?.closest('body') || document.body;
  const items = [...document.querySelectorAll(cfg.targetSelector)];

  const tabKey = cfg.tabsLabel ? normaliseKey(cfg.tabsLabel) : 'room'; // default to "room"
  // If you want tabs to map to a specific attribute explicitly, author "Tabs Label = Room"
  const tabAttr = `data-${tabKey}`;

  let visibleCount = 0;

  items.forEach((item) => {
    let ok = true;

    // tabs filter
    if (state.tab && !/^all$/i.test(state.tab)) {
      ok = ok && matchesFilterValue(item.getAttribute(tabAttr), state.tab);
    }

    // dropdown filters
    Object.entries(state.filters).forEach(([key, selected]) => {
      if (!ok) return;
      const attr = `data-${key}`;
      ok = ok && matchesFilterValue(item.getAttribute(attr), selected);
    });

    item.classList.toggle('is-hidden-by-filters', !ok);
    if (ok) visibleCount += 1;
  });

  // optional: dispatch event for analytics or other blocks
  root.dispatchEvent(
    new CustomEvent('filters:changed', {
      bubbles: true,
      detail: {
        tab: state.tab,
        filters: { ...state.filters },
        visibleCount,
        totalCount: items.length,
      },
    }),
  );

  updateActiveUI(root, state);
}

export default function decorate(block) {
  const cfg = readTableConfig(block);

  // state
  const state = {
    tab: cfg.tabs[0] || 'All',
    filters: {},
  };

  // initialise dropdown state to first option ("All" recommended)
  cfg.dropdowns.forEach((dd) => {
    state.filters[dd.key] = dd.options[0] || 'All';
  });

  // build UI
  const root = document.createElement('div');
  root.className = 'filters';

  const onChange = () => applyFilters(cfg, state, root);

  root.append(
    buildTabs(cfg, state, onChange),
    buildDropdowns(cfg, state, onChange),
  );

  // Replace authored table with our UI
  block.textContent = '';
  block.append(root);

  // Apply initially
  onChange();
}
