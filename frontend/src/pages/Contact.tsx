import React from 'react';
    import { MapPin, Phone, Mail, Clock } from 'lucide-react';

    export default function Contact() {
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
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif text-xl font-bold text-baba-primary mb-2">Visit Us</h3>
                  <p className="text-gray-600 leading-relaxed">
                    GT Road, Srikakulam,<br/>Andhra Pradesh – 532001
                  </p>
                </div>

                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 group hover:border-baba-accent transition-colors">
                  <div className="w-12 h-12 bg-baba-softbg rounded-full flex items-center justify-center text-baba-accent mb-6 group-hover:bg-baba-accent group-hover:text-white transition-colors">
                    <Phone className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif text-xl font-bold text-baba-primary mb-2">Call or Email</h3>
                  <p className="text-gray-600 mb-1">Phone: <a href="tel:8328030460" className="hover:text-baba-accent">8328030460</a></p>
                  <p className="text-gray-600 break-words">Email: <a href="mailto:tangudukrishna.23@gmail.com" className="hover:text-baba-accent">tangudukrishna.23@gmail.com</a></p>
                </div>

                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 group hover:border-baba-accent transition-colors">
                  <div className="w-12 h-12 bg-baba-softbg rounded-full flex items-center justify-center text-baba-accent mb-6 group-hover:bg-baba-accent group-hover:text-white transition-colors">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif text-xl font-bold text-baba-primary mb-2">Business Hours</h3>
                  <p className="text-gray-600">Monday to Saturday: 9:30 AM – 8:30 PM</p>
                  <p className="text-red-500 font-medium mt-1">Sunday: Closed</p>
                </div>
              </div>

              {/* Map Placeholder & Form */}
              <div className="lg:w-2/3 flex flex-col gap-8">
                {/* Embedded Map Placeholder */}
                <div className="bg-gray-200 w-full h-64 sm:h-80 rounded-xl overflow-hidden shadow-sm relative border border-gray-300">
                  {/* Real implementation would use an iframe from Google Maps */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                    <MapPin className="w-10 h-10 mb-2 opacity-50" />
                    <span>Google Maps Placeholder for GT Road, Srikakulam</span>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="font-serif text-2xl font-bold text-baba-primary mb-6">Send us a message</h3>
                  <form className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                        <input type="text" className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-baba-accent focus:border-baba-accent" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Your Email</label>
                        <input type="email" className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-baba-accent focus:border-baba-accent" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                      <textarea rows={4} className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-baba-accent focus:border-baba-accent"></textarea>
                    </div>
                    <button type="button" className="bg-baba-primary text-white px-8 py-3 rounded-sm font-medium hover:bg-baba-accent transition-colors">
                      Send Message
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }