import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-6">
      <div className="text-6xl md:text-8xl font-black text-gray-200 mb-4">404</div>
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Page Not Found</h1>
      <p className="text-gray-500 mb-8 max-w-md">
        The page you are looking for doesn't exist or you don't have permission to view it.
      </p>
      <Link 
        to="/" 
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition shadow-sm"
      >
        <Home size={20} />
        Back to Dashboard
      </Link>
    </div>
  );
}
