import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { GoogleOAuthProvider } from "@react-oauth/google";

import { ShopProvider } from "./src/context/ShopContext";
import ScrollToTop from "./src/components/ScrollToTop";
import Layout from "./src/components/Layout";

const Home = lazy(() => import("./src/pages/Home"));
const Shop = lazy(() => import("./src/pages/Shop"));
const ProductDetail = lazy(() => import("./src/pages/ProductDetail"));
const Cart = lazy(() => import("./src/pages/Cart"));
const Checkout = lazy(() => import("./src/pages/Checkout"));
const About = lazy(() => import("./src/pages/About"));
const Contact = lazy(() => import("./src/pages/Contact"));
const NotFound = lazy(() => import("./src/pages/NotFound"));
const Wishlist = lazy(() => import("./src/pages/Wishlist"));
const Auth = lazy(() => import("./src/pages/Auth"));
const Profile = lazy(() => import("./src/pages/Profile"));
const Addresses = lazy(() => import("./src/pages/Addresses"));
const OrderSuccess = lazy(() => import("./src/pages/OrderSuccess"));

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center bg-baba-softbg">
    <div className="text-center">
      <div className="w-10 h-10 mx-auto rounded-full border-4 border-baba-primary/20 border-t-baba-primary animate-spin" />
      <p className="mt-3 text-sm text-gray-500">Loading...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <GoogleOAuthProvider clientId="997556493278-gjo799eqc94t5s3bvl0fmlf66ggjluvc.apps.googleusercontent.com">
      <ShopProvider>
        <Router>
          <ScrollToTop />
          <Layout>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/addresses" element={<Addresses />} />
                <Route path="/order-success" element={<OrderSuccess />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Layout>

          <ToastContainer
            position="bottom-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
          />
        </Router>
      </ShopProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
