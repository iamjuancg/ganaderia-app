export function openModal({ title, bodyHtml, footerHtml = '' }) {
  const container = document.getElementById('modal-container');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-header">
        <span class="modal-title">${title}</span>
        <button class="modal-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>`;

  const close = () => overlay.remove();
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
  });

  container.appendChild(overlay);
  overlay.querySelector('.modal').querySelector('input, select, textarea, button:not(.modal-close)')?.focus();
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
