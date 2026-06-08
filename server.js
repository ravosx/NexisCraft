import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");
const dataDir = path.join(root, "data");
const ordersFile = path.join(dataDir, "payment-orders.json");

loadEnv(path.join(root, ".env"));

const port = Number(process.env.PORT || 3000);
const currency = process.env.CURRENCY || "EUR";
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function loadEnv(filePath) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] ||= value;
  }
}

async function loadProducts() {
  const raw = await readFile(path.join(dataDir, "products.json"), "utf8");
  return JSON.parse(raw).products;
}

async function findProduct(productId) {
  const products = await loadProducts();
  return products.find((product) => product.id === productId);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress?.replace("::ffff:", "") || "127.0.0.1";
}

function baseUrl(req) {
  return process.env.BASE_URL || `http://${req.headers.host}`;
}

function validateNickname(nickname) {
  return typeof nickname === "string" && /^[A-Za-z0-9_]{3,16}$/.test(nickname);
}

function toMinorUnits(amount) {
  return Math.round(Number(amount) * 100);
}

async function readOrders() {
  try {
    return JSON.parse(await readFile(ordersFile, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { orders: {} };
    throw error;
  }
}

async function writeOrders(value) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(ordersFile, JSON.stringify(value, null, 2), "utf8");
}

async function saveOrder(ref, order) {
  const state = await readOrders();
  state.orders[ref] = order;
  await writeOrders(state);
}

async function paypalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    const error = new Error("PayPal credentials are not configured.");
    error.status = 503;
    throw error;
  }

  const base = process.env.PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error_description || data.message || "PayPal authentication failed.");
    error.status = response.status;
    throw error;
  }

  return data.access_token;
}

async function paypalRequest(pathname, init = {}) {
  const token = await paypalAccessToken();
  const base = process.env.PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const response = await fetch(`${base}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.error_description || "PayPal request failed.");
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

async function createPaypalOrder(body) {
  const product = await findProduct(body.productId);
  if (!product) {
    const error = new Error("Unknown product.");
    error.status = 400;
    throw error;
  }
  if (!validateNickname(body.nickname)) {
    const error = new Error("Minecraft nickname must have 3-16 letters, numbers or underscores.");
    error.status = 400;
    throw error;
  }

  const order = await paypalRequest("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: product.id,
          description: `${product.name} for ${body.nickname} on NexisCraft.cz`,
          custom_id: body.nickname,
          amount: {
            currency_code: currency,
            value: Number(product.price).toFixed(2)
          }
        }
      ]
    })
  });

  return { id: order.id };
}

async function paysafeRequest(pathname, init = {}) {
  const apiKey = process.env.PAYSAFE_API_KEY_BASE64;
  if (!apiKey) {
    const error = new Error("Paysafe credentials are not configured.");
    error.status = 503;
    throw error;
  }

  const base = (process.env.PAYSAFE_API_BASE || "https://api.test.paysafe.com/paymenthub/v1").replace(/\/$/, "");
  const response = await fetch(`${base}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || data.message || "Paysafe request failed.");
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

async function createPaysafecardOrder(req, body) {
  const product = await findProduct(body.productId);
  if (!product) {
    const error = new Error("Unknown product.");
    error.status = 400;
    throw error;
  }
  if (!validateNickname(body.nickname)) {
    const error = new Error("Minecraft nickname must have 3-16 letters, numbers or underscores.");
    error.status = 400;
    throw error;
  }

  const ref = `NX-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const amount = toMinorUnits(product.price);
  const origin = baseUrl(req);
  const payload = {
    merchantRefNum: ref,
    transactionType: "PAYMENT",
    paymentType: "PAYSAFECARD",
    amount,
    currencyCode: currency,
    customerIp: clientIp(req),
    PaysafeCard: {
      consumerId: body.nickname,
      minAgeRestriction: 16
    },
    billingDetails: {
      nickName: body.nickname,
      street: "Digital delivery",
      city: "Bratislava",
      zip: "00000",
      country: process.env.PAYSAFE_COUNTRY || "SK"
    },
    merchantDescriptor: {
      dynamicDescriptor: "NexisCraft",
      phone: process.env.PAYSAFE_MERCHANT_PHONE || "000000000"
    },
    returnLinks: [
      {
        rel: "on_completed",
        href: `${origin}/?payment=paysafecard-success&ref=${encodeURIComponent(ref)}`,
        method: "GET"
      },
      {
        rel: "on_failed",
        href: `${origin}/?payment=paysafecard-failed&ref=${encodeURIComponent(ref)}`,
        method: "GET"
      },
      {
        rel: "default",
        href: `${origin}/?payment=paysafecard-return&ref=${encodeURIComponent(ref)}`,
        method: "GET"
      }
    ]
  };

  if (process.env.PAYSAFE_ACCOUNT_ID) {
    payload.accountId = process.env.PAYSAFE_ACCOUNT_ID;
  }

  const paymentHandle = await paysafeRequest("/paymenthandles", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const redirectUrl = paymentHandle.links?.find((link) =>
    ["redirect_payment", "payment_redirect"].includes(link.rel)
  )?.href;

  if (!redirectUrl) {
    const error = new Error("Paysafe did not return a paysafecard redirect URL.");
    error.status = 502;
    throw error;
  }

  await saveOrder(ref, {
    provider: "paysafecard",
    productId: product.id,
    nickname: body.nickname,
    amount,
    currency,
    paymentHandleToken: paymentHandle.paymentHandleToken,
    paymentHandleId: paymentHandle.id,
    status: paymentHandle.status,
    createdAt: new Date().toISOString()
  });

  return { ref, redirectUrl };
}

async function capturePaysafecard(body, req) {
  const ref = String(body.ref || "");
  const state = await readOrders();
  const order = state.orders[ref];
  if (!order?.paymentHandleToken) {
    const error = new Error("Unknown paysafecard order reference.");
    error.status = 404;
    throw error;
  }

  const capture = await paysafeRequest("/payments", {
    method: "POST",
    body: JSON.stringify({
      merchantRefNum: `${ref}-CAPTURE`,
      amount: order.amount,
      currencyCode: order.currency,
      dupCheck: true,
      settleWithAuth: process.env.PAYSAFE_SETTLE_WITH_AUTH !== "false",
      paymentHandleToken: order.paymentHandleToken,
      customerIp: clientIp(req),
      description: `NexisCraft.cz ${order.productId} for ${order.nickname}`
    })
  });

  order.status = capture.status;
  order.paymentId = capture.id;
  order.capturedAt = new Date().toISOString();
  await writeOrders(state);
  return { status: capture.status, paymentId: capture.id };
}

async function serveStatic(req, res, url) {
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(publicDir, pathname));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    const type = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": type.startsWith("text/html") ? "no-store" : "public, max-age=3600"
    });
    res.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      const index = await readFile(path.join(publicDir, "index.html"));
      res.writeHead(200, { "Content-Type": mimeTypes[".html"], "Cache-Control": "no-store" });
      res.end(index);
      return;
    }
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  try {
    if (req.method === "GET" && url.pathname === "/api/config") {
      sendJson(res, 200, {
        serverIp: process.env.SERVER_IP || "play.nexiscraft.cz",
        serverVersion: process.env.SERVER_VERSION || "Java 1.21+",
        currency,
        paypalClientId: process.env.PAYPAL_CLIENT_ID || "",
        paypalMode: process.env.PAYPAL_MODE || "sandbox",
        paysafecardConfigured: Boolean(process.env.PAYSAFE_API_KEY_BASE64)
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/products") {
      sendJson(res, 200, { products: await loadProducts() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/paypal/orders") {
      sendJson(res, 200, await createPaypalOrder(await readRequestBody(req)));
      return;
    }

    const paypalCapture = url.pathname.match(/^\/api\/paypal\/orders\/([^/]+)\/capture$/);
    if (req.method === "POST" && paypalCapture) {
      const orderId = paypalCapture[1];
      sendJson(res, 200, await paypalRequest(`/v2/checkout/orders/${orderId}/capture`, { method: "POST" }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/paysafecard/orders") {
      sendJson(res, 200, await createPaysafecardOrder(req, await readRequestBody(req)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/paysafecard/capture") {
      sendJson(res, 200, await capturePaysafecard(await readRequestBody(req), req));
      return;
    }

    if (req.method === "GET") {
      await serveStatic(req, res, url);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    console.error(error);
    sendJson(res, error.status || 500, {
      error: error.message || "Unexpected server error.",
      details: error.details
    });
  }
});

server.listen(port, () => {
  console.log(`NexisCraft.cz website running at http://localhost:${port}`);
});
