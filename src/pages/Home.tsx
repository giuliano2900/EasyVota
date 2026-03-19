import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Home() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.length < 6) {
      setError('Inserisci un PIN valido (almeno 6 caratteri)');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const pinUpper = pin.toUpperCase().trim();
      const pinDoc = await getDoc(doc(db, 'pins', pinUpper));

      if (!pinDoc.exists()) {
        setError('PIN non trovato. Verifica di averlo digitato correttamente.');
        setIsLoading(false);
        return;
      }

      const pinData = pinDoc.data();
      if (pinData.used) {
        setError('Questo PIN è già stato utilizzato per votare.');
        setIsLoading(false);
        return;
      }

      // PIN is valid and unused, navigate to voting booth
      navigate(`/vote/${pinUpper}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `pins/${pin}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-indigo-600 p-8 text-center text-white">
          <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Votazione Caseggiato</h1>
          <p className="text-indigo-100 text-sm">
            Voto segreto e sicuro. Un voto per appartamento.
          </p>
        </div>

        <div className="p-8">
          <form onSubmit={handleVerifyPin} className="space-y-6">
            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-slate-700 mb-2">
                Inserisci il tuo PIN di voto
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  id="pin"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.toUpperCase())}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-lg font-mono tracking-widest uppercase placeholder-slate-300"
                  placeholder="ES: A7B9X2"
                  maxLength={8}
                />
              </div>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  Accedi alla Scheda <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
        
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
          <button 
            onClick={() => navigate('/admin')}
            className="text-xs text-slate-500 hover:text-indigo-600 font-medium transition-colors"
          >
            Accesso Amministratore
          </button>
        </div>
      </div>
    </div>
  );
}
