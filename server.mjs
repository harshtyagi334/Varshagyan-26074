import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const bhashiniUrl = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
app.use(express.json({ limit: '8mb' }));

const serviceIdFor = (kind, lang, targetLang) => {
  if (kind === 'translation') return process.env[`BHASHINI_TRANSLATION_SERVICE_ID_${lang.toUpperCase()}_${targetLang.toUpperCase()}`];
  return process.env[`BHASHINI_${kind.toUpperCase()}_SERVICE_ID_${lang.toUpperCase()}`];
};
const isConfigured = (kind, lang, targetLang) => Boolean(process.env.BHASHINI_INFERENCE_API_KEY && serviceIdFor(kind, lang, targetLang));

app.get('/api/bhashini/status', (_req, res) => {
  const langStatus = (lang) => ({
    speechToText: isConfigured('asr', lang),
    textToSpeech: isConfigured('tts', lang),
    translationFromEnglish: lang !== 'en' && isConfigured('translation', 'en', lang),
    translationToEnglish: lang !== 'en' && isConfigured('translation', lang, 'en'),
  });
  res.json({ configured: Boolean(process.env.BHASHINI_INFERENCE_API_KEY), languages: { mr: langStatus('mr'), en: langStatus('en') } });
});

app.post('/api/bhashini/:task', async (req, res) => {
  const { task } = req.params;
  const { text, audioContent, sourceLanguage, targetLanguage } = req.body || {};
  const isTranslation = task === 'translate';
  const isAsr = task === 'asr';
  const taskType = isTranslation ? 'translation' : isAsr ? 'asr' : task === 'tts' ? 'tts' : null;
  if (!taskType) return res.status(404).json({ error: 'Unsupported language service.' });

  const validLang = (value) => typeof value === 'string' && /^[a-z]{2,3}$/.test(value);
  if (!validLang(sourceLanguage) || (isTranslation && !validLang(targetLanguage))) {
    return res.status(400).json({ error: 'A valid language code is required.' });
  }
  if ((isAsr && (typeof audioContent !== 'string' || audioContent.length > 7_000_000)) || (!isAsr && (typeof text !== 'string' || !text.trim() || text.length > 2_000))) {
    return res.status(400).json({ error: isAsr ? 'Audio is missing or exceeds the 5 MB limit.' : 'Text is missing or exceeds the 2,000 character limit.' });
  }

  const serviceId = serviceIdFor(taskType, sourceLanguage, targetLanguage);
  const apiKey = process.env.BHASHINI_INFERENCE_API_KEY;
  if (!apiKey || !serviceId) return res.status(503).json({ error: 'Bhashini is not configured for this language yet.' });

  const config = { language: { sourceLanguage }, serviceId };
  if (isTranslation) config.language.targetLanguage = targetLanguage;
  if (taskType === 'tts') config.gender = 'female';
  const payload = {
    pipelineTasks: [{ taskType, config }],
    inputData: isAsr ? { audio: [{ audioContent }] } : { input: [{ source: text }] },
  };

  try {
    const upstream = await fetch(bhashiniUrl, {
      method: 'POST',
      headers: { Accept: '*/*', Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45_000),
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return res.status(upstream.status === 401 ? 503 : 502).json({ error: upstream.status === 401 ? 'Bhashini credentials were rejected.' : 'Bhashini could not process this request.' });
    const output = result?.pipelineResponse?.[0]?.output?.[0] || {};
    const value = isAsr ? output.source : isTranslation ? output.target : (output.audioContent || output.audio);
    if (!value) return res.status(502).json({ error: 'Bhashini returned no result for this request.' });
    const audioFormat = result?.pipelineResponse?.[0]?.config?.audioFormat || 'wav';
    res.json(isAsr ? { transcript: value } : isTranslation ? { translation: value } : { audioContent: value, audioFormat });
  } catch {
    res.status(502).json({ error: 'Could not reach Bhashini. Please try again.' });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(root, 'dist')));
  app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
} else {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(port, '0.0.0.0', () => console.log(`VarshaGyan listening on http://localhost:${port}`));
