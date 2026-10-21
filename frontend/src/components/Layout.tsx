import React from 'react';
    import Navbar from './Navbar';
    import Footer from './Footer';
    import InAppBrowserNotice from './InAppBrowserNotice';
    import { useLocation } from 'react-router-dom';

    const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
      const location = useLocation();
      const isAdminRoute = location.pathname.startsWith('/admin');
      // Only where a customer is about to buy; not on checkout, which handles
      // in-app browsers itself by offering only methods that work there.
      const isPurchaseRoute = /^\/(product|cart)/.test(location.pathname);

      if (isAdminRoute) return <>{children}</>;

      return (
        <div className="min-h-screen flex flex-col bg-baba-background text-baba-textdark font-sans selection:bg-baba-accent/30 selection:text-baba-primary">
          <Navbar />
          {isPurchaseRoute && <InAppBrowserNotice />}
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
        </div>
      );
    };

    export default Layout;
