import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, setDoc, writeBatch, documentId } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ArrowLeft, KeyRound, Users, CheckCircle2, BarChart3, Loader2, Printer, Mail, AlertTriangle } from 'lucide-react';
import { generatePin } from '../lib/utils';

export default function ElectionDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [election, setElection] = useState<any>(null);
  const [pins, setPins] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [numPinsToGenerate, setNumPinsToGenerate] = useState(1);
  const [generationMode, setGenerationMode] = useState<'anonymous' | 'email'>('anonymous');
  const [emailInput, setEmailInput] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && id) {
        fetchElectionData(currentUser.uid, id);
      } else if (!currentUser) {
        navigate('/admin');
      }
    });
    return () => unsubscribe();
  }, [id, navigate]);

  const fetchElectionData = async (uid: string, electionId: string) => {
    try {
      const electionDoc = await getDoc(doc(db, 'elections', electionId));
      if (!electionDoc.exists() || electionDoc.data().adminId !== uid) {
        navigate('/admin');
        return;
      }
      const elData = electionDoc.data();
      setElection({ id: electionDoc.id, ...elData });
      
      if (elData.voterEmails && elData.voterEmails.length > 0) {
        setGenerationMode('email');
        setEmailInput(elData.voterEmails.join('\n'));
      }

      const q = query(collection(db, 'pins'), where('electionId', '==', electionId));
      const pinsSnapshot = await getDocs(q);
      const pinsData: any[] = [];
      pinsSnapshot.forEach((doc) => {
        pinsData.push({ id: doc.id, ...doc.data() });
      });
      setPins(pinsData);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `elections/${electionId}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePins = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    let emailsToGenerate: string[] = [];
    if (generationMode === 'email') {
      emailsToGenerate = emailInput.split('\n').map(e => e.trim()).filter(e => e);
      if (emailsToGenerate.length === 0) return;
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emailsToGenerate.filter(e => !emailRegex.test(e));
      
      if (invalidEmails.length > 0) {
        alert(`Sono stati trovati indirizzi email non validi:\n${invalidEmails.join('\n')}\n\nCorreggi gli indirizzi e riprova.`);
        return;
      }

      if (emailsToGenerate.length > 500) {
        alert("Puoi generare un massimo di 500 PIN alla volta.");
        return;
      }
      
      const existingEmails = pins.map(p => p.email).filter(e => e);
      emailsToGenerate = emailsToGenerate.filter(e => !existingEmails.includes(e));
      
      if (emailsToGenerate.length === 0) {
        alert("Tutti gli indirizzi email inseriti hanno già un PIN associato.");
        return;
      }
    } else {
      if (numPinsToGenerate < 1) return;
      if (numPinsToGenerate > 500) {
        alert("Puoi generare un massimo di 500 PIN alla volta.");
        return;
      }
    }

    setIsGenerating(true);

    try {
      const newPins: any[] = [];
      const count = generationMode === 'email' ? emailsToGenerate.length : numPinsToGenerate;
      const generatedPinIds = new Set<string>(pins.map(p => p.id));

      while (newPins.length < count) {
        const pinsNeeded = count - newPins.length;
        const candidatePins: string[] = [];
        
        for (let i = 0; i < pinsNeeded; i++) {
          let pinCode = generatePin();
          while (generatedPinIds.has(pinCode) || candidatePins.includes(pinCode)) {
            pinCode = generatePin();
          }
          candidatePins.push(pinCode);
        }
        
        // Check uniqueness in Firestore globally to avoid collisions across all elections
        const existingPinsInDb = new Set<string>();
        const chunkSize = 10; // Use smaller chunks for parallel getDoc calls
        
        for (let i = 0; i < candidatePins.length; i += chunkSize) {
          const chunk = candidatePins.slice(i, i + chunkSize);
          const results = await Promise.all(
            chunk.map(pinId => getDoc(doc(db, 'pins', pinId)))
          );
          results.forEach(snap => {
            if (snap.exists()) {
              existingPinsInDb.add(snap.id);
            }
          });
        }
        
        for (const pinCode of candidatePins) {
          if (existingPinsInDb.has(pinCode)) {
            generatedPinIds.add(pinCode); // Mark as used
          } else {
            generatedPinIds.add(pinCode);
            
            const pinData: any = {
              electionId: id,
              used: false
            };
            
            if (generationMode === 'email') {
              const emailIndex = newPins.length;
              if (emailsToGenerate[emailIndex]) {
                pinData.email = emailsToGenerate[emailIndex];
              }
            }
            
            newPins.push({ id: pinCode, ...pinData });
            
            if (newPins.length === count) break;
          }
        }
      }

      if (newPins.length > 0) {
        const batch = writeBatch(db);
        for (const pin of newPins) {
          const { id: pinId, ...pinData } = pin;
          const pinRef = doc(db, 'pins', pinId);
          batch.set(pinRef, pinData);
        }

        await batch.commit();
        setPins(prev => [...prev, ...newPins]);
        setNumPinsToGenerate(1);
        if (generationMode === 'email') {
          setEmailInput('');
          // Invia email automaticamente per i nuovi PIN generati
          await sendPinsBatch(newPins);
        }
      }
    } catch (err) {
      console.error("Errore generazione PIN:", err);
      alert("Si è verificato un errore durante la generazione dei PIN. Verifica la tua connessione o i permessi.");
      handleFirestoreError(err, OperationType.WRITE, 'pins');
    } finally {
      setIsGenerating(false);
    }
  };

  const sendPinsBatch = async (pinsToSend: any[]) => {
    if (pinsToSend.length === 0) return;
    
    setIsSendingEmails(true);
    try {
      const response = await fetch('/api/send-pins-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pins: pinsToSend.map(p => ({ email: p.email, pin: p.id })),
          electionTitle: election.title,
          appUrl: window.location.origin
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante l\'invio delle email');
      }

      const results = await response.json();
      if (results.failed > 0) {
        alert(`Email inviate: ${results.success}. Errori: ${results.failed}.\n\nAlcuni errori:\n${results.errors.slice(0, 3).join('\n')}`);
      } else {
        alert(`Tutte le ${results.success} email sono state inviate con successo.`);
      }
    } catch (err: any) {
      console.error("Errore invio batch email:", err);
      alert(err.message || "Si è verificato un errore durante l'invio delle email. Verifica la configurazione SMTP.");
    } finally {
      setIsSendingEmails(false);
    }
  };

  const sendEmail = async (pin: string, email: string) => {
    setIsSendingEmails(true);
    try {
      const response = await fetch('/api/send-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          pin,
          electionTitle: election.title,
          appUrl: window.location.origin
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante l\'invio dell\'email');
      }

      alert(`Email inviata con successo a ${email}`);
    } catch (err: any) {
      console.error("Errore invio email:", err);
      // Fallback a mailto se l'API fallisce (es. SMTP non configurato)
      const subject = encodeURIComponent(`Il tuo PIN per la votazione: ${election.title}`);
      const body = encodeURIComponent(`Ciao,\n\nEcco il tuo PIN personale e segreto per partecipare alla votazione "${election.title}".\n\nIl tuo PIN è: ${pin}\n\nVai su ${window.location.origin} per esprimere il tuo voto.\n\nGrazie.`);
      window.open(`mailto:${email}?subject=${subject}&body=${body}`);
    } finally {
      setIsSendingEmails(false);
    }
  };

  if (isLoading || !election) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const now = new Date();
  const start = election.startTime.toDate();
  const end = election.endTime.toDate();
  let status = 'Chiusa';
  let statusColor = 'bg-slate-100 text-slate-800';
  
  if (now < start) {
    status = 'Programmata';
    statusColor = 'bg-amber-100 text-amber-800';
  } else if (now >= start && now <= end) {
    status = 'In Corso';
    statusColor = 'bg-emerald-100 text-emerald-800';
  }

  const totalPins = pins.length;
  const usedPins = pins.filter(p => p.used).length;
  const participationRate = totalPins > 0 ? Math.round((usedPins / totalPins) * 100) : 0;

  // Calculate results
  const options = election.options || election.candidates || [];
  const results = options.map((o: any) => {
    const votes = pins.filter(p => p.used && (p.optionId === o.id || p.candidateId === o.id)).length;
    return { ...o, votes };
  }).sort((a: any, b: any) => b.votes - a.votes);

  const maxVotes = results.length > 0 ? results[0].votes : 0;
  const winners = results.filter((r: any) => r.votes === maxVotes && maxVotes > 0);

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/admin')}
                className="mr-4 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <span className="text-xl font-bold text-slate-800 truncate">{election.title}</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header Stats */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">{election.title}</h1>
              <div className="flex items-center space-x-4 text-sm text-slate-500">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                  {status}
                </span>
                <span>
                  {format(start, "d MMM yyyy, HH:mm", { locale: it })} - {format(end, "d MMM yyyy, HH:mm", { locale: it })}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-slate-100 pt-6">
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 mr-4">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">PIN Generati</p>
                <p className="text-2xl font-bold text-slate-900">{totalPins}</p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 mr-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Voti Espressi</p>
                <p className="text-2xl font-bold text-slate-900">{usedPins}</p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600 mr-4">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Affluenza</p>
                <p className="text-2xl font-bold text-slate-900">{participationRate}%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Results Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-indigo-600" />
                Risultati {status === 'In Corso' ? 'in Tempo Reale' : ''}
              </h2>

              {usedPins === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  Nessun voto espresso finora.
                </div>
              ) : (
                <div className="space-y-6">
                  {results.map((option: any, index: number) => {
                    const percentage = usedPins > 0 ? Math.round((option.votes / usedPins) * 100) : 0;
                    const isWinner = winners.some((w: any) => w.id === option.id) && status === 'Chiusa';

                    return (
                      <div key={option.id} className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-slate-900">
                              {option.text || option.name}
                            </span>
                            {isWinner && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                Vincitore
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium text-slate-700">
                            {option.votes} voti ({percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full ${isWinner ? 'bg-yellow-400' : 'bg-indigo-600'}`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* PIN Management Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                <KeyRound className="w-5 h-5 mr-2 text-indigo-600" />
                Gestione PIN
              </h2>

              <div className="mb-6 flex space-x-4 border-b border-slate-200">
                <button
                  className={`pb-2 text-sm font-medium ${generationMode === 'anonymous' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setGenerationMode('anonymous')}
                >
                  PIN Anonimi (Stampa)
                </button>
                <button
                  className={`pb-2 text-sm font-medium ${generationMode === 'email' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setGenerationMode('email')}
                >
                  PIN via Email
                </button>
              </div>

              <form onSubmit={handleGeneratePins} className="mb-8">
                {generationMode === 'anonymous' ? (
                  <>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Genera nuovi PIN
                    </label>
                    <div className="flex space-x-3">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={numPinsToGenerate}
                        onChange={(e) => setNumPinsToGenerate(parseInt(e.target.value) || 1)}
                        className="block w-full border border-slate-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                      <button
                        type="submit"
                        disabled={isGenerating}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                      >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Genera'}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Genera un PIN per ogni appartamento avente diritto al voto.
                    </p>
                  </>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Indirizzi Email (uno per riga)
                    </label>
                    <textarea
                      rows={4}
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="mario.rossi@example.com&#10;luigi.verdi@example.com"
                      className="block w-full border border-slate-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm mb-3"
                    />
                    {election.voterEmails && election.voterEmails.length > 0 && (
                      <p className="mt-1 mb-3 text-xs text-indigo-600 font-medium">
                        ✓ Lista email precompilata con gli aventi diritto inseriti in fase di creazione.
                      </p>
                    )}
                    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-amber-700">
                            <strong>Attenzione alla segretezza:</strong> Associando un'email al PIN, l'amministratore potrebbe risalire al voto espresso. Usa questa funzione solo se i condomini accettano questa condizione.
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={isGenerating || isSendingEmails || !emailInput.trim()}
                      className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                    >
                      {isGenerating || isSendingEmails ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                      {isSendingEmails ? 'Invio Email...' : 'Genera e Invia PIN'}
                    </button>
                  </>
                )}
              </form>

              {pins.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-slate-900">Lista PIN</h3>
                    <button
                      onClick={() => window.print()}
                      className="inline-flex items-center text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      <Printer className="w-3 h-3 mr-1" />
                      Stampa PIN
                    </button>
                  </div>
                  <div className="bg-slate-50 rounded-lg border border-slate-200 max-h-64 overflow-y-auto">
                    <ul className="divide-y divide-slate-200">
                      {pins.map((pin) => (
                        <li key={pin.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center space-x-3">
                            <span className="font-mono text-sm font-medium text-slate-900 tracking-wider">
                              {pin.id}
                            </span>
                            {pin.email && (
                              <span className="text-sm text-slate-500 truncate max-w-[200px]" title={pin.email}>
                                {pin.email}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {pin.email && !pin.used && (
                              <button
                                onClick={() => sendEmail(pin.id, pin.email)}
                                disabled={isSendingEmails}
                                className="inline-flex items-center px-2 py-1 border border-slate-300 shadow-sm text-xs font-medium rounded text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                              >
                                {isSendingEmails ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Mail className="w-3 h-3 mr-1" />}
                                Invia
                              </button>
                            )}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              pin.used ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {pin.used ? 'Usato' : 'Valido'}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="mt-4 text-xs text-slate-500 bg-amber-50 p-3 rounded-lg border border-amber-100">
                    <strong>Importante:</strong> Stampa e ritaglia i PIN. Per garantire la segretezza, distribuiscili in modo casuale (es. estrazione da un'urna) in modo da non sapere quale PIN è stato assegnato a quale avente diritto.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
