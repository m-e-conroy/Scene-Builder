
import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'primary';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111] border border-[#333] rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-full ${variant === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-bold text-white uppercase tracking-tight">{title}</h3>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            {message}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 bg-[#222] hover:bg-[#2a2a2a] text-gray-300 rounded-lg text-xs font-black uppercase tracking-widest transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onCancel();
              }}
              className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg ${
                variant === 'danger' 
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
