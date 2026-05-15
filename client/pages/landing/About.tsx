import { Heart, Zap, Shield, Target, Users, Sparkles, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function About() {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden relative font-['Noto_Sans_Arabic']">
      <div className="fixed top-0 left-0 w-full h-full z-0 bg-[radial-gradient(circle_at_10%_10%,rgba(99,102,241,0.08)_0%,transparent_35%),radial-gradient(circle_at_90%_90%,rgba(168,85,247,0.05)_0%,transparent_35%),#f8fafc] dark:bg-[radial-gradient(circle_at_10%_10%,rgba(99,102,241,0.15)_0%,transparent_35%),radial-gradient(circle_at_90%_90%,rgba(168,85,247,0.10)_0%,transparent_35%),#020617]"></div>
      
      <div className="relative pt-32 pb-16 px-6 overflow-hidden z-10 w-full">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[50vw] h-[40vh] bg-[radial-gradient(circle,rgba(99,102,241,0.15)_0%,transparent_60%)] blur-[80px] z-0 opacity-80 pointer-events-none"></div>
        
        <div className="max-w-4xl mx-auto relative z-10">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 space-x-reverse bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">منصتكم، قصتكم</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-6 tracking-tight text-slate-900 dark:text-white leading-tight">
              Sahla4Eco: التجارة الإلكترونية للجميع، <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-400">وليس للقلة</span>
            </h1>
          </div>

          {/* Story Section */}
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-sm rounded-3xl p-8 md:p-10 mb-12 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-md transition-all">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Heart className="text-white w-6 h-6" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">قصتنا: كسر حواجز الأسعار</h2>
            </div>
            <div className="space-y-6 text-slate-700 dark:text-slate-300 font-medium leading-loose text-lg">
              <p>
                بدأت رحلتنا بملاحظة بسيطة ومؤلمة: منصات التجارة الإلكترونية في الجزائر أصبحت مكلفة للغاية. عندما تفرض المنصات مبالغ تفوق 50 دولاراً شهرياً، فهي لا تساعد الشباب، بل تعيقهم. نحن نعتبر هذه الأسعار المبالغ فيها عائقاً أمام الإبداع والنمو.
              </p>
              <p>
                Sahla4Eco لم تُنشأ لتكون مجرد منصة أخرى، بل لتكون الحل البديل. لقد قمنا ببناء هذه المنصة باستخدام أحدث التقنيات الذكية لتقليل تكاليفنا التشغيلية، حتى نتمكن من تمرير هذه التوفيرات إليك. نحن لا نهتم بمن قام بالبرمجة، ما يهمنا هو أن تحصل على متجر احترافي، سهل الاستخدام، وبسعر عادل.
              </p>
            </div>
          </div>

          {/* Vision Section */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-8 md:p-10 mb-12 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Target className="text-white w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black">رؤيتنا: العدالة الرقمية</h2>
              </div>
              <p className="text-lg leading-loose text-indigo-100">
                رؤيتنا واضحة: تمكين كل تاجر جزائري—من المبتدئ الذي يملك منتجاً واحداً إلى المحترف الذي يدير مئات الطلبات—من الوصول إلى تكنولوجيا عالمية دون الحاجة إلى دفع &quot;ضرائب&quot; باهظة للمنصات الأخرى.
              </p>
            </div>
          </div>

          {/* Values Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl p-6 hover:-translate-y-1 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-700 transition-all duration-300">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mb-4 text-slate-700 dark:text-slate-300">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">سهولة مطلقة</h3>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">صممنا الواجهة لتكون بسيطة جداً، بحيث يمكنك إطلاق متجرك في دقائق.</p>
            </div>
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl p-6 hover:-translate-y-1 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-700 transition-all duration-300">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mb-4 text-slate-700 dark:text-slate-300">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">سعر عادل</h3>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">نحن هنا لنكسر احتكار الأسعار المرتفعة. السعر المنخفض لا يعني جودة أقل، بل يعني كفاءة أعلى.</p>
            </div>
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl p-6 hover:-translate-y-1 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-700 transition-all duration-300">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mb-4 text-slate-700 dark:text-slate-300">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">دعم حقيقي</h3>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">نحن معكم خطوة بخطوة، لأن نجاحكم هو دليل على أن رؤيتنا كانت صحيحة.</p>
            </div>
          </div>

          {/* Join the Revolution - CTA */}
          <div className="text-center rounded-3xl p-10 bg-gradient-to-br from-indigo-900 to-slate-900 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
            <div className="relative z-10">
              <h2 className="text-2xl md:text-3xl font-black mb-4">انضم إلى الثورة</h2>
              <p className="text-indigo-100 font-medium max-w-2xl mx-auto mb-8 leading-relaxed text-lg">
                نحن لا نبيع مجرد برمجيات؛ نحن نبيع الفرصة. Sahla4Eco هي عائلتكم الجديدة التي تؤمن بأن التكنولوجيا يجب أن تخدم الجميع، وليس فقط من يملك المال الوفير.
              </p>
              <p className="text-white font-black text-xl mb-8">
                حان الوقت للتوقف عن دفع الأسعار الخيالية. ابدأ اليوم مع Sahla4Eco.
              </p>
              <Link to="/dashboard" className="inline-flex items-center gap-2 bg-white text-slate-900 px-8 py-4 rounded-full font-black text-lg hover:bg-slate-50 transition-colors shadow-lg hover:scale-105 active:scale-95">
                ابدأ الآن مجاناً
                <ArrowLeft className="w-5 h-5 text-indigo-600" />
              </Link>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
