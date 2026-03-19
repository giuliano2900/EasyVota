import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { CheckCircle2, AlertCircle, Loader2, XCircle, Home } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Vote() {
  const { pin } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const [election, setElection] = useState<any>(null);
  const [pinData, setPinData] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<{title: string, message: string} | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchElectionData = async () => {
      if (!pin) return;
      try {
        const pinDoc = await getDoc(doc(db, 'pins', pin));
        if (!pinDoc.exists()) {
          setError({
            title: 'PIN non valido',
            message: 'Il PIN inserito non esiste nel sistema. Verifica di averlo letto e digitato correttamente, facendo attenzione a maiuscole e minuscole.'
          });
          return;
        }

        const pd = pinDoc.data();
        if (pd.used) {
          setError({
            title: 'PIN già utilizzato',
            message: 'Risulta che questo PIN sia già stato utilizzato per esprimere un voto. Ogni PIN è monouso e garantisce un solo voto. Se ritieni sia un errore o se qualcun altro ha usato il tuo PIN, contatta l\'amministratore del caseggiato.'
          });
          return;
        }
        setPinData(pd);

        const electionDoc = await getDoc(doc(db, 'elections', pd.electionId));
        if (!electionDoc.exists()) {
          setError({
            title: 'Votazione non trovata',
            message: 'La votazione associata a questo PIN non esiste più o è stata eliminata dall\'amministratore.'
          });
          return;
        }

        const el = electionDoc.data();
        const now = new Date();
        const start = el.startTime.toDate();
        const end = el.endTime.toDate();

        if (now < start) {
          setError({
            title: 'Votazione non ancora aperta',
            message: 'Le votazioni non sono ancora iniziate. Riprova più tardi.'
          });
        } else if (now > end) {
          setError({
            title: 'Votazione chiusa',
            message: 'Le votazioni sono chiuse. Non è più possibile esprimere preferenze.'
          });
        } else {
          setElection({ id: electionDoc.id, ...el });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `pins/${pin}`);
      }
    };

    fetchElectionData();
  }, [pin]);

  const handleVote = async () => {
    if (!selectedOption || !pin || !election) return;
    setIsSubmitting(true);
    setError(null);

    try {
      // The security rules enforce that we can only update if used == false
      await updateDoc(doc(db, 'pins', pin), {
        used: true,
        optionId: selectedOption,
        candidateId: selectedOption // For backwards compatibility
      });
      setSuccess(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pins/${pin}`);
      setError({
        title: 'Errore di registrazione',
        message: 'Si è verificato un errore durante la registrazione del voto. Riprova tra qualche istante.'
      });
      setIsSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-red-100">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">{error.title}</h2>
          <p className="text-slate-600 mb-8">{error.message}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center bg-slate-100 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-200 transition-colors"
          >
            <Home className="w-5 h-5 mr-2" />
            Torna alla Home
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-emerald-100">
          <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Voto Registrato!</h2>
          <p className="text-slate-600 mb-8">
            Il tuo voto è stato registrato con successo in modo anonimo. Grazie per aver partecipato.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            Chiudi
          </button>
        </div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-indigo-600 px-6 py-8 text-white text-center">
            <h1 className="text-3xl font-bold mb-2">{election.title}</h1>
            <p className="text-indigo-100">Seleziona la tua preferenza. Il voto è segreto.</p>
          </div>

          <div className="p-6 sm:p-8">
            <div className="space-y-4">
              {(election.options || election.candidates || []).map((option: any) => (
                <label
                  key={option.id}
                  className={cn(
                    "relative flex cursor-pointer rounded-xl border p-4 shadow-sm focus:outline-none transition-all duration-200",
                    selectedOption === option.id
                      ? "border-indigo-600 ring-2 ring-indigo-600 bg-indigo-50"
                      : "border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <input
                    type="radio"
                    name="option"
                    value={option.id}
                    className="sr-only"
                    onChange={() => setSelectedOption(option.id)}
                  />
                  <span className="flex flex-1">
                    <span className="flex flex-col">
                      <span className="block text-lg font-medium text-slate-900">
                        {option.text || option.name}
                      </span>
                    </span>
                  </span>
                  <CheckCircle2
                    className={cn(
                      "h-6 w-6 transition-opacity duration-200",
                      selectedOption === option.id ? "text-indigo-600 opacity-100" : "opacity-0"
                    )}
                  />
                </label>
              ))}
            </div>

            <div className="mt-10">
              <button
                onClick={handleVote}
                disabled={!selectedOption || isSubmitting}
                className="w-full flex items-center justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin h-6 w-6" />
                ) : (
                  "Conferma Voto"
                )}
              </button>
              <p className="text-center text-sm text-slate-500 mt-4">
                Attenzione: una volta confermato, il voto non potrà essere modificato.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
