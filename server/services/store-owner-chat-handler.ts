// Store Owner Chat Handler for Color Intelligence
// Handles AI-powered color analysis and recommendations in store owner chat

import { pool } from '../utils/database';
import { colorIntelligenceService } from './color-intelligence';
import { generateText } from './gemini';

interface ChatMessage {
  content: string;
  type: 'text' | 'command' | 'error';
}

interface CommandIntent {
  type: 'color_analyze' | 'color_recommend' | 'color_apply' | 'color_undo' | 'color_history' | 'other';
  confidence: number;
  parameters: Record<string, any>;
}

class StoreOwnerChatHandler {
  /**
   * Detect intent from store owner's message
   */
  async detectColorIntent(message: string): Promise<CommandIntent> {
    const lowerMsg = message.toLowerCase();
    
    // Color analysis intents
    if (
      lowerMsg.includes('analyze') && lowerMsg.includes('color') ||
      lowerMsg.includes('analyze') && lowerMsg.includes('product') ||
      lowerMsg.includes('why are customers') && lowerMsg.includes('leaving') ||
      lowerMsg.includes('product color') ||
      lowerMsg.includes('store color') && lowerMsg.includes('palette')
    ) {
      return {
        type: 'color_analyze',
        confidence: 0.95,
        parameters: {},
      };
    }

    // Color recommendation intents
    if (
      lowerMsg.includes('recommend') && lowerMsg.includes('color') ||
      lowerMsg.includes('suggest') && lowerMsg.includes('color') ||
      lowerMsg.includes('improve') && lowerMsg.includes('color') ||
      lowerMsg.includes('what colors') && lowerMsg.includes('should') ||
      lowerMsg.includes('color optimization') ||
      lowerMsg.includes('color suggestion')
    ) {
      return {
        type: 'color_recommend',
        confidence: 0.95,
        parameters: {},
      };
    }

    // Apply color intents
    if (
      lowerMsg.includes('apply') && lowerMsg.includes('color') ||
      lowerMsg.includes('change') && lowerMsg.includes('store color') ||
      lowerMsg.includes('update') && lowerMsg.includes('store design')
    ) {
      return {
        type: 'color_apply',
        confidence: 0.85,
        parameters: {},
      };
    }

    // Undo intents
    if (
      lowerMsg.includes('undo') ||
      lowerMsg.includes('revert') && lowerMsg.includes('color') ||
      lowerMsg.includes('go back') ||
      lowerMsg.includes('previous color')
    ) {
      return {
        type: 'color_undo',
        confidence: 0.9,
        parameters: {},
      };
    }

    // History intents
    if (
      lowerMsg.includes('history') && lowerMsg.includes('color') ||
      lowerMsg.includes('version') && lowerMsg.includes('color') ||
      lowerMsg.includes('show me') && lowerMsg.includes('color changes')
    ) {
      return {
        type: 'color_history',
        confidence: 0.9,
        parameters: {},
      };
    }

    return {
      type: 'other',
      confidence: 0,
      parameters: {},
    };
  }

  /**
   * Handle color analysis command
   */
  async handleColorAnalyze(storeId: number, storeOwnerId: number): Promise<ChatMessage> {
    try {
      // Get store info
      const storeResult = await pool.query(
        `SELECT * FROM client_store_settings WHERE id = $1 AND client_id = $2`,
        [storeId, storeOwnerId]
      );

      if (!storeResult.rows.length) {
        return {
          content: '❌ Store not found. Please make sure you\'re analyzing the correct store.',
          type: 'error',
        };
      }

      // Analyze products
      const palette = await colorIntelligenceService.getStoreColorPalette(storeId);
      const segments = await colorIntelligenceService.getSegments(storeId);

      if (!palette.length) {
        return {
          content: `📊 Color analysis started! I need to analyze your product images first. This helps me understand what colors your products have.\n\nLet me start by extracting colors from your product images...`,
          type: 'text',
        };
      }

      // Generate analysis response
      const colors = palette.map((c: any) => c.hex).join(', ');
      const segmentInfo = segments.length
        ? segments
            .map((s: any) => `${s.segmentName}: ${s.avgTimeOnSite}s avg, ${s.conversionRate}% conversion`)
            .join('\n')
        : 'No customer segments tracked yet';

      const response = `📊 **Color Analysis Complete**

**Your Store's Color Palette:**
- Top colors: ${colors}
- Total products analyzed: Multiple

**Customer Segments:**
${segmentInfo}

**Findings:**
Your store currently has the following color profile based on your products. Different customer segments show different color preferences.

**Next Steps:**
Would you like me to:
1. Suggest new colors to improve engagement
2. Optimize colors for a specific customer segment
3. Show you the color version history`;

      return {
        content: response,
        type: 'text',
      };
    } catch (error: any) {
      console.error('Error in handleColorAnalyze:', error);
      return {
        content: `❌ Error analyzing colors: ${error.message}`,
        type: 'error',
      };
    }
  }

  /**
   * Handle color recommendation command
   */
  async handleColorRecommend(storeId: number, storeOwnerId: number): Promise<ChatMessage> {
    try {
      // Generate recommendation
      const recommendation = await colorIntelligenceService.generateColorRecommendation(storeId);

      const response = `✨ **Color Recommendation Generated**

**Recommended Colors:**
- Header: ${recommendation.recommendedColors.headerBg}
- Buttons: ${recommendation.recommendedColors.button}
- Text: ${recommendation.recommendedColors.text}
- Accent: ${recommendation.recommendedColors.accent}
- Background: ${recommendation.recommendedColors.background}

**Why These Colors?**
${recommendation.reasoning}

**Expected Impact:**
- ⏱️ Time on site: +${recommendation.expectedImpact.timeOnSiteIncrease}%
- 🛒 Conversion rate: +${recommendation.expectedImpact.conversionIncrease}%
- 📉 Bounce rate: -${recommendation.expectedImpact.bounceRateDecrease}%

**Confidence: ${(recommendation.confidenceScore * 100).toFixed(0)}%**

Would you like me to apply these colors to your store?`;

      return {
        content: response,
        type: 'text',
      };
    } catch (error: any) {
      console.error('Error in handleColorRecommend:', error);
      return {
        content: `❌ Error generating recommendations: ${error.message}`,
        type: 'error',
      };
    }
  }

  /**
   * Handle color version history
   */
  async handleColorHistory(storeId: number, storeOwnerId: number): Promise<ChatMessage> {
    try {
      const versionsResult = await pool.query(
        `SELECT * FROM store_color_versions WHERE store_id = $1 ORDER BY version_number DESC LIMIT 10`,
        [storeId]
      );

      if (!versionsResult.rows.length) {
        return {
          content: 'ℹ️ No color history yet. Once you apply colors, they will appear here.',
          type: 'text',
        };
      }

      const versions = versionsResult.rows;
      const historyText = versions
        .map(
          (v: any, idx: number) => `
**Version ${v.version_number}** (${new Date(v.created_at).toLocaleDateString()})
- Applied by: ${v.applied_by}
- Reason: ${v.reason}
${v.metrics_before ? `- Before: ${v.metrics_before.timeOnSite}s avg time` : ''}
${v.metrics_after ? `- After: ${v.metrics_after.timeOnSite}s avg time` : ''}
`
        )
        .join('\n');

      const response = `📋 **Color Version History**

${historyText}

You can revert to any previous version by asking "revert to version X"`;

      return {
        content: response,
        type: 'text',
      };
    } catch (error: any) {
      console.error('Error in handleColorHistory:', error);
      return {
        content: `❌ Error retrieving history: ${error.message}`,
        type: 'error',
      };
    }
  }

  /**
   * Process store owner's chat message and determine if it's color-related
   */
  async processStoreOwnerMessage(
    storeId: number,
    storeOwnerId: number,
    message: string
  ): Promise<ChatMessage | null> {
    const intent = await this.detectColorIntent(message);

    if (intent.confidence < 0.7) {
      // Not color-related, let other handlers process it
      return null;
    }

    switch (intent.type) {
      case 'color_analyze':
        return this.handleColorAnalyze(storeId, storeOwnerId);

      case 'color_recommend':
        return this.handleColorRecommend(storeId, storeOwnerId);

      case 'color_history':
        return this.handleColorHistory(storeId, storeOwnerId);

      case 'color_apply':
        return {
          content: `To apply recommended colors, please use the color recommendation feature first. Would you like me to generate color recommendations for your store?`,
          type: 'text',
        };

      case 'color_undo':
        return {
          content: `To revert to a previous color version, I need to know which version you'd like to restore. Type "show me color history" to see available versions.`,
          type: 'text',
        };

      default:
        return null;
    }
  }
}

export const storeOwnerChatHandler = new StoreOwnerChatHandler();
