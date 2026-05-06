import { useQuery } from '@tanstack/react-query';

interface AISettings {
  ai_chat_enabled: boolean;
  guardian_enabled: boolean;
  storefront_assistant: boolean;
  auto_descriptions: boolean;
  auto_pricing: boolean;
  auto_alt_text: boolean;
  image_analysis: boolean;
  analytics_narration: boolean;
  inventory_forecast: boolean;
  order_suggestions: boolean;
  order_priority: boolean;
  churn_warning: boolean;
  reply_suggestions: boolean;
  broadcast_composer: boolean;
  omni_intelligence: boolean;
  action_order_status: boolean;
  action_create_product: boolean;
  action_edit_product: boolean;
  action_delete_product: boolean;
  action_store_design: boolean;
  action_bot_control: boolean;
  ai_reply_telegram: boolean;
  ai_reply_messenger: boolean;
  ai_reply_instagram: boolean;
  ai_reply_whatsapp: boolean;
  ai_reply_viber: boolean;
  ai_instructions: string;
}

const DEFAULT: AISettings = {
  ai_chat_enabled: true,
  guardian_enabled: true,
  storefront_assistant: true,
  auto_descriptions: false,
  auto_pricing: false,
  auto_alt_text: false,
  image_analysis: true,
  analytics_narration: true,
  inventory_forecast: true,
  order_suggestions: true,
  order_priority: true,
  churn_warning: true,
  reply_suggestions: true,
  broadcast_composer: true,
  omni_intelligence: true,
  action_order_status: true,
  action_create_product: true,
  action_edit_product: true,
  action_delete_product: true,
  action_store_design: true,
  action_bot_control: true,
  ai_reply_telegram: true,
  ai_reply_messenger: true,
  ai_reply_instagram: true,
  ai_reply_whatsapp: true,
  ai_reply_viber: true,
  ai_instructions: '',
};

export function useAISettings() {
  return useQuery({
    queryKey: ['aiSettings'],
    queryFn: async () => {
      const res = await fetch('/api/ai-settings', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load AI settings');
      const data = await res.json();
      return { ...DEFAULT, ...data } as AISettings;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
