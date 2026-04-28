import { pool } from '../utils/database';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ColorAnalysis {
  hex: string;
  rgb: { r: number; g: number; b: number };
  percentage: number;
  name: string;
}

interface ProductColorData {
  productId: number;
  storeId: number;
  imageUrl: string;
  dominantColors: ColorAnalysis[];
  colorMood: 'warm' | 'cool' | 'neutral';
  colorHarmony: 'monochrome' | 'analogous' | 'complementary' | 'triadic';
  brightnessLevel: 'dark' | 'medium' | 'light';
  saturationLevel: 'muted' | 'medium' | 'vibrant';
}

interface SegmentMetrics {
  segmentName: string;
  productCategory: string;
  visitorCount: number;
  avgTimeOnSite: number;
  conversionRate: number;
  bounceRate: number;
  clickThroughRate: number;
  preferredColors: string[];
  averageOrderValue: number;
}

interface ColorRecommendation {
  recommendedColors: Record<string, string>;
  reasoning: string;
  expectedImpact: {
    timeOnSiteIncrease: number;
    conversionIncrease: number;
    bounceRateDecrease: number;
  };
  confidenceScore: number;
}

class ColorIntelligenceService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      console.warn('[ColorIntelligence] GOOGLE_AI_API_KEY not configured — AI color features disabled.');
    }
  }

  private requireAI(): GoogleGenerativeAI {
    if (!this.genAI) throw new Error('GOOGLE_AI_API_KEY not configured');
    return this.genAI;
  }

  /**
   * Analyze product image and extract dominant colors
   */
  async analyzeProductImage(
    productId: number,
    storeId: number,
    imageUrl: string
  ): Promise<ProductColorData> {
    try {
      // Download image and convert to base64
      const imageBuffer = await this.downloadImage(imageUrl);
      const base64Image = imageBuffer.toString('base64');

      // Use Gemini vision to analyze colors
      const model = this.requireAI().getGenerativeModel({ model: 'gemini-1.5-flash' });

      const response = await model.generateContent([
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg',
          },
        },
        {
          text: `Analyze this product image and provide a detailed color analysis. Return ONLY valid JSON (no markdown) with this structure:
{
  "dominantColors": [
    { "hex": "#XXXXXX", "percentage": 35, "name": "color name" },
    { "hex": "#XXXXXX", "percentage": 25, "name": "color name" }
  ],
  "colorMood": "warm|cool|neutral",
  "colorHarmony": "monochrome|analogous|complementary|triadic",
  "brightnessLevel": "dark|medium|light",
  "saturationLevel": "muted|medium|vibrant",
  "analysis": "Brief description of the color scheme"
}

Requirements:
- Return top 3-5 dominant colors
- Percentages must sum to 100
- Return hex colors only
- Be accurate about color mood and harmony
- Analyze overall brightness and saturation`,
        },
      ]);

      const content = response.response.text();
      // Extract JSON from response (in case of markdown wrapping)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsedResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);

      const analysis: ProductColorData = {
        productId,
        storeId,
        imageUrl,
        dominantColors: parsedResponse.dominantColors,
        colorMood: parsedResponse.colorMood,
        colorHarmony: parsedResponse.colorHarmony,
        brightnessLevel: parsedResponse.brightnessLevel,
        saturationLevel: parsedResponse.saturationLevel,
      };

      // Store in database
      await pool.query(
        `INSERT INTO store_product_colors 
         (store_id, product_id, dominant_colors, color_mood, color_harmony, brightness_level, saturation_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (store_id, product_id) DO UPDATE SET
         dominant_colors = $3,
         color_mood = $4,
         color_harmony = $5,
         brightness_level = $6,
         saturation_level = $7,
         updated_at = NOW()`,
        [
          storeId,
          productId,
          JSON.stringify(analysis.dominantColors),
          analysis.colorMood,
          analysis.colorHarmony,
          analysis.brightnessLevel,
          analysis.saturationLevel,
        ]
      );

      return analysis;
    } catch (error) {
      console.error('Error analyzing product image:', error);
      throw new Error(`Failed to analyze product image: ${error}`);
    }
  }

  /**
   * Get aggregate color palette for store (from all products)
   */
  async getStoreColorPalette(storeId: number): Promise<ColorAnalysis[]> {
    try {
      const result = await pool.query(
        `SELECT dominant_colors FROM store_product_colors 
         WHERE store_id = $1 
         ORDER BY updated_at DESC`,
        [storeId]
      );

      const allColors: Map<string, { count: number; data: ColorAnalysis }> = new Map();

      // Aggregate colors from all products
      result.rows.forEach((row) => {
        const colors = row.dominant_colors;
        colors.forEach((color: ColorAnalysis) => {
          if (allColors.has(color.hex)) {
            const existing = allColors.get(color.hex)!;
            existing.count += 1;
          } else {
            allColors.set(color.hex, { count: 1, data: color });
          }
        });
      });

      // Sort by frequency and return top colors
      const palette = Array.from(allColors.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((item) => item.data);

      return palette;
    } catch (error) {
      console.error('Error getting store color palette:', error);
      throw error;
    }
  }

  /**
   * Update customer segment metrics (called from analytics)
   */
  async updateSegmentMetrics(storeId: number, segment: SegmentMetrics): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO store_customer_segments 
         (store_id, segment_name, product_category, visitor_count, avg_time_on_site, 
          conversion_rate, bounce_rate, click_through_rate, preferred_colors, average_order_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (store_id, segment_name) DO UPDATE SET
         visitor_count = $4,
         avg_time_on_site = $5,
         conversion_rate = $6,
         bounce_rate = $7,
         click_through_rate = $8,
         preferred_colors = $9,
         average_order_value = $10,
         updated_at = NOW()`,
        [
          storeId,
          segment.segmentName,
          segment.productCategory,
          segment.visitorCount,
          segment.avgTimeOnSite,
          segment.conversionRate,
          segment.bounceRate,
          segment.clickThroughRate,
          JSON.stringify(segment.preferredColors),
          segment.averageOrderValue,
        ]
      );
    } catch (error) {
      console.error('Error updating segment metrics:', error);
      throw error;
    }
  }

  /**
   * Get customer segments for a store
   */
  async getSegments(storeId: number): Promise<SegmentMetrics[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM store_customer_segments 
         WHERE store_id = $1 
         ORDER BY visitor_count DESC`,
        [storeId]
      );

      return result.rows.map((row) => ({
        segmentName: row.segment_name,
        productCategory: row.product_category,
        visitorCount: row.visitor_count,
        avgTimeOnSite: row.avg_time_on_site,
        conversionRate: row.conversion_rate,
        bounceRate: row.bounce_rate,
        clickThroughRate: row.click_through_rate,
        preferredColors: row.preferred_colors || [],
        averageOrderValue: row.average_order_value,
      }));
    } catch (error) {
      console.error('Error getting segments:', error);
      throw error;
    }
  }

  /**
   * Generate color recommendations based on products and segments
   */
  async generateColorRecommendation(storeId: number): Promise<ColorRecommendation> {
    try {
      // Get store color palette
      const palette = await this.getStoreColorPalette(storeId);

      // Get customer segments
      const segments = await this.getSegments(storeId);

      // Get current store settings
      const storeResult = await pool.query(
        `SELECT * FROM client_store_settings WHERE id = $1`,
        [storeId]
      );
      const storeSettings = storeResult.rows[0];

      // Use Gemini to generate recommendations
      const model = this.requireAI().getGenerativeModel({ model: 'gemini-1.5-flash' });

      const response = await model.generateContent([
        {
          text: `You are a color psychology expert for e-commerce stores. 

Store Information:
- Current colors: Header: ${storeSettings.header_bg_color}, Button: ${storeSettings.button_color}, Text: ${storeSettings.text_color}
- Product palette (top colors): ${palette.map((c) => c.hex).join(', ')}
- Primary customer segments: ${segments.map((s) => `${s.segmentName} (${s.avgTimeOnSite}s avg, ${s.conversionRate}% conversion)`).join('; ')}

Customer Preferences by Segment:
${segments.map((s) => `- ${s.segmentName}: Prefers ${s.preferredColors.join(', ')} | Bounce rate: ${s.bounceRate}%`).join('\n')}

Analyze this data and provide color recommendations. Return ONLY valid JSON:
{
  "headerColor": "#XXXXXX",
  "buttonColor": "#XXXXXX", 
  "textColor": "#XXXXXX",
  "accentColor": "#XXXXXX",
  "backgroundColor": "#XXXXXX",
  "reasoning": "Clear explanation of why these colors",
  "targetSegment": "Primary customer segment this optimizes for",
  "expectedTimeOnSiteIncrease": 15,
  "expectedConversionIncrease": 5,
  "expectedBounceRateDecrease": 10,
  "confidenceScore": 0.85
}

Ensure:
- Colors complement product palette
- Match psychology of target segment
- Improve readability and hierarchy
- Realistic improvement projections
- Confidence 0.0-1.0`,
        },
      ]);

      const content = response.response.text();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);

      const recommendation: ColorRecommendation = {
        recommendedColors: {
          headerBg: parsed.headerColor,
          button: parsed.buttonColor,
          text: parsed.textColor,
          accent: parsed.accentColor,
          background: parsed.backgroundColor,
        },
        reasoning: parsed.reasoning,
        expectedImpact: {
          timeOnSiteIncrease: parsed.expectedTimeOnSiteIncrease,
          conversionIncrease: parsed.expectedConversionIncrease,
          bounceRateDecrease: parsed.expectedBounceRateDecrease,
        },
        confidenceScore: parsed.confidenceScore,
      };

      // Store recommendation
      await pool.query(
        `INSERT INTO color_recommendations 
         (store_id, recommended_colors, recommendation_reason, confidence_score, estimated_impact)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          storeId,
          JSON.stringify(recommendation.recommendedColors),
          recommendation.reasoning,
          recommendation.confidenceScore,
          JSON.stringify(recommendation.expectedImpact),
        ]
      );

      return recommendation;
    } catch (error) {
      console.error('Error generating color recommendation:', error);
      throw error;
    }
  }

  /**
   * Apply color recommendation to store
   */
  async applyColorRecommendation(
    storeId: number,
    recommendationId: number,
    storeOwnerId: number
  ): Promise<void> {
    try {
      // Get recommendation
      const recResult = await pool.query(
        `SELECT * FROM color_recommendations WHERE id = $1 AND store_id = $2`,
        [recommendationId, storeId]
      );

      if (!recResult.rows.length) {
        throw new Error('Recommendation not found');
      }

      const recommendation = recResult.rows[0];
      const colors = recommendation.recommended_colors;

      // Get current metrics
      const currentResult = await pool.query(
        `SELECT * FROM client_store_settings WHERE id = $1`,
        [storeId]
      );
      const currentSettings = currentResult.rows[0];

      // Apply colors to store settings
      await pool.query(
        `UPDATE client_store_settings 
         SET header_bg_color = $1, button_color = $2, text_color = $3, 
             secondary_color = $4, background_color = $5, updated_at = NOW()
         WHERE id = $6`,
        [
          colors.headerBg,
          colors.button,
          colors.text,
          colors.accent,
          colors.background,
          storeId,
        ]
      );

      // Create version history
      const versionResult = await pool.query(
        `SELECT MAX(version_number) as max_version FROM store_color_versions WHERE store_id = $1`,
        [storeId]
      );
      const nextVersion = (versionResult.rows[0].max_version || 0) + 1;

      await pool.query(
        `INSERT INTO store_color_versions 
         (store_id, version_number, colors_config, applied_by, reason, metrics_before)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          storeId,
          nextVersion,
          JSON.stringify(colors),
          'AI',
          'AI Color Intelligence Recommendation',
          JSON.stringify(currentSettings),
        ]
      );

      // Update recommendation status
      await pool.query(
        `UPDATE color_recommendations SET status = 'applied', accepted_by = $1, accepted_at = NOW() 
         WHERE id = $2`,
        [storeOwnerId, recommendationId]
      );
    } catch (error) {
      console.error('Error applying color recommendation:', error);
      throw error;
    }
  }

  /**
   * Helper: Download image from URL
   */
  private async downloadImage(imageUrl: string): Promise<Buffer> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

export const colorIntelligenceService = new ColorIntelligenceService();
