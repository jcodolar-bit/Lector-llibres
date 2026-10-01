import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

// Resilient helper to handle temporary 503 high demand spikes with model fallback
async function generateContentWithFallback(ai: GoogleGenAI, params: any, models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite']) {
  let lastErr: any = null;
  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        ...params,
        model,
      });
      return res;
    } catch (err: any) {
      lastErr = err;
      console.warn(`[Gemini Fallback] Model ${model} encountered error, trying next:`, err?.message || err);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastErr;
}

// Resilient helper for TTS audio generation with fallback
async function generateSpeechWithFallback(ai: GoogleGenAI, params: any, models = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts']) {
  let lastErr: any = null;
  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        ...params,
        model,
      });
      const parts = res.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          return {
            base64Audio: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'audio/wav',
            model,
          };
        }
      }
    } catch (err: any) {
      lastErr = err;
      console.warn(`[TTS Fallback] Model ${model} encountered error, trying next:`, err?.message || err);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastErr;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', hasApiKey: Boolean(apiKey) });
  });

  // 1. Translate Literary Text to Catalan
  app.post('/api/translate', async (req, res) => {
    try {
      const { text, sourceLanguage, literaryTone } = req.body;

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Cal proporcionar un fragment de text per traduir.' });
      }

      const toneGuide = {
        classic: 'To clàssic, elegant i digne, amb un lèxic ric i cadència senyorial (estil Carner, Riba, Pla).',
        contemporary: 'To contemporani fluid, viu i expressiu, conservant la màxima naturalitat i força narrativa.',
        poetic: 'To poètic, líric i evocador, amb especial cura pel ritme intern, la sonoritat i la mètrica implícita.',
        theatrical: 'To teatral i dialògic, idoni per a ser dramatitzat i llegit en veu alta, amb diàlegs naturals i vibrants.',
      }[literaryTone as string] || 'To literari equilibrat, digne i fidel a l’obra original.';

      const langDirective = sourceLanguage && sourceLanguage !== 'auto'
        ? `L'idioma d'origen indicat per l'usuari és: "${sourceLanguage}".`
        : `L'usuari no ha indicat idioma d'origen: identifica l'idioma original amb exactitud.`;

      const systemInstruction = `Ets un traductor literari professional de primer ordre en llengua catalana, hereu de la gran tradició de traducció literària catalana (Carner, Riba, Manent, Sellent).

Les teves regles estrictes són:
1. IDENTIFICACIÓ D'IDIOMA: ${langDirective}
2. TRADUCCIÓ LITERÀRIA: Tradueix el text original al català normatiu de màxima qualitat. La traducció ha de ser natural, fluida i respectar el to de l'obra (literari, narratiu, assagístic, etc.).
3. DIÀLEGS I ESTRUCTURA: Conserva la maquetació dels diàlegs utilitzant guions llargs («—») o cometes («...») segons convingui, i mantén els paràgrafs originals.
4. LÈXIC I SINTAXI: Utilitza un català genuí, ric, amb pronoms febles ben travats i expressions idiomàtiques naturals, evitant qualsevol calc o interferència sintàctica de l'idioma d'origen.
5. NOMS PROPIS: Mantén els noms propis en la seva forma habitual o adaptació literària consagrada en català.
6. REGLES D'ACTUACIÓ CRÍTICA: NO afegeixis introduccions ni comentaris abans o després de la traducció directa (ex: NO diguis "Aquí teniu la traducció"). El text traduït ha de començar directament amb la primera frase de l'obra.`;

      const prompt = `Text original per traduir:\n"""\n${text.trim()}\n"""\nAplica aquest criteri d'estil: ${toneGuide}\nRetorna exclusivament un objecte JSON amb l'estructura especificada.`;

      const response = await generateContentWithFallback(ai, {
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedLanguage: { type: Type.STRING },
              detectedGenre: { type: Type.STRING },
              literaryToneAssessment: { type: Type.STRING },
              catalanTranslation: { type: Type.STRING },
              paragraphs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    original: { type: Type.STRING },
                    translation: { type: Type.STRING },
                  },
                  required: ['id', 'original', 'translation'],
                },
              },
              literaryNotes: { type: Type.STRING },
            },
            required: ['detectedLanguage', 'catalanTranslation', 'paragraphs'],
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      res.json(parsed);
    } catch (err: any) {
      console.error('Translation error:', err);
      res.status(500).json({ error: err.message || 'Error en la traducció literària.' });
    }
  });

  // 2. Generate Native Audio Narration with Gemini TTS (in Catalan or Natural Original language)
  app.post('/api/narrate', async (req, res) => {
    try {
      const { text, voiceName = 'Kore', pacing = 'natural', language = 'Català', languageCode } = req.body;

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Cal proporcionar text per a la narració.' });
      }

      const pacingDirectives: Record<string, string> = {
        contemplative: 'Ritme pausat, reflexiu i serè. Pauses marcades després de comes i punts per assaborir cada mot.',
        natural: 'Ritme narratiu fluid, natural i expressiu d’audiollibre d’alta gamma. Respiracions i cadència literària viva.',
        dramatic: 'Ritme teatral, amb inflexions dramàtiques, contrastos dinàmics i intensitat emotiva.',
      };

      const selectedPacing = pacingDirectives[pacing] || pacingDirectives.natural;

      const isCatalan = !language || language.toLowerCase().includes('català') || language.toLowerCase().includes('catala');

      const styleDescription = isCatalan
        ? `Narrador d'audiollibres professional d'alta qualitat en llengua catalana.
Veu impecable, nativa, expressiva i clara. Comença a llegir directament el text traduït sense introduccions ni comiat.
${selectedPacing}
Respecta escrupolosament la puntuació: pauses breus a les comes, pauses clares als punts i silencis elegants en punts i a part.`
        : `Professional expressive native audiobook narrator reading in natural ${language}.
Warm tone, accurate native pronunciation and natural storytelling rhythm. Begin reading directly without any intro or outro.
${selectedPacing}
Strictly respect punctuation pauses at commas, periods, and paragraph breaks.`;

      const cleanText = text.trim();
      const textToNarrate = cleanText.length > 2000 ? cleanText.slice(0, 2000) + '...' : cleanText;
      const validVoices = ['Kore', 'Fenrir', 'Puck', 'Zephyr', 'Charon'];
      const chosenVoice = validVoices.includes(voiceName) ? voiceName : 'Kore';

      const speechResult = await generateSpeechWithFallback(ai, {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: textToNarrate,
                speechMetadata: {
                  style: styleDescription,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: chosenVoice },
            },
          },
        },
      });

      res.json({
        audioBase64: speechResult.base64Audio,
        mimeType: speechResult.mimeType || 'audio/wav',
        voice: chosenVoice,
        language: isCatalan ? 'Català' : language,
        languageCode: languageCode || (isCatalan ? 'ca' : 'auto'),
        textLength: textToNarrate.length,
        isTruncated: cleanText.length > 2000,
      });
    } catch (err: any) {
      console.error('Narration error:', err);
      res.status(500).json({ error: err.message || 'Error en generar la narració d’àudio.' });
    }
  });

  // 3. Combined Translate & Narrate endpoint
  app.post('/api/translate-and-narrate', async (req, res) => {
    try {
      const { text, sourceLanguage, literaryTone, voiceName = 'Kore', narratorPacing = 'natural' } = req.body;

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Cal proporcionar un text original.' });
      }

      // Step 1: Literary translation
      const toneGuide = {
        classic: 'To clàssic, elegant i digne, amb un lèxic ric i cadència senyorial (estil Carner, Riba, Pla).',
        contemporary: 'To contemporani fluid, viu i expressiu, conservant la màxima naturalitat i força narrativa.',
        poetic: 'To poètic, líric i evocador, amb especial cura pel ritme intern, la sonoritat i la mètrica implícita.',
        theatrical: 'To teatral i dialògic, idoni per a ser dramatitzat i llegit en veu alta, amb diàlegs naturals i vibrants.',
      }[literaryTone as string] || 'To literari equilibrat, digne i fidel a l’obra original.';

      const langDirective = sourceLanguage && sourceLanguage !== 'auto'
        ? `L'idioma d'origen indicat per l'usuari és: "${sourceLanguage}".`
        : `L'usuari no ha indicat idioma d'origen: identifica l'idioma original automàticament.`;

      const systemInstruction = `Ets un traductor literari professional de màxima categoria cap al català normatiu i narrador d'audiollibres.

Les teves regles estrictes són:
1. IDENTIFICACIÓ D'IDIOMA: ${langDirective}
2. TRADUCCIÓ LITERÀRIA: Tradueix el text original al català normatiu de màxima qualitat. La traducció ha de ser natural, fluida i respectar el to de l'obra.
3. DIÀLEGS I ESTRUCTURA: Conserva la maquetació dels diàlegs («—») i mantén l'estructura de paràgrafs.
4. LÈXIC I SINTAXI: Fes servir català genuí, pronoms febles ben administrats, lèxic expressiu.
5. REGLES D'ACTUACIÓ: NO afegeixis cap introducció ni comentari ni abans ni després. La traducció comença directament.
6. MANTÉN els noms propis en la seva forma habitual o adaptació literària adequada.`;

      const translationResponse = await generateContentWithFallback(ai, {
        contents: `Text a traduir al català literari:\n"""\n${text.trim()}\n"""\nCriteri de to: ${toneGuide}`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedLanguage: { type: Type.STRING },
              languageCode: {
                type: Type.STRING,
                description: "Codi ISO de dues lletres de l'idioma d'origen (ex: en, fr, de, es, it, pt, ru, ja)",
              },
              detectedGenre: { type: Type.STRING },
              literaryToneAssessment: { type: Type.STRING },
              catalanTranslation: { type: Type.STRING },
              paragraphs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    original: { type: Type.STRING },
                    translation: { type: Type.STRING },
                  },
                  required: ['id', 'original', 'translation'],
                },
              },
              literaryNotes: { type: Type.STRING },
            },
            required: ['detectedLanguage', 'catalanTranslation', 'paragraphs'],
          },
        },
      });

      const parsedTranslation = JSON.parse(translationResponse.text?.trim() || '{}');
      const catalanTranslation = parsedTranslation.catalanTranslation || '';

      // Step 2: Audio generation (TTS)
      let audioResult = null;
      try {
        const pacingDirectives: Record<string, string> = {
          contemplative: 'Ritme pausat i serè, amb pauses llargues i emotivitat tranquil·la.',
          natural: 'Ritme d’audiollibre natural, fluid i expressiu.',
          dramatic: 'Ritme intens i dramàtic, donant pes a les paraules i diàlegs.',
        };
        const pacingNote = pacingDirectives[narratorPacing] || pacingDirectives.natural;
        const style = `Narrador d'audiollibres en català. Veu expressiva, clara i nativa. Comença a llegir directament el text. ${pacingNote}`;
        const audioText = catalanTranslation.length > 2000 ? catalanTranslation.slice(0, 2000) : catalanTranslation;

        const speechResult = await generateSpeechWithFallback(ai, {
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: audioText,
                  speechMetadata: { style },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
              },
            },
          },
        });

        if (speechResult.base64Audio) {
          audioResult = {
            audioBase64: speechResult.base64Audio,
            mimeType: speechResult.mimeType || 'audio/wav',
            voice: voiceName || 'Kore',
          };
        }
      } catch (audioErr: any) {
        console.warn('TTS warning in translate-and-narrate:', audioErr?.message || audioErr);
      }

      res.json({
        originalText: text.trim(),
        ...parsedTranslation,
        audio: audioResult,
      });
    } catch (err: any) {
      console.error('Translate and narrate error:', err);
      res.status(500).json({ error: err.message || 'Error en el procés de traducció i narració.' });
    }
  });

  // 4. Scan Book Page from Camera and Translate + Narrate directly
  app.post('/api/scan-and-translate', async (req, res) => {
    try {
      const {
        imageBase64,
        mimeType = 'image/jpeg',
        sourceLanguage,
        literaryTone,
        voiceName = 'Kore',
        narratorPacing = 'natural',
      } = req.body;

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'Cal proporcionar la imatge de la pàgina del llibre capturada amb la càmera.' });
      }

      let cleanBase64 = imageBase64;
      let resolvedMimeType = mimeType;
      if (imageBase64.includes(';base64,')) {
        const parts = imageBase64.split(';base64,');
        const match = parts[0].match(/data:(.*?)$/);
        if (match) resolvedMimeType = match[1];
        cleanBase64 = parts[1];
      }

      const toneGuide = {
        classic: 'To clàssic, elegant i digne, amb un lèxic ric i cadència senyorial (estil Carner, Riba, Pla).',
        contemporary: 'To contemporani fluid, viu i expressiu, conservant la màxima naturalitat i força narrativa.',
        poetic: 'To poètic, líric i evocador, amb especial cura pel ritme intern, la sonoritat i la mètrica implícita.',
        theatrical: 'To teatral i dialògic, idoni per a ser dramatitzat i llegit en veu alta, amb diàlegs naturals i vibrants.',
      }[literaryTone as string] || 'To literari equilibrat, digne i fidel a l’obra original.';

      const langDirective = sourceLanguage && sourceLanguage !== 'auto'
        ? `L'idioma d'origen indicat per l'usuari és: "${sourceLanguage}".`
        : `L'usuari no ha indicat idioma d'origen: identifica l'idioma original automàticament a partir del text del llibre a la imatge.`;

      const systemInstruction = `Ets un traductor literari professional d'elit cap al català normatiu i narrador d'audiollibres.
Rebràs una fotografia d'una pàgina o fragment d'un llibre capturat amb la càmera del dispositiu.

Les teves tasques són:
1. RECONEIXEMENT ÒPTIC DE TEXT (OCR LITERARI): Llegeix amb màxima precisió qualsevol text imprès o manuscrit de la pàgina visible a la imatge. Pot ser una portada, la primera pàgina, o una pàgina interior que continuï el text d'una altra pàgina. Transcriu fidelment tot el text dels paràgrafs i diàlegs. Si apareix text parcial o començat, transcriu-lo tal com es llegeix.
2. IDENTIFICACIÓ D'IDIOMA: ${langDirective}
3. TRADUCCIÓ LITERÀRIA: Tradueix el text extret al català normatiu de màxima qualitat. La traducció ha de ser natural, fluida i respectar el to de l'obra (literari, narratiu, assagístic, etc.).
4. DIÀLEGS I PARÀGRAFS: Maqueta els diàlegs amb guions («—») o cometes («...») segons correspongui i mantén la partició de paràgrafs per a la lectura sincrònica bilingüe.
5. REGLES D'ACTUACIÓ ESTRICTES: NO afegeixis introduccions ni comentaris del tipus "En aquesta imatge hi diu...". La traducció al català ha de començar directament amb el text de la lectura.
6. NOMS PROPIS: Mantén els noms propis en la seva forma habitual o adaptació literària adequada.`;

      const prompt = `Aquesta fotografia mostra una pàgina d'un llibre (pot ser la primera pàgina, la segona o qualsevol pàgina successiva).
Llegeix amb cura tot el text visible del llibre, identifica'n l'idioma i tradueix-lo directament al català literari.
Criteri de to: ${toneGuide}`;

      const imagePart = {
        inlineData: {
          data: cleanBase64,
          mimeType: resolvedMimeType || 'image/jpeg',
        },
      };

      const response = await generateContentWithFallback(ai, {
        contents: {
          parts: [imagePart, { text: prompt }],
        },
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              extractedOriginalText: {
                type: Type.STRING,
                description: 'El text complet llegit i extret de la imatge del llibre en el seu idioma original',
              },
              detectedLanguage: {
                type: Type.STRING,
                description: "Idioma d'origen identificat a la pàgina del llibre",
              },
              languageCode: {
                type: Type.STRING,
                description: "Codi ISO de dues lletres de l'idioma d'origen (ex: en, fr, de, es, it, pt, ru, ja)",
              },
              detectedGenre: {
                type: Type.STRING,
                description: 'Gènere literari de la pàgina',
              },
              literaryToneAssessment: {
                type: Type.STRING,
                description: 'Avaluació del to i estil',
              },
              catalanTranslation: {
                type: Type.STRING,
                description: 'La traducció completa al català normatiu, començant directament sense cap introducció',
              },
              paragraphs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    original: { type: Type.STRING },
                    translation: { type: Type.STRING },
                  },
                  required: ['id', 'original', 'translation'],
                },
              },
              literaryNotes: {
                type: Type.STRING,
                description: 'Anotacions del traductor',
              },
            },
            required: ['extractedOriginalText', 'detectedLanguage', 'catalanTranslation', 'paragraphs'],
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      const catalanTranslation = parsed.catalanTranslation || '';

      // Generate TTS Audio
      let audioResult = null;
      try {
        const pacingDirectives: Record<string, string> = {
          contemplative: 'Ritme pausat i serè, amb pauses llargues i emotivitat tranquil·la.',
          natural: 'Ritme d’audiollibre natural, fluid i expressiu.',
          dramatic: 'Ritme intens i dramàtic, donant pes a les paraules i diàlegs.',
        };
        const pacingNote = pacingDirectives[narratorPacing] || pacingDirectives.natural;
        const style = `Narrador d'audiollibres en català. Veu expressiva, clara i nativa. Comença a llegir directament el text. ${pacingNote}`;
        const audioText = catalanTranslation.length > 2000 ? catalanTranslation.slice(0, 2000) : catalanTranslation;

        const speechResult = await generateSpeechWithFallback(ai, {
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: audioText,
                  speechMetadata: { style },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
              },
            },
          },
        });

        if (speechResult.base64Audio) {
          audioResult = {
            audioBase64: speechResult.base64Audio,
            mimeType: speechResult.mimeType || 'audio/wav',
            voice: voiceName || 'Kore',
          };
        }
      } catch (audioErr: any) {
        console.warn('TTS warning during camera translation:', audioErr?.message || audioErr);
      }

      res.json({
        originalText: parsed.extractedOriginalText,
        ...parsed,
        audio: audioResult,
      });
    } catch (err: any) {
      console.error('Camera scan and translate error:', err);
      res.status(500).json({ error: err.message || 'Error en escanejar i traduir la pàgina del llibre.' });
    }
  });

  // Serve static files or Vite dev middleware
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VeuLiterària Server running on http://0.0.0.0:${PORT} (env: ${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
