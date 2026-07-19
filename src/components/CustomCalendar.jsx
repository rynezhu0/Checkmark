import { useState, useRef, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Shared custom calendar picker component used by both TaskItem and TaskDetailPanel.
 * 
 * Props:
 * - value: string | null — current date in 'yyyy-MM-dd' format
 * - onChange: (dateStr: string | null) => void
 * - onClose: () => void
 * - theme: 'dark' | 'light'
 * - position: 'left' | 'right' — which side the calendar aligns to (default: 'left')
 */
export default function CustomCalendar({ value, onChange, onClose, theme, position = 'left' }) {
  const selected = value ? new Date(value + 'T00:00:00') : null;
  const [viewDate, setViewDate] = useState(selected || new Date());
  const [inputValue, setInputValue] = useState(value ? format(selected, 'MMMM d, yyyy') : '');
  const calRef = useRef(null);

  const stableOnClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (calRef.current && !calRef.current.contains(e.target)) {
        stableOnClose();
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') stableOnClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [stableOnClose]);

  // Sync input value when value prop changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setInputValue(format(d, 'MMMM d, yyyy'));
      setViewDate(d);
    } else {
      setInputValue('');
    }
  }, [value]);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  const days = [];
  let day = calStart;
  while (day <= calEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const handleSelect = (d) => {
    const dateStr = format(d, 'yyyy-MM-dd');
    onChange(dateStr);
    onClose();
  };

  const handleClear = () => {
    onChange(null);
    onClose();
  };

  const handleToday = () => {
    const today = new Date();
    setViewDate(today);
  };

  const isDark = theme === 'dark';

  const positionClasses = position === 'right'
    ? 'right-0'
    : 'left-0';

  return (
    <div
      ref={calRef}
      className={`absolute ${positionClasses} top-full mt-1 w-[280px] rounded-lg shadow-xl border z-30 p-3
        ${isDark ? 'bg-navy-800 border-navy-700' : 'bg-white border-gray-200'}
        animate-calendar-in`}
    >
      {/* Date input */}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const parsed = new Date(inputValue);
            if (!isNaN(parsed.getTime())) {
              handleSelect(parsed);
            }
          }
        }}
        placeholder="Type a date..."
        className={`w-full text-sm px-2.5 py-1.5 rounded-md border outline-none mb-3
          ${isDark
            ? 'bg-navy-900 border-navy-600 text-white placeholder-navy-500 focus:border-navy-500'
            : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gray-400'
          }`}
      />

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {format(viewDate, 'MMMM yyyy')}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleToday}
            className={`text-xs px-2 py-0.5 rounded cursor-pointer transition-colors
              ${isDark
                ? 'text-navy-400 hover:text-white hover:bg-navy-700'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
          >
            Today
          </button>
          <button
            onClick={() => setViewDate(subMonths(viewDate, 1))}
            className={`p-1 rounded cursor-pointer transition-colors
              ${isDark ? 'text-navy-400 hover:text-white hover:bg-navy-700' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setViewDate(addMonths(viewDate, 1))}
            className={`p-1 rounded cursor-pointer transition-colors
              ${isDark ? 'text-navy-400 hover:text-white hover:bg-navy-700' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className={`text-center text-[11px] font-medium py-1
            ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const inMonth = isSameMonth(d, viewDate);
          const isSelected = selected && isSameDay(d, selected);
          const isTodayDate = isToday(d);

          return (
            <button
              key={i}
              onClick={() => handleSelect(d)}
              className={`w-9 h-9 flex items-center justify-center text-sm rounded-full cursor-pointer
                transition-colors relative
                ${!inMonth
                  ? isDark ? 'text-navy-600' : 'text-gray-300'
                  : isSelected
                    ? 'bg-accent-blue text-white font-medium'
                    : isTodayDate
                      ? 'bg-red-500 text-white font-medium'
                      : isDark
                        ? 'text-navy-200 hover:bg-navy-700'
                        : 'text-gray-700 hover:bg-gray-100'
                }`}
            >
              {format(d, 'd')}
            </button>
          );
        })}
      </div>

      {/* Clear button */}
      <div className={`mt-3 pt-2 border-t ${isDark ? 'border-navy-700' : 'border-gray-200'}`}>
        <button
          onClick={handleClear}
          className={`text-sm cursor-pointer transition-colors
            ${isDark ? 'text-navy-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
