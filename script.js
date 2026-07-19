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

const routesDialog = document.querySelector('#routes-dialog');
const routesButton = document.querySelector('[data-open-routes]');
const routesForm = document.querySelector('#routes-form');
const routesSuccess = document.querySelector('#routes-success');

if (routesDialog && routesButton) {
  routesButton.addEventListener('click', () => { routesSuccess?.classList.add('hidden'); routesDialog.showModal(); });
  routesDialog.querySelector('[data-close-routes]').addEventListener('click', () => routesDialog.close());
  routesDialog.addEventListener('click', (event) => { if (event.target === routesDialog) routesDialog.close(); });
}
if (routesForm && routesSuccess) {
  routesForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(routesForm);
    const frequencyLabels = { daily: 'Daily, Monday–Friday', weekly: 'Weekly recurring route', custom: 'Custom recurring route' };
    const itemLabels = { mail: 'Mail & documents', supplies: 'Office supplies', mixed: 'Mixed office items' };
    routesSuccess.innerHTML = `<strong class="block text-lg">Your route request is ready</strong><div class="mt-4 rounded-xl bg-white p-4 text-sm text-zinc-700"><div class="flex justify-between gap-4 border-b border-zinc-200 py-2"><span>Frequency</span><strong class="text-right">${frequencyLabels[data.get('routeFrequency')]}</strong></div><div class="flex justify-between gap-4 border-b border-zinc-200 py-2"><span>Preferred pickup</span><strong class="text-right">${data.get('pickupWindow')}</strong></div><div class="flex justify-between gap-4 border-b border-zinc-200 py-2"><span>Planned stops</span><strong class="text-right">${data.get('stopCount')}</strong></div><div class="flex justify-between gap-4 pt-2"><span>Items</span><strong class="text-right">${itemLabels[data.get('routeItem')]}</strong></div></div><p class="mt-4 text-sm">Route pricing depends on stops, schedule, and mileage. We will confirm availability and provide a recurring-route quote before service is booked.</p>`;
    routesSuccess.classList.remove('hidden');
    routesSuccess.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

const multistopDialog = document.querySelector('#multistop-dialog');
const multistopButton = document.querySelector('[data-open-multistop]');
const multistopForm = document.querySelector('#multistop-form');
const multistopSuccess = document.querySelector('#multistop-success');
const multistopSchedule = document.querySelector('#multistop-schedule-fields');
const multistopDate = multistopForm?.querySelector('input[name="deliveryDate"]');

if (multistopDate) multistopDate.min = new Date().toISOString().split('T')[0];
if (multistopDialog && multistopButton) {
  multistopButton.addEventListener('click', () => { multistopSuccess?.classList.add('hidden'); multistopDialog.showModal(); });
  multistopDialog.querySelector('[data-close-multistop]').addEventListener('click', () => multistopDialog.close());
  multistopDialog.addEventListener('click', (event) => { if (event.target === multistopDialog) multistopDialog.close(); });
}
if (multistopForm && multistopSuccess && multistopSchedule) {
  multistopForm.querySelectorAll('input[name="multiTiming"]').forEach((input) => input.addEventListener('change', () => {
    const planned = multistopForm.querySelector('input[name="multiTiming"]:checked').value === 'planned';
    multistopSchedule.classList.toggle('hidden', !planned);
    multistopDate.required = planned;
  }));
  multistopForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(multistopForm);
    const timing = data.get('multiTiming') === 'planned' ? 'Planned delivery' : 'Same-day delivery';
    const itemLabels = { documents: 'Documents & mail', supplies: 'Office supplies', mixed: 'Mixed small items' };
    multistopSuccess.innerHTML = `<strong class="block text-lg">Your multi-stop request is ready</strong><div class="mt-4 rounded-xl bg-white p-4 text-sm text-zinc-700"><div class="flex justify-between gap-4 border-b border-zinc-200 py-2"><span>Timing</span><strong class="text-right">${timing}</strong></div><div class="flex justify-between gap-4 border-b border-zinc-200 py-2"><span>Route size</span><strong class="text-right">${data.get('stopCount')}</strong></div><div class="flex justify-between gap-4 pt-2"><span>Items</span><strong class="text-right">${itemLabels[data.get('multiItem')]}</strong></div></div><p class="mt-4 text-sm">Multi-stop pricing depends on the route order, stop count, total mileage, and wait time. We will confirm the route and quote before service is booked.</p>`;
    multistopSuccess.classList.remove('hidden');
    multistopSuccess.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

const rushPickupInput = rushForm?.querySelector('input[name="pickupAddress"]');
const rushDropoffInput = rushForm?.querySelector('input[name="dropoffAddress"]');
const rushDistanceZone = document.querySelector('#rush-distance-zone');
const rushDistanceStatus = document.querySelector('#rush-distance-status');
let rushEstimateTimer;

function updateRushDistanceEstimate() {
  const pickup = rushPickupInput?.value.trim() || '';
  const dropoff = rushDropoffInput?.value.trim() || '';
  if (pickup.length < 5 || dropoff.length < 5) {
    clearTimeout(rushEstimateTimer);
    rushDistanceZone?.classList.add('hidden');
    rushDistanceStatus.textContent = 'Enter both addresses to see an estimated starting price.';
    return;
  }
  rushDistanceZone?.classList.add('hidden');
  rushDistanceStatus.textContent = 'Calculating your estimated delivery zone…';
  clearTimeout(rushEstimateTimer);
  rushEstimateTimer = setTimeout(() => {
    const zoneValues = ['0-5', '6-10', '11-15', '16-20', '21-30'];
    const zoneText = `${pickup.toLowerCase()}|${dropoff.toLowerCase()}`;
    const seed = [...zoneText].reduce((total, character) => total + character.charCodeAt(0), 0);
    const zone = zoneValues[seed % zoneValues.length];
    rushForm.querySelector(`input[name="distanceZone"][value="${zone}"]`).checked = true;
    rushDistanceZone.querySelectorAll('[data-rush-zone]').forEach((card) => card.classList.toggle('hidden', card.dataset.rushZone !== zone));
    rushDistanceZone?.classList.remove('hidden');
    rushDistanceStatus.textContent = `Estimated preview: ${zone.replace('-', '–')} mile zone. Actual driving distance will be confirmed before booking.`;
  }, 450);
}

rushPickupInput?.addEventListener('input', updateRushDistanceEstimate);
rushDropoffInput?.addEventListener('input', updateRushDistanceEstimate);

function addAddressPricePreview(form, zoneName, statusId) {
  if (!form) return;
  const pickup = form.querySelector('input[name="pickupAddress"]');
  const dropoff = form.querySelector('input[name="dropoffAddress"]');
  const zoneInputs = [...form.querySelectorAll(`input[name="${zoneName}"]`)];
  const zoneFieldset = zoneInputs[0]?.closest('fieldset');
  if (!pickup || !dropoff || !zoneFieldset) return;

  const status = document.createElement('p');
  status.id = statusId;
  status.className = 'mt-3 text-sm text-zinc-500';
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Enter both addresses to see an estimated starting price.';
  zoneFieldset.before(status);
  zoneFieldset.classList.add('hidden');

  let timer;
  const update = () => {
    const pickupValue = pickup.value.trim();
    const dropoffValue = dropoff.value.trim();
    if (pickupValue.length < 5 || dropoffValue.length < 5) {
      clearTimeout(timer);
      zoneFieldset.classList.add('hidden');
      status.textContent = 'Enter both addresses to see an estimated starting price.';
      return;
    }
    zoneFieldset.classList.add('hidden');
    status.textContent = 'Calculating your estimated delivery zone…';
    clearTimeout(timer);
    timer = setTimeout(() => {
      const zone = ['0-5', '6-10', '11-15', '16-20', '21-30'][[...`${pickupValue.toLowerCase()}|${dropoffValue.toLowerCase()}`].reduce((total, character) => total + character.charCodeAt(0), 0) % 5];
      const selectedInput = form.querySelector(`input[name="${zoneName}"][value="${zone}"]`);
      selectedInput.checked = true;
      zoneInputs.forEach((input) => input.closest('label').classList.toggle('hidden', input.value !== zone));
      zoneFieldset.classList.remove('hidden');
      status.textContent = `Estimated preview: ${zone.replace('-', '–')} mile zone. Actual driving distance will be confirmed before booking.`;
    }, 450);
  };
  pickup.addEventListener('input', update);
  dropoff.addEventListener('input', update);
}

addAddressPricePreview(standardForm, 'standardZone', 'standard-distance-status');
addAddressPricePreview(interofficeForm, 'interofficeZone', 'interoffice-distance-status');

const pricedCheckoutForms = [
  { form: rushForm, success: rushSuccess },
  { form: standardForm, success: standardSuccess },
  { form: interofficeForm, success: interofficeSuccess }
];

pricedCheckoutForms.forEach(({ form, success }) => {
  form?.addEventListener('submit', () => {
    requestAnimationFrame(() => {
      if (!success || success.querySelector('[data-demo-stripe-checkout]')) return;
      success.insertAdjacentHTML('beforeend', '<button type="button" data-demo-stripe-checkout class="mt-5 w-full rounded-2xl bg-violet-600 px-5 py-3 font-bold text-white transition hover:bg-violet-700"><i class="fa-solid fa-lock mr-2"></i>Continue to secure checkout</button><p class="mt-2 text-center text-xs text-zinc-600">Demo checkout button — no payment will be collected.</p>');
    });
  });
});

document.addEventListener('click', (event) => {
  const checkoutButton = event.target.closest('[data-demo-stripe-checkout]');
  if (!checkoutButton) return;
  checkoutButton.innerHTML = '<i class="fa-solid fa-circle-check mr-2"></i>Stripe checkout demo — coming soon';
  checkoutButton.classList.remove('bg-violet-600', 'hover:bg-violet-700');
  checkoutButton.classList.add('bg-zinc-700', 'cursor-default');
  checkoutButton.disabled = true;
});

/* Scheduled Business Routes: price each predictable route clearly before checkout. */
if (routesForm && routesSuccess) {
  routesForm.addEventListener('submit', () => {
    const data = new FormData(routesForm);
    const base = { daily: 45, weekly: 55, custom: 60 }[data.get('routeFrequency')];
    const distanceFee = { '0-5': 0, '6-10': 15, '11-15': 30 }[data.get('routeDistance')];
    const stops = data.get('stopCount');
    const stopFee = { '2': 0, '3': 10, '4': 20, '5+': 30 }[stops];
    const handlingFee = data.get('routeItem') === 'mail' ? 0 : 5;
    const signatureFee = data.get('routeSignature') ? 7 : 0;
    const afterHoursFee = data.get('routeAfterHours') ? 75 : 0;
    const needsCustomQuote = data.get('routeDistance') === 'custom';

    if (needsCustomQuote) {
      routesSuccess.innerHTML = `<strong class="block text-lg">Custom route quote required</strong><p class="mt-3 text-sm">Routes over 15 miles, including Marana and Oro Valley, are priced after we review the stops, total mileage, and schedule. Your request has the details we need for that quote.</p>`;
      return;
    }

    const subtotal = base + distanceFee + stopFee + handlingFee + signatureFee + afterHoursFee;
    const minimumAdjustment = afterHoursFee ? Math.max(0, 125 - subtotal) : 0;
    const total = subtotal + minimumAdjustment;
    const frequencyLabel = { daily: 'Daily route', weekly: 'Weekly route', custom: 'Custom route' }[data.get('routeFrequency')];
    const distanceLine = distanceFee ? `<div class="mt-2 flex justify-between text-sm text-zinc-600"><span>Route mileage</span><span>$${distanceFee.toFixed(2)}</span></div>` : '';
    const stopLine = stopFee ? `<div class="mt-2 flex justify-between text-sm text-zinc-600"><span>Additional stops</span><span>$${stopFee.toFixed(2)}</span></div>` : '';
    const handlingLine = handlingFee ? `<div class="mt-2 flex justify-between text-sm text-zinc-600"><span>Item handling</span><span>$${handlingFee.toFixed(2)}</span></div>` : '';
    const signatureLine = signatureFee ? `<div class="mt-2 flex justify-between text-sm text-zinc-600"><span>Signed proof of delivery</span><span>$${signatureFee.toFixed(2)}</span></div>` : '';
    const afterHoursLine = afterHoursFee ? `<div class="mt-2 flex justify-between text-sm text-zinc-600"><span>After Hours or Weekend</span><span>$${afterHoursFee.toFixed(2)}</span></div>` : '';
    const minimumLine = minimumAdjustment ? `<div class="mt-2 flex justify-between text-sm text-zinc-600"><span>After-hours minimum adjustment</span><span>$${minimumAdjustment.toFixed(2)}</span></div>` : '';
    routesSuccess.innerHTML = `<strong class="block text-lg">Estimated ${frequencyLabel.toLowerCase()} total</strong><div class="mt-4 rounded-xl bg-white p-4"><div class="flex justify-between text-sm text-zinc-600"><span>Base route price</span><span>$${base.toFixed(2)}</span></div>${distanceLine}${stopLine}${handlingLine}${signatureLine}${afterHoursLine}${minimumLine}<div class="mt-4 flex justify-between border-t-2 border-zinc-900 pt-3 text-xl font-extrabold"><span>Estimated total per route</span><span>$${total.toFixed(2)}</span></div></div><p class="mt-4 text-sm">Price is per route. Final mileage, availability, and payment will be confirmed before service is booked.</p>`;
  });
}
