import { useState, useEffect, useRef, useMemo } from 'react';
import { publicAPI } from '../services/api';

export default function RealmSelect({
  region,
  value,
  onChange,
  inputClassName = '',
  placeholder = 'Ragnaros',
}) {
  const [realms, setRealms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  // Fetch realms when region changes
  useEffect(() => {
    if (!region) return;
    setLoading(true);
    publicAPI
      .realms(region)
      .then((r) => setRealms(r.data.realms || []))
      .catch(() => setRealms([]))
      .finally(() => setLoading(false));
  }, [region]);

  // Sync external value changes
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const filtered = useMemo(() => {
    if (!query.trim()) return realms;
    const q = query.toLowerCase();
    return realms.filter((r) => r.name.toLowerCase().includes(q));
  }, [realms, query]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [filtered]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleKeyDown(e) {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightIndex]) {
          selectRealm(filtered[highlightIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  }

  function selectRealm(realm) {
    setQuery(realm.name);
    setIsOpen(false);
    onChange(realm.name, realm.slug);
  }

  function handleInputChange(e) {
    setQuery(e.target.value);
    setIsOpen(true);
    onChange(e.target.value, e.target.value.toLowerCase().replace(/\s+/g, '-'));
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const item = listRef.current.children[highlightIndex];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex, isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={loading ? 'Loading realms...' : placeholder}
        className={
          inputClassName ||
          'w-full pt-7 pb-3 px-4 bg-transparent text-white font-rajdhani text-base outline-none placeholder:text-void-muted/50'
        }
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
      />

      {isOpen && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-[100] top-full left-0 right-0 max-h-60 overflow-y-auto rounded-b-xl border border-void-bright/25"
          style={{ backgroundColor: '#1a0f2e' }}
          role="listbox"
        >
          {filtered.slice(0, 50).map((realm, i) => (
            <li
              key={realm.id}
              role="option"
              aria-selected={i === highlightIndex}
              className={`px-4 py-2.5 text-sm font-rajdhani cursor-pointer transition-colors border-b border-void-bright/5 last:border-b-0
                ${i === highlightIndex ? 'text-white' : 'text-void-text/80 hover:text-white'}`}
              style={{ backgroundColor: i === highlightIndex ? '#251a3d' : '#1a0f2e' }}
              onMouseEnter={() => setHighlightIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                selectRealm(realm);
              }}
            >
              {realm.name}
            </li>
          ))}
        </ul>
      )}

      {isOpen && filtered.length === 0 && query.trim() && !loading && (
        <div
          className="absolute z-[100] top-full left-0 right-0 px-4 py-3 border border-void-bright/25 rounded-b-xl text-sm text-void-muted font-rajdhani"
          style={{ backgroundColor: '#1a0f2e' }}
        >
          No realms found
        </div>
      )}
    </div>
  );
}
