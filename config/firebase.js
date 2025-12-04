const admin = require("firebase-admin");

function initializeFirebase() {
  const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString("utf8");
  const serviceAccount = JSON.parse(decoded);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = { initializeFirebase, admin };
