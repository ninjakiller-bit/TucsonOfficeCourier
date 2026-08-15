import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL || "";
const allowedStatuses = new Set(["New", "Accepted", "Picked Up", "Delivered", "Cancelled"]);

function sslConfiguration() {
  if (!databaseUrl || process.env.DATABASE_SSL === "false") return false;
  if (/\b(?:localhost|127\.0\.0\.1)\b/i.test(databaseUrl)) return false;
  return { rejectUnauthorized: false };
}

const pool = databaseUrl
  ? new Pool({
    connectionString: databaseUrl,
    ssl: sslConfiguration(),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000
  })
  : null;

pool?.on("error", (error) => {
  console.error("Unexpected PostgreSQL connection error", error.message);
});

export function databaseConfigured() {
  return Boolean(pool);
}

function requirePool() {
  if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
  return pool;
}

export async function initializeDatabase() {
  if (!pool) return false;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS courier_orders (
      id BIGSERIAL PRIMARY KEY,
      request_id VARCHAR(40) NOT NULL UNIQUE,
      stripe_session_id TEXT NOT NULL UNIQUE,
      stripe_payment_intent_id TEXT,
      stripe_event_id TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'New'
        CHECK (status IN ('New', 'Accepted', 'Picked Up', 'Delivered', 'Cancelled')),
      service_key VARCHAR(30),
      service_name VARCHAR(160) NOT NULL,
      amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
      currency VARCHAR(3) NOT NULL DEFAULT 'usd',
      payment_status VARCHAR(30) NOT NULL,
      customer_name VARCHAR(160),
      customer_email VARCHAR(254),
      customer_phone VARCHAR(80),
      pickup_address TEXT NOT NULL,
      dropoff_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
      pickup_date VARCHAR(40),
      pickup_time VARCHAR(40),
      driving_miles NUMERIC(8, 1),
      item_type VARCHAR(160),
      item_weight NUMERIC(8, 2),
      delivery_timing VARCHAR(120),
      special_instructions TEXT,
      price_description TEXT,
      email_sent_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS courier_orders_status_idx
      ON courier_orders (status, paid_at DESC);
    CREATE INDEX IF NOT EXISTS courier_orders_paid_at_idx
      ON courier_orders (paid_at DESC);

    CREATE TABLE IF NOT EXISTS courier_order_status_history (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES courier_orders(id) ON DELETE CASCADE,
      previous_status VARCHAR(20),
      new_status VARCHAR(20) NOT NULL,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  return true;
}

function optionalNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dropoffList(value) {
  return String(value || "")
    .split("|")
    .map((address) => address.trim())
    .filter(Boolean);
}

export async function storePaidOrder(event, session) {
  const metadata = session.metadata || {};
  const requestId = String(metadata.request_id || session.client_reference_id || "").slice(0, 40);
  if (!requestId || !session.id) throw new Error("ORDER_IDENTIFIERS_MISSING");

  const values = [
    requestId,
    String(session.id),
    String(session.payment_intent || "") || null,
    String(event.id || "") || null,
    String(metadata.service_key || "") || null,
    String(metadata.service || "Delivery request").slice(0, 160),
    Math.max(0, Math.round(Number(session.amount_total || 0))),
    String(session.currency || "usd").slice(0, 3).toLowerCase(),
    String(session.payment_status || "paid").slice(0, 30),
    String(metadata.contact_name || session.customer_details?.name || "").slice(0, 160) || null,
    String(session.customer_details?.email || session.customer_email || "").slice(0, 254) || null,
    String(metadata.contact_phone || session.customer_details?.phone || "").slice(0, 80) || null,
    String(metadata.pickup || "").slice(0, 1000),
    JSON.stringify(dropoffList(metadata.dropoff)),
    String(metadata.pickup_date || "").slice(0, 40) || null,
    String(metadata.pickup_time || "").slice(0, 40) || null,
    optionalNumber(metadata.driving_miles),
    String(metadata.item_type || "").slice(0, 160) || null,
    optionalNumber(metadata.item_weight),
    String(metadata.delivery_timing || "").slice(0, 120) || null,
    String(metadata.notes || "").slice(0, 2000) || null,
    String(metadata.price_description || "").slice(0, 2000) || null,
    new Date(Number(event.created || Math.floor(Date.now() / 1000)) * 1000)
  ];

  const result = await requirePool().query(`
    INSERT INTO courier_orders (
      request_id, stripe_session_id, stripe_payment_intent_id, stripe_event_id,
      service_key, service_name, amount_cents, currency, payment_status,
      customer_name, customer_email, customer_phone, pickup_address,
      dropoff_addresses, pickup_date, pickup_time, driving_miles, item_type,
      item_weight, delivery_timing, special_instructions, price_description, paid_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
      $14::jsonb, $15, $16, $17, $18, $19, $20, $21, $22, $23
    )
    ON CONFLICT (stripe_session_id) DO UPDATE SET
      stripe_payment_intent_id = EXCLUDED.stripe_payment_intent_id,
      stripe_event_id = EXCLUDED.stripe_event_id,
      payment_status = EXCLUDED.payment_status,
      customer_email = COALESCE(EXCLUDED.customer_email, courier_orders.customer_email),
      customer_phone = COALESCE(EXCLUDED.customer_phone, courier_orders.customer_phone),
      updated_at = NOW()
    RETURNING id, request_id, email_sent_at
  `, values);

  return result.rows[0];
}

export async function markOrderEmailSent(orderId) {
  await requirePool().query(
    "UPDATE courier_orders SET email_sent_at = NOW(), updated_at = NOW() WHERE id = $1",
    [orderId]
  );
}

export async function listOrders({ status = "", search = "" } = {}) {
  const values = [];
  const conditions = [];
  if (status && allowedStatuses.has(status)) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }
  if (search) {
    values.push(`%${search.slice(0, 120)}%`);
    const index = values.length;
    conditions.push(`(
      request_id ILIKE $${index}
      OR customer_name ILIKE $${index}
      OR customer_email ILIKE $${index}
      OR customer_phone ILIKE $${index}
      OR pickup_address ILIKE $${index}
      OR dropoff_addresses::text ILIKE $${index}
    )`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const ordersResult = await requirePool().query(`
    SELECT
      id, request_id, status, service_key, service_name, amount_cents, currency,
      payment_status, customer_name, customer_email, customer_phone,
      pickup_address, dropoff_addresses, pickup_date, pickup_time, driving_miles,
      item_type, item_weight, delivery_timing, special_instructions,
      price_description, paid_at, created_at, updated_at
    FROM courier_orders
    ${where}
    ORDER BY paid_at DESC
    LIMIT 250
  `, values);
  const summaryResult = await requirePool().query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'New')::int AS new_count,
      COUNT(*) FILTER (WHERE status IN ('Accepted', 'Picked Up'))::int AS active_count,
      COUNT(*) FILTER (WHERE status = 'Delivered')::int AS delivered_count,
      COALESCE(SUM(amount_cents) FILTER (WHERE status <> 'Cancelled'), 0)::bigint AS paid_cents
    FROM courier_orders
  `);
  return {
    orders: ordersResult.rows,
    summary: {
      ...summaryResult.rows[0],
      paid_cents: Number(summaryResult.rows[0].paid_cents || 0)
    }
  };
}

export async function updateOrderStatus(requestId, newStatus) {
  if (!allowedStatuses.has(newStatus)) throw new Error("INVALID_ORDER_STATUS");
  const client = await requirePool().connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      "SELECT id, status FROM courier_orders WHERE request_id = $1 FOR UPDATE",
      [requestId]
    );
    if (!current.rows[0]) throw new Error("ORDER_NOT_FOUND");
    const order = current.rows[0];
    if (order.status !== newStatus) {
      await client.query(
        "UPDATE courier_orders SET status = $1, updated_at = NOW() WHERE id = $2",
        [newStatus, order.id]
      );
      await client.query(
        "INSERT INTO courier_order_status_history (order_id, previous_status, new_status) VALUES ($1, $2, $3)",
        [order.id, order.status, newStatus]
      );
    }
    await client.query("COMMIT");
    return { requestId, status: newStatus };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  await pool?.end();
}
