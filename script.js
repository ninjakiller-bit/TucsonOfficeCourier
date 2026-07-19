const rushDialog = document.querySelector('#rush-dialog');
const rushButton = document.querySelector('[data-open-rush]');
const rushForm = document.querySelector('#rush-form');
const rushSuccess = document.querySelector('#rush-success');

const priceTable = {
  distance: { '0-5': 35, '6-10': 50, '11-15': 65, '16-20': 80, '21-30': 105 },
  speed: { rush: 20, 'same-day': 0 },
  item: { envelope: 0, document: 0, 'signature-document': 7, package: 10 }
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
    const speed = formData.get('speed');
    const item = formData.get('item');
    const base = priceTable.distance[zone];
    const speedFee = priceTable.speed[speed];
    const itemFee = priceTable.item[item];
    const total = base + speedFee + itemFee;
    rushSuccess.innerHTML = `<strong class="block text-lg">Your estimated delivery total</strong><div class="mt-4 rounded-xl bg-white p-4"><div class="flex justify-between text-sm text-zinc-600"><span>Distance zone (${zone} miles)</span><span>$${base.toFixed(2)}</span></div><div class="mt-2 flex justify-between text-sm text-zinc-600"><span>Delivery speed</span><span>$${speedFee.toFixed(2)}</span></div><div class="mt-2 flex justify-between text-sm text-zinc-600"><span>Item handling</span><span>$${itemFee.toFixed(2)}</span></div><div class="mt-4 flex justify-between border-t-2 border-zinc-900 pt-3 text-xl font-extrabold"><span>Estimated total</span><span>$${total.toFixed(2)}</span></div></div><p class="mt-4 text-sm">Estimate only. Final driving distance, service availability, and payment will be confirmed before a delivery is booked.</p>`;
    rushSuccess.classList.remove('hidden');
    rushSuccess.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

