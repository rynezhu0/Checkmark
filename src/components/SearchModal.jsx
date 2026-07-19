import { useState, useRef, useEffect } from 'react';
import { useTasks, searchAllTasks } from '../context/TaskContext';
import { Search, X, ListChecks, FileText } from 'lucide-react';

// Wrap the first match of `query` inside `text` with a <mark> for a quick visual snippet.
function HighlightedSnippet({ text, query, isDark }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);
  return (
    <>
      {before}
      <mark className={isDark ? 'bg-blue-500/40 text-white rounded-sm' : 'bg-yellow-200 text-gray-900 rounded-sm'}>
        {match}
      </mark>
      {after}
    </>
  );
}

export default function SearchModal({ onClose, theme }) {
  const isDark = theme === 'dark';
  const { fullState, dispatch } = useTasks();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const results = searchAllTasks(fullState.lists, query).slice(0, 50);

  const handleResultClick = (result) => {
    dispatch({ type: 'SET_ACTIVE_LIST', payload: result.listId });
    dispatch({ type: 'SET_VIEW', payload: { type: 'list' } });
    dispatch({ type: 'SELECT_TASK', payload: result.task.id });
    dispatch({ type: 'SET_HIGHLIGHT', payload: { taskId: result.task.id, query: query.trim() } });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-[560px] max-w-[90vw] max-h-[70vh] flex flex-col rounded-xl shadow-2xl border overflow-hidden
          ${isDark ? 'bg-navy-800 border-navy-700' : 'bg-white border-gray-200'}`}
      >
        {/* Input */}
        <div className={`flex items-center gap-2.5 px-4 py-3 border-b flex-shrink-0
          ${isDark ? 'border-navy-700' : 'border-gray-200'}`}>
          <Search size={17} className={isDark ? 'text-navy-400' : 'text-gray-400'} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all tasks and descriptions..."
            className={`flex-1 bg-transparent outline-none text-sm
              ${isDark ? 'text-white placeholder-navy-500' : 'text-gray-900 placeholder-gray-400'}`}
          />
          <button
            onClick={onClose}
            className={`p-1 rounded-lg cursor-pointer transition-colors
              ${isDark ? 'text-navy-500 hover:text-white hover:bg-navy-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
          >
            <X size={15} />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto py-1.5">
          {query.trim() === '' && (
            <div className={`px-4 py-10 text-center text-sm ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>
              Start typing to search across every tasklist
            </div>
          )}
          {query.trim() !== '' && results.length === 0 && (
            <div className={`px-4 py-10 text-center text-sm ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>
              No matching tasks found
            </div>
          )}
          {results.map((result) => (
            <button
              key={result.task.id}
              onClick={() => handleResultClick(result)}
              className={`w-[calc(100%-12px)] mx-1.5 flex flex-col items-start gap-0.5 px-3 py-2.5 mb-0.5
                text-left rounded-lg transition-colors cursor-pointer
                ${isDark ? 'hover:bg-navy-700' : 'hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-1.5 min-w-0 w-full">
                <FileText size={13} className={`flex-shrink-0 ${isDark ? 'text-navy-500' : 'text-gray-400'}`} />
                <span className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {result.matchIn === 'title'
                    ? <HighlightedSnippet text={result.task.title || 'Untitled'} query={query} isDark={isDark} />
                    : (result.task.title || 'Untitled')}
                </span>
              </div>
              {result.matchIn === 'description' && result.task.description && (
                <p className={`text-xs truncate w-full pl-[19px] ${isDark ? 'text-navy-400' : 'text-gray-500'}`}>
                  <HighlightedSnippet text={result.task.description} query={query} isDark={isDark} />
                </p>
              )}
              <div className="flex items-center gap-1 pl-[19px]">
                <ListChecks size={11} className={isDark ? 'text-navy-600' : 'text-gray-400'} />
                <span className={`text-[11px] ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>{result.listTitle}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
