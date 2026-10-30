import React, { useState, useEffect } from 'react';
import { X, Key, Info, Check, Trash2, ShieldAlert, Eye, EyeOff } from 'lucide-react';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyChange?: () => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onClose,
  onKeyChange
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const savedKey = localStorage.getItem('custom_gemini_api_key') || '';
      setApiKey(savedKey);
      setIsSaved(!!savedKey);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      localStorage.setItem('custom_gemini_api_key', trimmed);
      setIsSaved(true);
    } else {
      localStorage.removeItem('custom_gemini_api_key');
      setIsSaved(false);
    }
    if (onKeyChange) onKeyChange();
  };

  const handleClear = () => {
    localStorage.removeItem('custom_gemini_api_key');
    setApiKey('');
    setIsSaved(false);
    if (onKeyChange) onKeyChange();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111] border border-[#333] rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#151515]">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-blue-400" />
            <h3 className="text-xs font-black uppercase text-white tracking-widest">Private AI Credentials</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-white hover:bg-white/5 p-1 rounded-md transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 bg-blue-950/20 border border-blue-500/20 rounded-lg p-3 text-[11px] text-blue-200/90 leading-relaxed">
            <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold uppercase tracking-wider text-blue-400 text-[9px] mb-1">How This Works</p>
              <p>
                By adding your own key, renders bypass the shared application rate limits completely. 
                Your key is <strong className="text-white">only persisted locally in your browser's private state</strong> (<code className="text-blue-300">localStorage</code>) and is sent directly in a secure header to run the generation requests. It is never stored permanently on our backend.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">AI Studio API Key</label>
              {isSaved && (
                <span className="text-[9px] text-emerald-400 font-extrabold uppercase flex items-center gap-1">
                  <Check size={10} /> Saved & Active
                </span>
              )}
            </div>
            
            <div className="relative flex items-center">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setIsSaved(false);
                }}
                placeholder="AIzaSy..."
                className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 pr-20 text-xs font-mono text-zinc-150 outline-none focus:border-blue-500 hover:border-white/20 transition-all font-bold"
              />
              <div className="absolute right-1 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1 px-1.5 text-zinc-400 hover:text-white transition-all rounded hover:bg-white/5"
                  title={showKey ? "Hide API Key" : "Show API Key"}
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                {apiKey && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1 px-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all rounded"
                    title="Clear Key"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-yellow-950/20 border border-yellow-500/10 rounded-lg p-2.5 text-[10px] text-yellow-200/80 leading-normal">
            <ShieldAlert size={14} className="text-yellow-500 shrink-0 mt-0.5" />
            <span>
              Get your key for free on the <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-yellow-400 underline font-semibold hover:text-yellow-300">Google AI Studio Dashboard</a>.
            </span>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-[#222] hover:bg-[#2c2c2c] text-[#a1a1aa] rounded-lg text-[10px] font-black uppercase tracking-wider text-center transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                handleSave();
                onClose();
              }}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider text-center transition-all shadow-lg shadow-blue-900/25 cursor-pointer"
            >
              Save Credentials
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsDialog;
