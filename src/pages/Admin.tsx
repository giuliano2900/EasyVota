import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, Timestamp, orderBy } from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Plus, LogOut, FileText, Calendar, Users, Loader2, ShieldCheck } from 'lucide-react';

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [elections, setElections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const navigate = useNavigate();

  // New Election Form State
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [options, setOptions] = useState([{ id: '1', text: '' }, { id: '2', text: '' }]);
  const [voterEmailsInput, setVoterEmailsInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchElections(currentUser.uid);
      } else {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchElections = async (uid: string) => {
    try {
      const q = query(
        collection(db, 'elections'),
        where('adminId', '==', uid)
      );
      const querySnapshot = await getDocs(q);
      const els: any[] = [];
      querySnapshot.forEach((doc) => {
        els.push({ id: doc.id, ...doc.data() });
      });
      // Sort client side since we don't have a composite index set up yet
      els.sort((a, b) => b.startTime.toMillis() - a.startTime.toMillis());
      setElections(els);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'elections');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsCreating(true);

    try {
      const start = new Date(`${startDate}T${startTime}`);
      const end = new Date(`${endDate}T${endTime}`);
      
      const validOptions = options.filter(o => o.text.trim() !== '').map((o, i) => ({
        id: `o_${Date.now()}_${i}`,
        text: o.text.trim()
      }));

      if (validOptions.length < 2) {
        alert("Inserisci almeno due opzioni valide.");
        setIsCreating(false);
        return;
      }

      const voterEmails = voterEmailsInput.split('\n').map(e => e.trim()).filter(e => e);
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = voterEmails.filter(e => !emailRegex.test(e));
      
      if (invalidEmails.length > 0) {
        alert(`Sono stati trovati indirizzi email non validi:\n${invalidEmails.join('\n')}\n\nCorreggi gli indirizzi e riprova.`);
        setIsCreating(false);
        return;
      }

      if (voterEmails.length > 500) {
        alert("Puoi inserire un massimo di 500 indirizzi email.");
        setIsCreating(false);
        return;
      }

      const newElection: any = {
        title,
        startTime: Timestamp.fromDate(start),
        endTime: Timestamp.fromDate(end),
        adminId: user.uid,
        options: validOptions
      };

      if (voterEmails.length > 0) {
        newElection.voterEmails = voterEmails;
      }

      const docRef = await addDoc(collection(db, 'elections'), newElection);
      setElections([{ id: docRef.id, ...newElection }, ...elections]);
      setShowNewModal(false);
      
      // Reset form
      setTitle('');
      setStartDate('');
      setStartTime('');
      setEndDate('');
      setEndTime('');
      setOptions([{ id: '1', text: '' }, { id: '2', text: '' }]);
      setVoterEmailsInput('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'elections');
      alert("Errore durante la creazione della votazione.");
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Area Amministratore</h1>
          <p className="text-slate-600 mb-8">
            Accedi con il tuo account Google per gestire le votazioni del caseggiato.
          </p>
          <button
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            Accedi con Google
          </button>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            Torna al Voto
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <ShieldCheck className="w-8 h-8 text-indigo-600 mr-2" />
              <span className="text-xl font-bold text-slate-800">Admin Dashboard</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600 hidden sm:block">{user.email}</span>
              <button
                onClick={logout}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-slate-500 hover:text-slate-700 focus:outline-none transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Esci
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Le tue Votazioni</h1>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nuova Votazione
          </button>
        </div>

        {elections.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-slate-200">
            <FileText className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-2 text-sm font-medium text-slate-900">Nessuna votazione</h3>
            <p className="mt-1 text-sm text-slate-500">Inizia creando una nuova votazione del caseggiato.</p>
            <div className="mt-6">
              <button
                onClick={() => setShowNewModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                Nuova Votazione
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {elections.map((election) => {
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

              return (
                <div
                  key={election.id}
                  onClick={() => navigate(`/admin/election/${election.id}`)}
                  className="bg-white overflow-hidden shadow-sm rounded-2xl border border-slate-200 hover:shadow-md transition-shadow cursor-pointer flex flex-col"
                >
                  <div className="px-6 py-5 flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                        {status}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2">{election.title}</h3>
                    <div className="space-y-2 mt-4">
                      <div className="flex items-center text-sm text-slate-500">
                        <Calendar className="flex-shrink-0 mr-1.5 h-4 w-4 text-slate-400" />
                        <span>
                          {format(start, "d MMM yyyy, HH:mm", { locale: it })} - {format(end, "d MMM yyyy, HH:mm", { locale: it })}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-slate-500">
                        <Users className="flex-shrink-0 mr-1.5 h-4 w-4 text-slate-400" />
                        <span>{(election.options || election.candidates || []).length} Opzioni</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 px-6 py-3 border-t border-slate-100">
                    <span className="text-sm font-medium text-indigo-600 hover:text-indigo-900">
                      Gestisci Votazione &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* New Election Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            <div className="fixed inset-0 bg-slate-900/50 transition-opacity" onClick={() => setShowNewModal(false)} aria-hidden="true" />
            <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 w-full sm:max-w-lg">
              <form onSubmit={handleCreateElection}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-slate-900 mb-4">
                    Crea Nuova Votazione
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Titolo</label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Es. Votazione Delegato 2026 oppure Approvazione Bilancio"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Data Inizio</label>
                        <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Ora Inizio</label>
                        <input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Data Fine</label>
                        <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Ora Fine</label>
                        <input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Opzioni di voto (Candidati, Sì/No, ecc.)</label>
                      {options.map((option, index) => (
                        <div key={option.id} className="flex mb-2">
                          <input
                            type="text"
                            value={option.text}
                            onChange={(e) => {
                              const newO = [...options];
                              newO[index].text = e.target.value;
                              setOptions(newO);
                            }}
                            className="block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder={`Opzione ${index + 1}`}
                            required={index < 2}
                          />
                          {index >= 2 && (
                            <button
                              type="button"
                              onClick={() => setOptions(options.filter((_, i) => i !== index))}
                              className="ml-2 text-red-600 hover:text-red-800"
                            >
                              Rimuovi
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setOptions([...options, { id: Date.now().toString(), text: '' }])}
                        className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        + Aggiungi Opzione
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Indirizzi Email Aventi Diritto (Opzionale)
                      </label>
                      <textarea
                        rows={3}
                        value={voterEmailsInput}
                        onChange={(e) => setVoterEmailsInput(e.target.value)}
                        placeholder="mario.rossi@example.com&#10;luigi.verdi@example.com"
                        className="block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Inserisci un indirizzo email per riga. Verranno utilizzati per inviare i PIN.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-2xl">
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {isCreating ? 'Creazione...' : 'Crea Votazione'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Annulla
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
