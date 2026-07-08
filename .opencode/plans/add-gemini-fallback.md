# Plan: Add Google Gemini as AI Fallback

## Problem
`DEEPINFRA_API_KEY` is not working. All AI features (chat, customer AI, owner AI, guardian) rely on `server/services/gemini.ts` which only calls DeepInfra.

## Solution
Add Gemini as a fallback. `@google/generative-ai` SDK v0.24.1 is already installed (used by `color-intelligence.ts`).

## Changes

### 1. `.env.example`
After line 6 (`DEEPINFRA_API_KEY=`), add:
```
# Google Gemini AI (fallback when DeepInfra is down — free tier available)
GOOGLE_AI_API_KEY=
```

Then in your actual `.env`, set: `GOOGLE_AI_API_KEY=AIzaSyDfLASMUGcTKZHI369kEtW1OA6rpHT-8go`

### 2. `server/services/gemini.ts`

**a) Add import** after line 13 (after the comment block, before `const DEEPINFRA_API_BASE`):
```ts
import { GoogleGenerativeAI } from '@google/generative-ai';
```

**b) Add Gemini model constant** after line 23:
```ts
const GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash';
```

**c) Wrap the DeepInfra retry loop** in `callAI()` (lines 386–463) in a try-catch, then add Gemini fallback after the catch. Replace lines 386–463:

```ts
  // Retry with backoff, fallback to smaller model on final attempt
  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Use vision model when images are attached, otherwise use the requested or default model
      const selectedModel = isVisionRequest ? VISION_MODEL : (model || OWNER_AI_MODEL);
      const useModel = attempt === MAX_RETRIES ? (isVisionRequest ? VISION_MODEL : AI_FALLBACK_MODEL) : selectedModel;
      const url = `${DEEPINFRA_API_BASE}/chat/completions`;

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(buildBody(useModel)),
          signal: AbortSignal.timeout(60000),
        });
      } catch (err: any) {
        console.warn(`[AI] Network error on attempt ${attempt + 1}: ${err?.message || err}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
          continue;
        }
        throw new Error(`AI API network error after ${MAX_RETRIES + 1} attempts: ${err?.message || err}`);
      }

      if (response.ok) {
        const data: any = await response.json();
        const text = data?.choices?.[0]?.message?.content;
        if (!text) throw new Error('Empty response from AI');

        const usage = data?.usage || {};
        const tokensInput = usage.prompt_tokens || 0;
        const tokensOutput = usage.completion_tokens || 0;
        const totalTokens = usage.total_tokens || (tokensInput + tokensOutput);

        let costUsd = 0;
        if (useModel === OWNER_AI_MODEL) {
          costUsd = (tokensInput * 0.36 + tokensOutput * 0.40) / 1_000_000;
        } else if (useModel === VISION_MODEL) {
          costUsd = (tokensInput * 0.15 + tokensOutput * 0.60) / 1_000_000;
        } else if (useModel === AI_FALLBACK_MODEL) {
          costUsd = totalTokens * 0.03 / 1_000_000;
        } else {
          costUsd = (tokensInput * 0.12 + tokensOutput * 0.24) / 1_000_000;
        }

        return {
          text: text.trim(),
          tokensInput,
          tokensOutput,
          totalTokens,
          costUsd
        };
      }

      if (response.status === 429) throw new Error('AI_QUOTA_EXCEEDED');

      if (response.status === 503 && attempt < MAX_RETRIES) {
        console.warn(`[AI] 503 on attempt ${attempt + 1}, retrying in ${RETRY_DELAYS[attempt]}ms...`);
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
        continue;
      }

      const errText = await response.text();
      if (attempt === MAX_RETRIES) {
        throw new Error(`AI API error ${response.status} (after ${MAX_RETRIES + 1} attempts): ${errText}`);
      }
    }
  } catch (deepInfraError) {
    // Gemini fallback
    const geminiKey = process.env.GOOGLE_AI_API_KEY;
    if (geminiKey) {
      console.warn('[AI] DeepInfra failed, falling back to Gemini');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const geminiModel = genAI.getGenerativeModel({ model: GEMINI_FALLBACK_MODEL });

      const contents: { role: string; parts: { text: string }[] }[] = [];

      // Convert conversation history
      for (const h of conversationHistory) {
        contents.push({
          role: h.role,
          parts: [{ text: h.parts.map(p => p.text).join('\n') }],
        });
      }

      // Build user message with optional images
      let userPart = userMessage;
      if (isVisionRequest && images) {
        const parts: any[] = [{ text: userMessage }];
        for (const img of images) {
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64,
            },
          });
        }
        contents.push({ role: 'user', parts });
      } else {
        contents.push({ role: 'user', parts: [{ text: userMessage }] });
      }

      try {
        const result = await geminiModel.generateContent({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens || 1024,
            topP: 0.95,
          },
        });

        const response = result.response;
        const text = response.text();

        // Gemini free tier = $0 cost
        return {
          text: text.trim(),
          tokensInput: 0,
          tokensOutput: 0,
          totalTokens: 0,
          costUsd: 0,
        };
      } catch (geminiErr: any) {
        console.error('[AI] Gemini fallback also failed:', geminiErr?.message || geminiErr);
        throw new Error(`DeepInfra failed and Gemini fallback also failed: ${geminiErr?.message || geminiErr}`);
      }
    }
    throw deepInfraError;
  }

  throw new Error('AI API: all retries exhausted');
```

## Deployment
After making these changes:
1. Add `GOOGLE_AI_API_KEY=AIzaSyDfLASMUGcTKZHI369kEtW1OA6rpHT-8go` to `.env`
2. Restart the server
