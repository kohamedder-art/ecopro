import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

type PreviewSandboxProps = {
  code: string;
  templateName: string;
  storeName: string;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  heroHeading?: string;
  heroSubtitle?: string;
};

function stripTypeScript(src: string): string {
  let s = src;
  // Remove interface/type declarations
  s = s.replace(/^export\s+interface\s+\w+(\s*extends\s+[^{]+)?\s*\{[\s\S]*?\n\}/gm, '');
  s = s.replace(/^interface\s+\w+(\s*extends\s+[^{]+)?\s*\{[\s\S]*?\n\}/gm, '');
  s = s.replace(/^export\s+type\s+\w+\s*=\s*[^;]+;/gm, '');
  s = s.replace(/^type\s+\w+\s*=\s*[^;]+;/gm, '');
  // Remove type annotations from variables: const x: Type = ...
  s = s.replace(/(:\s*(?:React\.)?[A-Z]\w*(?:\s*\|[^=]+)?(?=\s*=))/g, '');
  // Remove type annotations from function params: (x: Type) =>
  s = s.replace(/(\(\s*)(\w+)\s*:\s*(?:React\.)?[A-Z]\w*(?:\s*\|[^)]+)?/g, '$1$2');
  // Remove : return type from functions
  s = s.replace(/(\))\s*:\s*(?:React\.)?[A-Z]\w*(?=\s*\{)/g, '$1');
  // Remove standalone type assertions: as Type
  s = s.replace(/\bas\s+[A-Z]\w+/g, '');
  return s;
}

export default function PreviewSandbox({
  code,
  templateName,
  storeName,
  primaryColor = '#6366F1',
  accentColor = '#818CF8',
  backgroundColor = '#FFFFFF',
  heroHeading = '',
  heroSubtitle = '',
}: PreviewSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const renderPreview = useCallback(() => {
    if (!iframeRef.current || !code) return;
    setError(null);
    setLoading(true);

    // Strip module imports
    let stripped = code
      .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
      .replace(/^import\s+type\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
      .replace(/^import\s+['"].*?['"];?\s*$/gm, '')
      .trim();

    // Strip TypeScript syntax
    stripped = stripTypeScript(stripped);

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Tajawal', 'Inter', sans-serif; overflow-x: hidden; }
    #root { min-height: 100vh; }
    .error-box { padding: 16px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; color: #991B1B; font-family: monospace; font-size: 12px; white-space: pre-wrap; direction: ltr; text-align: left; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    window.onerror = function(msg, src, line, col, err) {
      var el = document.getElementById('root');
      if (el) {
        el.innerHTML = '<div class="error-box">⚠️ Error: ' + msg + '\\nLine: ' + line + (err && err.stack ? '\\n' + err.stack : '') + '</div>';
      }
      parent.postMessage({ type: 'sandbox-error', message: String(msg) }, '*');
      return true;
    };
  </script>
  <script type="text/babel" data-presets="react">
    var _h = React.createElement;
    var _f = React.Fragment;
    var useState = React.useState, useEffect = React.useEffect, useMemo = React.useMemo, useCallback = React.useCallback, useRef = React.useRef, Fragment = React.Fragment;

    var useTemplateSkeleton = function(props) {
      var p = props.products || [];
      return {
        mainProduct: p[0] || null,
        products: p,
        filtered: props.filtered || [],
        settings: props.settings || {},
        storeSlug: props.storeSlug || 'preview',
        handleOrder: function(e) { e.preventDefault(); alert('تم الطلب!'); },
        isSubmitting: false,
        orderError: null,
        orderSuccess: false,
        setOrderSuccess: function() {},
        lastOrderId: null,
        lastTelegramUrl: null,
        customerName: '', setCustomerName: function() {},
        customerPhone: '', setCustomerPhone: function() {},
        customerAddress: '', setCustomerAddress: function() {},
        communeId: '', setCommuneId: function() {},
        customerNotes: '', setCustomerNotes: function() {},
        quantity: 1, setQuantity: function() {},
        selectedVariant: null, setSelectedVariant: function() {},
        selectedOffer: null, setSelectedOffer: function() {},
        offers: [], offersLoading: false,
        wilayas: [
          { id: 16, labelAR: 'الجزائر', homePrice: 600, deskPrice: 400 },
          { id: 31, labelAR: 'وهران', homePrice: 700, deskPrice: 500 },
          { id: 25, labelAR: 'قسنطينة', homePrice: 650, deskPrice: 450 },
        ],
        selectedWilayaId: null, setSelectedWilayaId: function() {},
        selectedWilaya: null,
        communes: [],
        selectedDeliveryType: 'home', setSelectedDeliveryType: function() {},
        showAddress: true, showCommune: true, showNotes: true,
        showHomeDelivery: true, showDeskDelivery: true,
        deliveryFee: 600,
        variantPrice: null,
        productPrice: p[0] ? p[0].price : 0,
        productTotal: p[0] ? p[0].price : 0,
        totalCost: (p[0] ? p[0].price : 0) + 600,
        currency: (props.settings || {}).currency_code || 'د.ج',
        displayPrice: function(n) { return Math.round(n); },
        goToProduct: function() {},
        goToStore: function() {},
        scrollToForm: function() {},
      };
    };

    var VariantSelector = function(props) {
      var variants = props.variants || [];
      var selected = props.selected;
      var onSelect = props.onSelect;
      if (variants.length === 0) return null;
      return _h('div', { className: 'flex flex-wrap gap-2 mb-4' },
        variants.map(function(v) {
          return _h('button', {
            key: v.id,
            onClick: function() { onSelect(v); },
            className: 'px-3 py-1.5 rounded-lg border text-sm ' +
              (selected && selected.id === v.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-400')
          }, v.variant_name || v.size || v.color);
        })
      );
    };

    var OfferSelector = function(props) {
      var offers = props.offers || [];
      var selected = props.selected;
      var onSelect = props.onSelect;
      if (offers.length === 0) return null;
      return _h('div', { className: 'flex flex-wrap gap-2 mb-4' },
        offers.map(function(o) {
          return _h('button', {
            key: o.id,
            onClick: function() { onSelect(o); },
            className: 'px-3 py-1.5 rounded-lg border text-sm ' +
              (selected && selected.id === o.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-400')
          }, o.name);
        })
      );
    };

    var OrderSuccessConnect = function(props) {
      return _h('div', { className: 'p-4 rounded-xl bg-gray-50 text-center' },
        _h('p', { className: 'text-sm text-gray-600' }, 'يمكنك التواصل معنا عبر واتساب')
      );
    };

    var getAlgeriaCommunesByWilayaId = function() { return []; };
    var communeDisplayName = function(c) { return c && c.name ? c.name : ''; };

    var _pc = ${JSON.stringify(primaryColor)};
    var _ac = ${JSON.stringify(accentColor)};
    var _bg = ${JSON.stringify(backgroundColor)};
    var _tc = '#1a1a2e';

    ${stripped}

    try {
      var _tpl = typeof ${templateName} !== 'undefined' ? ${templateName} : null;

      if (!_tpl) {
        throw new Error('Could not find component: ${templateName}');
      }

      var _props = {
        storeSlug: 'preview-store',
        products: [
          { id: 1, title: 'سماعة بلوتوث لاسلكية', price: 2500, slug: 'bluetooth-headset', stock_quantity: 99, is_featured: true, views: 120, images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'], variants: [
            { id: 1, product_id: 1, color: 'أسود', size: null, size2: null, variant_name: 'أسود', price: 2500, stock_quantity: 50, images: [], is_active: true, sort_order: 0 },
            { id: 2, product_id: 1, color: 'أبيض', size: null, size2: null, variant_name: 'أبيض', price: 2800, stock_quantity: 30, images: [], is_active: true, sort_order: 1 },
          ]},
          { id: 2, title: 'ساعة ذكية رياضية', price: 4500, slug: 'smartwatch', stock_quantity: 45, is_featured: true, views: 89, images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'], variants: [] },
          { id: 3, title: 'شاحن لاسلكي سريع', price: 1800, slug: 'wireless-charger', stock_quantity: 120, is_featured: false, views: 56, images: ['https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400'], variants: [] },
          { id: 4, title: 'نظارات شمسية أنيقة', price: 3200, slug: 'sunglasses', stock_quantity: 35, is_featured: false, views: 42, images: ['https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400'], variants: [] },
        ],
        filtered: [],
        settings: {
          store_name: ${JSON.stringify(storeName)},
          template: 'ai-generated',
          primary_color: _pc,
          secondary_color: _ac,
          template_accent_color: _ac,
          template_bg_color: _bg,
          template_hero_heading: ${JSON.stringify(heroHeading)},
          template_hero_subtitle: ${JSON.stringify(heroSubtitle)},
          template_button_text: 'تسوق الآن',
          template_font_family: 'Tajawal, sans-serif',
          currency_code: 'د.ج',
        },
        categories: [],
        searchQuery: '',
        setSearchQuery: function() {},
        categoryFilter: '',
        setCategoryFilter: function() {},
        sortOption: 'featured',
        setSortOption: function() {},
        viewMode: 'grid',
        setViewMode: function() {},
        formatPrice: function(n) { return Math.round(n).toLocaleString('ar-DZ') + ' دج'; },
        primaryColor: _pc,
        secondaryColor: _ac,
        bannerUrl: null,
        navigate: function() {},
        canManage: false,
      };

      var root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(_tpl, _props));
      parent.postMessage({ type: 'sandbox-success' }, '*');
    } catch(err) {
      document.getElementById('root').innerHTML = '<div class="error-box">⚠️ Template Error: ' + err.message + '\\n\\n' + (err.stack || '') + '</div>';
      parent.postMessage({ type: 'sandbox-error', message: err.message }, '*');
    }
  <\/script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    if (iframeRef.current) {
      iframeRef.current.src = url;
    }

    // Listen for messages from iframe
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'sandbox-error') {
        setError(e.data.message);
        setLoading(false);
      } else if (e.data?.type === 'sandbox-success') {
        setError(null);
        setLoading(false);
      }
    };
    window.addEventListener('message', onMsg);

    // Fallback timeout — if Babel takes too long or fails silently
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setLoading(false);
    }, 8000);

    return () => {
      window.removeEventListener('message', onMsg);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [code, templateName, storeName, primaryColor, accentColor, backgroundColor, heroHeading, heroSubtitle]);

  useEffect(() => {
    const cleanup = renderPreview();
    return () => { cleanup?.(); };
  }, [renderPreview]);

  return (
    <div className="relative w-full h-full bg-white">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
        </div>
      )}
      {error && (
        <div className="absolute inset-x-0 top-0 z-20 p-4 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-bold">خطأ في القالب</span>
          </div>
          <pre className="text-xs text-red-500 bg-red-50 p-3 rounded-lg overflow-auto max-h-40">{error}</pre>
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin"
        title="Store Preview"
      />
    </div>
  );
}
