let _modalIdSeq = 0;

export function openModal({ title, bodyHtml, footerHtml = '' }) {
  const container = document.getElementById('modal-container');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const titleId = `modal-title-${++_modalIdSeq}`;
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <div class="modal-header">
        <span class="modal-title" id="${titleId}">${title}</span>
        <button class="modal-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>`;

  const close = () => overlay.remove();
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  // Focus trap: Tab/Shift+Tab no salen del modal.
  const modalEl = overlay.querySelector('.modal');
  const getFocusable = () => modalEl.querySelectorAll(
    'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  const keydownHandler = (e) => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', keydownHandler); return; }
    if (e.key !== 'Tab') return;
    const items = getFocusable();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', keydownHandler);

  container.appendChild(overlay);
  modalEl.querySelector('input, select, textarea, button:not(.modal-close)')?.focus();
  return { overlay, close };
}

export function confirmModal(message, onConfirm, danger = true) {
  const { overlay, close } = openModal({
    title: 'Confirmar acción',
    bodyHtml: `<p>${message}</p>`,
    footerHtml: `
      <button class="btn btn-secondary" id="cancel-btn">Cancelar</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-btn">Confirmar</button>`
  });
  overlay.querySelector('#cancel-btn').addEventListener('click', close);
  overlay.querySelector('#confirm-btn').addEventListener('click', () => { close(); onConfirm(); });
}
