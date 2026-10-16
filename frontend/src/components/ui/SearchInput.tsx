import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value: externalValue,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  className = '',
}) => {
  const [innerValue, setInnerValue] = useState(externalValue);

  // Sync internal state if external value changes (e.g. cleared externally)
  useEffect(() => {
    setInnerValue(externalValue);
  }, [externalValue]);

  // Debounce notification of value changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (innerValue !== externalValue) {
        onChange(innerValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [innerValue, debounceMs, onChange, externalValue]);

  const handleClear = () => {
    setInnerValue('');
    onChange('');
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
        <Search className="h-4 w-4" />
      </div>
      <input
        type="text"
        value={innerValue}
        onChange={(e) => setInnerValue(e.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-gray-300 pl-9 pr-8 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-colors shadow-sm"
      />
      {innerValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
