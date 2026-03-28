import React from 'react';
    import { Link } from 'react-router-dom';
    import { Facebook, Instagram, Linkedin, MapPin, Phone, Mail, Clock } from 'lucide-react';

    const Footer = () => {
      return (
        <footer className="bg-baba-primary text-baba-softbg pt-16 pb-8 border-t-[4px] border-baba-accent">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
              
              {/* Brand Col */}
              <div className="space-y-6">
                <Link to="/" className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-baba-accent rounded-sm flex items-center justify-center text-baba-primary font-serif text-xl font-bold">
                    B
                  </div>
                  <div className="flex flex-col">
                    <span className="font-serif font-bold text-xl tracking-wider text-white uppercase leading-tight">Baba</span>
                    <span className="text-xs tracking-[0.2em] text-baba-accent uppercase leading-tight">Textiles</span>
                  </div>
                </Link>
                <p className="text-sm text-baba-softbg/80 leading-relaxed max-w-xs">
                  Premium wholesale textiles offering the best rates and best quality. Your trusted partner for authentic ethnic and modern wear.
                </p>
                <div className="flex space-x-4">
                  <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-baba-accent hover:text-baba-primary transition-all duration-300">
                    <Facebook className="h-5 w-5" />
                  </a>
                  <a href="https://www.instagram.com/srikakulam_wholesale_babatex" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-baba-accent hover:text-baba-primary transition-all duration-300">
                    <Instagram className="h-5 w-5" />
                  </a>
                  <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-baba-accent hover:text-baba-primary transition-all duration-300">
                    <Linkedin className="h-5 w-5" />
                  </a>
                </div>
              </div>

              {/* Quick Links */}
              <div>
  <h3 className="text-lg font-serif font-semibold text-white mb-6 tracking-wide">
    Quick Links
  </h3>

  <ul className="space-y-4">
    
    <li>
      <Link 
        to="/shop" 
        className="text-sm text-baba-softbg/80 hover:text-baba-accent transition-colors"
      >
        Shop All
      </Link>
    </li>

    <li>
      <Link 
        to="/shop?category=sarees" 
        className="text-sm text-baba-softbg/80 hover:text-baba-accent transition-colors"
      >
        Sarees
      </Link>
    </li>

    <li>
      <Link 
        to="/shop?category=3%20piece%20sets" 
        className="text-sm text-baba-softbg/80 hover:text-baba-accent transition-colors"
      >
        3 Piece Sets
      </Link>
    </li>

    <li>
      <Link 
        to="/shop?category=frocks" 
        className="text-sm text-baba-softbg/80 hover:text-baba-accent transition-colors"
      >
        Frocks
      </Link>
    </li>

    <li>
      <Link 
        to="/shop?category=dress%20materials" 
        className="text-sm text-baba-softbg/80 hover:text-baba-accent transition-colors"
      >
        Dress Materials
      </Link>
    </li>

    <li>
      <Link 
        to="/about" 
        className="text-sm text-baba-softbg/80 hover:text-baba-accent transition-colors"
      >
        About Us
      </Link>
    </li>

    <li>
      <Link 
        to="/contact" 
        className="text-sm text-baba-softbg/80 hover:text-baba-accent transition-colors"
      >
        Contact
      </Link>
    </li>

  </ul>
</div>

              {/* Contact Info */}
              <div>
                <h3 className="text-lg font-serif font-semibold text-white mb-6 tracking-wide">Contact Us</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-baba-accent shrink-0 mt-0.5" />
                    <span className="text-sm text-baba-softbg/80">GT Road, Srikakulam,<br/>Andhra Pradesh – 532001</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-baba-accent shrink-0" />
                    <span className="text-sm text-baba-softbg/80">8328030460</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-baba-accent shrink-0" />
                    <span className="text-sm text-baba-softbg/80">tangudukrishna.23@gmail.com</span>
                  </li>
                </ul>
              </div>

              {/* Business Hours */}
              <div>
                <h3 className="text-lg font-serif font-semibold text-white mb-6 tracking-wide">Business Hours</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-baba-accent shrink-0 mt-0.5" />
                    <div className="text-sm text-baba-softbg/80 space-y-1">
                      <p><span className="text-white">Mon - Sat:</span> 9:30 AM – 8:30 PM</p>
                      <p><span className="text-white">Sunday:</span> Closed</p>
                    </div>
                  </li>
                </ul>
              </div>

            </div>
            <div className="pt-8 border-t border-white/10 text-center flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sm text-baba-softbg/60">
                &copy; {new Date().getFullYear()} Baba Textiles. All rights reserved.
              </p>
              <div className="flex gap-4 text-sm text-baba-softbg/60">
                <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              </div>
            </div>
          </div>
        </footer>
      );
    };

    export default Footer;