# Fixes applied for AI Crop Detection & Satellite Intelligence

## 1. AI Crop Detection (Gemini Vision)

**Problem:** `server.ts` used model id `gemini-4-hydrogen`, which is not a public Gemini API model.
That breaks `POST /api/doctor/diagnose` (and the assistant / mandi helpers).

**Fix:** Change all occurrences to `gemini-2.0-flash`:

```bash
sed -i "s/gemini-4-hydrogen/gemini-2.0-flash/g" server.ts
```

Also set in your environment / secrets:

```
GEMINI_API_KEY=your_key_from_https://aistudio.google.com/apikey
```

## 2. Satellite Intelligence (Google Earth Engine)

**Problem:** Pixel NDVI/NDWI only work when GEE credentials are configured and the service account is registered with Earth Engine.

Set:

```
GEE_PROJECT_ID=strong-summer-514915-u4
GEE_SERVICE_ACCOUNT_JSON=<full JSON key as one line>
```

Or:

```
GEE_CLIENT_EMAIL=earth-engine-sa@strong-summer-514915-u4.iam.gserviceaccount.com
GEE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
```

Then:

1. Enable Earth Engine API on the GCP project.
2. Register the service account with Earth Engine (https://earthengine.google.com/).
3. Restart the server and check `GET /api/satellite/gee-status` → should show `"status": "READY"`.

**Security:** If a service account private key was shared in chat, rotate it in Google Cloud Console immediately.
