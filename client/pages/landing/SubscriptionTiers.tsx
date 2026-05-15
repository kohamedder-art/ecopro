import React, { useState, useEffect } from 'react';
import { Check, Crown, Zap, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface Tier {
  id: string;
  name: string;
  description: string;
  price: number | null;
  period: string;
  badge?: string;
  color: {
    bg: string;
    border: string;
    text: string;
    icon: string;
    button: string;
    buttonHover: string;
  };
  icon: React.ReactNode;
  features: string[];
  cta: string;
  ctaAction: () => void;
  highlighted?: boolean;
}

export default function SubscriptionTiers() {
  const navigate = useNavigate();
  const [isAnnual, setIsAnnual] = useState(false);
  const [subscriptionPrice, setSubscriptionPrice] = useState(7);
  const [trialDays, setTrialDays] = useState(30);

  useEffect(() => {
    fetch('/api/billing/public/settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          if (data.subscription_price) setSubscriptionPrice(Number(data.subscription_price));
          if (data.trial_days) setTrialDays(Number(data.trial_days));
        }
      })
      .catch(() => {});
  }, []);

  const tiers: Tier[] = [
    {
      id: 'bronze',
      name: 'Bronze',
      description: 'Perfect for getting started',
      price: null,
      period: 'Forever Free',
      color: {
        bg: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20',
        border: 'border-amber-200 dark:border-amber-800',
        text: 'text-amber-900 dark:text-amber-100',
        icon: 'text-amber-600 dark:text-amber-400',
        button: 'bg-amber-600 hover:bg-amber-700',
        buttonHover: 'hover:shadow-lg hover:shadow-amber-500/30',
      },
      icon: <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center"><span className="text-2xl">🥉</span></div>,
      features: [
        'Up to 10 products',
        'Basic store customization',
        'Standard templates',
        'Order management',
        'Email support',
        'Basic analytics',
        'Mobile responsive store',
        'SSL security',
      ],
      cta: 'Get Started',
      ctaAction: () => navigate('/signup'),
    },
    {
      id: 'gold',
      name: 'Gold',
      description: 'For growing businesses',
      price: subscriptionPrice,
      period: isAnnual ? '/year' : '/month',
      badge: 'Most Popular',
      highlighted: true,
      color: {
        bg: 'bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30',
        border: 'border-yellow-300 dark:border-yellow-700',
        text: 'text-yellow-900 dark:text-yellow-100',
        icon: 'text-yellow-600 dark:text-yellow-400',
        button: 'bg-yellow-500 hover:bg-yellow-600',
        buttonHover: 'hover:shadow-lg hover:shadow-yellow-400/40',
      },
      icon: <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center"><span className="text-2xl">🥇</span></div>,
      features: [
        'Unlimited products',
        'Advanced customization',
        'Priority templates',
        'Advanced order management',
        'Priority email support',
        'Advanced analytics & reports',
        'Code requests & messaging',
        'Custom domain support',
        'API access',
        'Marketing tools',
      ],
      cta: 'Start Free Trial',
      ctaAction: () => navigate('/dashboard'),
    },
    {
      id: 'platinum',
      name: 'Platinum',
      description: 'For enterprises',
      price: subscriptionPrice * 2,
      period: isAnnual ? '/year' : '/month',
      badge: 'Enterprise',
      color: {
        bg: 'bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950/20 dark:to-gray-950/20',
        border: 'border-gray-300 dark:border-gray-700',
        text: 'text-gray-900 dark:text-gray-100',
        icon: 'text-gray-700 dark:text-gray-300',
        button: 'bg-gray-800 hover:bg-gray-900 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900',
        buttonHover: 'hover:shadow-lg hover:shadow-gray-600/30 dark:hover:shadow-white/20',
      },
      icon: <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center"><span className="text-2xl">👑</span></div>,
      features: [
        'Everything in Gold',
        'Dedicated account manager',
        'Custom integrations',
        'Advanced security features',
        '24/7 phone support',
        'White label options',
        'Custom branding',
        'Advanced automation',
        'Bulk operations',
        'Priority feature requests',
        'Compliance management',
        'SLA guarantee',
      ],
      cta: 'Contact Sales',
      ctaAction: () => navigate('/contact'),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-slate-300 mb-8">
            Start free and scale as you grow. No credit card required.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={`text-lg font-medium transition-colors ${!isAnnual ? 'text-white' : 'text-slate-400'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-14 h-8 bg-slate-700 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500"
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transform transition-transform ${
                  isAnnual ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-lg font-medium transition-colors ${isAnnual ? 'text-white' : 'text-slate-400'}`}>
              Annual
              {isAnnual && <span className="ml-2 text-sm bg-green-500/20 text-green-300 px-2 py-1 rounded-full">Save 25%</span>}
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
                tier.highlighted
                  ? 'md:scale-105 md:shadow-2xl shadow-xl'
                  : 'hover:shadow-xl'
              }`}
            >
              {/* Badge */}
              {tier.badge && (
                <div className="absolute top-0 right-0 z-10">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-1 rounded-bl-xl text-sm font-bold">
                    {tier.badge}
                  </div>
                </div>
              )}

              {/* Card Background */}
              <div className={`${tier.color.bg} border-2 ${tier.color.border} h-full backdrop-blur-sm`}>
                <div className="p-8">
                  {/* Icon & Name */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className={`text-3xl font-bold ${tier.color.text} mb-2`}>
                        {tier.name}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {tier.description}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {tier.icon}
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="mb-8 pb-8 border-b border-current border-opacity-20">
                    <div className="flex items-baseline gap-2">
                      {tier.price !== null ? (
                        <>
                          <span className={`text-5xl font-bold ${tier.color.text}`}>
                            {tier.price} دج
                          </span>
                          <span className="text-slate-600 dark:text-slate-400">
                            {tier.period}
                          </span>
                        </>
                      ) : (
                        <span className={`text-4xl font-bold ${tier.color.text}`}>
                          {tier.period}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-4 mb-8">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <div className={`flex-shrink-0 mt-0.5 ${tier.color.icon}`}>
                          <Check className="w-5 h-5" />
                        </div>
                        <span className="text-slate-700 dark:text-slate-300">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    onClick={tier.ctaAction}
                    className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-200 ${tier.color.button} ${tier.color.buttonHover} transform hover:scale-105 active:scale-95`}
                  >
                    {tier.cta}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mt-20 bg-slate-800/50 border border-slate-700 rounded-2xl p-8 backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-400" />
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            {[
              {
                q: 'Can I change plans anytime?',
                a: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards through RedotPay. All payments are secure and encrypted.',
              },
              {
                q: 'Is there a free trial for paid plans?',
                a: `Yes! Bronze starts with a ${trialDays}-day free trial. No credit card required to get started.`,
              },
              {
                q: 'What happens if I cancel?',
                a: 'You can cancel anytime. Your store and data remain active until the end of your billing period.',
              },
            ].map((item, index) => (
              <div key={index} className="border-b border-slate-700 pb-4 last:border-b-0">
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-sm">
                    ?
                  </span>
                  {item.q}
                </h3>
                <p className="text-slate-400">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-16 flex justify-center gap-8 flex-wrap">
          <div className="text-center">
            <div className="text-3xl mb-2">🔒</div>
            <p className="text-slate-400">SSL Secure</p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">✓</div>
            <p className="text-slate-400">Money-back Guarantee</p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">📞</div>
            <p className="text-slate-400">24/7 Support</p>
          </div>
        </div>
      </div>
    </div>
  );
}
