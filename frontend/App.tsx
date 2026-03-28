import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { GoogleOAuthProvider } from "@react-oauth/google";

import { ShopProvider } from "./src/context/ShopContext";
import ScrollToTop from "./src/components/ScrollToTop";
import Layout from "./src/components/Layout";

import Home from "./src/pages/Home";
import Shop from "./src/pages/Shop";
import ProductDetail from "./src/pages/ProductDetail";
import Cart from "./src/pages/Cart";
import Checkout from "./src/pages/Checkout";
import Admin from "./src/pages/Admin";
import About from "./src/pages/About";
import Contact from "./src/pages/Contact";
import NotFound from "./src/pages/NotFound";
import Wishlist from "./src/pages/Wishlist";
import Auth from "./src/pages/Auth";
import Profile from "./src/pages/Profile";
import Addresses from "./src/pages/Addresses";
import OrderSuccess from "./src/pages/OrderSuccess";

const App: React.FC = () => {
  return (
    <GoogleOAuthProvider clientId="997556493278-gjo799eqc94t5s3bvl0fmlf66ggjluvc.apps.googleusercontent.com">
      <ShopProvider>
        <Router>
          <ScrollToTop />

          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/admin/*" element={<Admin />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/addresses" element={<Addresses />} />
              <Route path="*" element={<NotFound />} />
              <Route path="/order-success" element={<OrderSuccess />} />
            </Routes>
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