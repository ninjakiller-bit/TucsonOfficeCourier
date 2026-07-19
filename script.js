const rushDialog = document.querySelector('#rush-dialog');
const rushButton = document.querySelector('[data-open-rush]');
const rushForm = document.querySelector('#rush-form');
const rushSuccess = document.querySelector('#rush-success');

if (rushDialog && rushButton) {
  rushButton.addEventListener('click', () => rushDialog.showModal());
  rushDialog.querySelector('[data-close-rush]').addEventListener('click', () => rushDialog.close());
  rushDialog.addEventListener('click', (event) => {
    if (event.target === rushDialog) rushDialog.close();
  });
}

if (rushForm && rushSuccess) {
  rushForm.addEventListener('submit', (event) => {
    event.preventDefault();
    rushSuccess.classList.remove('hidden');
    rushForm.querySelector('button[type="submit"]').textContent = 'Distance calculator coming soon';
    rushForm.querySelector('button[type="submit"]').disabled = true;
  });
}

