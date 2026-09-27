# VarshaGyan (वर्षा ज्ञान)

VarshaGyan is a prototype for SIH problem statement 26074: turning block-level
weather information into Panchayat-level estimates for agro-meteorological
advisory services. It has a Marathi-first farmer experience and an evaluation
workspace with the map, Panchayat comparison, and methodology views.

## Run locally

Prerequisites: Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. No Gemini key is required to run the prototype.

## Current prototype boundaries

- The app requests current block-center weather from Open-Meteo. If that
  service is unavailable, it labels and falls back to the bundled sample data.
  This is not an IMD forecast or an operational Panchayat-level forecast.
- The terrain calculation is a demonstration heuristic, not a trained or
  validated model. No real paired gauge/forecast dataset or validation score
  is bundled. See [backend/MODEL_DATA.md](backend/MODEL_DATA.md) for the data
  requirements and training workflow.
- Open-Meteo data is attributed in the app under CC BY 4.0. The free API is
  limited to non-commercial use; consult Open-Meteo's terms before commercial
  or promotional use. Educational content is listed as permitted non-commercial
  use in its terms.
- Crop and growth-stage choices are stored in the browser. Only a few
  crop-stage risk rules are implemented; when no reviewed rule matches, the
  UI identifies the advice as general weather guidance.
- Farmer observations in this prototype stay in the current app session.
  Example observations are marked as demo data.

Do not use the Panchayat estimate or unreviewed advisory rules to make
operational farm decisions. The live block forecast improves demo interactivity,
but it does not validate the prototype's downscaling method.

## Optional BHASHINI language services

BHASHINI can provide Marathi/English speech recognition, text-to-speech, and
translation when an inference API key and matching service IDs are configured.
Copy the BHASHINI variable names from `.env.example` into a local `.env.local`
file and fill them with credentials and service IDs from the BHASHINI/ULCA
portal. Keep the inference key on the Node server; do not add it to browser
code. Recorded audio is sent only when the user chooses **Transcribe with
Bhashini**. Read-aloud uses the local device voice if BHASHINI is unavailable.

API access, model availability, usage limits, and charges depend on the
BHASHINI account and selected model. Review translations/transcriptions before
using them in an agricultural advisory.

For production, build with `npm run build`, then run `npm start` with
`NODE_ENV=production`. The Node server serves the static app and the
credentialed BHASHINI proxy.
