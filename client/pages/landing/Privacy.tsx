export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <p className="text-gray-600 mb-4">Last updated: September 10, 2026. Sahla4Eco (sahla4eco.com) is an Algerian e-commerce platform. This policy explains what data we collect and why.</p>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">1. Account Data</h2>
          <p className="text-gray-700">
            When you create an account, including signing in with Google, we store your name,
            email address and avatar. Google Sign-In shares only your basic profile
            (name, email, avatar) with us.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">2. Google Sheets Access</h2>
          <p className="text-gray-700">
            If you connect your Google account for order export, we request the spreadsheets
            scope solely to write your store orders into spreadsheets you choose. We never
            read unrelated files. You can revoke access at any time in your Google Account
            settings or by disconnecting in the dashboard.
          </p>
        </section>
        
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">3. Order Information</h2>
          <p className="text-gray-700">
            When customers place orders we collect name, phone number, and delivery address
            (wilaya, commune), ordered products and payment/delivery details, and share them
            with the store owner and the chosen delivery company to fulfill the order.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">4. Third Parties We Share Data With</h2>
          <p className="text-gray-700">
            We do not sell personal data. We share data only as needed to operate the service:
            delivery companies (name, phone, address to ship orders), messaging platforms
            (Telegram, WhatsApp, Messenger — only identifiers you opted in), Google (Sign-In
            profile and Sheets content you explicitly connect), and payment/advertising pixels
            you configure yourself (Meta, TikTok, Snapchat).
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">4. Messaging Identifiers</h2>
          <p className="text-gray-700">
            When you opt in to order notifications we store messaging identifiers
            (such as Telegram chat id or Messenger PSID) to send order status updates.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">5. Cookies</h2>
          <p className="text-gray-700">
            We use strictly necessary cookies for login sessions, store selection and
            CSRF protection. No advertising cookies.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">6. Retention and Your Rights</h2>
          <p className="text-gray-700">
            Order and account data is kept while your account is active. You can request access to,
            correction of, or deletion of your personal data at any time via the dashboard or by
            contacting us. You can opt-out of messaging notifications at any time.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">7. Contact Us</h2>
          <p className="text-gray-700">
            For questions about this privacy policy: sahla4eco@gmail.com
          </p>
        </section>
      </div>
    </div>
  );
}
