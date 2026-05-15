import { Clock, Download, Eye, ShoppingCart, Tag, DollarSign, Check, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { GradientCard } from "@/components/ui/GradientCard";
import { useTranslation } from "@/lib/i18n";

export default function EnhancedDashboard() {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState({
    days: 1,
    hours: 22,
    minutes: 36,
    seconds: 32
  });

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else if (prev.days > 0) {
          return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const stats = [
    { 
      title: "Visits", 
      value: "1", 
      icon: <Eye className="w-10 h-10" style={{ color: '#1d4ed8' }} />, 
      gradient: "from-blue-500 to-cyan-500",
      iconBg: "bg-blue-200 dark:bg-blue-500/20",
      iconColor: "text-blue-700 dark:text-blue-400",
      textColor: "text-blue-500 dark:text-blue-400",
      cardFrom: "from-blue-500/20",
      cardTo: "to-blue-500/5",
      cardBorder: "border-blue-500/30"
    },
    { 
      title: "Revenue", 
      value: "0 DZD", 
      icon: <DollarSign className="w-10 h-10" style={{ color: '#15803d' }} />, 
      gradient: "from-green-500 to-emerald-500",
      iconBg: "bg-green-200 dark:bg-green-500/20",
      iconColor: "text-green-700 dark:text-green-400",
      textColor: "text-green-500 dark:text-green-400",
      cardFrom: "from-green-500/20",
      cardTo: "to-green-500/5",
      cardBorder: "border-green-500/30"
    },
    { 
      title: "Available Products", 
      value: "0", 
      icon: <Tag className="w-10 h-10" style={{ color: '#7e22ce' }} />, 
      gradient: "from-purple-500 to-pink-500",
      iconBg: "bg-purple-200 dark:bg-purple-500/20",
      iconColor: "text-purple-700 dark:text-purple-400",
      textColor: "text-purple-500 dark:text-purple-400",
      cardFrom: "from-purple-500/20",
      cardTo: "to-purple-500/5",
      cardBorder: "border-purple-500/30"
    },
    { 
      title: "New Orders", 
      value: "0", 
      icon: <ShoppingCart className="w-10 h-10" style={{ color: '#c2410c' }} />, 
      gradient: "from-orange-500 to-red-500",
      iconBg: "bg-orange-200 dark:bg-orange-500/20",
      iconColor: "text-orange-700 dark:text-orange-400",
      textColor: "text-orange-500 dark:text-orange-400",
      cardFrom: "from-orange-500/20",
      cardTo: "to-orange-500/5",
      cardBorder: "border-orange-500/30"
    },
  ];

  const quickStats = [
    { label: "Orders", value: "15 / 0", status: "success" },
    { label: "Pixels", value: "1 / 0", status: "success" },
    { label: "Ad Catalogs", value: "0 / 0", status: "error" },
    { label: "Custom Domains", value: "0 / 0", status: "error" },
    { label: "Store Hustle", value: "1 / 1", status: "error" },
  ];

  const setupSteps = [
    { title: "Add Store Logo", completed: true },
    { title: "Add Products", completed: false },
    { title: "Set Delivery Prices and Regions", completed: false },
    { title: "Link your Telegram account to receive new order notifications", completed: false },
    { title: "Add contact methods for your customers", completed: false },
  ];

  const completedSteps = setupSteps.filter(s => s.completed).length;
  const totalSteps = setupSteps.length;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Welcome Banner - Unique diagonal split design */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-100 via-blue-100 to-cyan-100 dark:from-black dark:via-black dark:to-black border-2 border-violet-300 dark:border-gray-800 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(139,92,246,0.2),transparent_50%)] dark:bg-[radial-gradient(circle_at_30%_50%,rgba(139,92,246,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(6,182,212,0.2),transparent_50%)] dark:bg-[radial-gradient(circle_at_70%_50%,rgba(6,182,212,0.1),transparent_50%)]"></div>
        
        <div className="relative z-10 p-6 md:p-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5 md:gap-6">
            <div className="text-center md:text-right">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 mb-5">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-lg font-medium">Online Now</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                <span className="bg-gradient-to-l from-primary via-accent to-purple-600 bg-clip-text text-transparent">
                  Welcome, Walid
                </span>
              </h1>
              <p className="text-muted-foreground text-2xl md:text-3xl">Ready to make sales today?</p>
            </div>
            
            <div className="flex items-center gap-5">
              <Button size="lg" className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg text-lg px-8 py-6">
                <Tag className="w-6 h-6 ml-2" />
                Add New Product
              </Button>
              <Button size="lg" variant="outline" className="border-2 text-lg px-8 py-6">
                <Eye className="w-6 h-6 ml-2" />
                Preview Store
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid - Unique card design with diagonal accent */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, idx) => (
          <GradientCard
            key={idx}
            title={stat.title}
            value={stat.value}
            icon={<div className={stat.iconColor}>{stat.icon}</div>}
            from={stat.cardFrom}
            to={stat.cardTo}
            border={stat.cardBorder}
            iconBg={stat.iconBg}
            valueClassName={stat.textColor}
            className="group relative hover:shadow-2xl hover:scale-105"
          >
            {/* Diagonal accent line */}
            <div className={`absolute top-0 left-0 w-2 h-full bg-gradient-to-b ${stat.gradient}`}></div>
          </GradientCard>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
        {/* Left Column - Subscription & Stats */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          {/* Subscription Card */}
          <div className="relative rounded-xl border-2 border-rose-300 dark:border-gray-800 bg-gradient-to-br from-rose-100 via-amber-100 to-orange-100 dark:from-black dark:via-black dark:to-black p-6 md:p-10 text-center overflow-hidden shadow-lg">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-pink-400/30 to-rose-500/30 rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-amber-400/30 to-orange-500/30 rounded-full blur-2xl"></div>
            
            <div className="relative z-10">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-yellow-500/10 border border-yellow-500/20 mb-6">
                <span className="text-4xl">⏰</span>
                <span className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">Trial Period</span>
              </div>
              <h3 className="font-bold text-3xl md:text-4xl mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Your Subscription Usage</h3>
            <p className="text-xl text-muted-foreground mb-8">
              Current Month: Nov 06, 2025 15:52 - Nov 08, 2025 15:52
            </p>

            {/* Countdown */}
            <div className="flex items-center justify-center gap-6 mb-6 md:mb-8">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl blur opacity-50"></div>
                  <div className="relative bg-gradient-to-br from-red-500 to-orange-500 text-white rounded-xl p-6 min-w-[110px]">
                    <div className="text-4xl md:text-5xl font-bold">{String(timeLeft.days).padStart(2, '0')}</div>
                    <div className="text-lg font-medium mt-1">Day</div>
                  </div>
                </div>
                <span className="text-3xl md:text-4xl font-bold text-muted-foreground">:</span>
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl blur opacity-50"></div>
                  <div className="relative bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-xl p-6 min-w-[110px]">
                    <div className="text-4xl md:text-5xl font-bold">{String(timeLeft.hours).padStart(2, '0')}</div>
                    <div className="text-lg font-medium mt-1">Hour</div>
                  </div>
                </div>
                <span className="text-3xl md:text-4xl font-bold text-muted-foreground">:</span>
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur opacity-50"></div>
                  <div className="relative bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-xl p-6 min-w-[110px]">
                    <div className="text-4xl md:text-5xl font-bold">{String(timeLeft.minutes).padStart(2, '0')}</div>
                    <div className="text-lg font-medium mt-1">Minute</div>
                  </div>
                </div>
                <span className="text-3xl md:text-4xl font-bold text-muted-foreground">:</span>
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl blur opacity-50"></div>
                  <div className="relative bg-gradient-to-br from-green-500 to-emerald-500 text-white rounded-xl p-6 min-w-[110px]">
                    <div className="text-4xl md:text-5xl font-bold">{String(timeLeft.seconds).padStart(2, '0')}</div>
                    <div className="text-lg font-medium mt-1">Second</div>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-lg md:text-xl text-red-500 font-semibold mb-8 flex items-center justify-center gap-3">
              <span className="text-3xl">⚠️</span>
              Your free trial period ends in:
            </p>

            <Button size="lg" className="w-full max-w-lg bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg hover:shadow-xl transition-all text-xl py-7">
              <span className="text-2xl">✨</span>
              Upgrade Your Subscription Now
            </Button>
            </div>

            {/* Details Link */}
            <button className="flex items-center justify-center gap-3 w-full mt-6 text-lg text-primary hover:underline font-medium">
              <ChevronLeft className="w-6 h-6" />
              View Details
            </button>
          </div>

          {/* Overview Stats */}
          <div>
            <h3 className="font-bold text-3xl mb-8 flex items-center gap-4">
              <span className="text-4xl">📊</span>
              Overview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <GradientCard
                  key={index}
                  title={stat.title}
                  value={stat.value}
                  icon={<div className={stat.iconColor}>{stat.icon}</div>}
                  from={stat.cardFrom}
                  to={stat.cardTo}
                  border={stat.cardBorder}
                  iconBg={stat.iconBg}
                  valueClassName={stat.textColor}
                  className="group text-center relative hover:shadow-2xl hover:-translate-y-2"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-5 group-hover:opacity-10 transition-opacity`}></div>
                  <div className="relative z-10 mt-3 flex items-center justify-center">
                    <div className={"inline-flex items-center justify-center w-16 h-16 rounded-xl " + stat.iconBg + " mb-3 group-hover:scale-110 transition-transform"}>
                      {/* icon already colored via wrapper */}
                    </div>
                  </div>
                  <div className={`absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br ${stat.gradient} opacity-10 rounded-full`}></div>
                </GradientCard>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="rounded-2xl border-2 border-teal-300 dark:border-gray-800 bg-gradient-to-br from-cyan-50 via-teal-50 to-emerald-50 dark:from-black dark:via-black dark:to-black p-8 shadow-2xl">
            <h3 className="font-bold text-3xl mb-6 flex items-center gap-4">
              <span className="text-4xl">📈</span>
              Quick Stats
            </h3>
            <div className="space-y-4">
              {quickStats.map((stat, index) => (
                <div key={index} className="flex items-center justify-between py-5 px-6 rounded-xl bg-white dark:bg-black hover:bg-blue-50 dark:hover:bg-gray-900 transition-colors shadow-md border border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-5">
                    {stat.status === "success" ? (
                      <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Check className="w-7 h-7 text-green-500" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
                        <span className="text-red-500 font-bold text-xl">—</span>
                      </div>
                    )}
                    <span className="text-xl font-medium">{stat.label}</span>
                  </div>
                  <span className="font-bold text-3xl">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Setup & App */}
        <div className="space-y-6 md:space-y-8">
          {/* Setup Checklist */}
          <div className="rounded-2xl border-2 border-lime-300 dark:border-gray-800 bg-gradient-to-br from-lime-50 via-emerald-50 to-teal-50 dark:from-black dark:via-black dark:to-black p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-3xl flex items-center gap-4">
                <span className="text-4xl">✅</span>
                Complete Your Store Setup
              </h3>
              <div className="px-5 py-2.5 rounded-full bg-accent/20 text-accent text-lg font-bold">
                {completedSteps}/{totalSteps}
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="mb-6 h-5 bg-gradient-to-r from-gray-200 to-gray-300 dark:bg-muted rounded-full overflow-hidden shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-lime-400 via-emerald-500 to-teal-500 transition-all duration-500 shadow-lg"
                style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
              ></div>
            </div>
            
            <div className="space-y-4">
              {setupSteps.map((step, index) => (
                <div key={index} className={`flex items-start gap-5 p-6 rounded-xl transition-all ${
                  step.completed 
                    ? 'bg-green-100 dark:bg-green-950 border-2 border-green-400 dark:border-green-800 shadow-md' 
                    : 'bg-white dark:bg-black border-2 border-gray-300 dark:border-gray-800 hover:border-primary hover:shadow-lg'
                }`}>
                  <button className="mt-0.5 hover:scale-110 transition-transform">
                    <ChevronLeft className="w-7 h-7 text-primary" />
                  </button>
                  <div className="flex-1 text-right">
                    <div className={`text-lg md:text-xl font-medium ${step.completed ? 'line-through text-muted-foreground' : ''}`}>
                      {step.title}
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    step.completed 
                      ? 'bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/50' 
                      : 'bg-muted border-2 border-muted-foreground/20'
                  }`}>
                    {step.completed && <Check className="w-7 h-7 text-white" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* App Promotion */}
          <div className="relative rounded-2xl border-2 border-fuchsia-400 dark:border-gray-800 bg-gradient-to-br from-fuchsia-100 via-purple-100 to-indigo-100 dark:from-black dark:via-black dark:to-black p-6 md:p-10 text-center overflow-hidden shadow-2xl">
            {/* Animated background */}
            <div className="absolute inset-0">
              <div className="absolute top-0 left-0 w-32 h-32 bg-fuchsia-400/30 rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute bottom-0 right-0 w-40 h-40 bg-purple-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            </div>
            
            <div className="relative z-10">
              <div className="text-5xl mb-5 animate-bounce">📱</div>
              <h3 className="font-bold text-3xl mb-5 flex items-center justify-center gap-4">
                <span className="text-4xl">🚀</span>
                Our Apps
              </h3>
              <div className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                CALL VERIFICATION
              </div>
              <div className="inline-flex items-center gap-3 px-6 py-4 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 mb-5">
                <span className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  SCAN APP
                </span>
              </div>
              <p className="text-lg md:text-xl text-muted-foreground mb-8">
                Scan and track your products easily
              </p>
              <Button size="lg" className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all group text-xl py-7">
                <Download className="w-6 h-6 ml-2 group-hover:animate-bounce" />
                Download the App Now
              </Button>
              
              {/* App features */}
              <div className="mt-8 space-y-4 text-lg text-muted-foreground">
                <div className="flex items-center justify-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span>Available on Android and iOS</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <span>100% Free</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
