"use client";

import { Minus, X } from "lucide-react";

type WidgetHeaderProps = {
  onClose: () => void;
  onMinimize: () => void;
};

export function WidgetHeader({ onClose, onMinimize }: WidgetHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between bg-[#075e54] px-4 text-white">
      <div>
        <h2 className="text-base font-black">WhatsApp Inbox</h2>
        <p className="text-xs text-emerald-100">Atencion rapida de conversaciones</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          aria-label="Minimizar widget"
          className="flex size-8 items-center justify-center rounded-full hover:bg-white/10"
          onClick={onMinimize}
          type="button"
        >
          <Minus aria-hidden="true" size={18} />
        </button>
        <button
          aria-label="Cerrar widget"
          className="flex size-8 items-center justify-center rounded-full hover:bg-white/10"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>
    </header>
  );
}
