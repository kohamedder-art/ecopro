
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ShoppingCart, PlusCircle, Share2, Flag } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
// Inline ThemeToggleButton (copied from Mercury template)
function ThemeToggleButton() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="outline" className="h-9 px-3 text-sm" onClick={toggle} style={{ borderColor: 'hsl(var(--border))' }}>
      {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
    </Button>
  );
}

interface Product {
  [key: string]: any;
}

const PublicProduct: React.FC = () => {
  const { storeSlug, productSlug } = useParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  // Store header is now handled by StoreLayout
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [seller, setSeller] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setProduct(null);
    setSeller(null);
    fetch(`/api/store/${storeSlug}/${productSlug}?track_view=1`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Product not found');
        return res.json();
      })
      .then((data) => {
        const prod = data.product || data;
        setProduct(prod);
        // Fetch seller info if seller_id exists
        if (prod.seller_id) {
          fetch(`/api/sellers/${prod.seller_id}`)
            .then(async (res) => {
              if (res.ok) setSeller(await res.json());
            });
        }
      })
      .catch((err) => setError(err.message || 'Failed to load product'))
      .finally(() => setLoading(false));
  }, [storeSlug, productSlug]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!product) return <div className="p-8 text-center">No product found.</div>;

  const pruneProductForCache = (p: any) => {
    if (!p || typeof p !== 'object') return p;
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      name: p.name,
      price: p.price,
      original_price: p.original_price,
      images: Array.isArray(p.images) ? p.images.slice(0, 6) : undefined,
      description: p.description,
      category: p.category,
      stock_quantity: p.stock_quantity,
      store_slug: storeSlug,
      variants: Array.isArray(p.variants) ? p.variants : undefined,
    };
  };

  const safeSetProductCache = (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Failed to write product cache:', e);
    }
  };

  const cacheProduct = (identifier: string, p: any) => {
    if (!identifier || !p) return;
    const pruned = pruneProductForCache(p);
    safeSetProductCache(`product_${identifier}`, pruned);
    if (p?.id != null) safeSetProductCache(`product_${String(p.id)}`, pruned);
    if (p?.slug) safeSetProductCache(`product_${String(p.slug)}`, pruned);
  };

  const warmCacheInBackground = () => {
    if (!storeSlug || !product?.id) return;
    const productId = Number(product.id);
    if (!Number.isFinite(productId) || productId <= 0) return;

    // Prefer the store-scoped endpoint that includes variants.
    void (async () => {
      try {
        const r = await fetch(
          `/api/storefront/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(String(productId))}`
        );
        if (!r.ok) return;
        const fresh = await r.json();
        cacheProduct(String(productSlug || productId), fresh);
      } catch {
        // ignore
      }
    })();
  };

  // Calculate discount
  const hasDiscount = product.original_price && Number(product.original_price) > Number(product.price);
  const discountPercent = hasDiscount
    ? Math.round(((Number(product.original_price) - Number(product.price)) / Number(product.original_price)) * 100)
    : 0;

  return (
    <>

      {/* End Mercury Store Header */}

      <div className="min-h-screen bg-[#f6f8fb] dark:bg-[#181a20] py-4 md:py-6 px-2 text-gray-900 dark:text-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 md:gap-3 md:gap-4">
        {/* Left: Image Gallery */}
        <div className="md:w-1/2 w-full flex flex-col items-center">
          <div className="w-full aspect-square bg-white dark:bg-[#23272f] rounded-2xl overflow-hidden flex items-center justify-center mb-4 shadow-lg border border-gray-100 dark:border-gray-700 relative">
            {product.images && product.images.length > 0 ? (
              <img
                src={product.images[selectedImage]}
                alt={product.title}
                className="object-contain w-full h-full bg-white"
                style={{ aspectRatio: '1/1', display: 'block' }}
              />
            ) : (
              <div className="text-2xl md:text-xl md:text-2xl md:text-xl md:text-2xl md:text-2xl md:text-xl md:text-2xl text-gray-300">📦</div>
            )}
            {hasDiscount && (
              <span className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                -{discountPercent}%
              </span>
            )}
          </div>
          {product.images && product.images.length > 1 && (
            <div className="flex gap-2 mb-2">
              {product.images.map((img: string, idx: number) => (
                <button
                  key={idx}
                  className={`w-14 h-14 rounded-xl border-2 transition-all duration-200 ${selectedImage === idx ? 'border-blue-600 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  onClick={() => setSelectedImage(idx)}
                >
                  <img src={img} alt={product.title + ' ' + (idx + 1)} className="object-contain w-full h-full rounded-xl bg-white" style={{ aspectRatio: '1/1', display: 'block' }} />
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Right: Product Info */}
        <div className="md:w-1/2 w-full flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-xl md:text-2xl lg:text-xl md:text-2xl font-extrabold text-gray-900 dark:text-white mb-1">{product.title}</h1>
            <div className="flex items-center gap-2 text-yellow-500 text-xs md:text-sm">
              <span>★</span>
              <span className="font-semibold text-gray-700">3.2</span>
              <span className="text-gray-400">(206 reviews)</span>
              <span className="text-green-600 ml-2">· 135 views</span>
            </div>
            <div className="flex items-end gap-3 mt-2">
              <span className="text-2xl md:text-xl md:text-2xl lg:text-lg md:text-xl md:text-2xl font-bold text-green-600">{Math.round(Number(product.price) || 0)} دج</span>
              {hasDiscount && (
                <span className="text-2xl text-gray-400 dark:text-gray-500 line-through">{Math.round(Number(product.original_price) || 0)} دج</span>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <span className="bg-green-100 dark:bg-green-900 dark:text-green-200 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">In Stock ({product.stock_quantity || 1} available)</span>
              <span className="bg-gray-100 dark:bg-gray-800 dark:text-gray-300 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold">used</span>
            </div>
            <div className="border-b my-4 dark:border-gray-700" />
            <div>
              <h2 className="font-semibold mb-1 text-gray-800 dark:text-gray-200">Description</h2>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line text-base">{product.description}</p>
            </div>
            <div className="flex flex-col gap-1 text-sm mt-2">
              <div><span className="font-semibold dark:text-gray-200">Location:</span> New York, NY</div>
              <div className="text-green-600 dark:text-green-400">Free shipping available</div>
              <div className="text-blue-600 dark:text-blue-400">Buyer Protection</div>
            </div>
            <div className="bg-white dark:bg-[#23272f] border dark:border-gray-700 rounded-xl p-4 shadow flex flex-col gap-3 mt-4">
              <h3 className="font-semibold mb-1 text-sm text-gray-700 dark:text-gray-200">Seller Information</h3>
              <div className="flex items-center gap-3">
                <img
                  src={
                    (seller && seller.avatar)
                      ? seller.avatar
                      : product.seller_avatar || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + encodeURIComponent((seller && seller.name) || product.seller_name || 'seller')
                  }
                  alt={(seller && seller.name) || product.seller_name || 'Seller'}
                  className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{(seller && seller.name) || product.seller_name || 'imad'}</div>
                  <div className="text-gray-600 dark:text-gray-400 text-xs">{(seller && seller.email) || product.seller_email || 'ima2d@gmail.com'}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <span className="font-medium dark:text-gray-200">Quantity:</span>
              <button className="w-8 h-8 border rounded dark:bg-[#23272f] dark:border-gray-700 dark:text-white" onClick={() => setQuantity(q => Math.max(1, q - 1))}>-</button>
              <input
                type="number"
                className="w-12 text-center border rounded dark:bg-[#23272f] dark:border-gray-700 dark:text-white"
                min={1}
                max={product.stock_quantity || 1}
                value={quantity}
                onChange={e => setQuantity(Math.max(1, Math.min(product.stock_quantity || 1, Number(e.target.value))))}
              />
              <button className="w-8 h-8 border rounded dark:bg-[#23272f] dark:border-gray-700 dark:text-white" onClick={() => setQuantity(q => Math.min(product.stock_quantity || 1, q + 1))}>+</button>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg text-lg flex items-center justify-center gap-2 shadow-md dark:bg-green-700 dark:hover:bg-green-800"
                size="lg"
                onClick={() => {
                  if (productSlug && product) {
                    cacheProduct(String(productSlug), product);
                    warmCacheInBackground();
                  }
                  navigate(`/store/${storeSlug}/checkout/${productSlug}`);
                }}
              >
                <ShoppingCart className="w-5 h-5" /> Buy Now
              </Button>
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" className="flex-1 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 py-2 rounded-lg flex items-center justify-center gap-2" size="sm">
                <Share2 className="w-4 h-4" /> Share
              </Button>
              <Button variant="outline" className="flex-1 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-red-500 py-2 rounded-lg flex items-center justify-center gap-2" size="sm">
                <Flag className="w-4 h-4" /> Report
              </Button>
            </div>
          </div>
        </div>
      </div>
      {/* Bottom Feature Cards */}

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mt-6 md:mt-4 md:mt-6">
        <div className="bg-white dark:bg-[#23272f] rounded-xl shadow p-6 flex flex-col items-center text-center">
          <span className="material-icons text-2xl md:text-xl md:text-2xl text-blue-500 dark:text-blue-400 mb-2">local_shipping</span>
          <div className="font-bold mb-1 dark:text-white">Fast Delivery</div>
          <div className="text-gray-500 dark:text-gray-300 text-sm">Get your products delivered quickly and safely</div>
        </div>
        <div className="bg-white dark:bg-[#23272f] rounded-xl shadow p-6 flex flex-col items-center text-center">
          <span className="material-icons text-2xl md:text-xl md:text-2xl text-blue-500 dark:text-blue-400 mb-2">verified_user</span>
          <div className="font-bold mb-1 dark:text-white">Buyer Protection</div>
          <div className="text-gray-500 dark:text-gray-300 text-sm">Your purchase is protected with our guarantee</div>
        </div>
        <div className="bg-white dark:bg-[#23272f] rounded-xl shadow p-6 flex flex-col items-center text-center">
          <span className="material-icons text-2xl md:text-xl md:text-2xl text-blue-500 dark:text-blue-400 mb-2">star</span>
          <div className="font-bold mb-1 dark:text-white">Quality Verified</div>
          <div className="text-gray-500 dark:text-gray-300 text-sm">All products are verified by our team</div>
        </div>
      </div>
    </div>
    </>
  );
}

export default PublicProduct;
