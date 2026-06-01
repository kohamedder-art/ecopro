import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, AlertTriangle, Cpu, HardDrive, Monitor, Box, Zap, Save, ShoppingCart, Trash2, Download } from 'lucide-react';
import { safeJsonParse } from '@/utils/safeJson';
import { useTranslation } from '@/lib/i18n';
import { trackAllPixels, PixelEvents } from '@/components/storefront/PixelScripts';
import { buildStoreUrl } from '@/lib/resolvedStore';

// Types
interface ProductMeta {
  socket?: string;
  cores?: number;
  threads?: number;
  tdp?: number;
  chipset?: string;
  formFactor?: string | string[];
  ramType?: string;
  ramSlots?: number;
  maxRam?: number;
  type?: string;
  capacity?: number;
  speed?: number;
  vram?: number;
  length?: number;
  wattage?: number;
  efficiency?: string;
  maxGpuLength?: number;
  [key: string]: any;
}

interface Product {
  id: string;
  title: string;
  category: string;
  subCategory: string;
  brand: string;
  price: number;
  image: string;
  meta: ProductMeta;
}

interface BuildConfig {
  cpu: Product | null;
  motherboard: Product | null;
  ram: Product | null;
  gpu: Product | null;
  storage: Product | null;
  case: Product | null;
  psu: Product | null;
}

interface SavedBuild {
  id: string;
  name: string;
  config: BuildConfig;
  totalPrice: number;
  createdAt: string;
}

interface CompatibilityIssue {
  type: 'error' | 'warning';
  message: string;
  components: string[];
}

const STEPS = [
  { id: 'cpu', icon: Cpu },
  { id: 'motherboard', icon: HardDrive },
  { id: 'ram', icon: Monitor },
  { id: 'gpu', icon: Monitor },
  { id: 'storage', icon: HardDrive },
  { id: 'case', icon: Box },
  { id: 'psu', icon: Zap },
];

export default function BuildPage() {
  const { storeSlug } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedBuilds, setSavedBuilds] = useState<SavedBuild[]>([]);
  const [buildName, setBuildName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  
  const [config, setConfig] = useState<BuildConfig>({
    cpu: null,
    motherboard: null,
    ram: null,
    gpu: null,
    storage: null,
    case: null,
    psu: null,
  });

  // Load products and saved builds
  useEffect(() => {
    async function loadData() {
      try {
        // Load PC components data
        const res = await fetch('/data/pc-components.json');
        const data = await res.json();
        setProducts(data.products || []);
        
        // Load saved builds from localStorage
        const saved = localStorage.getItem(`pc-builds-${storeSlug}`);
        if (saved) {
          setSavedBuilds(JSON.parse(saved));
        }
      } catch (err) {
        console.error('Failed to load PC components:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [storeSlug]);

  // Get products by subcategory
  const getProductsBySubCategory = (subCategory: string): Product[] => {
    return products.filter(p => p.subCategory === subCategory);
  };

  const steps = useMemo(
    () =>
      STEPS.map((step) => ({
        ...step,
        label: t(`buildPage.step.${step.id}.label`),
        description: t(`buildPage.step.${step.id}.desc`),
      })),
    [t]
  );

  const stepLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const step of steps) map[step.id] = step.label;
    return map;
  }, [steps]);

  // Compatibility checks
  const compatibilityIssues = useMemo((): CompatibilityIssue[] => {
    const issues: CompatibilityIssue[] = [];
    
    // CPU + Motherboard socket check
    if (config.cpu && config.motherboard) {
      if (config.cpu.meta.socket !== config.motherboard.meta.socket) {
        issues.push({
          type: 'error',
          message: t('buildPage.compat.cpuSocketMismatch', {
            cpuSocket: config.cpu.meta.socket,
            mbSocket: config.motherboard.meta.socket,
          }),
          components: ['cpu', 'motherboard'],
        });
      }
    }
    
    // RAM + Motherboard type check
    if (config.ram && config.motherboard) {
      if (config.ram.meta.type !== config.motherboard.meta.ramType) {
        issues.push({
          type: 'error',
          message: t('buildPage.compat.ramTypeMismatch', {
            ramType: config.ram.meta.type,
            mbRamType: config.motherboard.meta.ramType,
          }),
          components: ['ram', 'motherboard'],
        });
      }
    }
    
    // PSU wattage check
    if (config.psu && (config.cpu || config.gpu)) {
      const cpuTdp = config.cpu?.meta.tdp || 0;
      const gpuTdp = config.gpu?.meta.tdp || 0;
      const estimatedDraw = cpuTdp + gpuTdp + 150; // 150W for other components
      const psuWattage = config.psu.meta.wattage || 0;
      
      if (psuWattage < estimatedDraw) {
        issues.push({
          type: 'error',
          message: t('buildPage.compat.psuNotEnough', {
            psuWattage,
            estimatedDraw,
          }),
          components: ['psu', 'cpu', 'gpu'],
        });
      } else if (psuWattage < estimatedDraw * 1.2) {
        issues.push({
          type: 'warning',
          message: t('buildPage.compat.psuClose', {
            psuWattage,
            estimatedDraw,
          }),
          components: ['psu'],
        });
      }
    }
    
    // Case + Motherboard form factor check
    if (config.case && config.motherboard) {
      const caseFormFactors: string[] = Array.isArray(config.case.meta.formFactor) 
        ? config.case.meta.formFactor 
        : [config.case.meta.formFactor as string].filter(Boolean);
      const mbFormFactor = config.motherboard.meta.formFactor as string;
      
      if (mbFormFactor && !caseFormFactors.includes(mbFormFactor)) {
        issues.push({
          type: 'error',
          message: t('buildPage.compat.formFactorMismatch', {
            mbFormFactor,
            caseFormFactors: caseFormFactors.join(', '),
          }),
          components: ['case', 'motherboard'],
        });
      }
    }
    
    // GPU length check
    if (config.gpu && config.case) {
      const gpuLength = config.gpu.meta.length || 0;
      const maxGpuLength = config.case.meta.maxGpuLength || 999;
      
      if (gpuLength > maxGpuLength) {
        issues.push({
          type: 'error',
          message: t('buildPage.compat.gpuTooLong', {
            gpuLength,
            maxGpuLength,
          }),
          components: ['gpu', 'case'],
        });
      }
    }
    
    return issues;
  }, [config, t]);

  // Calculate totals
  const totalPrice = useMemo(() => {
    return Object.values(config).reduce((sum, product) => {
      return sum + (product?.price || 0);
    }, 0);
  }, [config]);

  const performanceScore = useMemo(() => {
    // Simple heuristic based on CPU and GPU price
    const cpuScore = config.cpu ? Math.min(100, (config.cpu.price / 1000)) : 0;
    const gpuScore = config.gpu ? Math.min(100, (config.gpu.price / 2000)) : 0;
    return Math.round((cpuScore + gpuScore) / 2);
  }, [config]);

  // Select a product
  const selectProduct = (stepId: string, product: Product | null) => {
    setConfig(prev => ({ ...prev, [stepId]: product }));
  };

  // Save build
  const saveBuild = () => {
    if (!buildName.trim()) return;
    
    const newBuild: SavedBuild = {
      id: Date.now().toString(),
      name: buildName,
      config,
      totalPrice,
      createdAt: new Date().toISOString(),
    };
    
    const updated = [...savedBuilds, newBuild];
    setSavedBuilds(updated);
    localStorage.setItem(`pc-builds-${storeSlug}`, JSON.stringify(updated));
    setBuildName('');
    setShowSaveModal(false);
  };

  // Load build
  const loadBuild = (build: SavedBuild) => {
    setConfig(build.config);
    setShowLoadModal(false);
    setCurrentStep(0);
  };

  // Delete build
  const deleteBuild = (buildId: string) => {
    const updated = savedBuilds.filter(b => b.id !== buildId);
    setSavedBuilds(updated);
    localStorage.setItem(`pc-builds-${storeSlug}`, JSON.stringify(updated));
  };

  // Add build to cart
  const addToCart = () => {
    const hasErrors = compatibilityIssues.some(i => i.type === 'error');
    if (hasErrors) {
      alert(t('buildPage.alert.fixCompatibility'));
      return;
    }
    
    const requiredParts = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu'];
    const missingParts = requiredParts.filter(part => !config[part as keyof BuildConfig]);
    
    if (missingParts.length > 0) {
      const partsLabel = missingParts
        .map((part) => stepLabelById[part] ?? part)
        .join(', ');
      alert(t('buildPage.alert.selectParts', { parts: partsLabel }));
      return;
    }
    
    // Add each component to cart
    const cart = safeJsonParse<any[]>(localStorage.getItem('cart'), []);
    Object.values(config).forEach(product => {
      if (product) {
        cart.push({
          id: product.id,
          name: product.title,
          price: product.price,
          quantity: 1,
          image: product.image,
        });
        trackAllPixels(PixelEvents.ADD_TO_CART, {
          content_ids: [product.id],
          content_name: product.title || 'منتج',
          value: product.price,
          currency: 'DZD',
          content_type: 'product',
        });
      }
    });
    localStorage.setItem('cart', JSON.stringify(cart));
    
    alert(t('buildPage.alert.addedToCart'));
    navigate(buildStoreUrl(storeSlug, '/'));
  };

  const currentStepData = steps[currentStep];
  const currentProducts = getProductsBySubCategory(currentStepData.id);
  const selectedProduct = config[currentStepData.id as keyof BuildConfig];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-md border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={() => navigate(buildStoreUrl(storeSlug, '/'))}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition"
          >
            <ChevronLeft className="w-5 h-5" />
            {t('buildPage.backToStore')}
          </button>
          
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            {t('buildPage.title')}
          </h1>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLoadModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            >
              <Download className="w-4 h-4" />
              {t('buildPage.action.load')}
            </button>
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition"
            >
              <Save className="w-4 h-4" />
              {t('buildPage.action.save')}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="mb-8 overflow-x-auto pb-2">
          <div className="flex items-center gap-2 min-w-max">
            {steps.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = idx === currentStep;
              const isComplete = config[step.id as keyof BuildConfig] !== null;
              const hasIssue = compatibilityIssues.some(i => i.components.includes(step.id));
              
              return (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => setCurrentStep(idx)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                      isActive 
                        ? 'bg-cyan-600 text-white' 
                        : isComplete
                          ? hasIssue
                            ? 'bg-amber-600/20 text-amber-400 border border-amber-600'
                            : 'bg-green-600/20 text-green-400 border border-green-600'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    <StepIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">{step.label}</span>
                    {isComplete && !hasIssue && <Check className="w-4 h-4" />}
                    {hasIssue && <AlertTriangle className="w-4 h-4" />}
                  </button>
                  {idx < steps.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Product Selection */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
              <h2 className="text-2xl font-bold mb-2">{currentStepData.label}</h2>
              <p className="text-gray-400 mb-6">{currentStepData.description}</p>
              
              <div className="space-y-4">
                {/* None option */}
                <button
                  onClick={() => selectProduct(currentStepData.id, null)}
                  className={`w-full p-4 rounded-lg border transition flex items-center gap-4 ${
                    !selectedProduct
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
                    <span className="text-gray-500">—</span>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{t('buildPage.skipStepTitle')}</div>
                    <div className="text-sm text-gray-400">{t('buildPage.skipStepDesc', { step: currentStepData.label })}</div>
                  </div>
                </button>
                
                {currentProducts.map(product => {
                  const isSelected = selectedProduct?.id === product.id;
                  
                  return (
                    <button
                      key={product.id}
                      onClick={() => selectProduct(currentStepData.id, product)}
                      className={`w-full p-4 rounded-lg border transition flex items-center gap-4 ${
                        isSelected
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <img 
                        src={product.image} 
                        alt={product.title}
                        className="w-16 h-16 object-cover rounded-lg"
                        loading="lazy"
                      />
                      <div className="flex-1 text-left">
                        <div className="font-medium">{product.title}</div>
                        <div className="text-sm text-gray-400">{product.brand}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {Object.entries(product.meta).slice(0, 3).map(([key, val]) => (
                            <span key={key} className="mr-3">
                              {key}: {Array.isArray(val) ? val.join('/') : val}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-cyan-400 font-bold">
                          {product.price.toLocaleString()} DZD
                        </div>
                        {isSelected && (
                          <Check className="w-5 h-5 text-cyan-400 ml-auto mt-1" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
                disabled={currentStep === 0}
                className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
              >
                <ChevronLeft className="w-5 h-5" />
                {t('buildPage.action.previous')}
              </button>
              
              {currentStep < steps.length - 1 ? (
                <button
                  onClick={() => setCurrentStep(s => Math.min(steps.length - 1, s + 1))}
                  className="flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg transition"
                >
                  {t('buildPage.action.next')}
                  <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={addToCart}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 rounded-lg transition font-bold"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {t('buildPage.action.addBuildToCart')}
                </button>
              )}
            </div>
          </div>

          {/* Build Summary */}
          <div className="space-y-6">
            {/* Preview Panel */}
            <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold mb-4">{t('buildPage.yourBuild')}</h3>
              
              <div className="space-y-3">
                {steps.map(step => {
                  const product = config[step.id as keyof BuildConfig];
                  return (
                    <div 
                      key={step.id}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        product ? 'bg-gray-700/50' : 'bg-gray-800/50 opacity-50'
                      }`}
                    >
                      {product ? (
                        <>
                          <img 
                            src={product.image} 
                            alt={product.title}
                            className="w-10 h-10 object-cover rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{product.title}</div>
                            <div className="text-xs text-gray-400">{step.label}</div>
                          </div>
                          <div className="text-sm text-cyan-400 font-medium">
                            {product.price.toLocaleString()}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center">
                            <step.icon className="w-5 h-5 text-gray-500" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm text-gray-500">{step.label}</div>
                            <div className="text-xs text-gray-600">{t('buildPage.notSelected')}</div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Total */}
              <div className="mt-6 pt-4 border-t border-gray-700">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>{t('buildPage.total')}</span>
                  <span className="text-cyan-400">{totalPrice.toLocaleString()} DZD</span>
                </div>
              </div>
            </div>

            {/* Performance Estimate */}
            <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold mb-4">{t('buildPage.performanceEstimate')}</h3>
              <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${performanceScore}%` }}
                />
              </div>
              <div className="mt-2 text-center text-sm text-gray-400">
                {performanceScore < 30
                  ? t('buildPage.performance.entry')
                  : performanceScore < 60
                    ? t('buildPage.performance.mid')
                    : performanceScore < 80
                      ? t('buildPage.performance.high')
                      : t('buildPage.performance.enthusiast')}
              </div>
            </div>

            {/* Compatibility Issues */}
            {compatibilityIssues.length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  {t('buildPage.compatibility')}
                </h3>
                <div className="space-y-3">
                  {compatibilityIssues.map((issue, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-lg text-sm ${
                        issue.type === 'error' 
                          ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                          : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                      }`}
                    >
                      {issue.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-xl font-bold mb-4">{t('buildPage.modal.saveTitle')}</h3>
            <input
              type="text"
              placeholder={t('buildPage.modal.buildNamePlaceholder')}
              value={buildName}
              onChange={(e) => setBuildName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:border-cyan-500 outline-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
              >
                {t('buildPage.action.cancel')}
              </button>
              <button
                onClick={saveBuild}
                disabled={!buildName.trim()}
                className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg transition"
              >
                {t('buildPage.action.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700 max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{t('buildPage.modal.loadTitle')}</h3>
            
            {savedBuilds.length === 0 ? (
              <p className="text-gray-400 text-center py-8">{t('buildPage.modal.noSavedBuilds')}</p>
            ) : (
              <div className="space-y-3">
                {savedBuilds.map(build => (
                  <div 
                    key={build.id}
                    className="p-4 bg-gray-700/50 rounded-lg border border-gray-600"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">{build.name}</div>
                        <div className="text-sm text-gray-400">
                          {new Date(build.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-cyan-400 font-bold">
                        {build.totalPrice.toLocaleString()} DZD
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => loadBuild(build)}
                        className="flex-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 rounded transition text-sm"
                      >
                        {t('buildPage.action.load')}
                      </button>
                      <button
                        onClick={() => deleteBuild(build.id)}
                        className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <button
              onClick={() => setShowLoadModal(false)}
              className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            >
              {t('buildPage.action.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
