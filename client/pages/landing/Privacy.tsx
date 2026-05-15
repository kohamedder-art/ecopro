export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <p className="text-gray-600 mb-4">Last updated: January 11, 2026</p>
        
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
          <p className="text-gray-700">
            We collect information you provide directly, including your name, phone number, 
            and delivery address when placing orders. We also collect messaging identifiers 
            (such as Telegram or Facebook Messenger IDs) when you opt-in to receive order notifications.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
          <p className="text-gray-700">
            We use your information to process and deliver your orders, send order status 
            notifications via your preferred messaging platform, and improve our services.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">3. Information Sharing</h2>
          <p className="text-gray-700">
            We do not sell your personal information. We share your information only with 
            delivery partners to fulfill your orders and with messaging platforms (Telegram, 
            Facebook Messenger) to send you notifications you've opted into.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">4. Data Security</h2>
          <p className="text-gray-700">
            We implement appropriate security measures to protect your personal information 
            against unauthorized access, alteration, or destruction.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">5. Your Rights</h2>
          <p className="text-gray-700">
            You can request access to, correction of, or deletion of your personal data 
            by contacting us. You can opt-out of messaging notifications at any time.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">6. Contact Us</h2>
          <p className="text-gray-700">
            For questions about this privacy policy, please contact the store directly.
          </p>
        </section>
      </div>
    </div>
  );
}
