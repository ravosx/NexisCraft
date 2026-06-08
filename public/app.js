const state = {
  products: [],
  config: {},
  selectedPayment: "paypal",
  paypalLoadedFor: null
};

const fallbackConfig = {
  serverIp: "play.nexiscraft.cz",
  serverVersion: "Java 1.21+",
  currency: "EUR",
  paypalClientId: "",
  paypalMode: "sandbox",
  paysafecardConfigured: false
};

const fallbackProducts = [
  {
    id: "starter-pack",
    name: "Survival Starter Pack",
    type: "bundle",
    price: 4.99,
    accent: "ember",
    description: "Balicek na pohodlny start pre novych hracov.",
    benefits: ["startovacie kluce a bonusove mince", "kozmeticky tag v chate", "vyhody sa daju upravit podla servera"]
  },
  {
    id: "rank-sentinel",
    name: "Rank Sentinel",
    type: "rank",
    price: 9.99,
    accent: "moss",
    description: "Prvy custom rank pre aktivnych survival hracov.",
    benefits: ["custom prefix", "pripravene miesto na /home, /kit alebo kozmetiku", "bez tvrdeho pay-to-win nastavenia"]
  },
  {
    id: "rank-mystic",
    name: "Rank Mystic",
    type: "rank",
    price: 19.99,
    accent: "amethyst",
    description: "Vyssi custom rank s fantasy stylom NexisCraftu.",
    benefits: ["vlastna farba mena", "extra kozmeticke odmeny", "vyhody doplnime podla tvojho zoznamu"]
  },
  {
    id: "rank-dragon",
    name: "Rank Dragon",
    type: "rank",
    price: 34.99,
    accent: "dragon",
    description: "Najvyssi survival rank s dragon temou.",
    benefits: ["premium prefix", "specialne efekty alebo crate kluce", "finalne vyhody sa daju dopisat neskor"]
  }
];

const money = (value) =>
  new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: state.config.currency || "EUR"
  }).format(value);

const qs = (selector) => document.querySelector(selector);

async function api(path, options = {}) {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const response = await fetch(normalizedPath, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function selectedProduct() {
  return state.products.find((product) => product.id === qs("#product-select").value) || state.products[0];
}

function renderProducts() {
  const grid = qs("#product-grid");
  const select = qs("#product-select");

  grid.innerHTML = state.products
    .map(
      (product) => `
        <article class="product-card" data-accent="${product.accent}">
          <h3>${product.name}</h3>
          <p>${product.description}</p>
          <strong class="price">${money(product.price)}</strong>
          <ul class="benefits">
            ${product.benefits.map((benefit) => `<li>${benefit}</li>`).join("")}
          </ul>
          <button class="select-product" type="button" data-product="${product.id}">Vybrat</button>
        </article>
      `
    )
    .join("");

  select.innerHTML = state.products
    .map((product) => `<option value="${product.id}">${product.name} - ${money(product.price)}</option>`)
    .join("");

  grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-product]");
    if (!button) return;
    select.value = button.dataset.product;
    updateTotal();
    qs("#checkout").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  select.addEventListener("change", updateTotal);
  updateTotal();
}

function updateTotal() {
  const product = selectedProduct();
  qs("#checkout-total").textContent = product ? money(product.price) : money(0);
  renderPaymentArea();
}

function setStatus(message, tone = "neutral") {
  const target = qs("#checkout-status");
  target.textContent = message || "";
  target.dataset.tone = tone;
}

function formPayload() {
  const nickname = qs("#nickname").value.trim();
  const product = selectedProduct();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(nickname)) {
    throw new Error("Zadaj platny Minecraft nick: 3-16 znakov, pismena, cisla alebo podtrznik.");
  }
  if (!product) throw new Error("Vyber produkt.");
  return { nickname, productId: product.id };
}

function loadPaypalSdk() {
  if (!state.config.paypalClientId) return Promise.reject(new Error("PayPal Client ID nie je nastavene."));
  const key = `${state.config.paypalClientId}:${state.config.currency}`;
  if (window.paypal && state.paypalLoadedFor === key) return Promise.resolve();

  document.querySelectorAll("script[data-paypal-sdk]").forEach((script) => script.remove());
  state.paypalLoadedFor = key;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.dataset.paypalSdk = "true";
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      state.config.paypalClientId
    )}&currency=${encodeURIComponent(state.config.currency)}&components=buttons&enable-funding=card`;
    script.onload = resolve;
    script.onerror = () => reject(new Error("PayPal SDK sa nepodarilo nacitat."));
    document.head.appendChild(script);
  });
}

async function renderPaypalButtons() {
  const container = qs("#paypal-buttons");
  container.innerHTML = "";

  if (!["paypal", "card"].includes(state.selectedPayment)) return;
  if (!state.config.paypalClientId) {
    container.innerHTML = '<p class="status-line">Dopln PAYPAL_CLIENT_ID a PAYPAL_CLIENT_SECRET v .env.</p>';
    return;
  }

  try {
    await loadPaypalSdk();
    const fundingSource = state.selectedPayment === "card" ? paypal.FUNDING.CARD : paypal.FUNDING.PAYPAL;
    const buttons = paypal.Buttons({
      fundingSource,
      style: {
        layout: "vertical",
        shape: "rect",
        label: state.selectedPayment === "card" ? "pay" : "paypal"
      },
      createOrder: async () => {
        const payload = formPayload();
        const order = await api("/api/paypal/orders", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        return order.id;
      },
      onApprove: async (data) => {
        setStatus("Platba sa dokoncuje...", "neutral");
        await api(`/api/paypal/orders/${data.orderID}/capture`, { method: "POST" });
        setStatus("Platba presla. Teraz treba napojit vydanie ranku na server.", "success");
      },
      onError: (error) => {
        setStatus(error.message || "Platba zlyhala.", "error");
      }
    });

    if (buttons.isEligible()) {
      buttons.render(container);
    } else {
      container.innerHTML = '<p class="status-line">Tato PayPal metoda nie je pre aktualny ucet dostupna.</p>';
    }
  } catch (error) {
    container.innerHTML = `<p class="status-line">${error.message}</p>`;
  }
}

function renderPaymentArea() {
  const manualButton = qs("#manual-pay-button");
  const paypalContainer = qs("#paypal-buttons");
  const isPaysafe = state.selectedPayment === "paysafecard";

  manualButton.hidden = !isPaysafe;
  paypalContainer.hidden = isPaysafe;
  if (isPaysafe) {
    paypalContainer.innerHTML = "";
  } else {
    renderPaypalButtons();
  }
}

async function handleCheckout(event) {
  event.preventDefault();
  if (state.selectedPayment !== "paysafecard") return;

  try {
    setStatus("Vytvaram paysafecard platbu...", "neutral");
    const result = await api("/api/paysafecard/orders", {
      method: "POST",
      body: JSON.stringify(formPayload())
    });
    window.location.href = result.redirectUrl;
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");
  const ref = params.get("ref");
  const box = qs("#return-status");
  if (!payment) return;

  box.hidden = false;
  if (payment === "paysafecard-success" && ref) {
    box.textContent = "paysafecard autorizacia sa vratila ako uspesna. Server sa pokusi dokoncit platbu.";
    api("/api/paysafecard/capture", {
      method: "POST",
      body: JSON.stringify({ ref })
    })
      .then(() => {
        box.textContent = "paysafecard platba bola dokoncena. Rank vydaj cez napojenie na Minecraft server.";
      })
      .catch((error) => {
        box.textContent = `Platba je vratena, ale capture este nepresiel: ${error.message}`;
      });
  } else if (payment?.includes("failed")) {
    box.textContent = "Platba bola zrusena alebo zlyhala.";
  } else {
    box.textContent = "Vratil si sa z platobnej brany.";
  }
}

async function copyServerIp() {
  const ip = state.config.serverIp || "play.nexiscraft.cz";
  await navigator.clipboard?.writeText(ip).catch(() => null);
  qs("#server-ip-label").textContent = "IP skopirovana";
  setTimeout(() => {
    qs("#server-ip-label").textContent = ip;
  }, 1600);
}

function bindUi() {
  qs("#copy-ip").addEventListener("click", copyServerIp);
  qs("#copy-ip-inline").addEventListener("click", copyServerIp);
  qs("#checkout-form").addEventListener("submit", handleCheckout);
  qs("#nickname").addEventListener("input", () => setStatus(""));

  document.querySelectorAll("[data-payment]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPayment = button.dataset.payment;
      document.querySelectorAll("[data-payment]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      setStatus("");
      renderPaymentArea();
    });
  });
}

async function init() {
  const [config, products] = await Promise.all([
    api("/api/config").catch(() => fallbackConfig),
    api("/api/products").catch(() => ({ products: fallbackProducts }))
  ]);
  state.config = config;
  state.products = products.products;
  qs("#server-ip-label").textContent = config.serverIp;
  qs("#copy-ip-inline").textContent = config.serverIp;
  qs("#server-version").textContent = config.serverVersion;
  bindUi();
  renderProducts();
  handlePaymentReturn();
  window.lucide?.createIcons();
}

init().catch((error) => {
  document.body.innerHTML = `<main class="section-inner"><h1>NexisCraft.cz</h1><p>${error.message}</p></main>`;
});
