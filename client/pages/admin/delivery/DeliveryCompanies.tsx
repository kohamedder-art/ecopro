import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Truck, Key, CheckCircle2, X, ExternalLink, Zap, Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { DELIVERY_LOGO_FALLBACK_SRC, getDeliveryCompanyLogoSrc } from "@/lib/deliveryLogos";
import { DeliveryCompanyLogo } from "@/components/delivery/DeliveryCompanyLogo";

interface DeliveryCompany {
  id: string;
  name: string;
  logo: string;
  description: string;
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
    const openIds = ['dolivroo', 'zr-express', 'noest', 'anderson', 'zimou-express', 'dhd'];
    return !openIds.includes(company.id);
  };
  
  // ========================================
  // REAL ALGERIAN DELIVERY COMPANIES WITH APIs
  // Based on research: Only companies with verified public APIs
  // ========================================
  // List of company IDs that should appear first (working ones)
  const workingCompanyOrder = ['dolivroo', 'zr-express', 'noest', 'anderson', 'zimou-express', 'dhd'];

  const [companies, setCompanies] = useState<DeliveryCompany[]>(() => [
    // ⭐ TIER 1: Best API - Yalidine (Most documented, npm packages available)
    {
      id: "yalidine",
      name: "Yalidine Express",
      logo: getDeliveryCompanyLogoSrc("Yalidine Express"),
      description: "#1 delivery in Algeria - Full REST API with npm SDK. Covers all 58 wilayas.",
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
      description: "Logistics SaaS platform. Aggregates multiple carriers (DHD, Conexlog/UPS).",
      apiFields: [
        { label: "API Token", placeholder: "Your Ecotrack API Token", field: "apiToken" },
        { label: "Account ID", placeholder: "Your Account ID", field: "accountId" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: true, tracking: true, labels: true, cod: true, webhooks: true },
      docsUrl: "https://ecotrack.dz",
      apiRating: 4,
    },
    // ⭐ TIER 2: Maystro Delivery
    {
      id: "maystro",
      name: "Maystro Delivery",
      logo: getDeliveryCompanyLogoSrc("Maystro Delivery"),
      description: "3K+ stores, 600+ drivers. Warehousing, packaging & call center included.",
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
      id: "procolis",
      name: "ProColis",
      logo: getDeliveryCompanyLogoSrc("ProColis"),
      description: "ProColis account integration (manual assignment-ready).",
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
      id: "nord-et-ouest",
      name: "Nord Et Ouest",
      logo: getDeliveryCompanyLogoSrc("Nord Et Ouest"),
      description: "Nord Et Ouest integration (manual assignment-ready).",
      apiFields: [
        { label: "Account Code", placeholder: "Your account/client code", field: "apiKey" },
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
      description: "Elogistia integration (manual assignment-ready).",
      apiFields: [
        { label: "Account Code", placeholder: "Your account/client code", field: "apiKey" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: false, tracking: false, labels: false, cod: false, webhooks: false },
      apiRating: 1,
    },
    {
      id: "colivraison-express",
      name: "Colivraison Express",
      logo: getDeliveryCompanyLogoSrc("Colivraison Express"),
      description: "Colivraison Express integration (manual assignment-ready).",
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
      description: "MDM Express integration (manual assignment-ready).",
      apiFields: [
        { label: "Account Code", placeholder: "Your account/client code", field: "apiKey" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: false, tracking: false, labels: false, cod: false, webhooks: false },
      apiRating: 1,
    },
    {
      id: "yalitec",
      name: "Yalitec",
      logo: getDeliveryCompanyLogoSrc("Yalitec"),
      description: "Yalitec integration (manual assignment-ready).",
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
      apiFields: [
        { label: "Account Code", placeholder: "Your account/client code", field: "apiKey" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: false, tracking: false, labels: false, cod: false, webhooks: false },
      apiRating: 1,
    },
    {
      id: "ecom-delivery",
      name: "Ecom Delivery",
      logo: getDeliveryCompanyLogoSrc("Ecom Delivery"),
      description: "Ecom Delivery integration (manual assignment-ready).",
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
      apiFields: [
        { label: "Account Code", placeholder: "Your account/client code", field: "apiKey" },
      ],
      enabled: false,
      hasApi: true,
      features: { createShipment: false, tracking: false, labels: false, cod: false, webhooks: false },
      apiRating: 1,
    },
  ]);

  // Sort companies so working ones come first
  const sortedCompanies = [
    ...companies.filter(c => workingCompanyOrder.includes(c.id)),
    ...companies.filter(c => !workingCompanyOrder.includes(c.id)),
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
      const { apiKey, apiSecret } = (() => {
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
            apiSecret: (credentials.accountId || '').trim() || undefined,
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

        // Generic fallback
        const primary = (credentials.apiToken || credentials.apiKey || '').trim();
        const secondary =
          (credentials.apiId || credentials.accountId || credentials.storeId || credentials.secretKey || '').trim() || undefined;
        return { apiKey: primary, apiSecret: secondary };
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
      if ((isNoest || isDhd) && !apiSecret) {
        if (existing?.is_enabled && existing?.has_api_secret) {
          // Allow keeping the saved GUID if user isn't changing it.
        } else {
          throw new Error('GUID is required');
        }
      }

      const res = await fetch('/api/delivery/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_company_id: dbId,
          api_key: apiKey,
          api_secret: apiSecret || undefined,
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

  const handleDisable = (companyId: string) => {
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
      {/* Header Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg">
            <Truck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              {t('delivery.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('delivery.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/20 border border-blue-200/50 dark:border-blue-800/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              {t('delivery.recommended')}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-300">
              {t('delivery.recommendedDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* Grid of delivery company cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedCompanies.map((company) => (
          <Card
            key={company.id}
            className={`relative transition-all duration-300 border-2 overflow-hidden group ${
              isComingSoon(company)
                ? 'cursor-not-allowed border-border/50 bg-card opacity-70'
                : 'cursor-pointer hover:shadow-xl hover:border-primary/60 hover:bg-primary/5 dark:hover:bg-primary/10'
            }`}
            onClick={() => handleCardClick(company)}
          >
            {isComingSoon(company) && (
              <div className="absolute top-2 left-2 z-10">
                <Badge variant="secondary" className="text-xs">
                  {t('delivery.comingSoon')}
                </Badge>
              </div>
            )}
            <CardContent className="p-4 space-y-3">
              {/* Header: Logo + Name + Rating */}
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center overflow-hidden border border-border/60 flex-shrink-0">
                  {company.logo.startsWith('/') ? (
                    <DeliveryCompanyLogo
                      name={company.name}
                      alt={company.name}
                      className="w-full h-full object-contain p-1.5"
                    />
                  ) : (
                    <Truck className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm leading-tight text-foreground truncate">
                    {company.name}
                  </h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    {renderStars(company.apiRating)}
                    <span className="text-xs text-muted-foreground ml-1">API</span>
                  </div>
                </div>
              </div>
              {/* Description */}
              <p className="text-xs text-muted-foreground line-clamp-2">
                {company.description}
              </p>
              {/* Feature badges */}
              <div className="flex flex-wrap gap-1">
                {company.features.createShipment && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Shipments</Badge>
                )}
                {company.features.tracking && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Tracking</Badge>
                )}
                {company.features.labels && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Labels</Badge>
                )}
                {company.features.cod && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">COD</Badge>
                )}
                {company.features.webhooks && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-300">Webhooks</Badge>
                )}
              </div>
              {/* Status */}
              <div className={`text-xs px-2 py-1 rounded-md text-center ${
                isComingSoon(company)
                  ? 'text-muted-foreground bg-muted/50'
                  : 'text-primary bg-primary/10 dark:bg-primary/20 font-semibold'
              }`}>
                {isComingSoon(company) ? t('delivery.comingSoon') : t('delivery.clickToConfigure')}
              </div>
            </CardContent>
          </Card>
        ))}
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