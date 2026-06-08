# Deploy NexisCraft.cz website

## Najlepsie jednoduche moznosti

### Render

1. Prihlas sa na https://dashboard.render.com/.
2. Vytvor novy Web Service.
3. Nahraj tento projekt do GitHub repo alebo pouzi Render blueprint `render.yaml`.
4. Build command: `npm install`
5. Start command: `npm start`
6. Health check path: `/api/config`
7. Dopln environment variables:

```env
SERVER_IP=play.nexiscraft.cz
SERVER_VERSION=Java 1.21+
CURRENCY=EUR
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYSAFE_API_BASE=https://api.test.paysafe.com/paymenthub/v1
PAYSAFE_API_KEY_BASE64=...
PAYSAFE_ACCOUNT_ID=...
PAYSAFE_COUNTRY=SK
PAYSAFE_MERCHANT_PHONE=...
```

Render free web services mozu spat po neaktivite. Web sa potom pri prvej navsteve zobudi pomalsie.

### Koyeb

1. Prihlas sa na https://app.koyeb.com/.
2. Create App -> GitHub alebo Docker.
3. Ak pouzijes Docker, projekt uz ma `Dockerfile`.
4. Port nech hosting berie z env premennej `PORT`.
5. Dopln rovnake environment variables ako vyssie.

### VPS alebo Oracle Cloud Always Free

Toto je najlepsie pre nonstop backend:

```bash
sudo apt update
sudo apt install -y nodejs npm git
git clone <repo-url> nexiscraft-website
cd nexiscraft-website
npm install
cp .env.example .env
nano .env
npm start
```

Pre nonstop beh:

```bash
sudo npm install -g pm2
pm2 start server.js --name nexiscraft-website
pm2 save
pm2 startup
```

## Dolezite

- Netlify/GitHub Pages su dobre na staticky frontend, ale tento web ma Node backend pre platby.
- PayPal/Paysafe secret kluce patria iba do hostingu ako environment variables.
- Pred live platbami otestuj sandbox a dopln webhooks.
- Po uspesnej platbe treba doplnit vydanie ranku cez RCON, plugin endpoint alebo queue system.
