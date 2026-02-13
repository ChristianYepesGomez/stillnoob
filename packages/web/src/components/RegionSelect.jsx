import { useState, useRef, useEffect } from 'react';

const REGIONS = [
  { value: 'EU', label: 'EU', desc: 'Europe' },
  { value: 'US', label: 'US', desc: 'Americas' },
  { value: 'KR', label: 'KR', desc: 'Korea' },
  { value: 'TW', label: 'TW', desc: 'Taiwan' },
];

export default function RegionSelect({ value, onChange, inputClassName = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(region) {
    onChange(region.value);
    setIsOpen(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(o => !o);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIdx = REGIONS.findIndex(r => r.value === value);
      const next = e.key === 'ArrowDown'
        ? (currentIdx + 1) % REGIONS.length
        : (currentIdx - 1 + REGIONS.length) % REGIONS.length;
      onChange(REGIONS[next].value);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        onKeyDown={handleKeyDown}
        className={inputClassName || 'w-full pt-7 pb-3 px-4 bg-transparent text-white font-rajdhani text-base outline-none text-left cursor-pointer'}
        role="combobox"
        aria-expanded={isOpen}
      >
        {value}
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-void-muted text-xs pointer-events-none">
          <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`} />
        </span>
      </button>

      {isOpen && (
        <ul
          className="absolute z-50 top-full left-0 right-0 bg-void-mid border border-void-glow/30 rounded-b-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden"
          role="listbox"
        >
          {REGIONS.map((region) => (
            <li
              key={region.value}
              role="option"
              aria-selected={region.value === value}
              className={`px-4 py-2.5 text-sm font-rajdhani cursor-pointer transition-colors flex items-center justify-between
                ${region.value === value
                  ? 'bg-void-glow/20 text-white'
                  : 'text-void-secondary hover:bg-void-surface hover:text-white'
                }`}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(region); }}
            >
              <span className="font-semibold">{region.label}</span>
              <span className="text-xs text-void-muted">{region.desc}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
