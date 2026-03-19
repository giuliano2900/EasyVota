import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import Home from './pages/Home';
import Vote from './pages/Vote';
import Admin from './pages/Admin';
import ElectionDetails from './pages/ElectionDetails';
import { useEffect, useState } from 'react';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/vote/:pin" element={<Vote />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/election/:id" element={<ElectionDetails />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
