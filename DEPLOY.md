# VictorReigns Empire — Deploy

## Upload these to your project root

```
index.html                  ← the whole storefront (SPA)
admin.html                  ← admin panel / installable app
about.html                  ← redirect stubs (keep — old links still work)
cart.html
checkout.html
contact.html
product.html
reviews.html
shop.html

sw.js                       ← service worker (push + offline)
firebase-messaging-sw.js    ← MUST be at root, exactly this name
manifest.json               ← makes the admin installable
vercel.json

logo.png                    ← hero + door + admin login
logo1.png                   ← header logo
icon-192.png                ← app icon
icon-512.png                ← app icon
apple-touch-icon.png        ← iPhone home-screen icon

api/
  notify-push.js            ← sends order push notifications
  notify-order.js           ← WhatsApp alerts (optional — delete if unused)
```

`firestore.rules` is **not** uploaded — paste it into Firebase instead (Step 2).

---

## Step 1 — Vercel environment variable

Vercel → your project → **Settings → Environment Variables**

| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | The **entire** contents of your NEW service-account `.json` |

Paste it as one blob, `{` to `}`. Don't reformat it or add quotes.

> Only if you also want WhatsApp alerts, add these four as well:
> `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `OWNER_WHATSAPP_TO`.
> Skip them and WhatsApp just quietly stays off — nothing breaks.

## Step 2 — Publish the Firestore rules

Firebase Console → **Firestore Database** → **Rules** → paste `firestore.rules` → **Publish**.

Without this, sign-in, reviews, and push registration will all be blocked.

## Step 3 — Deploy

Push to Vercel (or Deployments → ⋯ → **Redeploy**).

**A redeploy is required** after adding environment variables — Vercel won't
pick them up otherwise.

## Step 4 — Install the admin on your iPhone

1. Open `yoursite.vercel.app/admin.html` in **Safari** (must be Safari)
2. A prompt slides up — or tap **Share** → **Add to Home Screen**
3. **Close Safari.** Open **VR Admin** from your home screen.
4. Log in → tap **Enable alerts** → **Allow**
5. The bell should turn green and read **"Alerts on"**

## Step 5 — Test

Place a test order on the storefront. Your phone should buzz within seconds.

---

## Quick verification

- `yoursite.com/firebase-messaging-sw.js` → should show code, not a 404
- `yoursite.com/manifest.json` → should show JSON
- Firestore → a **`push_tokens`** collection should appear after Step 4

## If notifications don't arrive

1. Vercel → **Logs** → look for `notify-push` errors
2. Confirm `FIREBASE_SERVICE_ACCOUNT` is set **and you redeployed after**
3. Confirm `firestore.rules` was published (needs the `push_tokens` section)
4. Confirm you're in the **installed** app, not a Safari tab
5. Confirm iOS 16.4+ (Settings → General → About)
6. iOS → Settings → Notifications → **VR Admin** → Allow Notifications ON

---

## What's live

**Storefront** — single-page app; products load once and stay in memory.
Door intro + email sign-in gate. Colour variants with per-colour images.
Real customer reviews. Orders go straight to the admin.

**Admin** — installable app with push alerts. Products (with colours),
Orders, Reviews, and Customers. Tap any customer to see their orders + review.

**Admin password:** `victorreigns2026` — change it in `admin.html`
(search for `ADMIN_PASSWORD`).
