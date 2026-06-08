# NexisCraft.cz Minecraft Website

Hotovy zaklad webu:

- landing stranka pre NexisCraft.cz,
- survival sekcia,
- custom ranky pripravene na doplnenie vyhod,
- checkout pre PayPal, kartu a paysafecard,
- Node server bez externych balikov,
- platobne kluce ostavaju v `.env`, nie vo frontende.

## Spustenie

1. Nainstaluj Node.js 20 alebo novsi.
2. Skopiruj `.env.example` na `.env`.
3. Spusti:

```bash
npm start
```

4. Otvor `http://localhost:3000`.

## Deploy

Projekt je pripraveny pre Render, Koyeb, Docker alebo VPS:

- `render.yaml` pre Render blueprint,
- `Dockerfile` pre Docker/Koyeb,
- `Procfile` pre hostingy, ktore ho pouzivaju,
- `DEPLOY.md` s kompletnym postupom.

## Uprava rankov

Ranky su v `data/products.json`. Tam vies menit:

- nazov,
- cenu,
- popis,
- vyhody,
- farbu akcentu.

Po ulozeni refreshni web.

## PayPal a karta

PayPal a credit/debit karta su riesene cez PayPal checkout flow:

1. Vytvor PayPal REST app v PayPal Developer Dashboard.
2. Do `.env` vloz:

```env
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
```

3. Otestuj sandbox platbu.
4. Pri produkcii zmen `PAYPAL_MODE=live` a vloz live kluce.

Karta sa nerobi cez vlastne HTML inputy pre cislo karty. Je to bezpecnejsie, pretoze card data spracuje PayPal.

## paysafecard

paysafecard je pripravena cez Paysafe Payments API:

1. Ziskaj Paysafe merchant ucet a API kluce.
2. V `.env` vypln:

```env
PAYSAFE_API_BASE=https://api.test.paysafe.com/paymenthub/v1
PAYSAFE_API_KEY_BASE64=...
PAYSAFE_ACCOUNT_ID=...
PAYSAFE_COUNTRY=SK
PAYSAFE_MERCHANT_PHONE=...
```

3. Checkout vytvori `PAYSAFECARD` payment handle.
4. Hrac je presmerovany na paysafecard stranku.
5. Po navrate server zavola `/payments` capture endpoint.

Pred live spustenim treba nastavit webhooks v Paysafe a napojit vydanie ranku na Minecraft server.

## Vydanie ranku po platbe

Aktualne web platbu dokonci, ale este nevydava rank v Minecrafte. Na produkcii dopln jedno z tychto:

- RCON prikaz na server,
- plugin endpoint,
- Tebex/ vlastny queue system,
- zapis objednavky do databazy, ktoru cita Minecraft plugin.

Odporucany flow: platba uspesna -> zapis objednavku -> Minecraft plugin skontroluje queue -> vykona prikaz -> oznaci ako vydane.

## Dolezite pred produkciou

- Dopln obchodne podmienky, GDPR, kontakt a pravidla refundov.
- Otestuj sandbox platby.
- Zapni HTTPS.
- Neposielaj PayPal/Paysafe secret kluce do frontendu.
- Pridaj webhooky, aby sa ranky nevydavali len podla navratovej URL.
- Skontroluj, ci ponukane vyhody nie su pay-to-win.

## Zdroje k integracii

- PayPal JavaScript SDK: https://developer.paypal.com/sdk/js/
- PayPal Orders API: https://developer.paypal.com/docs/api/orders/v2/
- PayPal advanced card payments: https://developer.paypal.com/docs/multiparty/checkout/advanced/
- Paysafe Checkout setup: https://developer.paysafe.com/en/api-docs/paysafe-checkout/setup-and-callbacks/setup-function/
- Paysafe paysafecard Payments API: https://developer.paysafe.com/en/api-docs/payments-api/add-payment-methods/paysafecard/
