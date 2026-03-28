import React from 'react';

    export default function About() {
      return (
        <div className="bg-baba-softbg min-h-screen">
          <div className="bg-baba-primary py-24 px-4 text-center">
            <h1 className="font-serif text-5xl text-white font-bold mb-4">About Our Business</h1>
            <p className="text-baba-accent text-lg max-w-2xl mx-auto uppercase tracking-widest text-sm">Best rates and best quality is our motto</p>
          </div>

          <div className="container mx-auto px-4 py-20 max-w-6xl">
            <div className="flex flex-col md:flex-row gap-16 items-center">
              <div className="md:w-1/2">
                <div className="relative">
                  <img 
                    src="https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?auto=format&fit=crop&q=80&w=1000" 
                    alt="Textile Shop" 
                    className="rounded-lg shadow-2xl z-10 relative"
                  />
                  <div className="absolute -bottom-6 -right-6 w-full h-full border-4 border-baba-accent rounded-lg -z-10"></div>
                </div>
              </div>
              <div className="md:w-1/2 space-y-6">
                <h2 className="text-3xl font-serif text-baba-primary font-bold">A Legacy of Excellence</h2>
                <div className="w-16 h-1 bg-baba-accent"></div>
                <p className="text-gray-600 leading-relaxed text-lg">
                  Located in the heart of Srikakulam on GT Road, Baba Textiles has been synonymous with premium quality wholesale textiles. We understand that in the textile business, quality and pricing are paramount.
                </p>
                <p className="text-gray-600 leading-relaxed text-lg">
                  Our extensive collection spans across men's, women's, and kids' wear, meticulously sourced to ensure our partners get the finest fabrics. From grand royal silks to comfortable everyday cottons, every thread weaves a story of trust and durability.
                </p>
                <blockquote className="border-l-4 border-baba-accent pl-4 italic text-gray-500 font-serif text-xl my-8">
                  "Our commitment is simple: We provide the best rates so our wholesale partners can thrive, and the best quality so their customers keep coming back."
                </blockquote>
              </div>
            </div>
          </div>
        </div>
      );
    }