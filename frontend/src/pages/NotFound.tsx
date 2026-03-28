import React from 'react';
    import { Link } from 'react-router-dom';
    import { Home } from 'lucide-react';

    export default function NotFound() {
      return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center bg-baba-background px-4">
          <h1 className="text-9xl font-serif font-bold text-baba-primary mb-4">404</h1>
          <h2 className="text-2xl md:text-3xl font-serif text-baba-textdark mb-6">Page Not Found</h2>
          <p className="text-gray-500 mb-8 max-w-md text-center">
            The premium collection you are looking for might have been moved or is currently unavailable.
          </p>
          <Link to="/" className="flex items-center gap-2 bg-baba-primary text-white px-6 py-3 rounded-sm hover:bg-baba-accent transition-colors">
            <Home className="w-5 h-5" /> Back to Home
          </Link>
        </div>
      );
    }