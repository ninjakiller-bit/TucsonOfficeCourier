const rushDialog = document.querySelector('#rush-dialog');
const rushButton = document.querySelector('[data-open-rush]');
const rushForm = document.querySelector('#rush-form');
const rushSuccess = document.querySelector('#rush-success');

const flatRates = {
  '0-5': { sameDay: 45, rush: 65 },
  '6-10': { sameDay: 65, rush: 85 },
  '11-15': { sameDay: 85, rush: 110 },
  '16-20': { sameDay: 110, rush: 140 },
  '21-30': { sameDay: 145, rush: 185 }
};

if (rushDialog && rushButton) {
  rushButton.addEventListener('click', () => {
    rushSuccess?.classList.add('hidden');
    rushDialog.showModal();
  });
  rushDialog.querySelector('[data-close-rush]').addEventListener('click', () => rushDialog.close());
  rushDialog.addEventListener('click', (event) => {
    if (event.target === rushDialog) rushDialog.close();
  });
}

if (rushForm && rushSuccess) {
  rushForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(rushForm);
    const zone = formData.get('distanceZone');
    const rate = flatRates[zone];
    rushSuccess.innerHTML = `<strong class="block text-lg">Estimated ${zone}-mile route</strong><div class="mt-4 grid gap-3 sm:grid-cols-2"><div class="rounded-xl bg-white p-4"><span class="block text-sm text-zinc-600">Same-day</span><strong class="text-3xl">$${rate.sameDay}</strong></div><div class="rounded-xl bg-zinc-900 p-4 text-white"><span class="block text-sm text-zinc-300">Rush</span><strong class="text-3xl">$${rate.rush}</strong></div></div><p class="mt-4 text-sm">Estimate only. Final driving distance, service availability, and payment will be confirmed before a delivery is booked.</p>`;
    rushSuccess.classList.remove('hidden');
    rushSuccess.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}
