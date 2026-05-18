import { escapeHtml } from './format.js';

let _listenerAdded = false;

export function initDropdownCloser() {
  if (_listenerAdded) return;
  _listenerAdded = true;
  document.addEventListener('click', e => {
    if (!e.target.closest('.fi-dropdown')) {
      document.querySelectorAll('.fi-dropdown-panel').forEach(p => p.remove());
      document.querySelectorAll('.fi-dropdown-btn.open').forEach(b => b.classList.remove('open'));
    }
  });
}

export function buildDropdown(container, wrapperId, label, items, selected, onchange) {
  const wrapper = container.querySelector('#' + wrapperId);
  if (!wrapper) return;
  if (items.length === 0) { wrapper.innerHTML = ''; return; }

  const count = selected.size;
  const btnLabel = count > 0 ? `${label} <span class="fi-dd-badge">${count}</span>` : label;

  wrapper.innerHTML = `
    <button class="btn btn-secondary fi-dropdown-btn${count > 0 ? ' fi-dd-active' : ''}">
      ${btnLabel} <span style="margin-left:4px;font-size:0.7rem;">▼</span>
    </button>`;

  const btn = wrapper.querySelector('button');
  btn.addEventListener('click', e => {
    e.stopPropagation();
    document.querySelectorAll('.fi-dropdown-panel').forEach(p => {
      if (!wrapper.contains(p)) p.remove();
    });
    document.querySelectorAll('.fi-dropdown-btn.open').forEach(b => {
      if (b !== btn) b.classList.remove('open');
    });

    const existingPanel = wrapper.querySelector('.fi-dropdown-panel');
    if (existingPanel) { existingPanel.remove(); btn.classList.remove('open'); return; }

    btn.classList.add('open');

    const pending = new Set(selected);

    const panel = document.createElement('div');
    panel.className = 'fi-dropdown-panel';
    panel.innerHTML =
      `<div style="padding:6px 8px;border-bottom:1px solid var(--color-border);">
        <input type="text" class="fi-dd-search-input form-control" placeholder="Buscar…" style="height:30px;font-size:0.83rem;" autocomplete="off">
      </div>
      <div class="fi-dd-actions">
        <button class="fi-dd-selall">Seleccionar todo</button>
        <button class="fi-dd-deselall">Deseleccionar todo</button>
      </div>` +
      items.map(item => `
        <label class="fi-dd-item${pending.has(item.id) ? ' fi-dd-checked' : ''}">
          <input type="checkbox" value="${item.id}" ${pending.has(item.id) ? 'checked' : ''}>
          <span>${escapeHtml(item.nombre)}${item.tipo ? ` <span class="fi-dd-tipo fi-dd-tipo-${item.tipo}">${item.tipo}</span>` : ''}</span>
        </label>`).join('') +
      `<div class="fi-dd-footer">
        <button class="btn btn-sm btn-primary fi-dd-apply">Aplicar filtros</button>
      </div>`;

    const checkboxes = panel.querySelectorAll('input[type=checkbox]');

    const searchInput = panel.querySelector('.fi-dd-search-input');
    searchInput.addEventListener('click', e => e.stopPropagation());
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      panel.querySelectorAll('.fi-dd-item').forEach(lbl => {
        const text = lbl.querySelector('span')?.textContent?.toLowerCase() ?? '';
        lbl.style.display = text.includes(q) ? '' : 'none';
      });
    });

    const visibleCbs = () => [...checkboxes].filter(cb => cb.closest('label').style.display !== 'none');

    const setAll = (checked) => {
      visibleCbs().forEach(cb => {
        cb.checked = checked;
        cb.closest('label').classList.toggle('fi-dd-checked', checked);
        if (checked) pending.add(cb.value);
        else pending.delete(cb.value);
      });
    };

    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        cb.closest('label').classList.toggle('fi-dd-checked', cb.checked);
        if (cb.checked) pending.add(cb.value);
        else pending.delete(cb.value);
      });
    });

    panel.querySelector('.fi-dd-selall').addEventListener('click', e => { e.stopPropagation(); setAll(true); });
    panel.querySelector('.fi-dd-deselall').addEventListener('click', e => { e.stopPropagation(); setAll(false); });

    panel.querySelector('.fi-dd-apply').addEventListener('click', e => {
      e.stopPropagation();
      selected.clear();
      pending.forEach(v => selected.add(v));
      panel.remove();
      btn.classList.remove('open');
      onchange();
    });

    wrapper.appendChild(panel);

    const pr = panel.getBoundingClientRect();
    if (pr.right > window.innerWidth - 8) {
      panel.style.left = 'auto';
      panel.style.right = '0';
    }
  });
}
