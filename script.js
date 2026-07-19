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


const standardDialog = document.querySelector('#standard-dialog');
const standardButton = document.querySelector('[data-open-standard]');
const standardForm = document.querySelector('#standard-form');
const standardSuccess = document.querySelector('#standard-success');
const scheduleFields = document.querySelector('#schedule-fields');
const scheduledDate = document.querySelector('input[name="deliveryDate"]');
const standardPrices = {
  sameDay: { '0-5': 30, '6-10': 45, '11-15': 60, '16-20': 75, '21-30': 95 },
  scheduled: { '0-5': 25, '6-10': 35, '11-15': 45, '16-20': 55, '21-30': 70 },
  item: { document: 0, signature: 7, package: 10 }
};

if (scheduledDate) scheduledDate.min = new Date().toISOString().split('T')[0];
if (standardDialog && standardButton) {
  standardButton.addEventListener('click', () => { standardSuccess?.classList.add('hidden'); standardDialog.showModal(); });
  standardDialog.querySelector('[data-close-standard]').addEventListener('click', () => standardDialog.close());
  standardDialog.addEventListener('click', (event) => { if (event.target === standardDialog) standardDialog.close(); });
}
if (standardForm && scheduleFields) {
  const afterHoursFields = document.querySelector('#after-hours-fields');
  const afterHoursDateTime = document.querySelector('input[name="afterHoursDateTime"]');
  if (afterHoursDateTime) afterHoursDateTime.min = new Date().toISOString().slice(0, 16);
  standardForm.querySelectorAll('input[name="standardSpeed"]').forEach((input) => input.addEventListener('change', () => {
    const selected = standardForm.querySelector('input[name="standardSpeed"]:checked').value;
    const planned = selected === 'scheduled';
    const afterHours = selected === 'after-hours';
    scheduleFields.classList.toggle('hidden', !planned);
    afterHoursFields.classList.toggle('hidden', !afterHours);
    scheduledDate.required = planned;
    afterHoursDateTime.required = afterHours;
  }));
  standardForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(standardForm); const speed = data.get('standardSpeed'); const zone = data.get('standardZone');
    const routeBase = speed === 'scheduled' ? standardPrices.scheduled[zone] : standardPrices.sameDay[zone];
    const itemFee = standardPrices.item[data.get('standardItem')];
    const afterHoursFee = speed === 'after-hours' ? 75 : 0;
    const beforeMinimum = routeBase + itemFee + afterHoursFee;
    const minimumAdjustment = speed === 'after-hours' ? Math.max(0, 125 - beforeMinimum) : 0;
    const total = beforeMinimum + minimumAdjustment;
    const speedLabel = speed === 'same-day' ? 'Same-day delivery' : speed === 'scheduled' ? 'Planned delivery' : 'After-hours delivery';
    const afterHoursLine = afterHoursFee ? `<div class="mt-2 flex justify-between text-sm text-zinc-600"><span>After-hours fee</span><span>${afterHoursFee.toFixed(2)}</span></div>` : '';
    const minimumLine = minimumAdjustment ? `<div class="mt-2 flex justify-between text-sm text-zinc-600"><span>After-hours minimum adjustment</span><span>${minimumAdjustment.toFixed(2)}</span></div>` : '';
    standardSuccess.innerHTML = `<strong class="block text-lg">Estimated ${speedLabel.toLowerCase()} total</strong><div class="mt-4 rounded-xl bg-white p-4"><div class="flex justify-between text-sm text-zinc-600"><span>Route base (${zone} miles)</span><span>${routeBase.toFixed(2)}</span></div><div class="mt-2 flex justify-between text-sm text-zinc-600"><span>Item handling</span><span>${itemFee.toFixed(2)}</span></div>${afterHoursLine}${minimumLine}<div class="mt-4 flex justify-between border-t-2 border-zinc-900 pt-3 text-xl font-extrabold"><span>Estimated total</span><span>${total.toFixed(2)}</span></div></div><p class="mt-4 text-sm">Estimate only. Final driving distance, availability, and payment will be confirmed before a delivery is booked.</p>`;
    standardSuccess.classList.remove('hidden'); standardSuccess.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

const interofficeDialog = document.querySelector('#interoffice-dialog');
const interofficeButton = document.querySelector('[data-open-interoffice]');
const interofficeForm = document.querySelector('#interoffice-form');
const interofficeSuccess = document.querySelector('#interoffice-success');
const interofficeSchedule = document.querySelector('#interoffice-schedule-fields');
const interofficeAfterHours = document.querySelector('#interoffice-after-hours-fields');
const interofficeDate = interofficeForm?.querySelector('input[name="deliveryDate"]');
const interofficeAfterHoursDate = interofficeForm?.querySelector('input[name="afterHoursDateTime"]');

if (interofficeDate) interofficeDate.min = new Date().toISOString().split('T')[0];
if (interofficeAfterHoursDate) interofficeAfterHoursDate.min = new Date().toISOString().slice(0, 16);
if (interofficeDialog && interofficeButton) {
  interofficeButton.addEventListener('click', () => { interofficeSuccess?.classList.add('hidden'); interofficeDialog.showModal(); });
  interofficeDialog.querySelector('[data-close-interoffice]').addEventListener('click', () => interofficeDialog.close());
  interofficeDialog.addEventListener('click', (event) => { if (event.target === interofficeDialog) interofficeDialog.close(); });
}
if (interofficeForm && interofficeSchedule && interofficeAfterHours) {
  interofficeForm.querySelectorAll('input[name="interofficeSpeed"]').forEach((input) => input.addEventListener('change', () => {
    const selected = interofficeForm.querySelector('input[name="interofficeSpeed"]:checked').value;
    const planned = selected === 'scheduled'; const afterHours = selected === 'after-hours';
    interofficeSchedule.classList.toggle('hidden', !planned); interofficeAfterHours.classList.toggle('hidden', !afterHours);
    interofficeDate.required = planned; interofficeAfterHoursDate.required = afterHours;
  }));
  interofficeForm.addEventListener('submit', (event) => {
    event.preventDefault(); const data = new FormData(interofficeForm); const speed = data.get('interofficeSpeed'); const zone = data.get('interofficeZone');
    const routeBase = speed === 'scheduled' ? standardPrices.scheduled[zone] : standardPrices.sameDay[zone];
    const itemFee = { mail: 0, signature: 7, package: 10 }[data.get('interofficeItem')]; const afterFee = speed === 'after-hours' ? 75 : 0;
    const preliminary = routeBase + itemFee + afterFee; const minimum = speed === 'after-hours' ? Math.max(0, 125 - preliminary) : 0; const total = preliminary + minimum;
    const afterLine = afterFee ? `<div class="mt-2 flex justify-between text-sm text-zinc-600"><span>After-hours fee</span><span>$${afterFee.toFixed(2)}</span></div>` : ''; const minimumLine = minimum ? `<div class="mt-2 flex justify-between text-sm text-zinc-600"><span>After-hours minimum adjustment</span><span>$${minimum.toFixed(2)}</span></div>` : '';
    interofficeSuccess.innerHTML = `<strong class="block text-lg">Estimated mail-run total</strong><div class="mt-4 rounded-xl bg-white p-4"><div class="flex justify-between text-sm text-zinc-600"><span>Route base (${zone} miles)</span><span>$${routeBase.toFixed(2)}</span></div><div class="mt-2 flex justify-between text-sm text-zinc-600"><span>Item handling</span><span>$${itemFee.toFixed(2)}</span></div>${afterLine}${minimumLine}<div class="mt-4 flex justify-between border-t-2 border-zinc-900 pt-3 text-xl font-extrabold"><span>Estimated total</span><span>$${total.toFixed(2)}</span></div></div><p class="mt-4 text-sm">Estimate only. Final driving distance, availability, and payment will be confirmed before a delivery is booked.</p>`;
    interofficeSuccess.classList.remove('hidden'); interofficeSuccess.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}
