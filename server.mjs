import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 10000);
const recipient = process.env.CONTACT_TO_EMAIL || "";
const sender = process.env.CONTACT_FROM_EMAIL || "";
const resendKey = process.env.RESEND_API_KEY || "";
const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const orsKey = process.env.OPENROUTESERVICE_API_KEY || "";
const configuredBaseUrl = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
const rateLimit = new Map();
const geocodeCache = new Map();
const processedStripeEvents = new Set();
const maxBodySize = 30_000;

const serviceNames = {
  rush: "Rush and On Demand Delivery",
  documents: "Documents & Office Packages",
  mail: "Inter Office Mail Runs",
  routes: "Scheduled Business Routes",
  multi: "Multi Stop Deliveries",
  custom: "Custom Delivery Request"
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function securityHeaders(contentType = "text/plain; charset=utf-8") {
  return {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self'; form-action 'self'; frame-ancestors 'self'; base-uri 'self'"
  };
}

function sendJson(response, status, payload) {
  response.writeHead(status, securityHeaders("application/json; charset=utf-8"));
  response.end(JSON.stringify(payload));
}

function cleanText(value, maximum) {
  return typeof value === "string"
    ? value.replace(/\0/g, "").trim().slice(0, maximum)
    : "";
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
}

function clientAddress(request) {
  const forwarded = request.headers["x-forwarded-for"];
  return String(forwarded || request.socket.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function allowedByRateLimit(address, maximum = 12) {
  const now = Date.now();
  const period = 15 * 60 * 1000;
  const existing = rateLimit.get(address);

  if (!existing || now - existing.startedAt >= period) {
    rateLimit.set(address, { startedAt: now, attempts: 1 });
    return true;
  }

  existing.attempts += 1;
  return existing.attempts <= maximum;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function readBodyBuffer(request) {
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBodySize) {
      throw new Error("REQUEST_TOO_LARGE");
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function readJsonBody(request) {
  return JSON.parse((await readBodyBuffer(request)).toString("utf8"));
}

function requestBaseUrl(request) {
  if (configuredBaseUrl) return configuredBaseUrl;
  const protocol = cleanText(request.headers["x-forwarded-proto"], 20) || "http";
  const host = cleanText(request.headers.host, 255) || `localhost:${port}`;
  return `${protocol}://${host}`;
}

async function sendEmail({ to, replyTo, subject, html }) {
  if (!resendKey || !sender || !to) return false;

  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: sender,
      to: [to],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      html
    })
  });

  if (!result.ok) throw new Error(`EMAIL_PROVIDER_${result.status}`);
  return true;
}

async function sendContactEmail(contact) {
  const requestId = randomUUID();
  await sendEmail({
    to: recipient,
    replyTo: contact.email,
    subject: `Tucson Office Courier contact request ${requestId.slice(0, 8).toUpperCase()}`,
    html: `
      <h2>New Tucson Office Courier contact request</h2>
      <p><strong>Request ID:</strong> ${escapeHtml(requestId)}</p>
      <p><strong>Name or company:</strong> ${escapeHtml(contact.name)}</p>
      <p><strong>Reply email:</strong> ${escapeHtml(contact.email)}</p>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(contact.message).replaceAll("\n", "<br>")}</p>
    `
  });
  return requestId;
}

async function handleContact(request, response) {
  if (!allowedByRateLimit(clientAddress(request), 5)) {
    sendJson(response, 429, {
      ok: false,
      message: "Too many messages were submitted. Please wait 15 minutes and try again."
    });
    return;
  }

  if (!recipient || !sender || !resendKey) {
    sendJson(response, 503, {
      ok: false,
      message: "The contact service is temporarily unavailable."
    });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const honeypot = cleanText(body.website, 200);
    const name = cleanText(body.name, 120);
    const email = cleanText(body.email, 254).toLowerCase();
    const message = cleanText(body.message, 5000);

    if (honeypot) {
      sendJson(response, 200, { ok: true, requestId: randomUUID() });
      return;
    }

    if (name.length < 2 || !validEmail(email) || message.length < 10) {
      sendJson(response, 400, {
        ok: false,
        message: "Please enter your name, a valid email address, and a message of at least 10 characters."
      });
      return;
    }

    const requestId = await sendContactEmail({ name, email, message });
    sendJson(response, 200, { ok: true, requestId });
  } catch (error) {
    const status = error.message === "REQUEST_TOO_LARGE" ? 413 : 500;
    sendJson(response, status, {
      ok: false,
      message: status === 413 ? "The message is too large." : "Your message could not be sent. Please try again shortly."
    });
  }
}

async function orsRequest(url, options = {}) {
  if (!orsKey) throw new Error("ORS_NOT_CONFIGURED");
  const result = await fetch(url, {
    ...options,
    headers: {
      Authorization: orsKey,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  if (!result.ok) throw new Error(`ORS_${result.status}`);
  return result.json();
}

async function geocodeAddress(address) {
  const normalized = cleanText(address, 300);
  if (normalized.length < 5) throw new Error("ADDRESS_INVALID");

  const cacheKey = normalized.toLowerCase();
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < 15 * 60 * 1000) return cached.result;

  const url = new URL("https://api.openrouteservice.org/geocode/search");
  url.searchParams.set("text", normalized);
  url.searchParams.set("size", "1");
  url.searchParams.set("boundary.country", "US");
  url.searchParams.set("focus.point.lon", "-110.9747");
  url.searchParams.set("focus.point.lat", "32.2226");
  const data = await orsRequest(url);
  const feature = data.features?.[0];
  const coordinates = feature?.geometry?.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    throw new Error("ADDRESS_NOT_FOUND");
  }

  const result = {
    label: cleanText(feature.properties?.label || normalized, 300),
    coordinates: coordinates.map(Number)
  };
  geocodeCache.set(cacheKey, { savedAt: Date.now(), result });
  return result;
}

async function routeAddresses(addresses) {
  const geocoded = await Promise.all(addresses.map(geocodeAddress));
  const data = await orsRequest(
    "https://api.openrouteservice.org/v2/directions/driving-car",
    {
      method: "POST",
      body: JSON.stringify({ coordinates: geocoded.map((entry) => entry.coordinates) })
    }
  );
  const meters = Number(data.routes?.[0]?.summary?.distance);
  if (!Number.isFinite(meters) || meters <= 0) throw new Error("ROUTE_NOT_FOUND");
  const miles = meters / 1609.344;
  const zoneIndex = miles <= 5 ? 0 : miles <= 10 ? 1 : miles <= 15 ? 2 : miles <= 20 ? 3 : miles <= 30 ? 4 : 5;
  return {
    miles: Number(miles.toFixed(1)),
    zoneIndex,
    labels: geocoded.map((entry) => entry.label)
  };
}

function deliveryAddresses(body) {
  const fields = body?.fields || {};
  const serviceKey = cleanText(body?.serviceKey, 30);
  const pickup = cleanText(fields.pickup, 300);
  if (serviceKey === "multi") {
    const stops = Array.isArray(body.stops) ? body.stops.map((value) => cleanText(value, 300)).filter(Boolean) : [];
    return [pickup, ...stops];
  }
  return [pickup, cleanText(fields.dropoff, 300)];
}

async function handleAutocomplete(request, response) {
  if (!allowedByRateLimit(clientAddress(request), 80)) {
    sendJson(response, 429, { ok: false, message: "Please wait a moment before searching again." });
    return;
  }
  if (!orsKey) {
    sendJson(response, 503, { ok: false, message: "Address search is not configured yet." });
    return;
  }

  const query = cleanText(new URL(request.url, "http://localhost").searchParams.get("q"), 160);
  if (query.length < 3) {
    sendJson(response, 200, { ok: true, suggestions: [] });
    return;
  }

  try {
    const url = new URL("https://api.openrouteservice.org/geocode/autocomplete");
    url.searchParams.set("text", query);
    url.searchParams.set("size", "6");
    url.searchParams.set("boundary.country", "US");
    url.searchParams.set("focus.point.lon", "-110.9747");
    url.searchParams.set("focus.point.lat", "32.2226");
    const data = await orsRequest(url);
    const suggestions = (data.features || []).map((feature) => ({
      label: cleanText(feature.properties?.label, 300),
      coordinates: feature.geometry?.coordinates
    })).filter((entry) => entry.label && Array.isArray(entry.coordinates));
    sendJson(response, 200, { ok: true, suggestions });
  } catch {
    sendJson(response, 502, { ok: false, message: "Address suggestions are temporarily unavailable." });
  }
}

async function handleDistance(request, response) {
  if (!allowedByRateLimit(clientAddress(request), 30)) {
    sendJson(response, 429, { ok: false, message: "Please wait before calculating another route." });
    return;
  }
  if (!orsKey) {
    sendJson(response, 503, { ok: false, message: "Mileage calculation is not configured yet." });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const addresses = deliveryAddresses(body);
    if (addresses.length < 2 || addresses.some((value) => value.length < 5)) {
      sendJson(response, 400, { ok: false, message: "Enter a complete pickup and drop-off address." });
      return;
    }
    const route = await routeAddresses(addresses);
    sendJson(response, 200, {
      ok: true,
      miles: route.miles,
      zoneIndex: route.zoneIndex,
      customQuote: route.zoneIndex === 5,
      verifiedAddresses: route.labels
    });
  } catch (error) {
    const status = error.message === "REQUEST_TOO_LARGE" ? 413 : 422;
    sendJson(response, status, {
      ok: false,
      message: "We could not verify that route. Choose an address suggestion or check the street addresses."
    });
  }
}

function itemFee(item) {
  if (item === "Documents with signature") return 7;
  if (item === "Package") return 10;
  if (item === "Office supplies") return 5;
  return 0;
}

function integerIndex(value, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : 0;
}

function validateCheckoutFields(body) {
  const fields = body?.fields || {};
  const serviceKey = cleanText(body?.serviceKey, 30);
  if (!serviceNames[serviceKey] || serviceKey === "custom") throw new Error("CUSTOM_QUOTE");

  const required = ["pickup", "date", "time", "name", "phone", "email"];
  if (serviceKey !== "multi") required.push("dropoff");
  if (required.some((key) => cleanText(fields[key], 300).length < 2)) throw new Error("MISSING_FIELDS");
  if (!validEmail(cleanText(fields.email, 254))) throw new Error("INVALID_EMAIL");

  const weight = Number(fields.weight);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 10) throw new Error("INVALID_WEIGHT");

  if (serviceKey === "multi") {
    const stops = Array.isArray(body.stops) ? body.stops.map((value) => cleanText(value, 300)) : [];
    if (stops.length < 2 || stops.some((value) => value.length < 5)) throw new Error("MISSING_STOPS");
  }
  return { fields, serviceKey };
}

function checkoutAmount(body, route) {
  const { fields, serviceKey } = validateCheckoutFields(body);
  const pricing = body.pricing || {};
  const zone = route.zoneIndex;
  if (zone > 4) throw new Error("CUSTOM_DISTANCE");
  const handling = itemFee(cleanText(fields.type, 80));
  let total = 0;
  const parts = [];

  if (serviceKey === "rush") {
    const base = [35, 50, 65, 80, 105][zone];
    const rushFee = integerIndex(pricing.timingIndex, 1) === 0 ? 20 : 0;
    total = base + rushFee + handling;
    parts.push(`${route.miles} driving miles`, `distance $${base}`, rushFee ? "rush $20" : "same day included");
  } else if (serviceKey === "routes") {
    if (zone > 2) throw new Error("CUSTOM_DISTANCE");
    const frequency = integerIndex(pricing.frequencyIndex, 2);
    const base = [45, 55, 60][frequency];
    const distance = [0, 15, 30][zone];
    const stops = [0, 10, 20, 30][integerIndex(pricing.routeStopsIndex, 3)];
    const proof = integerIndex(pricing.proofIndex, 1) ? 7 : 0;
    const after = integerIndex(pricing.hoursIndex, 1) ? 75 : 0;
    total = base + distance + stops + handling + proof + after;
    if (after) total = Math.max(125, total);
    parts.push(`${route.miles} route miles`, `base route $${base}`, `route additions $${distance + stops + proof + after}`);
  } else {
    const timing = integerIndex(pricing.timingIndex, 2);
    const planned = [25, 35, 45, 55, 70];
    const sameDay = [30, 45, 60, 75, 95];
    const afterHours = timing === 2;
    const base = timing === 1 ? planned[zone] : sameDay[zone];
    total = base + handling + (afterHours ? 75 : 0);
    if (afterHours) total = Math.max(125, total);
    if (serviceKey === "multi") total += Math.max(0, body.stops.length - 2) * 10;
    parts.push(`${route.miles} driving miles`, `route $${base}`, afterHours ? "after hours" : timing === 1 ? "planned delivery" : "same day");
  }

  if (handling) parts.push(`item handling $${handling}`);
  return { amountCents: Math.round(total * 100), description: parts.join(" · ") };
}

async function createStripeCheckout(request, response) {
  if (!stripeKey) {
    sendJson(response, 503, {
      ok: false,
      message: "Secure checkout is prepared but the new Stripe account has not been connected yet."
    });
    return;
  }
  if (!orsKey) {
    sendJson(response, 503, {
      ok: false,
      message: "Secure checkout is prepared but mileage verification has not been connected yet."
    });
    return;
  }
  if (!allowedByRateLimit(clientAddress(request), 20)) {
    sendJson(response, 429, { ok: false, message: "Please wait before starting another checkout." });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const { fields, serviceKey } = validateCheckoutFields(body);
    const route = await routeAddresses(deliveryAddresses(body));
    const price = checkoutAmount(body, route);
    const requestId = `TOC-${randomUUID().slice(0, 8).toUpperCase()}`;
    const baseUrl = requestBaseUrl(request);
    const parameters = new URLSearchParams();

    parameters.set("mode", "payment");
    parameters.set("success_url", `${baseUrl}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`);
    parameters.set("cancel_url", `${baseUrl}/services.html?checkout=cancelled`);
    parameters.set("customer_email", cleanText(fields.email, 254));
    parameters.set("billing_address_collection", "required");
    parameters.set("phone_number_collection[enabled]", "true");
    parameters.set("client_reference_id", requestId);
    parameters.set("line_items[0][price_data][currency]", "usd");
    parameters.set("line_items[0][price_data][product_data][name]", serviceNames[serviceKey]);
    parameters.set("line_items[0][price_data][product_data][description]", price.description);
    parameters.set("line_items[0][price_data][unit_amount]", String(price.amountCents));
    parameters.set("line_items[0][quantity]", "1");
    parameters.set("metadata[request_id]", requestId);
    parameters.set("metadata[service]", serviceNames[serviceKey]);
    parameters.set("metadata[pickup]", cleanText(fields.pickup, 450));
    parameters.set("metadata[dropoff]", cleanText(serviceKey === "multi" ? body.stops.join(" | ") : fields.dropoff, 450));
    parameters.set("metadata[pickup_date]", cleanText(fields.date, 40));
    parameters.set("metadata[pickup_time]", cleanText(fields.time, 40));
    parameters.set("metadata[contact_name]", cleanText(fields.name, 120));
    parameters.set("metadata[contact_phone]", cleanText(fields.phone, 80));
    parameters.set("metadata[notes]", cleanText(fields.notes, 450));
    parameters.set("metadata[driving_miles]", String(route.miles));

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: parameters
    });
    const session = await stripeResponse.json();
    if (!stripeResponse.ok || !session.url) throw new Error(`STRIPE_${stripeResponse.status}`);
    sendJson(response, 200, { ok: true, checkoutUrl: session.url, requestId });
  } catch (error) {
    const customQuote = error.message === "CUSTOM_DISTANCE" || error.message === "CUSTOM_QUOTE";
    const validation = ["MISSING_FIELDS", "INVALID_EMAIL", "INVALID_WEIGHT", "MISSING_STOPS"].includes(error.message);
    sendJson(response, customQuote ? 422 : validation ? 400 : 500, {
      ok: false,
      message: customQuote
        ? "This route needs a custom quote before payment."
        : validation
          ? "Please review the required delivery and contact details."
          : "Secure checkout could not be started. Please try again shortly."
    });
  }
}

function validStripeSignature(rawBody, signatureHeader) {
  if (!stripeWebhookSecret || !signatureHeader) return false;
  const pieces = String(signatureHeader).split(",");
  const timestamp = pieces.find((piece) => piece.startsWith("t="))?.slice(2);
  const signatures = pieces.filter((piece) => piece.startsWith("v1=")).map((piece) => piece.slice(3));
  if (!timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", stripeWebhookSecret)
    .update(`${timestamp}.${rawBody.toString("utf8")}`)
    .digest("hex");
  return signatures.some((signature) => {
    const actualBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  });
}

async function handleStripeWebhook(request, response) {
  try {
    const rawBody = await readBodyBuffer(request);
    if (!validStripeSignature(rawBody, request.headers["stripe-signature"])) {
      sendJson(response, 400, { ok: false, message: "Invalid webhook signature." });
      return;
    }
    const event = JSON.parse(rawBody.toString("utf8"));
    if (processedStripeEvents.has(event.id)) {
      sendJson(response, 200, { received: true });
      return;
    }
    processedStripeEvents.add(event.id);

    if (event.type === "checkout.session.completed" && event.data?.object?.payment_status === "paid") {
      const session = event.data.object;
      const metadata = session.metadata || {};
      await sendEmail({
        to: recipient,
        replyTo: session.customer_details?.email || "",
        subject: `Paid Tucson Office Courier request ${metadata.request_id || session.client_reference_id}`,
        html: `
          <h2>Paid delivery request</h2>
          <p><strong>Request ID:</strong> ${escapeHtml(metadata.request_id || session.client_reference_id || "")}</p>
          <p><strong>Service:</strong> ${escapeHtml(metadata.service || "")}</p>
          <p><strong>Amount paid:</strong> $${(Number(session.amount_total || 0) / 100).toFixed(2)}</p>
          <p><strong>Pickup:</strong> ${escapeHtml(metadata.pickup || "")}</p>
          <p><strong>Drop-off:</strong> ${escapeHtml(metadata.dropoff || "")}</p>
          <p><strong>Pickup date and time:</strong> ${escapeHtml(metadata.pickup_date || "")} ${escapeHtml(metadata.pickup_time || "")}</p>
          <p><strong>Driving distance:</strong> ${escapeHtml(metadata.driving_miles || "")} miles</p>
          <p><strong>Customer:</strong> ${escapeHtml(metadata.contact_name || "")}</p>
          <p><strong>Phone:</strong> ${escapeHtml(metadata.contact_phone || "")}</p>
          <p><strong>Email:</strong> ${escapeHtml(session.customer_details?.email || "")}</p>
          <p><strong>Special instructions:</strong> ${escapeHtml(metadata.notes || "None")}</p>
        `
      });
    }
    sendJson(response, 200, { received: true });
  } catch {
    sendJson(response, 500, { ok: false, message: "Webhook processing failed." });
  }
}

async function handleCheckoutStatus(request, response) {
  if (!stripeKey) {
    sendJson(response, 503, { ok: false, message: "Stripe is not configured." });
    return;
  }
  const sessionId = cleanText(new URL(request.url, "http://localhost").searchParams.get("session_id"), 255);
  if (!sessionId.startsWith("cs_")) {
    sendJson(response, 400, { ok: false, message: "Invalid checkout session." });
    return;
  }
  try {
    const result = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${stripeKey}` }
    });
    const session = await result.json();
    if (!result.ok) throw new Error("SESSION_LOOKUP_FAILED");
    sendJson(response, 200, {
      ok: true,
      paid: session.payment_status === "paid",
      requestId: session.metadata?.request_id || session.client_reference_id || "",
      service: session.metadata?.service || "",
      amount: Number(session.amount_total || 0) / 100
    });
  } catch {
    sendJson(response, 502, { ok: false, message: "Payment confirmation is temporarily unavailable." });
  }
}

async function serveStatic(request, response) {
  const requestedPath = new URL(request.url, "http://localhost").pathname;
  const pathname = requestedPath === "/" ? "/index.html" : requestedPath;
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403, securityHeaders());
    response.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("NOT_FILE");
    const contentType = mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
    const file = await readFile(filePath);
    response.writeHead(200, {
      ...securityHeaders(contentType),
      "Cache-Control": contentType.startsWith("text/html") ? "no-cache" : "public, max-age=86400"
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    response.end(file);
  } catch {
    response.writeHead(404, securityHeaders());
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;

  if (request.method === "POST" && pathname === "/api/contact") {
    await handleContact(request, response);
    return;
  }
  if (request.method === "GET" && pathname === "/api/address-autocomplete") {
    await handleAutocomplete(request, response);
    return;
  }
  if (request.method === "POST" && pathname === "/api/delivery-distance") {
    await handleDistance(request, response);
    return;
  }
  if (request.method === "POST" && pathname === "/api/create-checkout-session") {
    await createStripeCheckout(request, response);
    return;
  }
  if (request.method === "POST" && pathname === "/api/stripe-webhook") {
    await handleStripeWebhook(request, response);
    return;
  }
  if (request.method === "GET" && pathname === "/api/checkout-session") {
    await handleCheckoutStatus(request, response);
    return;
  }
  if (request.method === "GET" || request.method === "HEAD") {
    await serveStatic(request, response);
    return;
  }

  response.writeHead(405, { ...securityHeaders(), Allow: "GET, HEAD, POST" });
  response.end("Method not allowed");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Tucson Office Courier server listening on port ${port}`);
});
