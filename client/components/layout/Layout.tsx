import { PropsWithChildren } from "react";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";

export default function Layout({ children }: PropsWithChildren) {
  const location = useLocation();
  const isStorefrontPage = location.pathname.startsWith('/store/');
  const isDashboardPage = location.pathname.startsWith('/dashboard');
  const isTemplateEditor = location.pathname === '/template-editor';
  const isStaffPage = location.pathname.startsWith('/staff/');
  const isPlatformAdmin = location.pathname.startsWith('/platform-admin');
  const isChatPage = location.pathname === '/chat';

  // Dashboard, staff, storefront, and platform-admin pages have their own complete layout - just render children
  // Platform-admin pages will render Header themselves
  if (isStorefrontPage || isDashboardPage || isTemplateEditor || isStaffPage || isPlatformAdmin) {
    return <>{children}</>;
  }

  return (
    <div className={isChatPage ? "flex flex-col h-screen overflow-hidden" : "min-h-screen flex flex-col"}>
      <Header />
      <main className={isChatPage ? "flex-1 overflow-hidden" : "flex-1"}>
        {children}
      </main>
      {!isChatPage && <Footer />}
    </div>
  );
}
