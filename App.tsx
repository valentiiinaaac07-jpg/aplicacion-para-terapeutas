import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import { 
  Loader2, Plus, ChevronRight, CheckCircle, 
  BookOpen, Brain, Calendar, ArrowLeft, RefreshCw, Library, KeyRound, ListTodo, Check, Sparkles, Wand2, Save, User as UserIcon, Target
} from 'lucide-react';
import { Layout } from './components/Layout';
import { Input } from './components/Input';
import { User, UserRole, Patient, Exercise } from './types';
import { generateCbtExercise } from './services/geminiService';

// --- Mock Data & Constants ---
const MOCK_THERAPIST: User = {
  id: 'th-1',
  username: 'admin',
  name: 'Dr. García',
  role: UserRole.THERAPIST
};

// Standard CBT Exercises Library
const STANDARD_LIBRARY: Omit<Exercise, 'id' | 'assignedDate' | 'completed'>[] = [
  {
    title: 'Respiración Cuadrada (4-4-4-4)',
    description: 'Técnica de respiración para recuperar el control durante picos de ansiedad.',
    symptomsAddressed: 'Ansiedad, Pánico, Estrés agudo',
    steps: [
      'Inhala profundamente por la nariz contando hasta 4.',
      'Retén el aire en tus pulmones contando hasta 4.',
      'Exhala suavemente por la boca contando hasta 4.',
      'Mantén los pulmones vacíos contando hasta 4 antes de volver a inhalar.',
      'Repite el ciclo durante al menos 4 minutos.'
    ]
  },
  {
    title: 'Programación de Actividades Agradables',
    description: 'Combatir la inercia depresiva agendando actividades pequeñas y placenteras.',
    symptomsAddressed: 'Depresión, Apatía, Falta de motivación',
    steps: [
      'Escribe una lista de 3 actividades simples que solías disfrutar (ej. escuchar música, caminar, leer).',
      'Elige una para realizar hoy, aunque sea solo por 10 minutos.',
      'Agenda una hora específica para hacerlo.',
      'Hazlo "como si" tuvieras ganas (acción opuesta).',
      'Anota cómo te sentiste después de hacerlo (0-10).'
    ]
  },
  {
    title: 'Detención del Pensamiento',
    description: 'Técnica para interrumpir bucles de pensamientos rumiantes u obsesivos.',
    symptomsAddressed: 'Rumiación, Obsesión, Preocupación excesiva',
    steps: [
      'Identifica que has entrado en un bucle de pensamientos negativos.',
      'Di en voz alta o mentalmente con firmeza: "¡BASTA!" o visualiza una señal de STOP roja.',
      'Inmediatamente, cambia tu foco de atención a un objeto en tu entorno (describe su color, textura, forma).',
      'Si el pensamiento vuelve, repite el proceso con paciencia.'
    ]
  },
  {
    title: 'Diario de Gratitud',
    description: 'Ejercicio de psicología positiva para cambiar el sesgo de atención negativo.',
    symptomsAddressed: 'Pesimismo, Baja autoestima, Insatisfacción',
    steps: [
      'Reserva 5 minutos al final del día.',
      'Escribe 3 cosas que sucedieron hoy por las que te sientes agradecido/a.',
      'Pueden ser cosas muy pequeñas (ej. un buen café, un mensaje de un amigo).',
      'Reflexiona brevemente por qué esas cosas son positivas.'
    ]
  }
];

// Initial Mock Patients
const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'pt-1',
    username: 'juan',
    name: 'Juan Pérez',
    role: UserRole.PATIENT,
    therapistId: 'th-1',
    assignedExercises: [
      {
        id: 'ex-1',
        title: 'Registro de Pensamientos',
        description: 'Identificar pensamientos automáticos negativos.',
        symptomsAddressed: 'Ansiedad general',
        steps: ['Identifica la situación.', 'Anota lo que sentiste.', 'Escribe el pensamiento automático.'],
        assignedDate: '2023-10-25',
        completed: true,
        completionDate: '2023-10-26',
        patientNotes: 'Me sentí mejor después de escribirlo.',
        moodRatingAfter: 7
      },
      {
        id: 'ex-2',
        title: 'Respiración Diafragmática',
        description: 'Técnica de relajación para reducir la ansiedad fisiológica inmediata.',
        symptomsAddressed: 'Estrés y Ansiedad',
        steps: [
            'Siéntate en una posición cómoda y coloca una mano en tu pecho y la otra en tu abdomen.',
            'Inhala lentamente por la nariz durante 4 segundos, sintiendo cómo se eleva tu abdomen.',
            'Mantén la respiración por 4 segundos.',
            'Exhala suavemente por la boca durante 6 segundos.',
            'Repite este ciclo durante 5 minutos para calmar tu sistema nervioso.'
        ],
        assignedDate: new Date().toISOString().split('T')[0],
        completed: false
      }
    ],
    todoTasks: [
        { id: 't-1', content: 'Beber 2 litros de agua', completed: false },
        { id: 't-2', content: 'Caminata de 15 minutos', completed: true },
        { id: 't-3', content: 'Leer 10 páginas de un libro', completed: false },
        { id: 't-4', content: 'Dormir antes de las 11 PM', completed: false },
    ],
    progressHistory: [
      { date: '10-20', moodAverage: 4, exercisesCompleted: 0 },
      { date: '10-22', moodAverage: 5, exercisesCompleted: 1 },
      { date: '10-24', moodAverage: 6, exercisesCompleted: 1 },
      { date: '10-26', moodAverage: 7, exercisesCompleted: 2 },
    ]
  }
];

// --- Views Enum ---
enum View {
  LOGIN,
  RECOVER_PASSWORD,
  THERAPIST_DASHBOARD,
  PATIENT_DETAILS,
  PATIENT_DASHBOARD,
  EXERCISE_DETAIL,
  AI_GENERATOR // New View
}

export default function App() {
  // --- Global State ---
  const [currentView, setCurrentView] = useState<View>(View.LOGIN);
  const [currentUser, setCurrentUser] = useState<User | Patient | null>(null);
  
  // Data State (Simulated DB)
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  // Login Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Recover Password State
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');

  // Exercise Generation & Assignment State
  const [symptomInput, setSymptomInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [librarySelection, setLibrarySelection] = useState<string>(''); // For dropdown
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null); // For AI Preview

  // --- Handlers ---

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    // Simulated Auth Logic
    if (username === 'admin' && password === 'admin') {
      setCurrentUser(MOCK_THERAPIST);
      setCurrentView(View.THERAPIST_DASHBOARD);
      return;
    }

    const foundPatient = patients.find(p => p.username === username && password === '1234');
    if (foundPatient) {
      setCurrentUser(foundPatient);
      setCurrentView(View.PATIENT_DASHBOARD);
      return;
    }

    setLoginError('Usuario o contraseña incorrectos. (Demo: admin/admin o juan/1234)');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUsername('');
    setPassword('');
    setCurrentView(View.LOGIN);
    setSelectedPatientId(null);
    setPreviewExercise(null);
  };

  const handleRecoverPassword = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate recovery
    setRecoveryMessage(`Se han enviado instrucciones a ${recoveryEmail}`);
    setTimeout(() => {
        setRecoveryMessage('');
        setCurrentView(View.LOGIN);
    }, 3000);
  };

  // Therapist: Create Patient
  const handleCreatePatient = (name: string, user: string) => {
    const newPatient: Patient = {
        id: `pt-${Date.now()}`,
        name: name,
        username: user,
        role: UserRole.PATIENT,
        therapistId: MOCK_THERAPIST.id,
        assignedExercises: [],
        todoTasks: [],
        progressHistory: []
    };
    setPatients([...patients, newPatient]);
  };

  // Therapist: Assign from Standard Library
  const handleAssignFromLibrary = () => {
    if (!librarySelection || !selectedPatientId) return;

    const template = STANDARD_LIBRARY.find(ex => ex.title === librarySelection);
    if (!template) return;

    const newExercise: Exercise = {
        id: `ex-${Date.now()}`,
        ...template,
        assignedDate: new Date().toISOString().split('T')[0],
        completed: false
    };

    setPatients(prev => prev.map(p => {
        if (p.id === selectedPatientId) {
            return {
                ...p,
                assignedExercises: [newExercise, ...p.assignedExercises]
            };
        }
        return p;
    }));
    setLibrarySelection(''); // Reset selection
    alert("Ejercicio asignado exitosamente.");
  };

  // Therapist: Generate Exercise with Gemini (Directly in Patient Details)
  const handleGenerateExercise = async () => {
    if (!symptomInput.trim() || !selectedPatientId) return;
    
    setIsGenerating(true);
    try {
      const result = await generateCbtExercise(symptomInput);
      if (result) {
        const newExercise: Exercise = {
          id: `ex-${Date.now()}`,
          title: result.title,
          description: result.description,
          steps: result.steps,
          symptomsAddressed: symptomInput,
          assignedDate: new Date().toISOString().split('T')[0],
          completed: false
        };

        // Update Patient State
        setPatients(prev => prev.map(p => {
          if (p.id === selectedPatientId) {
            return {
              ...p,
              assignedExercises: [newExercise, ...p.assignedExercises]
            };
          }
          return p;
        }));
        setSymptomInput('');
      }
    } catch (err) {
      console.error(err);
      alert("Error al generar el ejercicio. Verifique su API Key.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Therapist: AI Generator View Handlers
  const handleGeneratePreview = async () => {
    if (!symptomInput.trim()) return;
    setIsGenerating(true);
    setPreviewExercise(null);
    try {
        const result = await generateCbtExercise(symptomInput);
        if (result) {
            setPreviewExercise({
                id: `ex-${Date.now()}`,
                title: result.title,
                description: result.description,
                steps: result.steps,
                symptomsAddressed: symptomInput,
                assignedDate: new Date().toISOString().split('T')[0],
                completed: false
            });
        }
    } catch (err) {
        console.error(err);
        alert("Error al generar. Intente de nuevo.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleConfirmAssignment = () => {
      if (!previewExercise || !selectedPatientId) {
          alert("Debe seleccionar un paciente y generar un ejercicio.");
          return;
      }

      setPatients(prev => prev.map(p => {
          if (p.id === selectedPatientId) {
              return {
                  ...p,
                  assignedExercises: [previewExercise, ...p.assignedExercises]
              };
          }
          return p;
      }));

      alert("Ejercicio asignado correctamente.");
      setPreviewExercise(null);
      setSymptomInput('');
      setSelectedPatientId(null);
      setCurrentView(View.THERAPIST_DASHBOARD);
  };

  // Patient: Complete Exercise
  const handleCompleteExercise = (notes: string, mood: number) => {
    if (!currentUser || !selectedExercise) return;

    const updatedPatients = patients.map(p => {
        if (p.id === currentUser.id) {
            const updatedExercises = p.assignedExercises.map(ex => {
                if (ex.id === selectedExercise.id) {
                    return {
                        ...ex,
                        completed: true,
                        completionDate: new Date().toISOString().split('T')[0],
                        patientNotes: notes,
                        moodRatingAfter: mood
                    };
                }
                return ex;
            });
            
            // Add progress log simply for demo
            const today = new Date().toISOString().slice(5, 10); // MM-DD
            const newHistory = [...p.progressHistory, { date: today, moodAverage: mood, exercisesCompleted: 1 }];

            return { ...p, assignedExercises: updatedExercises, progressHistory: newHistory };
        }
        return p;
    });

    setPatients(updatedPatients);
    // Update current user reference if it's the patient
    const me = updatedPatients.find(p => p.id === currentUser.id);
    if(me) setCurrentUser(me);
    
    setCurrentView(View.PATIENT_DASHBOARD);
  };

  // Patient: Toggle Task Completion
  const handleToggleTask = (taskId: string) => {
    if (!currentUser) return;
    
    const updatedPatients = patients.map(p => {
        if (p.id === currentUser.id) {
            const updatedTasks = p.todoTasks.map(t => 
                t.id === taskId ? { ...t, completed: !t.completed } : t
            );
            return { ...p, todoTasks: updatedTasks };
        }
        return p;
    });

    setPatients(updatedPatients);
    const me = updatedPatients.find(p => p.id === currentUser.id);
    if(me) setCurrentUser(me);
  };

  // --- Sub-Components (Render Functions) ---

  const renderLogin = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
        <div className="text-center mb-8">
          <div className="bg-teal-600 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-200">
            <Brain className="text-white w-8 h-8" />
          </div>
          <h2 className="text-3xl font-bold text-slate-800">MenteClara</h2>
          <p className="text-slate-500 mt-2">Plataforma de Terapia Cognitivo Conductual</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <Input 
            label="Usuario" 
            placeholder="Ingrese su usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input 
            label="Contraseña" 
            type="password" 
            placeholder="Ingrese su contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          
          {loginError && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              {loginError}
            </div>
          )}

          <button 
            type="submit" 
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            Ingresar
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setCurrentView(View.RECOVER_PASSWORD)}
            className="text-sm text-teal-600 hover:text-teal-800 font-medium hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </div>
    </div>
  );

  const renderRecoverPassword = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
        <button 
          onClick={() => setCurrentView(View.LOGIN)} 
          className="absolute top-8 left-8 text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full hover:bg-slate-200 transition-colors"
        >
            <ArrowLeft size={16} /> Volver
        </button>

        <div className="text-center mb-8 mt-4">
            <div className="bg-teal-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-teal-50">
                <KeyRound className="text-teal-600 w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Recuperar Contraseña</h2>
            <p className="text-slate-500 mt-2 text-sm max-w-xs mx-auto">Ingresa el correo asociado a tu cuenta para recibir las instrucciones de recuperación.</p>
        </div>
        
        {recoveryMessage ? (
            <div className="flex flex-col items-center justify-center py-8">
                <div className="bg-green-100 text-green-700 p-4 rounded-full mb-4">
                    <CheckCircle size={32} />
                </div>
                <div className="bg-green-50 text-green-800 p-4 rounded-lg text-center w-full">
                    <p className="font-medium">¡Correo Enviado!</p>
                    <p className="text-sm mt-1">{recoveryMessage}</p>
                </div>
                <p className="text-xs text-slate-400 mt-4">Redirigiendo al login...</p>
            </div>
        ) : (
            <form onSubmit={handleRecoverPassword} className="space-y-6">
            <Input 
                label="Correo Electrónico" 
                type="email" 
                placeholder="ejemplo@correo.com"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                required
                className="bg-slate-50"
            />
            <button 
                type="submit" 
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg"
            >
                Enviar Instrucciones
            </button>
            </form>
        )}
      </div>
    </div>
  );

  const renderAIGenerator = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
        <button 
            onClick={() => {
                setPreviewExercise(null);
                setSymptomInput('');
                setCurrentView(View.THERAPIST_DASHBOARD);
            }} 
            className="text-slate-500 hover:text-teal-600 flex items-center gap-1"
        >
            <ArrowLeft size={20} /> Volver al Panel
        </button>

        <div className="text-center mb-8">
            <div className="bg-gradient-to-tr from-teal-500 to-emerald-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200">
                <Sparkles className="text-white w-8 h-8" />
            </div>
            <h2 className="text-3xl font-bold text-slate-800">Generador de Ejercicios IA</h2>
            <p className="text-slate-500 mt-2 max-w-xl mx-auto">
                Diseña intervenciones terapéuticas personalizadas analizando los síntomas específicos de tu paciente mediante inteligencia artificial.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Input Section */}
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <UserIcon size={18} className="text-teal-600" />
                        1. Seleccionar Paciente
                    </h3>
                    <select
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-slate-50"
                        value={selectedPatientId || ''}
                        onChange={(e) => setSelectedPatientId(e.target.value)}
                    >
                        <option value="">-- Seleccionar Paciente --</option>
                        {patients.map(p => (
                            <option key={p.id} value={p.id}>{p.name} (@{p.username})</option>
                        ))}
                    </select>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Brain size={18} className="text-teal-600" />
                        2. Describir Síntomas
                    </h3>
                    <textarea 
                        className="w-full p-4 border border-slate-300 rounded-lg h-40 focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none"
                        placeholder="Ej: El paciente reporta ansiedad social severa al entrar en reuniones de trabajo, con taquicardia y pensamientos de que todos lo juzgan..."
                        value={symptomInput}
                        onChange={(e) => setSymptomInput(e.target.value)}
                    />
                    <div className="mt-4">
                        <button 
                            onClick={handleGeneratePreview}
                            disabled={isGenerating || !symptomInput}
                            className="w-full py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Analizando y Generando...
                                </>
                            ) : (
                                <>
                                    <Wand2 size={20} />
                                    Generar Ejercicio
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview Section */}
            <div className="bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 p-6 flex flex-col">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <BookOpen size={18} className="text-teal-600" />
                    Vista Previa del Ejercicio
                </h3>
                
                {previewExercise ? (
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 flex-grow animate-in fade-in zoom-in duration-300">
                        <div className="border-b border-slate-100 pb-4 mb-4">
                            <h4 className="text-xl font-bold text-teal-800">{previewExercise.title}</h4>
                            <p className="text-sm text-slate-500 mt-1">{previewExercise.description}</p>
                        </div>
                        <div className="space-y-3 mb-6">
                            {previewExercise.steps.map((step, idx) => (
                                <div key={idx} className="flex gap-3 text-sm text-slate-700">
                                    <span className="font-bold text-teal-600">{idx + 1}.</span>
                                    <span>{step}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-auto pt-4 border-t border-slate-100">
                            <button 
                                onClick={handleConfirmAssignment}
                                disabled={!selectedPatientId}
                                className="w-full py-3 bg-slate-900 text-white font-bold rounded-lg hover:bg-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save size={18} />
                                {selectedPatientId ? 'Confirmar y Asignar' : 'Seleccione un paciente primero'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-grow flex flex-col items-center justify-center text-slate-400 text-center p-8">
                        <Sparkles size={48} className="mb-4 text-slate-300" />
                        <p>Los resultados generados por la IA aparecerán aquí para su revisión antes de ser asignados.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );

  const renderTherapistDashboard = () => (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Panel de Pacientes</h2>
          <p className="text-slate-500">Gestiona tus pacientes y monitorea su progreso.</p>
        </div>
        <div className="flex gap-3">
            <button 
                onClick={() => {
                    setSymptomInput('');
                    setPreviewExercise(null);
                    setSelectedPatientId(null);
                    setCurrentView(View.AI_GENERATOR);
                }}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-4 py-2 rounded-lg shadow-sm transition-all"
            >
                <Sparkles size={18} />
                Generador IA
            </button>
            <button 
                onClick={() => {
                    const name = prompt("Nombre del paciente:");
                    const user = prompt("Usuario del paciente:");
                    if(name && user) handleCreatePatient(name, user);
                }}
                className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg shadow-sm transition-colors"
            >
                <Plus size={18} />
                Nuevo Paciente
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {patients.map(patient => {
            const completedCount = patient.assignedExercises.filter(e => e.completed).length;
            const totalCount = patient.assignedExercises.length;
            
            return (
                <div key={patient.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-lg">
                                {patient.name.charAt(0)}
                            </div>
                            <span className="bg-teal-50 text-teal-700 text-xs px-2 py-1 rounded-full font-medium">
                                Activo
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">{patient.name}</h3>
                        <p className="text-sm text-slate-500 mb-4">@{patient.username}</p>
                        
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Ejercicios Completados</span>
                                <span className="font-medium text-slate-900">{completedCount} / {totalCount}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div 
                                    className="bg-teal-500 h-2 rounded-full" 
                                    style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                                ></div>
                            </div>
                        </div>

                        <button 
                            onClick={() => {
                                setSelectedPatientId(patient.id);
                                setCurrentView(View.PATIENT_DETAILS);
                            }}
                            className="w-full flex items-center justify-center gap-2 text-teal-600 font-medium border border-teal-100 bg-teal-50 hover:bg-teal-100 py-2 rounded-lg transition-colors"
                        >
                            Ver Progreso y Asignar
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );

  const renderPatientDetails = () => {
    const patient = patients.find(p => p.id === selectedPatientId);
    if (!patient) return null;

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <button onClick={() => setCurrentView(View.THERAPIST_DASHBOARD)} className="text-slate-500 hover:text-teal-600 flex items-center gap-1 mb-4">
           <ArrowLeft size={20} /> Volver al Panel
        </button>

        <div className="flex flex-col lg:flex-row gap-8">
            {/* Left Column: Stats & Exercises */}
            <div className="flex-1 space-y-8">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Progreso Emocional</h3>
                    <div className="h-64 w-full">
                        {patient.progressHistory.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={patient.progressHistory}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                                    <YAxis domain={[0, 10]} stroke="#64748b" fontSize={12} />
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                    />
                                    <Line type="monotone" dataKey="moodAverage" stroke="#0d9488" strokeWidth={3} activeDot={{ r: 6 }} name="Estado de Ánimo (1-10)" />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">Sin datos registrados aún</div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-bold text-slate-800">Historial de Ejercicios</h3>
                    </div>
                    <ul className="divide-y divide-slate-100">
                        {patient.assignedExercises.length === 0 && (
                            <li className="p-6 text-center text-slate-500">No hay ejercicios asignados.</li>
                        )}
                        {patient.assignedExercises.map(ex => (
                            <li key={ex.id} className="p-4 hover:bg-slate-50 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-medium text-slate-900">{ex.title}</h4>
                                        <p className="text-xs text-slate-500 mt-1">Para: {ex.symptomsAddressed}</p>
                                    </div>
                                    {ex.completed ? (
                                        <span className="flex items-center gap-1 text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded-full">
                                            <CheckCircle size={12} /> Completado ({ex.completionDate})
                                        </span>
                                    ) : (
                                        <span className="text-amber-600 text-xs font-medium bg-amber-50 px-2 py-1 rounded-full">
                                            Pendiente
                                        </span>
                                    )}
                                </div>
                                {ex.completed && (
                                    <div className="mt-3 bg-slate-50 p-3 rounded-lg text-sm text-slate-600 italic border-l-2 border-teal-200">
                                        "{ex.patientNotes}" <br/>
                                        <span className="text-xs text-slate-400 not-italic mt-1 block">Ánimo reportado: {ex.moodRatingAfter}/10</span>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Right Column: Assignments */}
            <div className="w-full lg:w-96 space-y-6">
                
                {/* 1. Standard Library Assignment */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Library className="text-teal-600" size={20} />
                        Biblioteca de Ejercicios
                    </h3>
                    <p className="text-slate-500 text-sm mb-4">Selecciona un ejercicio pre-diseñado para asignar inmediatamente.</p>
                    
                    <div className="space-y-4">
                        <select 
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                            value={librarySelection}
                            onChange={(e) => setLibrarySelection(e.target.value)}
                        >
                            <option value="">-- Seleccionar Ejercicio --</option>
                            {STANDARD_LIBRARY.map((ex, idx) => (
                                <option key={idx} value={ex.title}>{ex.title}</option>
                            ))}
                        </select>
                        
                        {librarySelection && (
                            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-slate-100">
                                {STANDARD_LIBRARY.find(e => e.title === librarySelection)?.description}
                            </div>
                        )}

                        <button 
                            onClick={handleAssignFromLibrary}
                            disabled={!librarySelection}
                            className="w-full py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Asignar Ejercicio
                        </button>
                    </div>
                </div>

                {/* 2. AI Assistant (Contextual) */}
                <div className="bg-gradient-to-br from-teal-600 to-teal-800 text-white rounded-xl shadow-lg p-6 sticky top-24">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <Brain className="text-white" />
                        </div>
                        <h3 className="font-bold text-lg">Asistente IA (Rápido)</h3>
                    </div>
                    <p className="text-teal-100 text-sm mb-6">
                        Generar ejercicio específicamente para {patient.name}.
                    </p>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-teal-100 mb-1 uppercase tracking-wider">Síntomas / Situación</label>
                            <textarea 
                                className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-white placeholder:text-teal-200/70 focus:ring-2 focus:ring-white/50 focus:outline-none text-sm resize-none h-24"
                                placeholder="Ej: Pánico al conducir..."
                                value={symptomInput}
                                onChange={(e) => setSymptomInput(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={handleGenerateExercise}
                            disabled={isGenerating || !symptomInput}
                            className="w-full py-3 bg-white text-teal-900 font-bold rounded-lg shadow-lg hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    Generando...
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={18} />
                                    Generar y Asignar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    );
  };

  const renderPatientDashboard = () => {
      // Robustly find the current patient from state to ensure data is fresh
      const patientData = currentUser && 'assignedExercises' in currentUser
        ? patients.find(p => p.id === currentUser.id) || currentUser
        : null;

      if (!patientData) return null;

      const myExercises = patientData.assignedExercises;
      const pendingExercises = myExercises.filter(ex => !ex.completed);
      const completedExercises = myExercises.filter(ex => ex.completed);

      return (
          <div className="max-w-6xl mx-auto space-y-8">
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
                  <h2 className="text-3xl font-bold text-slate-800 mb-2">Hola, {patientData.name} 👋</h2>
                  <p className="text-slate-500">Tu bienestar es un viaje. Aquí tienes tus actividades para hoy.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: CBT Exercises */}
                  <div className="lg:col-span-2">
                      <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-4">
                          <BookOpen className="text-teal-600" size={20} />
                          Para Hacer (Ejercicios TCC)
                      </h3>
                      <div className="space-y-4">
                          {pendingExercises.length === 0 ? (
                              <div className="p-8 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-500">
                                  🎉 ¡Todo al día! No tienes ejercicios pendientes.
                              </div>
                          ) : (
                              pendingExercises.map(ex => (
                                  <div 
                                      key={ex.id} 
                                      onClick={() => {
                                          setSelectedExercise(ex);
                                          setCurrentView(View.EXERCISE_DETAIL);
                                      }}
                                      className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                                  >
                                      <div>
                                          <div className="flex justify-between items-start mb-2">
                                              <span className="bg-teal-50 text-teal-700 text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                                                  Ejercicio Terapéutico
                                              </span>
                                              <span className="text-xs text-slate-400">{ex.assignedDate}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                              <h4 className="font-bold text-xl text-slate-800 group-hover:text-teal-600 transition-colors">{ex.title}</h4>
                                              <ChevronRight className="text-slate-300 group-hover:text-teal-600 transition-colors" size={20} />
                                          </div>
                                          <p className="text-slate-600 mt-2 line-clamp-2">{ex.description}</p>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>

                  {/* Right Column: Tasks & History */}
                  <div className="space-y-8">
                      {/* Daily Tasks Section */}
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-4">
                              <ListTodo className="text-indigo-600" size={20} />
                              Tareas Diarias
                          </h3>
                          <div className="space-y-3">
                              {patientData.todoTasks.map(task => (
                                  <div 
                                      key={task.id} 
                                      onClick={() => handleToggleTask(task.id)}
                                      className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group select-none"
                                  >
                                      <div className={`
                                          flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors
                                          ${task.completed ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 group-hover:border-indigo-400 bg-white'}
                                      `}>
                                          {task.completed && <Check size={14} className="text-white" strokeWidth={3} />}
                                      </div>
                                      <span className={`text-sm transition-all ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                          {task.content}
                                      </span>
                                  </div>
                              ))}
                              {patientData.todoTasks.length === 0 && (
                                  <p className="text-sm text-slate-400 text-center py-2">No tienes tareas pendientes.</p>
                              )}
                          </div>
                      </div>

                      {/* Completed History Section */}
                      <div>
                          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-4">
                              <CheckCircle className="text-green-600" size={20} />
                              Completados Recientemente
                          </h3>
                          <div className="space-y-4">
                              {completedExercises.slice(0, 5).map(ex => (
                                  <div key={ex.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 opacity-75">
                                      <h4 className="font-semibold text-slate-700 decoration-slate-400 text-sm">{ex.title}</h4>
                                      <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
                                          <span className="flex items-center gap-1">
                                              <Calendar size={12} /> {ex.completionDate}
                                          </span>
                                          <span className="bg-white px-2 py-0.5 rounded border border-slate-100">Ánimo: {ex.moodRatingAfter}/10</span>
                                      </div>
                                  </div>
                              ))}
                              {completedExercises.length === 0 && (
                                  <p className="text-sm text-slate-400 italic">Aún no has completado ejercicios.</p>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  const renderExerciseDetail = () => {
      if (!selectedExercise) return null;
      const [notes, setNotes] = useState('');
      const [rating, setRating] = useState(5);

      return (
        <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button 
                onClick={() => setCurrentView(View.PATIENT_DASHBOARD)} 
                className="mb-6 text-slate-500 hover:text-teal-600 flex items-center gap-1 transition-colors"
            >
                <ArrowLeft size={18} /> Volver al tablero
            </button>

            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                {/* Header Coherente: Vincula Síntoma con Solución */}
                <div className="bg-teal-600 p-8 text-white relative overflow-hidden">
                    <Target className="absolute -right-6 -top-6 text-teal-500/20 w-48 h-48 rotate-12" />
                    
                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 bg-teal-700/50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-teal-100 mb-4 border border-teal-500/30">
                            <Target size={14} />
                            Objetivo Terapéutico: {selectedExercise.symptomsAddressed}
                        </div>
                        <h2 className="text-3xl font-bold mb-3">{selectedExercise.title}</h2>
                        <p className="text-teal-50 text-lg leading-relaxed max-w-2xl">{selectedExercise.description}</p>
                    </div>
                </div>
                
                <div className="p-8">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="h-8 w-1 bg-teal-500 rounded-full"></div>
                        <h3 className="font-bold text-slate-800 text-xl">Instrucciones Paso a Paso</h3>
                    </div>
                    
                    <div className="space-y-6 mb-10">
                        {selectedExercise.steps.map((step, idx) => (
                            <div key={idx} className="flex gap-4 group">
                                <div className="flex-shrink-0 w-10 h-10 bg-teal-50 text-teal-700 rounded-xl border border-teal-100 flex items-center justify-center font-bold text-lg group-hover:bg-teal-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                                    {idx + 1}
                                </div>
                                <div className="pt-2 bg-slate-50 p-4 rounded-xl rounded-tl-none border border-slate-100 w-full group-hover:border-teal-100 transition-colors">
                                    <p className="text-slate-700 leading-relaxed text-lg">{step}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <CheckCircle className="text-teal-600" size={24} />
                            Registro de Finalización
                        </h3>
                        
                        <div className="mb-8">
                            <label className="block text-sm font-semibold text-slate-700 mb-4">
                                ¿Cómo te sientes ahora respecto a tus síntomas iniciales? (1-10)
                            </label>
                            <div className="px-2">
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="10" 
                                    value={rating} 
                                    onChange={(e) => setRating(Number(e.target.value))}
                                    className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600 hover:accent-teal-500 transition-all"
                                />
                                <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium uppercase tracking-wide">
                                    <span>Peor / Igual</span>
                                    <span className="text-teal-600 text-xl font-bold -mt-2">{rating}</span>
                                    <span>Mucho Mejor</span>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Reflexiones o Notas
                            </label>
                            <textarea 
                                className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-shadow text-slate-700 bg-white"
                                rows={3}
                                placeholder="¿Qué pensamientos surgieron? ¿Fue difícil concentrarse?"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>

                        <button 
                            onClick={() => handleCompleteExercise(notes, rating)}
                            className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 transform active:scale-[0.99]"
                        >
                            <Check size={24} strokeWidth={3} />
                            Completar Ejercicio
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  // --- Main Render ---

  return (
    <Layout user={currentUser} onLogout={handleLogout}>
      {currentView === View.LOGIN && renderLogin()}
      {currentView === View.RECOVER_PASSWORD && renderRecoverPassword()}
      {currentView === View.THERAPIST_DASHBOARD && renderTherapistDashboard()}
      {currentView === View.AI_GENERATOR && renderAIGenerator()}
      {currentView === View.PATIENT_DETAILS && renderPatientDetails()}
      {currentView === View.PATIENT_DASHBOARD && renderPatientDashboard()}
      {currentView === View.EXERCISE_DETAIL && renderExerciseDetail()}
    </Layout>
  );
}