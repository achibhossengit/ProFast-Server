# ProFast Server

This is the backend application for the ProFast project. It uses **Express.js** for the API, **Stripe** for payments, and **Firebase Admin** for authentication and other Firebase services.

👉 Full documentation: [ProFastDoc repository](https://github.com/achibhossengit/ProFastDoc).

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/achibhossengit/ProFast-Server.git
cd ProFast-Server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root directory and add the following keys:

```env
PORT=5000
STRIPE_SECRET_KEY=<your_stripe_secret_key>
FIREBASE_SERVICE_ACCOUNT=<path_to_your_firebase_service_account_json>
DB_USER=<your_database_user>
DB_PASSWORD=<your_database_password>
```

> **Note:** `FIREBASE_SERVICE_ACCOUNT` should point to your Firebase service account JSON file.

### 4. Start the development server

```bash
npm run dev
```

### 5. Open in browser / test API

By default, the server should run at:

```
http://localhost:5000
```

You can test API endpoints using **Postman** or any API client.
