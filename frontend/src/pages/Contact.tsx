import React, { useState } from "react";
import { MapPin, Phone, Clock, Navigation, MessageCircle } from "lucide-react";
import { usePageMeta } from "../utils/pageMeta";

const WHATSAPP_NUMBER = "918125114993";
const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent("Baba Textiles, GT Road, Srikakulam, Andhra Pradesh 532001");

export default function Contact() {
  usePageMeta({
    title: "Contact Us",
    description:
      "Contact Baba Textiles, GT Road, Srikakulam. Call or WhatsApp +91 8125114993, Monday to Saturday 9:30 AM – 8:30 PM.",
    path: "/contact",
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Messages go to the store's WhatsApp, pre-filled, so they actually reach
  // someone (the old form had no way to send anything).
  const sendOnWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("Please type your message.");
      return;
    }
    setError("");
    const text = [
      `Hello Baba Textiles,`,
      message.trim(),
      ``,
      `- ${name.trim() || "Customer"}${phone.trim() ? ` (${phone.trim()})` : ""}`,
    ].join("\n");
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  return (
    <div className="bg-baba-background min-h-screen py-16">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-16">
          <h1 className="font-serif text-4xl md:text-5xl text-baba-primary font-bold mb-4">Get in Touch</h1>
          <p className="text-gray-600 text-lg">We are here to assist with your wholesale requirements.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          {/* Contact Info */}
          <div className="lg:w-1/3 space-y-8">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 group hover:border-baba-accent transition-colors">
              <div className="w-12 h-12 bg-baba-softbg rounded-full flex items-center justify-center text-baba-accent mb-6 group-hover:bg-baba-accent group-hover:text-white transition-colors">
                <MapPin className="w-6 h-6" aria-hidden="true" />
              </div>
              <h2 className="font-serif text-xl font-bold text-baba-primary mb-2">Visit Us</h2>
              <p className="text-gray-600 leading-relaxed">
                GT Road, Srikakulam,<br />Andhra Pradesh – 532001
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 group hover:border-baba-accent transition-colors">
              <div className="w-12 h-12 bg-baba-softbg rounded-full flex items-center justify-center text-baba-accent mb-6 group-hover:bg-baba-accent group-hover:text-white transition-colors">
                <Phone className="w-6 h-6" aria-hidden="true" />
              </div>
              <h2 className="font-serif text-xl font-bold text-baba-primary mb-2">Call or Email</h2>
              <p className="text-gray-600 mb-1">Phone: <a href="tel:+918125114993" className="hover:text-baba-accent">+91 8125114993</a></p>
              <p className="text-gray-600 break-words">Email: <a href="mailto:tangudukrishna.23@gmail.com" className="hover:text-baba-accent">tangudukrishna.23@gmail.com</a></p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 group hover:border-baba-accent transition-colors">
              <div className="w-12 h-12 bg-baba-softbg rounded-full flex items-center justify-center text-baba-accent mb-6 group-hover:bg-baba-accent group-hover:text-white transition-colors">
                <Clock className="w-6 h-6" aria-hidden="true" />
              </div>
              <h2 className="font-serif text-xl font-bold text-baba-primary mb-2">Business Hours</h2>
              <p className="text-gray-600">Monday to Saturday: 9:30 AM – 8:30 PM</p>
              <p className="text-red-700 font-medium mt-1">Sunday: Closed</p>
            </div>
          </div>

          {/* Directions & Form */}
          <div className="lg:w-2/3 flex flex-col gap-8">
            <div className="bg-white w-full rounded-xl shadow-sm border border-gray-100 p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="w-14 h-14 bg-baba-softbg rounded-full flex items-center justify-center text-baba-primary shrink-0">
                <Navigation className="w-7 h-7" aria-hidden="true" />
              </div>
              <div className="flex-grow">
                <h2 className="font-serif text-xl font-bold text-baba-primary">Find our store</h2>
                <p className="text-gray-600 mt-1">GT Road, Srikakulam, Andhra Pradesh – 532001</p>
              </div>
              <a
                href={MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-baba-primary text-white px-6 py-3 rounded-sm font-medium hover:bg-baba-accent transition-colors whitespace-nowrap"
              >
                Open in Google Maps
              </a>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
              <h2 className="font-serif text-2xl font-bold text-baba-primary mb-2">Send us a message</h2>
              <p className="text-sm text-gray-600 mb-6">Your message opens in WhatsApp, ready to send to our store.</p>
              <form className="space-y-4" onSubmit={sendOnWhatsApp} noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                    <input
                      id="contact-name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-baba-accent focus:border-baba-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-phone" className="block text-sm font-medium text-gray-700 mb-1">Your Phone (optional)</label>
                    <input
                      id="contact-phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-baba-accent focus:border-baba-accent"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    aria-invalid={!!error}
                    aria-describedby={error ? "contact-error" : undefined}
                    className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-baba-accent focus:border-baba-accent"
                  />
                  {error && (
                    <p id="contact-error" role="alert" className="text-sm text-red-700 mt-1">{error}</p>
                  )}
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-baba-primary text-white px-8 py-3 rounded-sm font-medium hover:bg-baba-accent transition-colors"
                >
                  <MessageCircle className="w-5 h-5" aria-hidden="true" />
                  Send on WhatsApp
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
