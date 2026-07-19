import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useTasks } from '../context/TaskContext';
import { publishLiveColor, useLiveClipboardColorRef } from '../context/liveColorBus';
import ColorPicker from './ColorPicker';
import {
  Search,
  Plus,
  ClipboardList,
  MoreHorizontal,
  Pin,
  Pencil,
  Trash2,
  X,
  Palette,
  ChevronLeft,
} from 'lucide-react';

// ─── Three-dot action menu ──────────────────────────
function ClipboardActionMenu({ clipboard, position, onClose, onRename, dispatch, theme }) {
  const isDark = theme === 'dark';
  const menuRef = useRef(null);
  const [mode, setMode] = useState('menu'); // 'menu' | 'color'

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const itemClass = (extra) => `w-[calc(100%-12px)] mx-1.5 flex items-center gap-2.5 px-3 py-2
    text-sm rounded-lg transition-colors cursor-pointer ${extra}`;

  // Pushes straight to the DOM for every icon showing this clipboard's color, at raw
  // drag speed. Deliberately doesn't touch React state — that's left to the throttled
  // commit below — so this can't trigger a re-render storm during the drag.
  const handleLiveColorChange = (hex) => {
    publishLiveColor(clipboard.id, hex);
  };

  // Throttled by ColorPicker to once per animation frame — persists the color to the store.
  const handleColorCommit = (hex) => {
    dispatch({ type: 'SET_CLIPBOARD_COLOR', payload: { id: clipboard.id, color: hex } });
  };

  const paletteIconRef = useLiveClipboardColorRef(clipboard.id, clipboard.color || '#3b82f6');

  if (mode === 'color') {
    return (
      <div
        ref={menuRef}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={`absolute z-50 w-60 rounded-lg shadow-xl border p-3
          ${isDark ? 'bg-navy-800 border-navy-700' : 'bg-white border-gray-200'}`}
        style={{ top: position.top, left: position.left }}
      >
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={(e) => { e.stopPropagation(); setMode('menu'); }}
            className={`p-1 rounded-md cursor-pointer transition-colors
              ${isDark ? 'text-navy-400 hover:text-white hover:bg-navy-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
          >
            <ChevronLeft size={14} />
          </button>
          <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Customize color
          </span>
        </div>
        <ColorPicker value={clipboard.color || '#3b82f6'} onChange={handleColorCommit} onLiveChange={handleLiveColorChange} theme={theme} />
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className={`absolute z-50 w-44 rounded-lg shadow-xl border py-1.5
        ${isDark ? 'bg-navy-800 border-navy-700' : 'bg-white border-gray-200'}`}
      style={{ top: position.top, left: position.left }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onRename(); onClose(); }}
        className={itemClass(isDark ? 'text-navy-200 hover:bg-navy-700' : 'text-gray-700 hover:bg-gray-50')}
      >
        <Pencil size={15} />
        <span>Rename</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setMode('color'); }}
        className={itemClass(isDark ? 'text-navy-200 hover:bg-navy-700' : 'text-gray-700 hover:bg-gray-50')}
      >
        <Palette ref={paletteIconRef} size={15} className="clipboard-color-swatch" />
        <span>Customize</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          dispatch({
            type: clipboard.pinned ? 'UNPIN_CLIPBOARD' : 'PIN_CLIPBOARD',
            payload: clipboard.id,
          });
          onClose();
        }}
        className={itemClass(isDark ? 'text-navy-200 hover:bg-navy-700' : 'text-gray-700 hover:bg-gray-50')}
      >
        <Pin size={15} className={clipboard.pinned ? 'fill-current text-blue-400' : ''} />
        <span>{clipboard.pinned ? 'Unpin' : 'Pin'}</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          dispatch({ type: 'DELETE_CLIPBOARD', payload: clipboard.id });
          onClose();
        }}
        className={itemClass('text-red-400 hover:bg-red-500/10')}
      >
        <Trash2 size={15} />
        <span>Delete</span>
      </button>
    </div>
  );
}

// ─── Relative time helper ───────────────────────────
function formatRelativeDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Clipboard row ───────────────────────────────────
// Memoized so that dragging the color picker for ONE clipboard — which dispatches a
// store update on every animation frame — doesn't force every other row on this page
// to re-render too. Only the row whose own `cb` object actually changed re-renders.
function ClipboardRowImpl({
  cb, isRenaming, renameValue, onRenameChange, onRenameBlur, onRenameKeyDown, renameInputRef,
  onOpen, onRowContextMenu, onOpenMenu, menuOpen, menuPosition, onCloseMenu, onStartRename,
  dispatch, theme, isDark,
}) {
  const iconColorRef = useLiveClipboardColorRef(cb.id, cb.color || (isDark ? '#8899b8' : '#6b7280'));

  return (
    <div
      onClick={() => { if (!isRenaming) onOpen(cb.id); }}
      onContextMenu={(e) => { e.preventDefault(); onRowContextMenu(cb.id, e); }}
      className={`group flex items-center px-4 py-3.5 rounded-lg cursor-pointer
        transition-colors duration-150
        ${isDark ? 'hover:bg-navy-800/60' : 'hover:bg-gray-50'}`}
    >
      {/* Icon + Name */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
            ${isDark ? 'bg-navy-800' : 'bg-gray-100'}`}
        >
          <ClipboardList
            ref={iconColorRef}
            size={16}
            className="clipboard-color-swatch"
          />
        </div>
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={onRenameChange}
            onBlur={onRenameBlur}
            onKeyDown={onRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            className={`flex-1 min-w-0 text-sm font-medium bg-transparent outline-none border-b
              ${isDark ? 'text-white border-navy-600' : 'text-gray-900 border-gray-300'}`}
          />
        ) : (
          <span
            className={`text-sm font-medium truncate
              ${isDark ? 'text-white' : 'text-gray-900'}`}
          >
            {cb.name}
          </span>
        )}
      </div>

      {/* Modified date */}
      <span
        className={`w-32 text-right text-sm
          ${isDark ? 'text-navy-400' : 'text-gray-500'}`}
      >
        {formatRelativeDate(cb.updatedAt || cb.createdAt)}
      </span>

      {/* Three-dot action */}
      <div className="w-10 flex justify-end">
        <button
          onClick={(e) => { e.stopPropagation(); onOpenMenu(cb.id, e); }}
          className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer
            ${isDark
              ? 'text-navy-500 hover:text-white hover:bg-navy-700'
              : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'
            }`}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Action menu */}
      {menuOpen && (
        <ClipboardActionMenu
          clipboard={cb}
          position={menuPosition}
          onClose={onCloseMenu}
          onRename={() => onStartRename(cb)}
          dispatch={dispatch}
          theme={theme}
        />
      )}
    </div>
  );
}

function clipboardRowPropsEqual(prev, next) {
  return (
    prev.cb === next.cb &&
    prev.isRenaming === next.isRenaming &&
    prev.renameValue === next.renameValue &&
    prev.onRenameChange === next.onRenameChange &&
    prev.onRenameBlur === next.onRenameBlur &&
    prev.onRenameKeyDown === next.onRenameKeyDown &&
    prev.renameInputRef === next.renameInputRef &&
    prev.onOpen === next.onOpen &&
    prev.onRowContextMenu === next.onRowContextMenu &&
    prev.onOpenMenu === next.onOpenMenu &&
    prev.menuOpen === next.menuOpen &&
    prev.menuPosition?.top === next.menuPosition?.top &&
    prev.menuPosition?.left === next.menuPosition?.left &&
    prev.onCloseMenu === next.onCloseMenu &&
    prev.onStartRename === next.onStartRename &&
    prev.dispatch === next.dispatch &&
    prev.theme === next.theme &&
    prev.isDark === next.isDark
  );
}

const ClipboardRow = memo(ClipboardRowImpl, clipboardRowPropsEqual);

// ─── Main Clipboards Page ───────────────────────────
export default function ClipboardsPage() {
  const { theme } = useTheme();
  const { fullState, dispatch } = useTasks();
  const isDark = theme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenu, setActiveMenu] = useState(null); // { clipboardId, top, left }
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const originalNameRef = useRef('');
  const renameInputRef = useRef(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Stable identities so they don't defeat ClipboardRow's memoization.
  const startRename = useCallback((cb) => {
    originalNameRef.current = cb.name;
    setRenameValue(cb.name);
    setRenamingId(cb.id);
  }, []);

  const handleRenameChange = useCallback((e) => {
    const val = e.target.value;
    setRenameValue(val);
    if (val.trim()) {
      dispatch({ type: 'RENAME_CLIPBOARD', payload: { id: renamingId, name: val.trim() } });
    }
  }, [dispatch, renamingId]);

  const handleRenameBlur = useCallback(() => {
    if (!renameValue.trim()) {
      dispatch({ type: 'RENAME_CLIPBOARD', payload: { id: renamingId, name: originalNameRef.current } });
    }
    setRenamingId(null);
  }, [dispatch, renamingId, renameValue]);

  const handleRenameKeyDown = useCallback((e) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') {
      dispatch({ type: 'RENAME_CLIPBOARD', payload: { id: renamingId, name: originalNameRef.current } });
      setRenamingId(null);
    }
  }, [dispatch, renamingId]);

  const clipboards = fullState.clipboards || [];
  const filteredClipboards = searchQuery
    ? clipboards.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : clipboards;

  // Sort by most recently updated
  const sorted = [...filteredClipboards].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
  );

  const handleNew = () => {
    dispatch({ type: 'CREATE_CLIPBOARD', payload: { name: 'New Clipboard' } });
  };

  const handleOpenClipboard = useCallback((cbId) => {
    dispatch({ type: 'SET_VIEW', payload: { type: 'clipboard', id: cbId } });
  }, [dispatch]);

  const handleRowContextMenu = useCallback((cbId, e) => {
    setActiveMenu({ clipboardId: cbId, top: `${e.clientY}px`, left: `${e.clientX}px` });
  }, []);

  const handleOpenMenuButton = useCallback((cbId, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveMenu({ clipboardId: cbId, top: `${rect.bottom + 4}px`, left: `${rect.left - 120}px` });
  }, []);

  const handleCloseMenu = useCallback(() => setActiveMenu(null), []);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Header */}
      <div className="px-8 pt-8 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between mb-6">
          <h1
            className={`text-3xl font-bold
              ${isDark ? 'text-white' : 'text-gray-900'}`}
          >
            Clipboards
          </h1>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search
                size={15}
                className={`absolute left-3 top-1/2 -translate-y-1/2
                  ${isDark ? 'text-navy-500' : 'text-gray-400'}`}
              />
              <input
                type="text"
                placeholder="Search clipboards"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-9 pr-8 py-2 w-56 rounded-lg text-sm outline-none transition-colors
                  ${isDark
                    ? 'bg-navy-800 text-white placeholder-navy-500 border border-navy-700 focus:border-navy-600'
                    : 'bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200 focus:border-gray-300'
                  }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer
                    ${isDark ? 'text-navy-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {/* New button */}
            <button
              onClick={handleNew}
              className="flex items-center gap-1.5 bg-accent-blue hover:bg-blue-600
                text-white px-4 py-2 rounded-lg text-sm font-medium
                transition-colors duration-200 cursor-pointer shadow-sm shadow-blue-500/10"
            >
              <Plus size={15} />
              New
            </button>
          </div>
        </div>

        {/* Table header */}
        <div
          className={`flex items-center px-4 py-2.5 text-xs font-medium uppercase tracking-wider
            border-b
            ${isDark ? 'text-navy-500 border-navy-800' : 'text-gray-400 border-gray-200'}`}
        >
          <span className="flex-1">Name</span>
          <span className="w-32 text-right">Modified</span>
          <span className="w-10" />
        </div>
      </div>

      {/* Clipboard list */}
      <div className="flex-1 overflow-y-auto px-8">
        {sorted.map((cb) => (
          <ClipboardRow
            key={cb.id}
            cb={cb}
            isRenaming={renamingId === cb.id}
            renameValue={renamingId === cb.id ? renameValue : ''}
            onRenameChange={handleRenameChange}
            onRenameBlur={handleRenameBlur}
            onRenameKeyDown={handleRenameKeyDown}
            renameInputRef={renameInputRef}
            onOpen={handleOpenClipboard}
            onRowContextMenu={handleRowContextMenu}
            onOpenMenu={handleOpenMenuButton}
            menuOpen={activeMenu?.clipboardId === cb.id}
            menuPosition={activeMenu?.clipboardId === cb.id ? { top: activeMenu.top, left: activeMenu.left } : null}
            onCloseMenu={handleCloseMenu}
            onStartRename={startRename}
            dispatch={dispatch}
            theme={theme}
            isDark={isDark}
          />
        ))}

        {/* Empty state */}
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4
                ${isDark ? 'bg-navy-800' : 'bg-gray-100'}`}
            >
              <ClipboardList
                size={28}
                className={isDark ? 'text-navy-500' : 'text-gray-400'}
              />
            </div>
            <p
              className={`text-sm font-medium mb-1
                ${isDark ? 'text-navy-400' : 'text-gray-500'}`}
            >
              {searchQuery ? 'No clipboards match your search' : 'No clipboards yet'}
            </p>
            {!searchQuery && (
              <p
                className={`text-xs
                  ${isDark ? 'text-navy-600' : 'text-gray-400'}`}
              >
                Create one to organize your tasklists
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
