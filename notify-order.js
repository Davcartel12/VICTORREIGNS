/**
 * VictorReigns Empire — WhatsApp order notification
 *
 * Vercel serverless function. The storefront calls this right after an order
 * is saved to Firestore; it sends you a WhatsApp message via Twilio.
 *
 * Required environment variables (set these in Vercel → Settings → Environment Variables):
 *   TWILIO_ACCOUNT_SID   e.g. ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   TWILIO_AUTH_TOKEN    your Twilio auth token
 *   TWILIO_WHATSAPP_FROM e.g. whatsapp:+14155238886   (Twilio's sandbox number)
 *   OWNER_WHATSAPP_TO    e.g. whatsapp:+2349122492113 (YOUR number — where alerts go)
 *
 * No secrets ever touch the browser — they live only on the server.
 */

const FCFA = (n) => (Number(n) || 0).toLocaleString('fr-FR') + ' FCFA';

function buildMessage(order) {
  const lines = (order.items || []).map((i) => {
    const colour = i.color ? ` (${i.color})` : '';
    return `• ${i.name}${colour} × ${i.quantity} — ${FCFA(i.price * i.quantity)}`;
  });

  return [
    '🛍️ *NEW ORDER — VictorReigns Empire*',
    '',
    `*Customer:* ${order.name || '—'}`,
    `*Phone:* ${order.phone || '—'}`,
    order.accountEmail ? `*Account:* ${order.accountEmail}` : null,
    `*Deliver to:* ${order.address || '—'}`,
    '',
    '*Items:*',
    ...(lines.length ? lines : ['—']),
    '',
    `*TOTAL: ${FCFA(order.total)}*`,
    '',
    '_Open the admin panel to mark it fulfilled._'
  ]
    .filter(Boolean)
    .join('\n');
}

module.exports = async (req, res) => {
  // Allow the storefront to call this from the browser
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const {
    TWILIO_ACCOUNT_SID: SID,
    TWILIO_AUTH_TOKEN: TOKEN,
    TWILIO_WHATSAPP_FROM: FROM,
    OWNER_WHATSAPP_TO: TO
  } = process.env;

  if (!SID || !TOKEN || !FROM || !TO) {
    console.error('Twilio env vars are not configured');
    // Don't fail the customer's checkout over a notification problem
    return res.status(200).json({ ok: false, error: 'not-configured' });
  }

  try {
    const order = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    // Basic sanity check — ignore junk requests
    if (!order.name || !Array.isArray(order.items) || !order.items.length) {
      return res.status(400).json({ ok: false, error: 'invalid-order' });
    }

    const body = new URLSearchParams({
      From: FROM,
      To: TO,
      Body: buildMessage(order)
    });

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${SID}:${TOKEN}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
      }
    );

    const data = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error('Twilio error:', data);
      return res.status(200).json({ ok: false, error: data.message || 'twilio-failed' });
    }

    return res.status(200).json({ ok: true, sid: data.sid });
  } catch (err) {
    console.error('notify-order failed:', err);
    // Always 200: a failed notification must never break the customer's order
    return res.status(200).json({ ok: false, error: 'send-failed' });
  }
};
