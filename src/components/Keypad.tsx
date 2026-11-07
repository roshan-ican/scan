import React from 'react';
import { Delete } from 'lucide-react';

interface KeypadProps {
  onDigit: (digit: string) => void;
  onDecimal: () => void;
  onBackspace: () => void;
  onClear?: () => void;
}

export const Keypad: React.FC<KeypadProps> = ({
  onDigit,
  onDecimal,
  onBackspace,
}) => {
  const keys = [
    { label: '1', action: () => onDigit('1') },
    { label: '2', action: () => onDigit('2') },
    { label: '3', action: () => onDigit('3') },
    { label: '4', action: () => onDigit('4') },
    { label: '5', action: () => onDigit('5') },
    { label: '6', action: () => onDigit('6') },
    { label: '7', action: () => onDigit('7') },
    { label: '8', action: () => onDigit('8') },
    { label: '9', action: () => onDigit('9') },
    { label: '.', action: onDecimal, isSpecial: true },
    { label: '0', action: () => onDigit('0') },
    { label: 'backspace', action: onBackspace, isBackspace: true },
  ];

  return (
    <div className="w-full max-w-sm mx-auto grid grid-cols-3 gap-2 p-2 bg-[#f3f5f7] dark:bg-[#111214] rounded-2xl select-none">
      {keys.map((k, index) => {
        if (k.isBackspace) {
          return (
            <button
              key={index}
              type="button"
              onClick={k.action}
              aria-label="Backspace"
              className="h-16 flex items-center justify-center rounded-xl bg-white dark:bg-[#1c1e22] text-[#1b1d1f] dark:text-[#f3f5f7] active:bg-[#e4e7ec] dark:active:bg-[#282a30] transition-colors cursor-pointer"
            >
              <Delete className="w-6 h-6 text-[#5c6064] dark:text-[#9ca1a8]" />
            </button>
          );
        }

        return (
          <button
            key={index}
            type="button"
            onClick={k.action}
            aria-label={`Key ${k.label}`}
            className="h-16 flex items-center justify-center rounded-xl bg-white dark:bg-[#1c1e22] text-[24px] font-semibold text-[#1b1d1f] dark:text-[#f3f5f7] tabular-nums active:bg-[#e4e7ec] dark:active:bg-[#282a30] transition-colors cursor-pointer"
          >
            {k.label}
          </button>
        );
      })}
    </div>
  );
};
