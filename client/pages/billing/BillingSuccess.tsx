import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BillingSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionToken = searchParams.get('session');

  useEffect(() => {
    // Redirect after 3 seconds if user doesn't click button
    const timer = setTimeout(() => {
      navigate('/dashboard');
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-green-200 dark:bg-green-900/30 rounded-full blur-xl animate-pulse"></div>
            <CheckCircle className="w-20 h-20 text-green-600 dark:text-green-400 relative" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Payment Successful!
        </h1>

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-300 mb-2">
          Thank you for your subscription payment.
        </p>

        {/* Details */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-8 border border-green-200 dark:border-green-800">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Amount Paid</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">2000 DZD</p>
            </div>
            <div className="border-t border-green-200 dark:border-green-800 pt-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">✓ Activated</p>
            </div>
            <div className="border-t border-green-200 dark:border-green-800 pt-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">Next Billing Date</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-8 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Your subscription is now active! You can access all features of your store immediately.
          </p>
        </div>

        {/* Action Button */}
        <Button
          onClick={() => navigate('/dashboard')}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 gap-2"
        >
          Go to Dashboard
          <ArrowRight className="w-4 h-4" />
        </Button>

        {/* Secondary Text */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
          Redirecting to dashboard in a few seconds...
        </p>
      </div>
    </div>
  );
};

export default BillingSuccess;
