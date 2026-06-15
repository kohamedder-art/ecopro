import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Truck, Key, CheckCircle2, X, ExternalLink, Zap, Wifi, WifiOff, Settings2, Star, Loader2, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { DELIVERY_LOGO_FALLBACK_SRC, getDeliveryCompanyLogoSrc } from "@/lib/deliveryLogos";
import { DeliveryCompanyLogo } from "@/components/delivery/DeliveryCompanyLogo";

interface DeliveryCompany {
  id: string;
  name: string;
  logo: string;
  description: string;
  descriptionKey?: string;
  apiFields: {
    label: string;
    placeholder: string;
    field: string;
    type?: string;
  }[];
  enabled: boolean;
  credentials?: Record<string, string>;
  // API availability info
  hasApi: boolean;
  features: {
    createShipment: boolean;
    tracking: boolean;
    labels: boolean;
    cod: boolean;
    webhooks: boolean;
  };
  docsUrl?: string;
  apiRating: number; // 1-5 stars
}

const LOGO_FALLBACK_SRC = DELIVERY_LOGO_FALLBACK_SRC;

function toCompanyLookupKey(name: string): string {
  return String(name || '')
    .trim()
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export default function DeliveryCompanies() {
  const { t } = useTranslation();
  const [selectedCompany, setSelectedCompany] = useState<DeliveryCompany | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [companyIdByName, setCompanyIdByName] = useState<Record<string, number>>({});
  const [integrationMetaByCompanyId, setIntegrationMetaByCompanyId] = useState<
    Record<number, { is_enabled: boolean; has_api_key: boolean; has_api_secret: boolean; updated_at?: string; configured_at?: string }>
  >({});
  const [webhookState, setWebhookState] = useState<{
    loading: boolean;
    result?: { success: boolean; supported: boolean; registered: boolean; webhookUrl: string; message: string };
  }>({ loading: false });

  // Only allow providers with working integrations to be configured.
  const isComingSoon = (company: DeliveryCompany) => {
    const openIds = ['dolivroo', 'zr-express', 'noest', 'anderson', 'zimou-express', 'dhd', 'ecotrack', 'ecom-delivery', 'elogistia', 'mdm-express', 'maystro'];
    return !openIds.includes(company.id);
  };
  
  // ========================================
  // REAL ALGERIAN DELIVERY COMPANIES WITH APIs
  // Based on research: Only companies with verified public APIs
  // ========================================
  // List of company IDs that should appear first (working ones)
  // Order here is authoritative for the UI — keeps MDM before Maystro.
  const workingCompanyOrder = ['dolivroo', 'zr-express', 'noest', 'anderson', 'zimou-express', 'dhd', 'ecotrack', 'ecom-delivery', 'elogistia', 'mdm-express', 'maystro'];

  const [companies, setCompanies] = useState<DeliveryCompany[]>(() => [
    // ⭐ TIER 1: Best API - Yalidine (Most documented, npm packages available)
    {
      id: "yalidine",
      name: "Yalidine Express",
      logo: getDeliveryCompanyLogoSrc("Yalidine Express"),
      description: "#1 delivery in Algeria - Full REST API with npm SDK. Covers all 58 wilayas.",
      descriptionKey: "delivery.desc.yalidine",
      apiFields: [
        { label: "API Token", placeholder: "Your Yalidine API Token", field: "apiToken" },
        { label: "API ID", placeholder: "Your API ID", field: "apiId" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: true, tracking: true, labels: true, cod: true, webhooks: true },
      docsUrl: "https://yalidine.app/app/dev/docs/api/",
      apiRating: 5,
    },
    // ⭐ TIER 1: Guepex - Similar API structure to Yalidine
    {
      id: "guepex",
      name: "Guepex",
      logo: getDeliveryCompanyLogoSrc("Guepex"),
      description: "160+ bureaus across 58 wilayas. Express (24h) & Economic (48h) delivery.",
      descriptionKey: "delivery.desc.guepex",
      apiFields: [
        { label: "API Token", placeholder: "Your Guepex API Token", field: "apiToken" },
        { label: "API Key", placeholder: "Your API Key", field: "apiKey" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: true, tracking: true, labels: true, cod: true, webhooks: true },
      docsUrl: "https://guepex.app/app/dev/docs/",
      apiRating: 4,
    },
    // ⭐ TIER 2: ZR Express - Official API
    {
      id: "zr-express",
      name: "ZR Express",
      logo: getDeliveryCompanyLogoSrc("ZR Express"),
      description: "Official ZR Express API. Requires Secret Key + Tenant ID for full parcel management.",
      descriptionKey: "delivery.desc.zrexpress",
      apiFields: [
        { label: "Secret Key", placeholder: "Your ZR Express Secret Key", field: "secretKey" },
        { label: "Tenant ID", placeholder: "Your Tenant ID (X-Tenant)", field: "tenantId" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: true, tracking: true, labels: false, cod: true, webhooks: true },
      docsUrl: "https://docs.zrexpress.app/reference",
      apiRating: 4,
    },
    // ⭐ TIER 2: Ecotrack - Logistics platform + Aggregator
    {
      id: "ecotrack",
      name: "Ecotrack",
      logo: getDeliveryCompanyLogoSrc("Ecotrack"),
      description: "API officielle Ecotrack. Création de commandes, suivi en temps réel, retours et liste des wilayas actives.",
      descriptionKey: "delivery.desc.ecotrack",
      apiFields: [
        { label: "API Token", placeholder: "Votre token Ecotrack (Bearer)", field: "apiToken" },
        { label: "API URL", placeholder: "https://mono2.ecotrack.dz/api/v1", field: "apiUrl" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: true, tracking: true, labels: false, cod: true, webhooks: false },
      docsUrl: "https://ecotrack.dz",
      apiRating: 4,
    },
    // ⭐ TIER 2: Maystro Delivery
    {
      id: "maystro",
      name: "Maystro Delivery",
      logo: getDeliveryCompanyLogoSrc("Maystro Delivery"),
      description: "3K+ stores, 600+ drivers. Warehousing, packaging & call center included.",
      descriptionKey: "delivery.desc.maystro",
      apiFields: [
        { label: "API Token", placeholder: "Your Maystro API Token", field: "apiToken" },
        { label: "Store ID", placeholder: "Your Store ID", field: "storeId" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: true, tracking: true, labels: false, cod: true, webhooks: false },
      docsUrl: "https://beta.maystro-delivery.com",
      apiRating: 3,
    },
    // 🔗 AGGREGATOR: Dolivroo - Unified API for all providers
    {
      id: "dolivroo",
      name: "Dolivroo",
      logo: getDeliveryCompanyLogoSrc("Dolivroo"),
      description: "Unified delivery API for Yalidine, ZR Express, Ecotrack and Maystro through one integration.",
      descriptionKey: "delivery.desc.dolivroo",
      apiFields: [
        { label: "API Key", placeholder: "dol_live_sk_...", field: "apiKey" },
        { label: "Connection Label (optional)", placeholder: "primary or client_store_1", field: "connectionLabel" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: true, tracking: true, labels: true, cod: true, webhooks: true },
      docsUrl: "https://dolivroo.com",
      apiRating: 5,
    },

    // 🧾 LABEL-READY (Manual): Noest
    {
      id: "noest",
      name: "Noest",
      logo: getDeliveryCompanyLogoSrc("Noest"),
      description: "Noest uses an Ecotrack-powered API. Use your Noest Token + GUID to create shipments and generate labels.",
      descriptionKey: "delivery.desc.noest",
      apiFields: [
        { label: "API Token", placeholder: "Your Noest API Token", field: "apiToken" },
        { label: "GUID", placeholder: "Your Noest GUID", field: "apiKey" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: true, tracking: true, labels: true, cod: true, webhooks: false },
      apiRating: 2,
    },
    // ⭐ TIER 2: Zimou Express
    {
      id: "zimou-express",
      name: "Zimou Express",
      logo: getDeliveryCompanyLogoSrc("Zimou Express"),
      description: "Fast delivery across Algeria. Express & standard shipping options.",
      descriptionKey: "delivery.desc.zimou",
      apiFields: [
        { label: "API Token", placeholder: "Your Zimou API Token (Bearer)", field: "apiToken" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: true, tracking: true, labels: false, cod: true, webhooks: true },
      docsUrl: "https://zimou.express/docs",
      apiRating: 3,
    },
    // ⭐ TIER 2: Anderson Ecommerce (Ecotrack platform)
    {
      id: "anderson",
      name: "Anderson Ecommerce",
      logo: getDeliveryCompanyLogoSrc("Anderson Ecommerce"),
      description: "Ecotrack-powered delivery. Full API for shipments, tracking & labels.",
      descriptionKey: "delivery.desc.anderson",
      apiFields: [
        { label: "API Token", placeholder: "Your Anderson API Token", field: "apiToken" },
        { label: "Account ID", placeholder: "Your Account ID (optional)", field: "accountId" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: true, tracking: true, labels: true, cod: true, webhooks: false },
      docsUrl: "https://anderson-ecommerce.ecotrack.dz",
      apiRating: 4,
    },

    // ============================
    // COMING SOON: Listed providers (no verified integration yet)
    // ============================
    {
      id: "dhd",
      name: "DHD Livraison",
      logo: getDeliveryCompanyLogoSrc("DHD"),
      description: "DHD Livraison Express — 55 wilayas across Algeria. COD, tracking & labels via Ecotrack platform.",
      descriptionKey: "delivery.desc.dhd",
      apiFields: [
        { label: "API Token", placeholder: "Your DHD API Token", field: "apiToken" },
        { label: "GUID", placeholder: "Your DHD User GUID", field: "apiKey" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: true, tracking: true, labels: true, cod: true, webhooks: false },
      docsUrl: "https://dhd-dz.com",
      apiRating: 3,
    },
    {
      id: "ecom-delivery",
      name: "Ecom Delivery",
      logo: getDeliveryCompanyLogoSrc("Ecom Delivery"),
      description: "Ecom Delivery — 58 wilayas. COD, tracking & labels.",
      descriptionKey: "delivery.desc.ecom",
      apiFields: [
        { label: "API Key", placeholder: "Your Ecom Delivery API Key", field: "apiKey" },
        { label: "API Token", placeholder: "Your Ecom Delivery Token", field: "apiToken" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: true, tracking: true, labels: true, cod: true, webhooks: false },
      docsUrl: "https://ecom-dz.net",
      apiRating: 3,
    },
    {
      id: "procolis",
      name: "ProColis",
      logo: getDeliveryCompanyLogoSrc("ProColis"),
      description: "ProColis account integration (manual assignment-ready).",
      descriptionKey: "delivery.desc.procolis",
      apiFields: [
        { label: "API Key / Client Code", placeholder: "Your ProColis API Key (or client code)", field: "apiKey" },
        { label: "API Secret (optional)", placeholder: "Optional secret", field: "apiId" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: false, tracking: false, labels: false, cod: false, webhooks: false },
      apiRating: 1,
    },
    {
      id: "elogistia",
      name: "Elogistia",
      logo: getDeliveryCompanyLogoSrc("Elogistia"),
      description: "Elogistia delivery integration with automatic shipment creation and tracking.",
      descriptionKey: "delivery.desc.elogistia",
      apiFields: [
        { label: "API Key", placeholder: "Your Elogistia API key", field: "apiKey" },
      ],
      enabled: true,
      hasApi: true,
      features: { createShipment: true, tracking: true, labels: false, cod: true, webhooks: false },
      apiRating: 3,
    },
    {
      id: "colivraison-express",
      name: "Colivraison Express",
      logo: getDeliveryCompanyLogoSrc("Colivraison Express"),
      description: "Colivraison Express integration (manual assignment-ready).",
      descriptionKey: "delivery.desc.colivraison",
      apiFields: [
        { label: "Account Code", placeholder: "Your account/client code", field: "apiKey" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: false, tracking: false, labels: false, cod: false, webhooks: false },
      apiRating: 1,
    },
    {
      id: "mdm-express",
      name: "MDM Express",
      logo: getDeliveryCompanyLogoSrc("MDM Express"),
      description: "MDM Express — Full REST API. Create shipments, track orders, COD support.",
      descriptionKey: "delivery.desc.mdm",
      apiFields: [
        { label: "API Key", placeholder: "Your MDM x-api-key", field: "apiToken" },
        { label: "Store ID", placeholder: "e.g. STR-CB25F3", field: "storeId" },
        { label: "Product Tracking ID", placeholder: "e.g. PRD-XXXXX", field: "productId" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: true, tracking: true, labels: false, cod: true, webhooks: false },
      docsUrl: "https://api.mdm.express",
      apiRating: 3,
    },
    {
      id: "yalitec",
      name: "Yalitec",
      logo: getDeliveryCompanyLogoSrc("Yalitec"),
      description: "Yalitec integration (manual assignment-ready).",
      descriptionKey: "delivery.desc.yalitec",
      apiFields: [
        { label: "Account Code", placeholder: "Your account/client code", field: "apiKey" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: false, tracking: false, labels: false, cod: false, webhooks: false },
      apiRating: 1,
    },
    {
      id: "mylerz-algerie",
      name: "Mylerz Algérie",
      logo: getDeliveryCompanyLogoSrc("Mylerz Algérie"),
      description: "Mylerz Algérie integration (manual assignment-ready).",
      descriptionKey: "delivery.desc.mylerz",
      apiFields: [
        { label: "Account Code", placeholder: "Your account/client code", field: "apiKey" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: false, tracking: false, labels: false, cod: false, webhooks: false },
      apiRating: 1,
    },
    {
      id: "flash-delivery",
      name: "Flash Delivery",
      logo: getDeliveryCompanyLogoSrc("Flash Delivery"),
      description: "Flash Delivery integration (manual assignment-ready).",
      descriptionKey: "delivery.desc.flash",
      apiFields: [
        { label: "Account Code", placeholder: "Your account/client code", field: "apiKey" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: false, tracking: false, labels: false, cod: false, webhooks: false },
      apiRating: 1,
    },
  ]);

  // Sort companies so working ones come first, following the explicit order
  // defined in `workingCompanyOrder` (preserves desired ordering like MDM → Maystro).
  const sortedCompanies: DeliveryCompany[] = [
    ...workingCompanyOrder.map((id) => companies.find((c) => c.id === id)).filter(Boolean) as DeliveryCompany[],
    ...companies.filter((c) => !workingCompanyOrder.includes(c.id)),
  ];

  useEffect(() => {
    // Fetch DB-backed delivery company IDs so we can save integrations.
    (async () => {
      try {
        const res = await fetch('/api/delivery/companies');
        if (!res.ok) return;
        const data = await res.json();
        const map: Record<string, number> = {};
        for (const c of Array.isArray(data) ? data : []) {
          const key = toCompanyLookupKey(String(c?.name || ''));
          const id = Number(c?.id);
          if (key && Number.isFinite(id)) map[key] = id;
        }
        setCompanyIdByName(map);

        // Load configured integrations (no secrets) so enabled state persists after refresh.
        const integRes = await fetch('/api/delivery/integrations');
        if (integRes.ok) {
          const integrations = await integRes.json().catch(() => []);
          const enabledIds = new Set<number>();
          const meta: Record<
            number,
            { is_enabled: boolean; has_api_key: boolean; has_api_secret: boolean; updated_at?: string; configured_at?: string }
          > = {};
          for (const row of Array.isArray(integrations) ? integrations : []) {
            const idNum = Number(row?.delivery_company_id);
            if (!Number.isFinite(idNum)) continue;
            const isEnabled = Boolean(row?.is_enabled);
            if (isEnabled) enabledIds.add(idNum);
            meta[idNum] = {
              is_enabled: isEnabled,
              has_api_key: Boolean(row?.has_api_key),
              has_api_secret: Boolean(row?.has_api_secret),
              updated_at: row?.updated_at,
              configured_at: row?.configured_at,
            };
          }

          setIntegrationMetaByCompanyId(meta);

          setCompanies((prev) =>
            prev.map((company) => {
              const dbId = map[toCompanyLookupKey(String(company.name || ''))];
              if (!dbId) return company;
              return enabledIds.has(dbId) ? { ...company, enabled: true } : { ...company, enabled: false };
            })
          );
        }
      } catch {
        // Silent; page can still render, but saving integrations may fail.
      }
    })();
  }, []);

  const isPrimaryCredentialField = (company: DeliveryCompany | null, fieldName: string) => {
    if (!company) return false;

    const primaryFieldByCompanyId: Record<string, string> = {
      yalidine: 'apiToken',
      guepex: 'apiToken',
      'zr-express': 'secretKey',
      ecotrack: 'apiToken',
      maystro: 'apiToken',
      dolivroo: 'apiKey',
      noest: 'apiToken',
      'zimou-express': 'apiToken',
      anderson: 'apiToken',
      dhd: 'apiToken',
      'mdm-express': 'apiToken',
    };

    return primaryFieldByCompanyId[company.id] === fieldName;
  };

  const handleCardClick = (company: DeliveryCompany) => {
    setSelectedCompany(company);
    setCredentials({});
    setTestResult(null);
    if (!isComingSoon(company)) {
      setShowConfigDialog(true);
    } else {
      setShowConfigDialog(false);
    }
  };

  const handleTestCredentials = async () => {
    if (!selectedCompany) return;
    setTesting(true);
    setTestResult(null);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const { apiKey, apiSecret } = (() => {
        const id = selectedCompany.id;
        if (id === 'yalidine') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: (credentials.apiId || '').trim() || undefined };
        if (id === 'guepex') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: (credentials.apiKey || '').trim() || undefined };
        if (id === 'zr-express') return { apiKey: (credentials.secretKey || '').trim(), apiSecret: (credentials.tenantId || '').trim() || undefined };
        if (id === 'ecotrack') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: (credentials.apiUrl || '').trim() || undefined };
        if (id === 'maystro') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: (credentials.storeId || '').trim() || undefined };
        if (id === 'dolivroo') return { apiKey: (credentials.apiKey || '').trim(), apiSecret: (credentials.connectionLabel || '').trim() || undefined };
        if (id === 'noest') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: (credentials.apiKey || '').trim() || undefined };
        if (id === 'zimou-express') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: undefined };
        if (id === 'anderson') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: (credentials.accountId || '').trim() || undefined };
        if (id === 'dhd') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: (credentials.apiKey || '').trim() || undefined };
        if (id === 'ecom-delivery') return { apiKey: (credentials.apiKey || '').trim(), apiSecret: (credentials.apiToken || '').trim() || undefined };
        if (id === 'mdm-express') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: (credentials.productId || '').trim() || undefined, merchantId: (credentials.storeId || '').trim() || undefined };
        return { apiKey: (credentials.apiToken || credentials.apiKey || '').trim(), apiSecret: undefined };
      })();
      if (!apiKey) {
        setTestResult({ success: false, message: 'Please enter your API credentials first' });
        return;
      }
      const res = await fetch('/api/delivery/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_company_name: selectedCompany.name, api_key: apiKey, api_secret: apiSecret }),
      });
      const data = await res.json();
      setTestResult({ success: Boolean(data.success), message: data.message || (data.success ? 'Connection successful' : 'Connection failed') });
    } catch (e: any) {
      setTestResult({ success: false, message: e?.message || 'Failed to test connection' });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!selectedCompany) return;

    setSaveError(null);
    setSaveSuccess(null);
    setSaving(true);
    setWebhookState({ loading: false });

    try {
      const dbId = companyIdByName[toCompanyLookupKey(String(selectedCompany.name || ''))];
      if (!dbId) {
        throw new Error('Delivery company not found on server. Make sure migrations are applied and the company exists.');
      }

      const existing = integrationMetaByCompanyId[dbId];

      const { apiKey, apiSecret, merchantId } = (() => {
        const id = selectedCompany.id;
        if (id === 'yalidine') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: (credentials.apiId || '').trim() || undefined };
        if (id === 'guepex') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: (credentials.apiKey || '').trim() || undefined };
        if (id === 'zr-express') return { apiKey: (credentials.secretKey || '').trim(), apiSecret: (credentials.tenantId || '').trim() || undefined };
        if (id === 'ecotrack') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: undefined, merchantId: (credentials.apiUrl || '').trim() || undefined };
        if (id === 'maystro') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: (credentials.storeId || '').trim() || undefined };
        if (id === 'dolivroo') return { apiKey: (credentials.apiKey || '').trim(), apiSecret: (credentials.connectionLabel || '').trim() || undefined };
        if (id === 'noest') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: (credentials.apiKey || '').trim() || undefined };
        if (id === 'zimou-express') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: undefined };
        if (id === 'anderson') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: (credentials.accountId || '').trim() || undefined };
        if (id === 'dhd') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: (credentials.apiKey || '').trim() || undefined };
        if (id === 'ecom-delivery') return { apiKey: (credentials.apiKey || '').trim(), apiSecret: (credentials.apiToken || '').trim() || undefined };
        if (id === 'mdm-express') return { apiKey: (credentials.apiToken || '').trim(), apiSecret: (credentials.productId || '').trim() || undefined, merchantId: (credentials.storeId || '').trim() || undefined };
        const primary = (credentials.apiToken || credentials.apiKey || '').trim();
        const secondary = (credentials.apiId || credentials.accountId || credentials.storeId || credentials.secretKey || '').trim() || undefined;
        return { apiKey: primary, apiSecret: secondary, merchantId: undefined };
      })();

      if (!apiKey) {
        if (existing?.is_enabled && existing?.has_api_key) {
          setSaveSuccess('Already connected (credentials are saved and hidden).');
          setShowConfigDialog(false);
          return;
        }
        throw new Error('API Token is required');
      }

      const isNoest = selectedCompany.id === 'noest' || selectedCompany.name.trim().toLowerCase() === 'noest';
      const isDhd = selectedCompany.id === 'dhd' || selectedCompany.name.trim().toLowerCase().includes('dhd');
      const isMdm = selectedCompany.id === 'mdm-express' || selectedCompany.name.trim().toLowerCase().includes('mdm');
      if ((isNoest || isDhd) && !apiSecret) {
        if (!(existing?.is_enabled && existing?.has_api_secret)) throw new Error('GUID is required');
      }
      if (isMdm && !apiSecret) {
        if (!(existing?.is_enabled && existing?.has_api_secret)) throw new Error('MDM Product Tracking ID is required');
      }

      // ── Step 1: Test credentials against the courier API ──
      if (!testResult?.success || testResult?.message?.includes('Already connected')) {
        setSaving(true);
        const testRes = await fetch('/api/delivery/integrations/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delivery_company_name: selectedCompany.name, api_key: apiKey, api_secret: apiSecret }),
        });
        const testBody = await testRes.json().catch(() => ({}));
        if (!testBody.success) {
          setTestResult({ success: false, message: testBody.message || 'Credentials are invalid' });
          throw new Error(testBody.message || 'Invalid credentials — please check your API key and try again');
        }
        setTestResult({ success: true, message: testBody.message || 'Connection successful' });
      }

      // ── Step 2: Save valid credentials ──
      const res = await fetch('/api/delivery/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_company_id: dbId,
          api_key: apiKey,
          api_secret: apiSecret || undefined,
          merchant_id: merchantId || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to save integration');
      }

      setCompanies(companies.map(company => 
        company.id === selectedCompany.id 
          ? { ...company, enabled: true, credentials } 
          : company
      ));
      setSelectedCompany({ ...selectedCompany, enabled: true, credentials });
      setIntegrationMetaByCompanyId((prev) => ({
        ...prev,
        [dbId]: {
          is_enabled: true,
          has_api_key: true,
          has_api_secret: Boolean(apiSecret || prev?.[dbId]?.has_api_secret),
          updated_at: new Date().toISOString(),
        },
      }));
      setSaveSuccess('تم الحفظ بنجاح');

      // ── Step 3: Try to register webhook ──
      const integrationId = data.integration_id;
      if (integrationId && selectedCompany.features.webhooks) {
        setWebhookState({ loading: true });
        try {
          const whRes = await fetch(`/api/delivery/integrations/${integrationId}/register-webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const whBody = await whRes.json().catch(() => ({}));
          setWebhookState({ loading: false, result: whBody });
        } catch {
          setWebhookState({ loading: false, result: { success: false, supported: false, registered: false, webhookUrl: '', message: 'فشل الاتصال بالخادم' } });
        }
      }
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async (companyId: string) => {
    try {
      await fetch(`/api/delivery/integrations/${companyId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (e) {
      console.error('Failed to delete integration:', e);
    }
    setCompanies(companies.map(company => 
      company.id === companyId 
        ? { ...company, enabled: false, credentials: {} } 
        : company
    ));
  };

  const selectedCompanyDbId = selectedCompany
    ? companyIdByName[toCompanyLookupKey(String(selectedCompany.name || ''))]
    : undefined;

  const selectedIntegrationMeta =
    selectedCompanyDbId && Number.isFinite(selectedCompanyDbId)
      ? integrationMetaByCompanyId[selectedCompanyDbId]
      : undefined;

  const canConnectSelectedCompany =
    Boolean(selectedCompany?.hasApi) && (selectedCompany?.apiFields?.length || 0) > 0;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 px-5 py-4 shadow-xl shadow-slate-900/20 dark:from-slate-900 dark:via-slate-800 dark:to-black">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMS41IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDYpIi8+PC9zdmc+')] opacity-50" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/15">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight">{t('delivery.title')}</h1>
              <p className="text-xs text-slate-300 mt-0.5">{t('delivery.subtitle')}</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-white">
                {sortedCompanies.filter(c => { const id = companyIdByName[toCompanyLookupKey(c.name)]; return c.enabled || Boolean(id && integrationMetaByCompanyId[id]?.is_enabled); }).length} {t('delivery.connected')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sortedCompanies.map((company) => {
          const dbId = companyIdByName[toCompanyLookupKey(String(company.name || ''))];
          const meta = dbId ? integrationMetaByCompanyId[dbId] : undefined;
          const isConnected = company.enabled || Boolean(meta?.is_enabled && meta?.has_api_key);
          const comingSoon = isComingSoon(company);
          const desc = company.descriptionKey ? (t(company.descriptionKey) || company.description) : company.description;
          return (
            <div
              key={company.id}
              onClick={() => handleCardClick(company)}
              className={`group relative rounded-xl overflow-hidden transition-all duration-200 ${
                comingSoon
                  ? 'cursor-not-allowed opacity-50 bg-gray-50 dark:bg-gray-900/40 border border-gray-200/60 dark:border-gray-700/40'
                  : isConnected
                    ? 'cursor-pointer bg-white dark:bg-gray-900 border border-emerald-300 dark:border-emerald-600 shadow-sm shadow-emerald-500/5 hover:shadow-md hover:-translate-y-0.5'
                    : 'cursor-pointer bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              {/* top accent bar */}
              <div className={`h-1 w-full ${
                isConnected
                  ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                  : comingSoon
                    ? 'bg-gray-200 dark:bg-gray-700'
                    : 'bg-gradient-to-r from-primary/60 to-accent/60'
              }`} />

              <div className="p-3.5 space-y-2.5">
                {/* Logo + name row */}
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden border flex-shrink-0 transition-colors ${
                    isConnected
                      ? 'border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 group-hover:border-primary/30'
                  }`}>
                    {company.logo.startsWith('/') ? (
                      <DeliveryCompanyLogo name={company.name} alt={company.name} className="w-full h-full object-contain p-1" />
                    ) : (
                      <Truck className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">{company.name}</h3>
                      {isConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" />}
                    </div>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-3 h-3 ${ s <= company.apiRating ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 dark:fill-gray-700 text-gray-200 dark:text-gray-700'}`} />
                      ))}
                    </div>
                  </div>
                  {comingSoon && (
                    <Badge variant="secondary" className="text-[10px] font-semibold px-1.5 py-0">{t('delivery.comingSoon')}</Badge>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{desc}</p>

                {/* Feature chips */}
                <div className="flex flex-wrap gap-1">
                  {company.features.createShipment && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">{t('delivery.shipments')}</span>}
                  {company.features.tracking && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/40">{t('delivery.tracking')}</span>}
                  {company.features.labels && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-800/40">{t('delivery.labels')}</span>}
                  {company.features.cod && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">{t('delivery.cod')}</span>}
                  {company.features.webhooks && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">{t('delivery.webhooks')}</span>}
                </div>

                {/* Status footer */}
                <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                  isConnected
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400'
                    : comingSoon
                      ? 'bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 text-gray-400 dark:text-gray-500'
                      : 'bg-primary/5 dark:bg-primary/10 border border-primary/20 text-primary'
                }`}>
                  {isConnected ? (
                    <>
                      <Wifi className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{t('delivery.connected')}</span>
                      {meta?.updated_at && (
                        <span className="text-[10px] font-normal text-emerald-500/60 ms-auto">{new Date(meta.updated_at).toLocaleDateString()}</span>
                      )}
                      <Settings2 className="w-3 h-3 text-emerald-500/40 ms-auto" />
                    </>
                  ) : comingSoon ? (
                    <>
                      <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{t('delivery.comingSoon')}</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50 flex-shrink-0" />
                      <span>{t('delivery.clickToConfigure')}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={(open) => { setShowConfigDialog(open); if (!open) { setTestResult(null); setSaveError(null); setSaveSuccess(null); } }}>
        <DialogContent className="max-w-lg border-0 shadow-2xl p-0 gap-0 overflow-hidden rounded-2xl">
          {/* ── Hero Header ── */}
          <div className="relative overflow-hidden min-w-0 w-full">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.15),transparent_50%)]" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTUiIGN5PSIxNSIgcj0iMSIgZmlsbD0icmdiYSwyNTUsMjU1LDU1KSIvPjwvc3ZnPg==')] opacity-40" />
            <div className="relative px-7 pt-6 pb-5">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-2xl flex-shrink-0">
                  {selectedCompany?.logo.startsWith('/') ? (
                    <DeliveryCompanyLogo name={selectedCompany?.name} alt={selectedCompany?.name} className="w-full h-full object-contain p-2" />
                  ) : (
                    <Truck className="w-8 h-8 text-white/80" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 mb-1">
                    <DialogTitle className="text-xl font-black text-white tracking-tight">
                      {selectedCompany?.name}
                    </DialogTitle>
                    {selectedCompany?.id === 'dolivroo' && (
                      <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[10px] font-black px-2 py-0.5 rounded-full backdrop-blur-sm">{t('delivery.aggregator')}</span>
                    )}
                  </div>
                  <DialogDescription className="text-sm text-slate-400 leading-relaxed line-clamp-2">
                    {selectedCompany?.description}
                  </DialogDescription>
                  <div className="flex items-center gap-1.5 mt-2.5">
                    <div className="flex items-center gap-0.5 bg-amber-500/15 border border-amber-400/20 rounded-full px-2 py-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-3 h-3 ${ s <= (selectedCompany?.apiRating || 0) ? 'fill-amber-400 text-amber-400' : 'fill-slate-600 text-slate-600'}`} />
                      ))}
                    </div>
                    <span className="text-[11px] font-medium text-slate-500">{t('delivery.apiQuality')}</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Bottom edge decoration */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          <div className="space-y-5 px-7 py-6 max-h-[58vh] overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-950 min-w-0 w-full">
            {/* Coming soon */}
            {selectedCompany && !canConnectSelectedCompany && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-8 text-center border border-gray-100 dark:border-gray-800">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                  <WifiOff className="w-7 h-7 text-gray-400" />
                </div>
                <p className="text-base font-black text-gray-900 dark:text-white mb-1">{t('delivery.comingSoon')}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('delivery.comingSoonDesc')}</p>
              </div>
            )}

            {/* ── Step Progress ── */}
            {canConnectSelectedCompany && (
              <div className="flex items-center gap-0">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
                    testResult?.success
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                      : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  }`}>
                    {testResult?.success ? <CheckCircle2 className="w-4 h-4" /> : '1'}
                  </div>
                  <span className={`text-xs font-bold ${testResult?.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                    إدخال البيانات
                  </span>
                </div>
                <div className={`flex-1 h-0.5 mx-3 rounded-full transition-all duration-500 ${testResult?.success ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-800'}`} />
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
                    testResult?.success
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                      : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                  }`}>
                    {testResult?.success ? <CheckCircle2 className="w-4 h-4" /> : '2'}
                  </div>
                  <span className={`text-xs font-bold ${testResult?.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-600'}`}>
                    {testResult?.success ? 'تم التحقق' : 'التفعيل'}
                  </span>
                </div>
              </div>
            )}

            {/* ── Credential Fields ── */}
            {canConnectSelectedCompany && selectedCompany?.apiFields.map((field) => {
              const isPrimaryField = isPrimaryCredentialField(selectedCompany, field.field);
              const isSavedHidden =
                Boolean(selectedCompany?.enabled) &&
                Boolean(selectedIntegrationMeta) &&
                (isPrimaryField ? Boolean(selectedIntegrationMeta?.has_api_key) : Boolean(selectedIntegrationMeta?.has_api_secret));
              const currentValue = credentials[field.field] || '';
              const placeholder = isSavedHidden && !currentValue ? t('delivery.savedHidden') : field.placeholder;

              const arabicLabels: Record<string, string> = {
                apiToken: 'رمز API',
                apiId: 'معرف API',
                apiKey: 'مفتاح API',
                secretKey: 'المفتاح السري',
                tenantId: 'معرف المستأجر',
                storeId: 'معرف المتجر',
                accountId: 'معرف الحساب',
                productId: 'معرف المنتج',
                connectionLabel: 'تسمية الاتصال',
                apiUrl: 'رابط API',
                apiSecret: 'المفتاح السري',
                merchantId: 'معرف التاجر',
                webhookSecret: 'مفتاح Webhook السري',
                guid: 'المعرف الفريد (GUID)',
              };
              const label = arabicLabels[field.field] || field.label;

              return (
                <div key={field.field} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`dlg-${field.field}`} className="text-sm font-black text-gray-900 dark:text-white">
                      {label}
                    </Label>
                    {isSavedHidden && !currentValue && (
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">محفوظ</span>
                    )}
                  </div>
                  <Input
                    id={`dlg-${field.field}`}
                    type={field.type || "text"}
                    placeholder={placeholder}
                    value={currentValue}
                    onChange={(e) => { setCredentials({ ...credentials, [field.field]: e.target.value }); setTestResult(null); }}
                    className="h-11 rounded-xl border-2 border-gray-200 dark:border-gray-800 focus:border-indigo-500 focus:ring-0 text-sm bg-gray-50 dark:bg-gray-900 placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-colors"
                    dir="ltr"
                  />
                </div>
              );
            })}

            {/* ── Test Result ── */}
            {testResult && (
              <div className={`rounded-2xl p-4 flex items-start gap-3 text-sm font-bold transition-all ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  testResult.success ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                }`}>
                  {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                </div>
                <span className="leading-relaxed">{testResult.message}</span>
              </div>
            )}

            {/* ── Webhook Section ── */}
            {selectedCompany?.features.webhooks && (
              <div className={`rounded-2xl border-2 border-dashed p-4 space-y-3 transition-all ${
                webhookState.result?.registered
                  ? 'border-emerald-300/60 dark:border-emerald-700/40 bg-gradient-to-br from-emerald-50/80 to-green-50/50 dark:from-emerald-950/10 dark:to-green-950/10'
                  : webhookState.loading
                    ? 'border-blue-300/60 dark:border-blue-700/40 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-blue-950/10 dark:to-indigo-950/10'
                    : 'border-amber-300/60 dark:border-amber-700/40 bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/10 dark:to-orange-950/10'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    webhookState.result?.registered
                      ? 'bg-emerald-100 dark:bg-emerald-900/40'
                      : webhookState.loading
                        ? 'bg-blue-100 dark:bg-blue-900/40'
                        : 'bg-amber-100 dark:bg-amber-900/40'
                  }`}>
                    {webhookState.loading ? (
                      <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                    ) : webhookState.result?.registered ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Wifi className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-black ${
                      webhookState.result?.registered
                        ? 'text-emerald-900 dark:text-emerald-100'
                        : webhookState.loading
                          ? 'text-blue-900 dark:text-blue-100'
                          : 'text-amber-900 dark:text-amber-100'
                    }`}>
                      {webhookState.result?.registered
                        ? 'تم تسجيل Webhook تلقائياً'
                        : webhookState.loading
                          ? 'جاري تسجيل Webhook...'
                          : t('delivery.webhookUrl')}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${
                      webhookState.result?.registered
                        ? 'text-emerald-600/80 dark:text-emerald-400/60'
                        : webhookState.loading
                          ? 'text-blue-600/80 dark:text-blue-400/60'
                          : 'text-amber-600/80 dark:text-amber-400/60'
                    }`}>
                      {webhookState.result?.message || t('delivery.webhookUrlDesc', { company: selectedCompany.name })}
                    </p>
                  </div>
                </div>
                {!webhookState.result?.registered && (
                  <div className="flex gap-2 min-w-0">
                    <code className="flex-1 text-[11px] bg-white dark:bg-gray-900 px-3 py-2.5 rounded-xl border border-amber-200/60 dark:border-amber-800/30 text-amber-900 dark:text-amber-100 truncate direction-ltr text-left font-mono shadow-sm">
                      {(webhookState.result?.webhookUrl) || `https://${window.location.host}/api/delivery/webhooks/${encodeURIComponent(selectedCompany.name)}`}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText((webhookState.result?.webhookUrl) || `https://${window.location.host}/api/delivery/webhooks/${encodeURIComponent(selectedCompany.name)}`)}
                      className="shrink-0 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-md shadow-amber-500/20 transition-colors"
                    >
                      {t('delivery.webhookUrlCopy')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Polling Note ── */}
            {selectedCompany && !selectedCompany.features.webhooks && selectedCompany.features.tracking && (
              <div className="rounded-2xl border-2 border-blue-200/60 dark:border-blue-800/30 bg-blue-50/80 dark:bg-blue-950/10 p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-black text-blue-900 dark:text-blue-100">تتبع تلقائي</p>
                  <p className="text-[11px] text-blue-600/70 dark:text-blue-400/50 mt-0.5">ال追踪 يتم عبر Polling كل 3 دقائق.</p>
                </div>
              </div>
            )}

            {/* ── Docs Link ── */}
            {selectedCompany?.docsUrl && (
              <button
                onClick={() => window.open(selectedCompany.docsUrl, '_blank')}
                className="w-full flex items-center gap-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-2xl p-4 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/10 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800/40 transition-colors">
                  <Key className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 text-right">
                  <p className="text-sm font-black text-gray-900 dark:text-white">{t('delivery.getCredentials')}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">{t('delivery.docs')}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors" />
              </button>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="border-t-2 border-gray-100 dark:border-gray-900 bg-gray-50/80 dark:bg-gray-900/50 px-7 py-4 min-w-0 w-full">
            <div className="flex items-center gap-3 flex-row-reverse">
              <Button
                size="default"
                onClick={handleSaveCredentials}
                disabled={saving || testing || !canConnectSelectedCompany}
                className="h-11 px-6 text-sm font-black rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-all disabled:opacity-50"
              >
                {(saving || testing) && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                {!saving && !testing && <CheckCircle2 className="w-4 h-4 ml-2" />}
                {testing ? 'جاري التحقق...' : saving ? 'جاري الحفظ...' : canConnectSelectedCompany ? t('delivery.connectActivate') : t('delivery.comingSoon')}
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={() => setShowConfigDialog(false)}
                className="h-11 px-5 text-sm font-bold rounded-xl border-2 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {t('cancel')}
              </Button>
              {selectedCompany?.enabled && (
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => {
                    if (selectedCompany) {
                      handleDisable(selectedCompany.id);
                      setShowConfigDialog(false);
                    }
                  }}
                  className="h-11 px-5 text-sm font-bold rounded-xl border-2 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-300 dark:hover:border-red-800"
                >
                  <X className="w-4 h-4 ml-1.5" />
                  {t('delivery.disconnect')}
                </Button>
              )}
              <div className="flex-1 min-w-0">
                {saveError && (
                  <p className="text-xs font-bold text-red-500 flex items-center gap-1.5 truncate">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{saveError}
                  </p>
                )}
                {saveSuccess && (
                  <p className="text-xs font-bold text-emerald-500 flex items-center gap-1.5 truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{saveSuccess}
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}