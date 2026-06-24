/**
 * AI Image Generation Service — Pollinations (free, no key) + Replicate fallback
 *
 * Generates product hero images for landing pages.
 * Primary: Pollinations (free, no API key required)
 * Fallback: Replicate Flux Schnell (if REPLICATE_API_KEY is set)
 */
import axios from 'axios';

const REPLICATE_API = 'https://api.replicate.com/v1';
const FLUX_SCHNELL = 'black-forest-labs/flux-schnell';

const POLLINATIONS_URL = 'https://image.pollinations.ai/prompt';

function getReplicateKey(): string {
  return process.env.REPLICATE_API_KEY || '';
}

async function generateViaPollinations(prompt: string, width = 1080, height = 1080): Promise<string | null> {
  try {
    const url = `${POLLINATIONS_URL}/${encodeURIComponent(prompt)}&width=${width}&height=${height}&nologo=true`;
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    if (res.status === 200 && res.data) {
      // Upload the generated image to our server storage
      const { writeFileSync, mkdirSync } = await import('fs');
      const { join } = await import('path');
      const outputDir = join(process.cwd(), 'uploads', 'landings');
      mkdirSync(outputDir, { recursive: true });
      const filename = `hero-${Date.now()}.jpg`;
      writeFileSync(join(outputDir, filename), res.data);
      return `/api/ai/landing/image/${filename}`;
    }
    return null;
  } catch (err: any) {
    console.error('[pollinations] error:', err?.message || err);
    return null;
  }
}

async function generateViaReplicate(prompt: string, width = 1080, height = 1080): Promise<string | null> {
  const apiKey = getReplicateKey();
  if (!apiKey) return null;

  try {
    const createRes = await axios.post(
      `${REPLICATE_API}/models/${FLUX_SCHNELL}/predictions`,
      {
        input: {
          prompt,
          width,
          height,
          num_outputs: 1,
          num_inference_steps: 4,
          go_fast: true,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const prediction = createRes.data;
    let outputUrl = prediction.urls?.get;

    if (outputUrl) {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const pollRes = await axios.get(outputUrl, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        const status = pollRes.data.status;
        if (status === 'succeeded') {
          const output = pollRes.data.output;
          if (Array.isArray(output) && output.length > 0) return output[0];
          if (typeof output === 'string') return output;
          return null;
        }
        if (status === 'failed') {
          console.error('[replicate] generation failed:', pollRes.data.error);
          return null;
        }
      }
    }
    return null;
  } catch (err: any) {
    console.error('[replicate] error:', err?.response?.data || err.message);
    return null;
  }
}

export async function generateHeroImage(
  productName: string,
  productImageUrl: string,
  style: string,
  width = 1080,
  height = 1080,
): Promise<string | null> {
  // Build prompt
  const prompt = [
    `Professional product hero image for "${productName}".`,
    style ? `Style: ${style}.` : '',
    'Clean background, dramatic lighting, high quality, commercial photography, white background.',
    'Product prominently displayed, elegant composition, Arabic/e-commerce style.',
    'No text, no watermark, no logos.',
  ].filter(Boolean).join(' ');

  // Try Pollinations first (free)
  const pollinationsResult = await generateViaPollinations(prompt, width, height);
  if (pollinationsResult) return pollinationsResult;

  // Fallback to Replicate
  console.log('[ai-image] Pollinations failed, trying Replicate...');
  return generateViaReplicate(prompt, width, height);
}

export async function generateHeroImageDirect(
  prompt: string,
  width = 1080,
  height = 1080,
): Promise<string | null> {
  const result = await generateViaPollinations(prompt, width, height);
  if (result) return result;
  return generateViaReplicate(prompt, width, height);
}
