import React, { useState } from 'react';
import { 
  Sparkles, UserCheck, Plus, ChevronRight, Ban, CheckCircle, 
  ArrowLeft, Save, CheckSquare, Square, Loader2, Activity, Shield, Stethoscope,
  ArrowRight, RefreshCw, Calendar, TrendingUp, Volume2
} from 'lucide-react';
import { Layout } from './components/Layout';
import { Input } from './components/Input';
import { generateCbtExercise, generateTextToSpeech } from './services/geminiService';
import { 
  User, Patient, UserRole, Exercise, GeminiExerciseResponse, 
  Task 
} from './types';

// Mock Data Setup
const MOCK_ADMIN: User = {
  id: 'adm-1',
  email: 'admin@menteclara.com',
  name: 'Administradora Principal',
  role: UserRole.ADMIN,
  status: 'active',
  password: '123'
};

const MOCK_THERAPIST_1: User = {
  id: 'th-1',
  email: 'doctor@menteclara.com',
  name: 'Dr. Sofia Ramirez',
  role: UserRole.THERAPIST,
  status: 'active',
  password: '123'
};

const MOCK_THERAPIST_2: User = {
  id: 'th-2',
  email: 'carlos@menteclara.com',
  name: 'Lic. Carlos Mendez',
  role: UserRole.THERAPIST,
  status: 'inactive',
  password: '123'
};

const MOCK_PATIENTS: Patient[] = [
  {
    id: 'pt-1',
    email: 'juan@email.com',
    name: 'Juan Perez',
    role: UserRole.PATIENT,
    status: 'active',
    password: '123',
    therapistId: 'th-1',
    assignedExercises: [
      {
        id: 'ex-1',
        title: 'Registro de Pensamientos',
        description: 'Identificar pensamientos automáticos negativos.',
        symptomsAddressed: 'Ansiedad',
        steps: ['Identificar situación: ¿Qué estaba pasando?', 'Identificar emoción: ¿Qué sentiste?', 'Escribir pensamiento: ¿Qué pasó por tu mente?'],
        assignedDate: new Date().toISOString(),
        completed: false
      }
    ],
    todoTasks: [
      { id: 't-1', content: 'Caminar 15 minutos', completed: true },
      { id: 't-2', content: 'Practicar respiración profunda', completed: false }
    ],
    progressHistory: [
      { date: '2023-10-25T10:00:00Z', moodAverage: 6.5, exercisesCompleted: 2 },
      { date: '2023-10-26T10:00:00Z', moodAverage: 7.2, exercisesCompleted: 1 },
      { date: '2023-10-27T10:00:00Z', moodAverage: 8.0, exercisesCompleted: 3 },
    ]
  }
];

enum View {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  AI_GENERATOR = 'AI_GENERATOR',
  PATIENT_DETAILS = 'PATIENT_DETAILS',
  ADMIN_PANEL = 'ADMIN_PANEL'
}

// Audio decoding helpers
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export default function App() {
  // State
  const [currentUser, setCurrentUser] = useState<User | Patient | null>(null);
  const [therapists, setTherapists] = useState<User[]>([MOCK_THERAPIST_1, MOCK_THERAPIST_2]);
  const [patients, setPatients] = useState<Patient[]>(MOCK_PATIENTS);
  const [currentView, setCurrentView] = useState<View>(View.LOGIN);
  
  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Admin State
  const [adminNewName, setAdminNewName] = useState('');
  const [adminNewEmail, setAdminNewEmail] = useState('');
  const [adminNewPass, setAdminNewPass] = useState('');
  const [adminError, setAdminError] = useState('');

  // Therapist Dashboard State
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [creationError, setCreationError] = useState('');

  // AI Generator State
  const [symptomInput, setSymptomInput] = useState('');
  const [previewExercise, setPreviewExercise] = useState<GeminiExerciseResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);

  // Audio State
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);

  // Handlers
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const emailInput = loginEmail.trim().toLowerCase();
    const passwordInput = loginPassword.trim();

    // Admin Login
    if (emailInput === MOCK_ADMIN.email && passwordInput === MOCK_ADMIN.password) {
      setCurrentUser(MOCK_ADMIN);
      setCurrentView(View.ADMIN_PANEL);
      return;
    }

    // Therapist Login
    const therapistAccount = therapists.find(t => t.email === emailInput && t.password === passwordInput);
    if (therapistAccount) {
      if (therapistAccount.status === 'inactive') {
        setLoginError('Acceso deshabilitado. Contacte al administrador.');
        return;
      }
      setCurrentUser(therapistAccount);
      setCurrentView(View.DASHBOARD);
      return;
    }

    // Patient Login
    const patient = patients.find(p => p.email.toLowerCase() === emailInput && p.password === passwordInput);
    if (patient) {
        // 1. Check Patient Status
        if (patient.status === 'inactive') {
            setLoginError('Cuenta suspendida. Contacte a su terapeuta.');
            return;
        }
        
        // 2. Check Therapist Status (Inheritance Rule)
        const patientTherapist = therapists.find(t => t.id === patient.therapistId);
        if (patientTherapist && patientTherapist.status === 'inactive') {
            setLoginError('Acceso denegado temporalmente por estado del terapeuta.');
            return;
        }

      setCurrentUser(patient);
      setCurrentView(View.DASHBOARD);
      return;
    }

    setLoginError('Credenciales inválidas. Verifique correo y contraseña.');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView(View.LOGIN);
    setLoginEmail('');
    setLoginPassword('');
  };

  const handleAdminCreateTherapist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminNewName || !adminNewEmail || !adminNewPass) {
        setAdminError('Todos los campos son requeridos');
        return;
    }
    if (therapists.some(t => t.email === adminNewEmail)) {
        setAdminError('El email ya está registrado');
        return;
    }

    const newTherapist: User = {
        id: `th-${Date.now()}`,
        name: adminNewName,
        email: adminNewEmail,
        password: adminNewPass,
        role: UserRole.THERAPIST,
        status: 'active'
    };

    setTherapists([...therapists, newTherapist]);
    setAdminNewName('');
    setAdminNewEmail('');
    setAdminNewPass('');
    setAdminError('');
  };

  const handleTherapistCreatePatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPass) {
      setCreationError('Todos los campos son obligatorios');
      return;
    }
    
    // Check duplicates
    if (patients.some(p => p.email.toLowerCase() === newUserEmail.toLowerCase())) {
        setCreationError('El email ya está registrado');
        return;
    }

    const newPatient: Patient = {
      id: `pt-${Date.now()}`,
      name: newUserName,
      email: newUserEmail,
      password: newUserPass,
      role: UserRole.PATIENT,
      status: 'active',
      therapistId: currentUser?.id || '',
      assignedExercises: [],
      todoTasks: [],
      progressHistory: []
    };

    setPatients([...patients, newPatient]);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPass('');
    setCreationError('');
  };

  const toggleUserStatus = (patientId: string) => {
    setPatients(patients.map(p => 
      p.id === patientId ? { ...p, status: p.status === 'active' ? 'inactive' : 'active' } : p
    ));
  };

  const toggleTherapistStatus = (therapistId: string) => {
    setTherapists(therapists.map(t => 
      t.id === therapistId ? { ...t, status: t.status === 'active' ? 'inactive' : 'active' } : t
    ));
  };

  const handleGenerateAI = async () => {
    if (!symptomInput.trim()) return;
    setIsGenerating(true);
    setPreviewExercise(null);
    setAssignmentSuccess(null); // Reset success message on new generation
    
    const result = await generateCbtExercise(symptomInput);
    if (result) {
      setPreviewExercise(result);
    }
    setIsGenerating(false);
  };

  const handleAssignExercise = () => {
      // Determine target ID: selected patient (for therapist) or current user (for patient)
      let targetId = selectedPatientId;
      let targetName = '';

      if (currentUser?.role === UserRole.PATIENT) {
        targetId = currentUser.id;
        targetName = currentUser.name;
      } else if (currentUser?.role === UserRole.THERAPIST) {
        if (!selectedPatientId) {
          setAssignError('Selecciona un paciente para asignar');
          return;
        }
        const found = patients.find(p => p.id === selectedPatientId);
        targetName = found ? found.name : '';
      }

      if (!targetId || !previewExercise) {
          setAssignError('Error en la asignación');
          return;
      }
      
      const newExercise: Exercise = {
          id: `ex-${Date.now()}`,
          title: previewExercise.title,
          description: previewExercise.description,
          steps: previewExercise.steps,
          symptomsAddressed: symptomInput,
          assignedDate: new Date().toISOString(),
          completed: false,
          moodRatingAfter: undefined,
          patientNotes: undefined
      };

      // Update patients array
      const updatedPatients = patients.map(p => {
          if (p.id === targetId) {
              return { ...p, assignedExercises: [...p.assignedExercises, newExercise] };
          }
          return p;
      });
      setPatients(updatedPatients);

      // If Current User is the patient, we must update their state too so UI reflects changes
      if (currentUser?.role === UserRole.PATIENT) {
        const updatedMe = updatedPatients.find(p => p.id === currentUser.id);
        if (updatedMe) {
            setCurrentUser(updatedMe);
        }
      }
      
      setAssignmentSuccess(`El ejercicio "${newExercise.title}" ha sido guardado correctamente.`);
      setAssignError('');
  };

  const resetAIView = () => {
      setPreviewExercise(null);
      setSymptomInput('');
      setSelectedPatientId(null);
      setAssignmentSuccess(null);
      setAssignError('');
  };

  const handlePlayAudio = async (exerciseId: string, textToRead: string) => {
    if (audioLoadingId) return; // Prevent multiple clicks
    setAudioLoadingId(exerciseId);
    
    try {
        const base64Audio = await generateTextToSpeech(textToRead);
        if (base64Audio) {
            const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
            const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                outputAudioContext,
                24000,
                1
            );
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContext.destination);
            source.onended = () => {
              outputAudioContext.close();
            };
            source.start();
        }
    } catch (e) {
        console.error("Error playing audio", e);
    } finally {
        setAudioLoadingId(null);
    }
  };

  // Render Methods
  const renderLogin = () => (
    <div className="max-w-md mx-auto mt-20 bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-700">
      <div className="text-center mb-8">
        <div className="bg-teal-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-900/50">
           <Activity className="text-white w-8 h-8" />
        </div>
        <h2 className="text-3xl font-bold text-white">Bienvenido</h2>
        <p className="text-slate-400 mt-2">Inicia sesión para continuar</p>
      </div>
      <form onSubmit={handleLogin}>
        <Input 
          label="Email" 
          value={loginEmail} 
          onChange={(e) => setLoginEmail(e.target.value)} 
          placeholder="tu@email.com"
          labelClassName="text-white"
          className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-teal-500"
        />
        <Input 
          label="Contraseña" 
          type="password" 
          value={loginPassword} 
          onChange={(e) => setLoginPassword(e.target.value)}
          placeholder="••••••••"
          labelClassName="text-white"
          className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-teal-500"
        />
        {loginError && <p className="text-red-400 text-sm font-bold mb-4 bg-red-900/20 p-3 rounded-lg border border-red-900/50">{loginError}</p>}
        <button className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-teal-900/20 mt-2">
          Ingresar
        </button>
      </form>
    </div>
  );

  const renderAccessDenied = () => (
      <div className="text-center py-20">
          <h2 className="text-2xl font-bold text-red-600">Acceso Denegado</h2>
          <button onClick={handleLogout} className="mt-4 text-teal-600 underline">Volver al inicio</button>
      </div>
  );

  const renderAdminPanel = () => {
    if (currentUser?.role !== UserRole.ADMIN) return renderAccessDenied();

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg">
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="text-teal-400" />
            Panel de Administración
          </h2>
          <p className="text-slate-400 mt-2">Gestión global de usuarios del sistema.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Therapist Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-fit">
                <h3 className="font-bold text-xl mb-4 flex items-center gap-2 text-slate-800">
                    <Stethoscope size={20} className="text-teal-600" />
                    Registrar Terapeuta
                </h3>
                <form onSubmit={handleAdminCreateTherapist} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre Completo</label>
                        <input 
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                            placeholder="Dr. Nombre Apellido"
                            value={adminNewName}
                            onChange={(e) => setAdminNewName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Email Profesional</label>
                        <input 
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                            placeholder="doctor@menteclara.com"
                            type="email"
                            value={adminNewEmail}
                            onChange={(e) => setAdminNewEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Contraseña</label>
                        <input 
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                            placeholder="••••••••"
                            type="password"
                            value={adminNewPass}
                            onChange={(e) => setAdminNewPass(e.target.value)}
                        />
                    </div>
                    {adminError && <p className="text-red-500 text-xs font-bold">{adminError}</p>}
                    <button type="submit" className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20">
                        <Plus size={18} /> Crear Cuenta
                    </button>
                </form>
            </div>

            {/* Therapists Table */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Administrar Terapeutas</h3>
                    <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded-full">Total: {therapists.length}</span>
                  </div>
                  <div className="p-0 overflow-x-auto">
                     <table className="w-full text-left">
                       <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
                         <tr>
                           <th className="px-6 py-4">Nombre</th>
                           <th className="px-6 py-4">Email</th>
                           <th className="px-6 py-4">Estado</th>
                           <th className="px-6 py-4 text-right">Acciones</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {therapists.map(therapist => (
                           <tr key={therapist.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                               <div className="flex items-center gap-3">
                                  <div className="h-9 w-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm">
                                     {therapist.name.charAt(0)}
                                  </div>
                                  <span className="font-bold text-slate-900">{therapist.name}</span>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500">{therapist.email}</td>
                            <td className="px-6 py-4">
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${therapist.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                    {therapist.status === 'active' ? 'ACTIVO' : 'INACTIVO'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                               <div className="flex justify-end gap-2">
                                   {therapist.status === 'active' ? (
                                       <button 
                                          onClick={() => toggleTherapistStatus(therapist.id)}
                                          className="bg-white text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors shadow-sm flex items-center gap-1 ml-auto"
                                       >
                                          <Ban size={14} /> Deshabilitar
                                       </button>
                                   ) : (
                                       <button 
                                          onClick={() => toggleTherapistStatus(therapist.id)}
                                          className="bg-white text-green-600 border border-green-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-50 transition-colors shadow-sm flex items-center gap-1 ml-auto"
                                       >
                                          <CheckCircle size={14} /> Habilitar
                                       </button>
                                   )}
                               </div>
                            </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden opacity-75">
                  <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-slate-800">Pacientes en el Sistema</h3>
                  </div>
                  <div className="p-0 overflow-x-auto">
                     <table className="w-full text-left">
                       <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
                         <tr>
                           <th className="px-6 py-4">Nombre</th>
                           <th className="px-6 py-4">Email</th>
                           <th className="px-6 py-4">Terapeuta Asignado</th>
                           <th className="px-6 py-4">Estado</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {patients.map(p => (
                           <tr key={p.id}>
                             <td className="px-6 py-4">
                               <div className="font-bold text-slate-900">{p.name}</div>
                             </td>
                             <td className="px-6 py-4 text-sm text-slate-600">{p.email}</td>
                             <td className="px-6 py-4 text-sm text-slate-600">
                                {therapists.find(t => t.id === p.therapistId)?.name || <span className="text-red-400 italic">No asignado / Inactivo</span>}
                             </td>
                             <td className="px-6 py-4">
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {p.status === 'active' ? 'Activo' : 'Suspendido'}
                                </span>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                  </div>
                </div>
            </div>
        </div>
      </div>
    );
  };

  const renderTherapistDashboard = () => {
    // Security Check: Only Therapists
    if (currentUser?.role !== UserRole.THERAPIST) return renderAccessDenied();

    // Data Filter: Only show my patients
    const myPatients = patients.filter(p => p.therapistId === currentUser?.id);

    return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Administrar Pacientes</h2>
          <p className="text-slate-600 text-lg">Gestiona tus pacientes y monitorea su progreso.</p>
        </div>
        <div className="flex gap-3">
            <button 
                onClick={() => {
                   resetAIView();
                   setCurrentView(View.AI_GENERATOR);
                }}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-5 py-3 rounded-xl shadow-md transition-all font-bold"
            >
                <Sparkles size={20} />
                Generador IA
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Create Patient Section */}
        <div className="bg-slate-800 text-white rounded-2xl shadow-lg p-6 flex flex-col justify-center">
            <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
                <UserCheck size={24} className="text-teal-400" />
                Registrar Paciente
            </h3>
            <p className="text-slate-400 text-sm mb-4">Crea una cuenta para tu paciente y asígnale acceso inmediato.</p>
            <form onSubmit={handleTherapistCreatePatient} className="space-y-3">
                <input 
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                    placeholder="Nombre Completo"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                />
                <input 
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                    placeholder="Email del Paciente"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                />
                <input 
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                    placeholder="Contraseña Temporal"
                    type="password"
                    value={newUserPass}
                    onChange={(e) => setNewUserPass(e.target.value)}
                />
                {creationError && <p className="text-red-400 text-xs font-bold">{creationError}</p>}
                <button type="submit" className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                    <Plus size={18} /> Crear Paciente
                </button>
            </form>
        </div>

        {/* Patients List */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            {myPatients.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center h-full">
                    <p className="text-slate-500 text-lg font-medium">No tienes pacientes asignados.</p>
                    <p className="text-slate-400 text-sm">Utiliza el formulario de la izquierda para registrar uno.</p>
                </div>
            ) : (
                myPatients.map(patient => {
                    const completedCount = patient.assignedExercises.filter(e => e.completed).length;
                    const totalCount = patient.assignedExercises.length;
                    
                    return (
                        <div key={patient.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all overflow-hidden">
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 font-bold text-lg">
                                        {patient.name.charAt(0)}
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wide ${patient.status === 'active' ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-600'}`}>
                                        {patient.status === 'active' ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">{patient.name}</h3>
                                <p className="text-xs text-slate-500 mb-4 font-medium break-all">{patient.email}</p>
                                
                                <div className="space-y-2 mb-6">
                                    <div className="flex justify-between text-xs font-semibold text-slate-600">
                                        <span>Progreso</span>
                                        <span className="text-slate-900">{completedCount} / {totalCount}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                        <div 
                                            className="bg-teal-500 h-2 rounded-full" 
                                            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="flex gap-2 flex-col">
                                    <button 
                                        onClick={() => {
                                            setSelectedPatientId(patient.id);
                                            setCurrentView(View.PATIENT_DETAILS);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 text-teal-700 font-bold border border-teal-100 bg-teal-50 hover:bg-teal-100 hover:border-teal-200 py-2 rounded-lg transition-all text-sm"
                                    >
                                        Ver Detalles
                                        <ChevronRight size={16} />
                                    </button>
                                    
                                    {patient.status === 'active' ? (
                                        <button 
                                            onClick={() => toggleUserStatus(patient.id)}
                                            className="w-full py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-300 transition-all shadow-sm text-sm font-bold flex items-center justify-center gap-2"
                                            title="Suspender acceso del paciente"
                                        >
                                            <Ban size={16} /> Cancelar acceso
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => toggleUserStatus(patient.id)}
                                            className="w-full py-2 bg-white border border-green-200 text-green-600 rounded-lg hover:bg-green-50 hover:border-green-300 transition-all shadow-sm text-sm font-bold flex items-center justify-center gap-2"
                                            title="Habilitar acceso del paciente"
                                        >
                                            <CheckCircle size={16} /> Habilitar acceso
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
      </div>
    </div>
  );
  };

  const renderAIGenerator = () => (
      <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4 mb-6">
              <button 
                  onClick={() => {
                      resetAIView();
                      setCurrentView(View.DASHBOARD);
                  }}
                  className="p-2 rounded-full hover:bg-slate-200 text-slate-600"
              >
                  <ArrowLeft />
              </button>
              <h2 className="text-2xl font-bold text-slate-900">
                  {currentUser?.role === UserRole.PATIENT ? 'Asistente Virtual TCC' : 'Generador de Ejercicios IA'}
              </h2>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                  {currentUser?.role === UserRole.PATIENT 
                    ? '¿Cómo te sientes en este momento? Describe tu situación o síntoma.'
                    : 'Describe los síntomas o la situación del paciente'}
              </label>
              <textarea
                  className="w-full p-4 border border-slate-600 bg-slate-800 text-white placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 h-32 resize-none"
                  placeholder={currentUser?.role === UserRole.PATIENT 
                    ? "Ej: Siento mucha ansiedad antes de presentar mi proyecto en el trabajo, me tiemblan las manos..."
                    : "Ej: El paciente siente mucha ansiedad social cuando tiene que hablar en reuniones de trabajo..."}
                  value={symptomInput}
                  onChange={(e) => setSymptomInput(e.target.value)}
              />
              <div className="mt-4 flex justify-end">
                  <button
                      onClick={handleGenerateAI}
                      disabled={isGenerating || !symptomInput}
                      className="bg-teal-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                      {isGenerating ? (
                          <><Loader2 className="animate-spin" size={18} /> {currentUser?.role === UserRole.PATIENT ? 'Analizando...' : 'Generando...'}</>
                      ) : (
                          <><Sparkles size={18} /> {currentUser?.role === UserRole.PATIENT ? 'Obtener Ayuda' : 'Generar Ejercicio'}</>
                      )}
                  </button>
              </div>
          </div>

          {previewExercise && (
              <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-teal-100 animate-in slide-in-from-bottom-5">
                  <div className="mb-6">
                      <h3 className="text-xl font-bold text-teal-900 mb-2">{previewExercise.title}</h3>
                      <p className="text-slate-600">{previewExercise.description}</p>
                  </div>
                  
                  <div className="space-y-3 mb-8">
                      <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Pasos a seguir:</h4>
                      <ol className="list-decimal list-inside space-y-2 text-slate-700">
                          {previewExercise.steps.map((step, idx) => (
                              <li key={idx} className="pl-2">{step}</li>
                          ))}
                      </ol>
                  </div>

                  {assignmentSuccess ? (
                       <div className="border-t pt-6">
                           <div className="bg-green-50 border border-green-200 rounded-xl p-6 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95">
                               <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                   <CheckCircle className="text-green-600 w-6 h-6" />
                               </div>
                               <h4 className="text-lg font-bold text-green-900 mb-2">
                                   {currentUser?.role === UserRole.PATIENT ? '¡Ejercicio Guardado!' : '¡Asignación Completada!'}
                               </h4>
                               <p className="text-green-700 mb-6">{assignmentSuccess}</p>
                               <div className="flex gap-4">
                                   <button 
                                      onClick={() => {
                                          resetAIView();
                                          setCurrentView(View.DASHBOARD);
                                      }}
                                      className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2 transition-colors"
                                   >
                                      Ir al Dashboard <ArrowRight size={18} />
                                   </button>
                                   <button 
                                      onClick={resetAIView}
                                      className="bg-white border border-green-300 text-green-700 px-6 py-2 rounded-lg font-bold hover:bg-green-50 flex items-center gap-2 transition-colors"
                                   >
                                      <RefreshCw size={18} /> {currentUser?.role === UserRole.PATIENT ? 'Consultar otro síntoma' : 'Generar Nuevo'}
                                   </button>
                               </div>
                           </div>
                       </div>
                  ) : (
                      <div className="flex items-center justify-between border-t pt-6">
                          <div className="flex-1 mr-4">
                              {currentUser?.role === UserRole.THERAPIST && (
                                <select 
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
                                    value={selectedPatientId || ''}
                                    onChange={(e) => setSelectedPatientId(e.target.value)}
                                >
                                    <option value="">-- Seleccionar Paciente para Asignar --</option>
                                    {patients.filter(p => p.therapistId === currentUser?.id).map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                              )}
                              {assignError && <p className="text-red-500 text-xs mt-1 font-semibold">{assignError}</p>}
                          </div>
                          <button 
                              onClick={handleAssignExercise}
                              className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-slate-800 flex items-center gap-2 transition-colors shadow-lg shadow-slate-900/20"
                          >
                              <Save size={18} /> 
                              {currentUser?.role === UserRole.PATIENT ? 'Guardar en mis ejercicios' : 'Asignar a Paciente'}
                          </button>
                      </div>
                  )}
              </div>
          )}
      </div>
  );

  const renderPatientDashboard = () => {
    // SECURITY/DATA CONSISTENCY: Always fetch the latest patient data from the master 'patients' array.
    // This ensures that any updates made by the therapist (who modifies 'patients') are immediately visible
    // when the patient views their dashboard, even if 'currentUser' state is slightly stale.
    const patient = patients.find(p => p.id === currentUser?.id) || (currentUser as Patient);
    
    // Sort exercises: Pending first, then Completed
    const sortedExercises = [...(patient.assignedExercises || [])].sort((a, b) => {
        if (a.completed === b.completed) return 0;
        return a.completed ? 1 : -1;
    });

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">Hola, {patient.name.split(' ')[0]}</h2>
                <p className="text-slate-600">Bienvenido a tu espacio personal.</p>
              </div>
              <button 
                onClick={() => {
                   resetAIView();
                   setCurrentView(View.AI_GENERATOR);
                }}
                className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white px-5 py-3 rounded-xl shadow-md transition-all font-bold"
              >
                  <Sparkles size={20} />
                  Consultar IA / Nuevo Síntoma
              </button>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Exercises List */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Activity className="text-teal-500" />
                        Mis Ejercicios
                    </h3>
                    <div className="space-y-4">
                        {sortedExercises.length > 0 ? (
                            sortedExercises.map(ex => (
                                <div 
                                    key={ex.id} 
                                    className={`border rounded-xl p-4 transition-all ${
                                        ex.completed 
                                            ? 'bg-green-50 border-green-200' 
                                            : 'bg-white border-slate-200 hover:border-teal-200'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className={`font-bold flex items-center gap-2 ${ex.completed ? 'text-green-800' : 'text-slate-800'}`}>
                                            {ex.completed && <CheckCircle size={18} className="text-green-600" />}
                                            {ex.title}
                                        </h4>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => handlePlayAudio(ex.id, `${ex.title}. ${ex.description}. ${ex.steps.join('. ')}.`)}
                                            className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-full font-bold flex items-center gap-1 shadow-sm hover:bg-indigo-100 transition-colors"
                                            disabled={!!audioLoadingId}
                                          >
                                            {audioLoadingId === ex.id ? (
                                              <Loader2 size={12} className="animate-spin" />
                                            ) : (
                                              <Volume2 size={14} />
                                            )}
                                            Escuchar ejercicio
                                          </button>
                                          
                                          {ex.completed && (
                                              <span className="text-xs bg-white text-green-700 border border-green-200 px-2 py-1 rounded-full font-bold flex items-center gap-1 shadow-sm">
                                                  <CheckCircle size={12} /> Completado
                                              </span>
                                          )}
                                        </div>
                                    </div>
                                    <p className={`text-sm mb-3 ${ex.completed ? 'text-green-700' : 'text-slate-600'}`}>
                                        {ex.description}
                                    </p>
                                    
                                    {ex.steps && ex.steps.length > 0 && (
                                        <div className="mt-3 mb-4 bg-slate-50 rounded-lg p-4 border border-slate-100">
                                            <h5 className="font-bold text-slate-900 text-sm mb-2">Instrucciones paso a paso:</h5>
                                            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
                                                {ex.steps.map((step, index) => (
                                                    <li key={index} className="pl-1 leading-relaxed">
                                                        {step}
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}

                                    {!ex.completed && (
                                        <button 
                                            className="text-sm font-bold text-teal-600 hover:text-teal-700 hover:underline flex items-center gap-1"
                                            onClick={() => {
                                                const updatedPatients = patients.map(p => {
                                                    if (p.id === patient.id) {
                                                        return {
                                                            ...p,
                                                            assignedExercises: p.assignedExercises.map(e => e.id === ex.id ? { ...e, completed: true } : e)
                                                        };
                                                    }
                                                    return p;
                                                });
                                                setPatients(updatedPatients);
                                                // Also update current user to keep sync, although dashboard pulls from patients list
                                                const updatedMe = updatedPatients.find(p => p.id === patient.id);
                                                if (updatedMe) setCurrentUser(updatedMe);
                                            }}
                                        >
                                            <Square size={16} /> Marcar como completado
                                        </button>
                                    )}
                                    {ex.completed && (
                                        <div className="text-xs font-semibold text-green-600 flex items-center gap-1 mt-2">
                                            Buen trabajo completando este ejercicio.
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-slate-400 text-sm">No tienes ejercicios asignados aún.</p>
                        )}
                    </div>
                </div>

                <div className="text-center mt-8 mb-4">
                  <p className="text-xs text-slate-400 italic">Esta aplicación no reemplaza la atención profesional.</p>
                </div>
            </div>
        </div>
    );
  };

  const renderPatientDetails = () => {
      const patient = patients.find(p => p.id === selectedPatientId);
      if (!patient) return null;

      return (
          <div className="max-w-4xl mx-auto">
              <button 
                  onClick={() => setCurrentView(View.DASHBOARD)}
                  className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors"
              >
                  <ArrowLeft size={20} /> Volver al panel
              </button>

              <div className="bg-white rounded-2xl shadow-sm p-8 border border-slate-200">
                  <div className="flex items-center gap-4 mb-8">
                      <div className="h-16 w-16 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 font-bold text-2xl">
                          {patient.name.charAt(0)}
                      </div>
                      <div>
                          <h2 className="text-2xl font-bold text-slate-900">{patient.name}</h2>
                          <p className="text-slate-500">{patient.email}</p>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                      <div>
                          <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Ejercicios Asignados</h3>
                          <ul className="space-y-3">
                              {patient.assignedExercises.map(ex => (
                                  <li key={ex.id} className="flex items-center justify-between text-sm">
                                      <span className="text-slate-700">{ex.title}</span>
                                      {ex.completed ? (
                                          <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle size={14}/> Listo</span>
                                      ) : (
                                          <span className="text-orange-500 font-bold flex items-center gap-1"><Loader2 size={14}/> Pendiente</span>
                                      )}
                                  </li>
                              ))}
                              {patient.assignedExercises.length === 0 && <li className="text-slate-400 italic">Sin ejercicios.</li>}
                          </ul>
                      </div>
                      
                      <div>
                           <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Resumen de Progreso</h3>
                           <div className="bg-slate-50 p-4 rounded-xl">
                               <div className="flex justify-between items-center mb-2">
                                   <span className="text-slate-600 text-sm">Ejercicios Completados</span>
                                   <span className="font-bold text-slate-900">
                                       {patient.assignedExercises.filter(e => e.completed).length} / {patient.assignedExercises.length}
                                   </span>
                               </div>
                               <div className="w-full bg-slate-200 rounded-full h-2.5">
                                   <div 
                                        className="bg-teal-600 h-2.5 rounded-full" 
                                        style={{ width: `${patient.assignedExercises.length > 0 ? (patient.assignedExercises.filter(e => e.completed).length / patient.assignedExercises.length) * 100 : 0}%` }}
                                   ></div>
                               </div>
                           </div>
                      </div>
                  </div>

                  {/* Progress History Section */}
                  <div className="border-t border-slate-100 pt-8">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <TrendingUp className="text-teal-600" size={20} />
                        Historial de Progreso
                    </h3>
                    {patient.progressHistory && patient.progressHistory.length > 0 ? (
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-xs">
                            <tr>
                              <th className="px-6 py-3">Fecha</th>
                              <th className="px-6 py-3">Estado de Ánimo</th>
                              <th className="px-6 py-3">Ejercicios Completados</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {patient.progressHistory.map((entry, index) => (
                              <tr key={index} className="hover:bg-slate-50/50">
                                <td className="px-6 py-4 text-slate-700 font-medium flex items-center gap-2">
                                  <Calendar size={14} className="text-slate-400" />
                                  {new Date(entry.date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-200 h-1.5 rounded-full w-24 max-w-[100px]">
                                      <div 
                                        className="bg-teal-500 h-1.5 rounded-full" 
                                        style={{ width: `${(entry.moodAverage / 10) * 100}%` }}
                                      ></div>
                                    </div>
                                    <span className="font-bold text-teal-700">{entry.moodAverage}/10</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-slate-600 font-medium">
                                  {entry.exercisesCompleted}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="bg-slate-50 rounded-xl p-8 text-center border border-dashed border-slate-300">
                        <p className="text-slate-400 italic">No hay historial de progreso registrado para este paciente.</p>
                      </div>
                    )}
                  </div>
              </div>
          </div>
      );
  };

  return (
    <Layout user={currentUser} onLogout={handleLogout}>
      {currentView === View.LOGIN && renderLogin()}
      {currentView === View.DASHBOARD && currentUser?.role === UserRole.THERAPIST && renderTherapistDashboard()}
      {currentView === View.DASHBOARD && currentUser?.role === UserRole.PATIENT && renderPatientDashboard()}
      {currentView === View.AI_GENERATOR && renderAIGenerator()}
      {currentView === View.PATIENT_DETAILS && renderPatientDetails()}
      {currentView === View.ADMIN_PANEL && renderAdminPanel()}
    </Layout>
  );
}