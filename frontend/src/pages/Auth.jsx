import React, { useState } from "react";
import { motion } from "framer-motion";
import { FcGoogle } from "react-icons/fc";
import { useNavigate } from "react-router-dom";
import { useShop } from "../context/ShopContext";
import { useGoogleLogin } from '@react-oauth/google';
import { toast } from "react-toastify";
export default function Auth() {
  const navigate = useNavigate();
  const { setUser } = useShop();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ 1. Move the Hook to the Top Level
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const res = await fetch("http://api.babatextiles.com/api/auth/google/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: tokenResponse.access_token }),
        });

        const data = await res.json();
        if (res.ok) {
          localStorage.setItem("token", data.access);
          setUser(data.user);
          toast.success("Login successful ✅");
          navigate("/");
        } else {
          toast.error(data.error || "Google Auth failed on server");
        }
      } catch (err) {
        console.error("Google Login Failed", err);
        toast.error("Server error during Google Login");
      } finally {
        setLoading(false);
      }
    },
    onError: () => toast.error("Google Login Failed ❌"),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password || (!isLogin && !name)) {
      toast.error("Please fill all fields");
      return;
    }

    setLoading(true);

    try {
      const url = isLogin
        ? "https://api.babatextiles.com/api/auth/login/"
        : "https://api.babatextiles.com/api/auth/register/";

      const body = isLogin
        ? { email, password }
        : { first_name: name, email, password };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
  toast.error(data.error || "Authentication failed");
  return;
}

if (isLogin) {
  localStorage.setItem("token", data.access);
  if (data.user) setUser(data.user);

  toast.success("Login successful ✅"); // ✅ FIXED

  navigate("/");
} else {
  toast.success("Account created successfully 🎉");

  setIsLogin(true);
  setName("");
}
    } catch (err) {
      console.error("Connection Error:", err);
      toast.error("Server error. Please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F6F1] px-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white shadow-xl rounded-xl p-8 w-full max-w-md"
      >
        <h2 className="text-2xl font-serif text-center mb-6 text-baba-primary">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h2>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {!isLogin && (
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border p-3 rounded focus:outline-none focus:ring-2 focus:ring-baba-accent"
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-3 rounded focus:outline-none focus:ring-2 focus:ring-baba-accent"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-3 rounded focus:outline-none focus:ring-2 focus:ring-baba-accent"
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-baba-primary text-white py-3 rounded font-semibold hover:bg-baba-accent transition disabled:opacity-50"
          >
            {loading ? "Please wait..." : isLogin ? "Login" : "Sign Up"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-grow h-[1px] bg-gray-200"></div>
          <span className="text-sm text-gray-500">OR</span>
          <div className="flex-grow h-[1px] bg-gray-200"></div>
        </div>

        {/* ✅ Now googleLogin is defined in the correct scope */}
        <button 
          type="button"
          onClick={() => googleLogin()}
          disabled={loading}
          className="flex items-center justify-center gap-3 border py-3 rounded w-full hover:bg-gray-50 transition disabled:opacity-50"
        >
          <FcGoogle size={22} />
          Continue with Google
        </button>

        <p className="text-center text-sm mt-6">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-baba-accent ml-2 font-medium hover:underline"
          >
            {isLogin ? "Sign Up" : "Login"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}