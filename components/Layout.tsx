import React from 'react';
import { LogOut, User as UserIcon, Activity } from 'lucide-react';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-teal-600 p-2 rounded-lg">
              <Activity className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-teal-900 tracking-tight">MenteClara</h1>
          </div>
          
          {user && (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-slate-900">{user.name}</span>
                <span className="text-xs text-slate-500 capitalize">{user.role === 'THERAPIST' ? 'Terapeuta' : 'Paciente'}</span>
              </div>
              <div className="h-8 w-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-700">
                <UserIcon size={18} />
              </div>
              <button
                onClick={onLogout}
                className="p-2 text-slate-500 hover:text-red-600 transition-colors"
                title="Cerrar Sesión"
              >
                <LogOut size={20} />
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
          &copy; {new Date().getFullYear()} MenteClara App. Terapia Cognitivo Conductual.
        </div>
      </footer>
    </div>
  );
};