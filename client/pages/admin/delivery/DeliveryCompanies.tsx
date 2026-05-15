import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Truck, Key, CheckCircle2, X, ExternalLink, Zap, Wifi, WifiOff, Settings2, Star } from "lucide-react";
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
  const [companyIdByName, setCompanyIdByName] = useState<Record<string, number>>({});
  const [integrationMetaByCompanyId, setIntegrationMetaByCompanyId] = useState<
    Record<number, { is_enabled: boolean; has_api_key: boolean; has_api_secret: boolean; updated_at?: string; configured_at?: string }>
  >({});

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
      description: "Official ZR Express API. Requires API Key + Tenant ID for full parcel management.",
      descriptionKey: "delivery.desc.zrexpress",
      apiFields: [
        { label: "API Key", placeholder: "Your ZR Express API Key", field: "apiKey" },
        { label: "Tenant ID", placeholder: "Your Tenant ID (X-Tenant)", field: "apiId" },
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
      features: { createShipment: true, tracking: true, labels: true, cod: true, webhooks: true },
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
      'zr-express': 'apiKey',
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
    if (!isComingSoon(company)) {
      setShowConfigDialog(true); // Allow opening config dialog for allowed companies
    } else {
      setShowConfigDialog(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!selectedCompany) return;

    setSaveError(null);
    setSaveSuccess(null);
    setSaving(true);

    try {
      const dbId = companyIdByName[toCompanyLookupKey(String(selectedCompany.name || ''))];
      if (!dbId) {
        throw new Error('Delivery company not found on server. Make sure migrations are applied and the company exists.');
      }

      const existing = integrationMetaByCompanyId[dbId];

      // Map UI credentials → backend schema
      // - api_key: primary token
      // - api_secret: secondary credential (e.g., GUID / API ID / Account ID / Store ID / Secret Key)
      const { apiKey, apiSecret, merchantId } = (() => {
        const id = selectedCompany.id;
        if (id === 'yalidine') {
          return {
            apiKey: (credentials.apiToken || '').trim(),
            apiSecret: (credentials.apiId || '').trim() || undefined,
          };
        }
        if (id === 'guepex') {
          return {
            apiKey: (credentials.apiToken || '').trim(),
            apiSecret: (credentials.apiKey || '').trim() || undefined,
          };
        }
        if (id === 'zr-express') {
          return {
            apiKey: (credentials.apiKey || '').trim(),
            apiSecret: (credentials.apiId || '').trim() || undefined,
          };
        }
        if (id === 'ecotrack') {
          return {
            apiKey: (credentials.apiToken || '').trim(),
            apiSecret: undefined,
            merchantId: (credentials.apiUrl || '').trim() || undefined,
          };
        }
        if (id === 'maystro') {
          return {
            apiKey: (credentials.apiToken || '').trim(),
            apiSecret: (credentials.storeId || '').trim() || undefined,
          };
        }
        if (id === 'dolivroo') {
          return {
            apiKey: (credentials.apiKey || '').trim(),
            apiSecret: (credentials.connectionLabel || '').trim() || undefined,
          };
        }
        if (id === 'noest') {
          return {
            apiKey: (credentials.apiToken || '').trim(),
            apiSecret: (credentials.apiKey || '').trim() || undefined,
          };
        }
        if (id === 'zimou-express') {
          return {
            apiKey: (credentials.apiToken || '').trim(),
            apiSecret: undefined,
          };
        }
        if (id === 'anderson') {
          return {
            apiKey: (credentials.apiToken || '').trim(),
            apiSecret: (credentials.accountId || '').trim() || undefined,
          };
        }
        if (id === 'dhd') {
          return {
            apiKey: (credentials.apiToken || '').trim(),
            apiSecret: (credentials.apiKey || '').trim() || undefined,
          };
        }

        if (id === 'ecom-delivery') {
          return {
            apiKey: (credentials.apiKey || '').trim(),
            apiSecret: (credentials.apiToken || '').trim() || undefined,
            merchantId: undefined,
          };
        }
        if (id === 'mdm-express') {
          return {
            apiKey: (credentials.apiToken || '').trim(),
            apiSecret: (credentials.productId || '').trim() || undefined,
            merchantId: (credentials.storeId || '').trim() || undefined,
          };
        }
        // Generic fallback
        const primary = (credentials.apiToken || credentials.apiKey || '').trim();
        const secondary =
          (credentials.apiId || credentials.accountId || credentials.storeId || credentials.secretKey || '').trim() || undefined;
        return { apiKey: primary, apiSecret: secondary, merchantId: undefined };
      })();

      // If already configured, don't force re-entry. Secrets are intentionally not shown.
      if (!apiKey) {
        if (existing?.is_enabled && existing?.has_api_key) {
          setSaveSuccess('Already connected (credentials are saved and hidden).');
          setShowConfigDialog(false);
          return;
        }
        throw new Error('API Token is required');
      }

      // Noest and DHD require GUID/user_guid.
      const isNoest = selectedCompany.id === 'noest' || selectedCompany.name.trim().toLowerCase() === 'noest';
      const isDhd = selectedCompany.id === 'dhd' || selectedCompany.name.trim().toLowerCase().includes('dhd');
      const isMdm = selectedCompany.id === 'mdm-express' || selectedCompany.name.trim().toLowerCase().includes('mdm');
      if ((isNoest || isDhd) && !apiSecret) {
        if (existing?.is_enabled && existing?.has_api_secret) {
          // Allow keeping the saved GUID if user isn't changing it.
        } else {
          throw new Error('GUID is required');
        }
      }
      if (isMdm && !apiSecret) {
        if (existing?.is_enabled && existing?.has_api_secret) {
          // Allow keeping saved Product Tracking ID if user is not updating it.
        } else {
          throw new Error('MDM Product Tracking ID is required');
        }
      }

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
      setSaveSuccess('Saved successfully');
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

  // Render star rating
  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={star <= rating ? "text-yellow-500" : "text-gray-300"}>
            ★
          </span>
        ))}
      </div>
    );
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
      <div className="relative overflow-hidden rounded-2xl bg-white/90 dark:bg-slate-900/45 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/70 ring-1 ring-black/5 dark:ring-white/10 shadow-lg shadow-slate-200/60 dark:shadow-black/40 px-5 py-4">
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center border border-white/50 dark:border-white/10 shadow-md">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">{t('delivery.title')}</h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 max-w-sm">{t('delivery.subtitle')}</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {sortedCompanies.filter(c => { const id = companyIdByName[toCompanyLookupKey(c.name)]; return c.enabled || Boolean(id && integrationMetaByCompanyId[id]?.is_enabled); }).length} {t('delivery.connected')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tip banner ── */}
      <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-700/40 rounded-lg px-3 py-2">
        <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <p className="text-xs text-amber-800 dark:text-amber-300">
          <span className="font-semibold">{t('delivery.recommended')}</span>{' — '}{t('delivery.recommendedDesc')}
        </p>
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
              className={`relative rounded-xl border-2 overflow-hidden transition-all duration-200 ${
                comingSoon
                  ? 'cursor-not-allowed opacity-55 border-border/40 bg-muted/30'
                  : isConnected
                    ? 'cursor-pointer border-emerald-400 dark:border-emerald-600 bg-white dark:bg-slate-900 shadow-md shadow-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/15 hover:-translate-y-0.5'
                    : 'cursor-pointer border-border bg-white dark:bg-slate-900 hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              {/* top accent line */}
              <div className={`h-0.5 w-full ${
                isConnected ? 'bg-gradient-to-r from-emerald-400 to-green-500' : comingSoon ? 'bg-border/40' : 'bg-gradient-to-r from-primary/40 to-accent/40'
              }`} />

              <div className="p-3 space-y-2.5">
                {/* Logo + name row */}
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden border flex-shrink-0 ${
                    isConnected ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40' : 'border-border/60 bg-muted/40'
                  }`}>
                    {company.logo.startsWith('/') ? (
                      <DeliveryCompanyLogo name={company.name} alt={company.name} className="w-full h-full object-contain p-1" />
                    ) : (
                      <Truck className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm truncate">{company.name}</h3>
                      {isConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" />}
                    </div>
                    <div className="flex gap-0.5 mt-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-2 h-2 ${ s <= company.apiRating ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted'}`} />
                      ))}
                    </div>
                  </div>
                  {comingSoon && (
                    <Badge variant="secondary" className="text-[10px] flex-shrink-0 px-1.5 py-0">{t('delivery.comingSoon')}</Badge>
                  )}
                </div>

                {/* Description */}
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{desc}</p>

                {/* Feature chips */}
                <div className="flex flex-wrap gap-1">
                  {company.features.createShipment && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40 font-medium">{t('delivery.shipments')}</span>}
                  {company.features.tracking && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/40 font-medium">{t('delivery.tracking')}</span>}
                  {company.features.labels && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-800/40 font-medium">{t('delivery.labels')}</span>}
                  {company.features.cod && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40 font-medium">{t('delivery.cod')}</span>}
                  {company.features.webhooks && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 font-medium">{t('delivery.webhooks')}</span>}
                </div>

                {/* Status footer */}
                <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${
                  isConnected
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50'
                    : comingSoon
                      ? 'bg-muted/40 border border-border/40'
                      : 'bg-primary/5 dark:bg-primary/10 border border-primary/20'
                }`}>
                  {isConnected ? (
                    <>
                      <Wifi className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{t('delivery.connected')}</span>
                      {meta?.updated_at && (
                        <span className="text-[10px] text-emerald-500/60 ms-auto">{new Date(meta.updated_at).toLocaleDateString()}</span>
                      )}
                      <Settings2 className="w-3 h-3 text-emerald-500/60 ms-auto" />
                    </>
                  ) : comingSoon ? (
                    <>
                      <WifiOff className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-[11px] text-muted-foreground">{t('delivery.comingSoon')}</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50 flex-shrink-0" />
                      <span className="text-[11px] font-semibold text-primary">{t('delivery.clickToConfigure')}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Configuration Dialog - Professional Styling */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-lg border-border/50 shadow-xl">
          <DialogHeader className="space-y-3 pb-4 border-b border-border/50">
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0 border border-primary/20">
                {selectedCompany?.logo.startsWith('/') ? (
                  <DeliveryCompanyLogo
                    name={selectedCompany?.name}
                    alt={selectedCompany?.name}
                    className="w-full h-full object-contain p-2 rounded-lg"
                  />
                ) : (
                  <Truck className="w-7 h-7 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  {selectedCompany?.name}
                  {selectedCompany?.id === 'dolivroo' && (
                    <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200">
                      {t('delivery.aggregator')}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs mt-1">
                  {selectedCompany?.description}
                </DialogDescription>
                {selectedCompany && (
                  <div className="flex items-center gap-1 mt-1">
                    {renderStars(selectedCompany.apiRating)}
                    <span className="text-xs text-muted-foreground ml-1">{t('delivery.apiQuality')}</span>
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* API Features Summary */}
            {selectedCompany && (
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t('delivery.supportedFeatures')}:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={selectedCompany.features.createShipment ? "default" : "secondary"} className="text-xs">
                    {selectedCompany.features.createShipment ? "✓" : "✗"} {t('delivery.createShipments')}
                  </Badge>
                  <Badge variant={selectedCompany.features.tracking ? "default" : "secondary"} className="text-xs">
                    {selectedCompany.features.tracking ? "✓" : "✗"} {t('delivery.tracking')}
                  </Badge>
                  <Badge variant={selectedCompany.features.labels ? "default" : "secondary"} className="text-xs">
                    {selectedCompany.features.labels ? "✓" : "✗"} {t('delivery.labels')}
                  </Badge>
                  <Badge variant={selectedCompany.features.cod ? "default" : "secondary"} className="text-xs">
                    {selectedCompany.features.cod ? "✓" : "✗"} {t('delivery.cashOnDelivery')}
                  </Badge>
                  <Badge variant={selectedCompany.features.webhooks ? "default" : "secondary"} className="text-xs">
                    {selectedCompany.features.webhooks ? "✓" : "✗"} {t('delivery.webhooks')}
                  </Badge>
                </div>
              </div>
            )}

            {/* Coming soon message */}
            {selectedCompany && !canConnectSelectedCompany && (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm font-medium">{t('delivery.comingSoon')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('delivery.comingSoonDesc')}</p>
              </div>
            )}

            {/* Credential Fields */}
            {canConnectSelectedCompany && selectedCompany?.apiFields.map((field) => (
              <div key={field.field} className="space-y-2">
                <Label htmlFor={field.field} className="text-sm font-medium">
                  {field.label}
                </Label>
                {(() => {
                  const isPrimaryField = isPrimaryCredentialField(selectedCompany, field.field);
                  const isSavedHidden =
                    Boolean(selectedCompany?.enabled) &&
                    Boolean(selectedIntegrationMeta) &&
                    (isPrimaryField ? Boolean(selectedIntegrationMeta?.has_api_key) : Boolean(selectedIntegrationMeta?.has_api_secret));

                  const currentValue = credentials[field.field] || '';
                  const placeholder = isSavedHidden && !currentValue ? 'Saved (hidden)' : field.placeholder;

                  return (
                <Input
                  id={field.field}
                  type={field.type || "text"}
                  placeholder={placeholder}
                  value={credentials[field.field] || ''}
                  onChange={(e) => setCredentials({ ...credentials, [field.field]: e.target.value })}
                  className="border-border/60 focus:border-primary/50 focus:ring-primary/20"
                />
                  );
                })()}
                {(() => {
                  const isPrimaryField = isPrimaryCredentialField(selectedCompany, field.field);
                  const isSavedHidden =
                    Boolean(selectedCompany?.enabled) &&
                    Boolean(selectedIntegrationMeta) &&
                    (isPrimaryField ? Boolean(selectedIntegrationMeta?.has_api_key) : Boolean(selectedIntegrationMeta?.has_api_secret));

                  const currentValue = credentials[field.field] || '';
                  if (!isSavedHidden || currentValue) return null;

                  return (
                    <p className="text-xs text-muted-foreground">
                      Saved and hidden for security. Leave blank to keep it.
                    </p>
                  );
                })()}
              </div>
            ))}
            
            {/* Documentation Link */}
            {selectedCompany?.docsUrl && (
              <div className="bg-gradient-to-br from-blue-50/80 to-cyan-50/50 dark:from-blue-950/30 dark:to-cyan-950/20 border border-blue-200/50 dark:border-blue-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2.5">
                    <Key className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                      {t('delivery.getCredentials')}
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-blue-600 hover:text-blue-700"
                    onClick={() => window.open(selectedCompany.docsUrl, '_blank')}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    {t('delivery.docs')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 border-t border-border/50 pt-4">
            <div className="flex-1">
              {saveError && (
                <p className="text-sm text-destructive">
                  {saveError}
                </p>
              )}
              {saveSuccess && (
                <p className="text-sm text-primary">
                  {saveSuccess}
                </p>
              )}
            </div>
            {selectedCompany?.enabled && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (selectedCompany) {
                    handleDisable(selectedCompany.id);
                    setShowConfigDialog(false);
                  }
                }}
                className="hover:bg-destructive/90"
              >
                <X className="w-4 h-4 mr-1.5" />
                {t('delivery.disconnect')}
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowConfigDialog(false)}
              className="border-border/60 hover:bg-muted/50"
            >
              {t('cancel')}
            </Button>
            <Button 
              size="sm"
              onClick={handleSaveCredentials}
              disabled={saving || !canConnectSelectedCompany}
              className="bg-gradient-to-r from-primary to-accent hover:shadow-lg"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {canConnectSelectedCompany ? t('delivery.connectActivate') : t('delivery.comingSoon')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}