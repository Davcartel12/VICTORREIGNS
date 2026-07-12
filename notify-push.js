/**
 * VictorReigns Empire — order push notification
 *
 * Called by the storefront right after an order is saved. Sends an FCM push
 * to every device that enabled alerts in the admin app — so you get notified
 * even when the app is closed and your phone is locked.
 *
 * Required environment variable (Vercel → Settings → Environment Variables):
 *   FIREBASE_SERVICE_ACCOUNT  — the whole service-account JSON, pasted as one line.
 *                               (Firebase Console → Project Settings → Service
 *                                accounts → Generate new private key)
 */

const FCFA = (n) => (Number(n) || 0).toLocaleString('fr-FR') + ' FCFA';

/* ---- Mint an OAuth access token from the service account (no SDK needed) ---- */
const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    })
  );

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const signature = signer
    .sign(sa.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'oauth-failed');
  return data.access_token;
}

/* ---- Read the registered device tokens straight from Firestore REST ---- */
async function getTokens(projectId, accessToken) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/push_tokens`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.documents || [])
    .map((d) => d.fields && d.fields.token && d.fields.token.stringValue)
    .filter(Boolean);
}

/* ---- Send one push ---- */
async function sendPush(projectId, accessToken, token, title, body) {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: { url: '/admin.html' },
          webpush: {
            fcmOptions: { link: '/admin.html' },
            notification: {
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: 'vr-order',
              renotify: true
            }
          }
        }
      })
    }
  );
  return res.ok;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error('FIREBASE_SERVICE_ACCOUNT is not set');
    return res.status(200).json({ ok: false, error: 'not-configured' });
  }

  try {
    const sa = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const order = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    if (!order.name || !Array.isArray(order.items) || !order.items.length) {
      return res.status(400).json({ ok: false, error: 'invalid-order' });
    }

    const count = order.items.reduce((a, i) => a + (Number(i.quantity) || 0), 0);
    const title = `New order — ${FCFA(order.total)}`;
    const body =
      `${order.name} · ${count} item${count === 1 ? '' : 's'}\n` +
      order.items
        .slice(0, 3)
        .map((i) => `${i.name}${i.color ? ` (${i.color})` : ''} ×${i.quantity}`)
        .join(', ') +
      (order.items.length > 3 ? '…' : '');

    const accessToken = await getAccessToken(sa);
    const tokens = await getTokens(sa.project_id, accessToken);

    if (!tokens.length) {
      return res.status(200).json({ ok: false, error: 'no-devices' });
    }

    const results = await Promise.all(
      tokens.map((t) => sendPush(sa.project_id, accessToken, t, title, body).catch(() => false))
    );
    const sent = results.filter(Boolean).length;

    return res.status(200).json({ ok: true, sent, of: tokens.length });
  } catch (err) {
    console.error('notify-push failed:', err);
    // Never break the customer's checkout over a notification
    return res.status(200).json({ ok: false, error: 'send-failed' });
  }
};
