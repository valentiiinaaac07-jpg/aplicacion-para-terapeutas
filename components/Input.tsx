import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  labelClassName?: string;
}

export const Input: React.FC<InputProps> = ({ label, type = 'text', className = '', labelClassName = '', error, ...props }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="mb-5">
      <label className={`block text-base font-semibold mb-2 ${labelClassName || 'text-slate-800'}`}>
        {label}
      </label>
      <div className="relative">
        <input
          type={isPassword && showPassword ? 'text' : type}
          className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors shadow-sm ${
            error ? 'border-red-500 bg-red-50 text-red-900 placeholder:text-red-400' : 'border-slate-300'
          } ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-teal-600 focus:outline-none"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm font-bold text-red-600 flex items-center gap-1">⚠️ {error}</p>}
    </div>
  );
};