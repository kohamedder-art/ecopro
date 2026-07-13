import { Router, Request, Response } from 'express';
import { generateTemplateCode } from '../services/template-generator';
import { verifyToken } from '../utils/auth';
import { pool } from '../utils/database';

const router = Router();

function extractUser(req: Request): any | null {
  try {
    const token = req.cookies?.ecopro_at;
    if (!token) return null;
    return verifyToken(token) as any;
  } catch {
    return null;
  }
}

/**
 * POST /api/ai/template-generate
 * Generate store configuration from a description
 * Body: { description: string }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const { description, currentSettings } = req.body;
    if (!description) return res.status(400).json({ error: 'description is required' });

    const { answer, template } = await generateTemplateCode(user.id || user.clientId, description, [], currentSettings);

    if (!template) {
      return res.json({ answer, template: null });
    }

    return res.json({
      answer,
      template: {
        templateId: template.templateId,
        storeName: template.storeName,
        description: template.description,
        settings: template.settings,
      },
    });
  } catch (err) {
    console.error('[TemplateGenerate] Error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/ai/template-generate/apply
 * Apply the AI-configured template to the store
 * Body: { settings: {...}, storeName: string, template: string }
 */
router.post('/apply', async (req: Request, res: Response) => {
  try {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const { settings, storeName, template } = req.body;
    if (!settings) return res.status(400).json({ error: 'settings is required' });

    const clientId = user.id || user.clientId;

    // Update store settings
    await pool.query(
      `UPDATE client_stores SET
        store_name = COALESCE($1, store_name),
        template = COALESCE($2, template),
        settings = jsonb_set(
          COALESCE(settings, '{}'::jsonb),
          '{primary_color}',
          to_jsonb(COALESCE($3, '#6366F1'))
        )
       WHERE id = $4`,
      [
        storeName || null,
        template || 'zenith',
        settings.primary_color || '#6366F1',
        clientId,
      ]
    );

    // Also set accent and bg colors
    if (settings.template_accent_color) {
      await pool.query(
        `UPDATE client_stores SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{template_accent_color}', to_jsonb($1)) WHERE id = $2`,
        [settings.template_accent_color, clientId]
      );
    }
    if (settings.template_bg_color) {
      await pool.query(
        `UPDATE client_stores SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{template_bg_color}', to_jsonb($1)) WHERE id = $2`,
        [settings.template_bg_color, clientId]
      );
    }
    if (settings.template_hero_heading) {
      await pool.query(
        `UPDATE client_stores SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{template_hero_heading}', to_jsonb($1)) WHERE id = $2`,
        [settings.template_hero_heading, clientId]
      );
    }
    if (settings.template_hero_subtitle) {
      await pool.query(
        `UPDATE client_stores SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{template_hero_subtitle}', to_jsonb($1)) WHERE id = $2`,
        [settings.template_hero_subtitle, clientId]
      );
    }
    if (settings.template_button_text) {
      await pool.query(
        `UPDATE client_stores SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{template_button_text}', to_jsonb($1)) WHERE id = $2`,
        [settings.template_button_text, clientId]
      );
    }

    return res.json({ success: true, message: 'تم تطبيق التصميم بنجاح!' });
  } catch (err) {
    console.error('[TemplateGenerate/apply] Error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/ai/template-generate/list
 * List generated configurations
 */
router.get('/list', async (_req: Request, res: Response) => {
  return res.json({ templates: [] });
});

export default router;
