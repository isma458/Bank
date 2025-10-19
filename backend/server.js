// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Stripe = require('stripe');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-11-15' });
const app = express();
app.use(cors());
app.use(express.json());

// Stripe webhook needs raw body
app.use('/webhook', bodyParser.raw({type: 'application/json'}));

/** --- Simple MongoDB helper (single file demo) --- **/
let db;
async function initDb() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  db = client.db(process.env.MONGO_DB || 'paya');
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
}
initDb().catch(console.error);

/** --- Auth (registro/login simple) --- **/
app.post('/api/register', async (req, res) => {
  const { email, password, name } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    const r = await db.collection('users').insertOne({ email, password: hash, name, balance: 0, createdAt: new Date() });
    res.json({ ok: true, id: r.insertedId });
  } catch(e) { res.status(400).json({ error: 'Email ya registrado' }); }
});
app.post('/api/login', async (req,res) => {
  const { email, password } = req.body;
  const user = await db.collection('users').findOne({ email });
  if(!user) return res.status(401).json({ error: 'Credenciales invalidas' });
  const match = await bcrypt.compare(password, user.password);
  if(!match) return res.status(401).json({ error: 'Credenciales invalidas' });
  const token = jwt.sign({ uid: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: { id: user._id, email: user.email, name: user.name, balance: user.balance } });
});

// Middleware auth
function auth(req,res,next){
  const h = req.headers.authorization;
  if(!h) return res.status(401).json({ error: 'No auth' });
  const token = h.replace('Bearer ','');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch(e){ res.status(401).json({ error: 'Token inválido' }); }
}

/** --- Crear PaymentIntent (cliente paga con tarjeta) --- **/
app.post('/api/create-payment-intent', auth, async (req, res) => {
  const { amount, currency = 'eur' } = req.body;
  // amount en céntimos (ej: 1000 = 10,00 EUR)
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    metadata: { userId: req.user.uid.toString() },
  });
  res.json({ clientSecret: paymentIntent.client_secret });
});

/** --- Webhook para confirmar pagos y actualizar ledger --- **/
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log('Webhook signature error', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if(event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const userId = pi.metadata.userId;
    const amount = pi.amount; // céntimos
    console.log('Pago confirmado para user', userId, 'monto', amount);
    // Actualizar ledger interno
    await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $inc: { balance: amount/100 }});
    await db.collection('transactions').insertOne({
      userId: new ObjectId(userId),
      type: 'deposit',
      amount: amount/100,
      stripeId: pi.id,
      createdAt: new Date()
    });
  }

  // maneja otros eventos si hace falta
  res.json({ received: true });
});

/** --- Transferencia entre usuarios (interno) --- **/
app.post('/api/transfer', auth, async (req,res) => {
  const { toEmail, amount } = req.body; // amount en euros
  const from = await db.collection('users').findOne({ _id: new ObjectId(req.user.uid) });
  const to = await db.collection('users').findOne({ email: toEmail });
  if(!to) return res.status(404).json({ error: 'Destinatario no existe' });
  if(from.balance < amount) return res.status(400).json({ error: 'Fondos insuficientes' });

  // Operación segura: con transacción (Mongo demo)
  const session = db.client.startSession();
  try {
    await session.withTransaction(async () => {
      await db.collection('users').updateOne({ _id: from._id }, { $inc: { balance: -amount } }, { session });
      await db.collection('users').updateOne({ _id: to._id }, { $inc: { balance: amount } }, { session });
      await db.collection('transactions').insertMany([
        { userId: from._id, type: 'transfer_out', amount: amount, to: to._id, createdAt: new Date() },
        { userId: to._id, type: 'transfer_in', amount: amount, from: from._id, createdAt: new Date() }
      ], { session });
    });
    res.json({ ok: true });
  } catch(e){
    console.error(e);
    res.status(500).json({ error: 'Error en la transferencia' });
  } finally { await session.endSession(); }
});

app.listen(process.env.PORT || 3000, () => console.log('Server listening'));
