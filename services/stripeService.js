const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

async function createStripePaymentIntent(amount) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
  });
  return paymentIntent.client_secret;
}

module.exports = { createStripePaymentIntent };
