import { useState, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useTasks, stripHtml, stripFontSize } from '../context/TaskContext';
import { useLiveClipboardColorRef } from '../context/liveColorBus';
import {
  ArrowLeft,
  Plus,
  ClipboardList,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Trash2,
  ExternalLink,
} from 'lucide-react';

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

export default function ClipboardDetailPage({ clipboardId }) {
  const { theme } = useTheme();
  const { fullState, dispatch } = useTasks();
  const isDark = theme === 'dark';
  const titleRef = useRef(null);

  const clipboard = useMemo(
    () => (fullState.clipboards || []).find(c => c.id === clipboardId),
    [fullState.clipboards, clipboardId]
  );

  const childLists = useMemo(
    () => (fullState.lists || []).filter(l => l.clipboardId === clipboardId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [fullState.lists, clipboardId]
  );

  // Keep title ref in sync — but not while the user is actively typing in it, or every
  // live keystroke dispatch would immediately reset/collapse their cursor position.
  useEffect(() => {
    if (titleRef.current && clipboard && document.activeElement !== titleRef.current) {
      titleRef.current.textContent = clipboard.name || '';
    }
  }, [clipboard?.name, clipboardId]);

  const [activeMenu, setActiveMenu] = useState(null);
  const [renamingListId, setRenamingListId] = useState(null);
  const [listRenameValue, setListRenameValue] = useState('');
  const originalListTitleRef = useRef('');
  const listRenameInputRef = useRef(null);

  useEffect(() => {
    if (renamingListId && listRenameInputRef.current) {
      listRenameInputRef.current.focus();
      listRenameInputRef.current.select();
    }
  }, [renamingListId]);

  const iconColorRef = useLiveClipboardColorRef(clipboard?.id, clipboard?.color || (isDark ? '#b0bdd4' : '#4b5563'));

  if (!clipboard) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className={`text-sm ${isDark ? 'text-navy-400' : 'text-gray-500'}`}>
          Clipboard not found
        </p>
      </div>
    );
  }

  const handleBack = () => {
    dispatch({ type: 'SET_VIEW', payload: { type: 'clipboards' } });
  };

  const handleRename = (newName) => {
    const trimmed = newName.trim();
    if (trimmed && trimmed !== clipboard.name) {
      dispatch({ type: 'RENAME_CLIPBOARD', payload: { id: clipboardId, name: trimmed } });
    } else if (!trimmed && titleRef.current) {
      titleRef.current.textContent = clipboard.name || '';
    }
  };

  const handleNewTasklist = () => {
    dispatch({ type: 'CREATE_LIST', payload: { title: 'New List', clipboardId } });
    // Stay on clipboard detail view
    dispatch({ type: 'SET_VIEW', payload: { type: 'clipboard', id: clipboardId } });
  };

  const handleOpenList = (listId) => {
    dispatch({ type: 'SET_ACTIVE_LIST', payload: listId });
  };

  const handleRemoveList = (listId) => {
    dispatch({ type: 'REMOVE_FROM_CLIPBOARD', payload: listId });
    setActiveMenu(null);
  };

  const startRenameList = (list) => {
    const plain = stripHtml(list.title);
    originalListTitleRef.current = plain;
    setListRenameValue(plain);
    setRenamingListId(list.id);
  };

  const handleListRenameChange = (e) => {
    const val = e.target.value;
    setListRenameValue(val);
    if (val.trim()) {
      dispatch({ type: 'RENAME_LIST', payload: { id: renamingListId, title: val.trim() } });
    }
  };

  const handleListRenameBlur = () => {
    if (!listRenameValue.trim()) {
      dispatch({ type: 'RENAME_LIST', payload: { id: renamingListId, title: originalListTitleRef.current } });
    }
    setRenamingListId(null);
  };

  const handleListRenameKeyDown = (e) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') {
      dispatch({ type: 'RENAME_LIST', payload: { id: renamingListId, title: originalListTitleRef.current } });
      setRenamingListId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Header */}
      <div className="px-8 pt-6 pb-2 flex-shrink-0">
        {/* Back button */}
        <button
          onClick={handleBack}
          className={`flex items-center gap-1.5 text-sm mb-4 px-2 py-1 rounded-lg
            transition-colors cursor-pointer
            ${isDark
              ? 'text-navy-400 hover:text-white hover:bg-navy-800'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
        >
          <ArrowLeft size={16} />
          Back to Clipboards
        </button>

        {/* Title area */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
              ${isDark ? 'bg-navy-800' : 'bg-gray-100'}`}
          >
            <ClipboardList
              ref={iconColorRef}
              size={20}
              className="clipboard-color-swatch"
            />
          </div>
          <div
            ref={titleRef}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => {
              const val = e.currentTarget.textContent || '';
              if (val.trim()) {
                dispatch({ type: 'RENAME_CLIPBOARD', payload: { id: clipboardId, name: val.trim() } });
              }
            }}
            onBlur={(e) => handleRename(e.currentTarget.textContent || '')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
            }}
            className={`text-2xl font-bold outline-none cursor-text break-words flex-1
              ${isDark ? 'text-white' : 'text-gray-900'}
              empty:before:content-['Untitled'] empty:before:opacity-40`}
          />
        </div>

        {/* New tasklist button */}
        <button
          onClick={handleNewTasklist}
          className="flex items-center gap-2 bg-accent-blue hover:bg-blue-600
            text-white px-4 py-2 rounded-lg text-sm font-medium
            transition-colors duration-200 cursor-pointer shadow-sm shadow-blue-500/10 mb-4"
        >
          <Plus size={15} />
          New Tasklist
        </button>

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

      {/* Tasklist list */}
      <div className="flex-1 overflow-y-auto px-8">
        {childLists.map((list) => (
          <div
            key={list.id}
            onClick={() => { if (renamingListId !== list.id) handleOpenList(list.id); }}
            onContextMenu={(e) => {
              e.preventDefault();
              setActiveMenu({
                listId: list.id,
                top: `${e.clientY}px`,
                left: `${e.clientX}px`,
              });
            }}
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
                <ListChecks
                  size={16}
                  className={isDark ? 'text-navy-400' : 'text-gray-500'}
                />
              </div>
              {renamingListId === list.id ? (
                <input
                  ref={listRenameInputRef}
                  value={listRenameValue}
                  onChange={handleListRenameChange}
                  onBlur={handleListRenameBlur}
                  onKeyDown={handleListRenameKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  className={`flex-1 min-w-0 text-sm font-medium bg-transparent outline-none border-b
                    ${isDark ? 'text-white border-navy-600' : 'text-gray-900 border-gray-300'}`}
                />
              ) : (
                <span
                  className={`text-sm font-medium truncate
                    ${isDark ? 'text-white' : 'text-gray-900'}`}
                >
                  <span dangerouslySetInnerHTML={{ __html: stripFontSize(list.title || 'Untitled') }} />
                </span>
              )}
            </div>

            {/* Modified date */}
            <span
              className={`w-32 text-right text-sm
                ${isDark ? 'text-navy-400' : 'text-gray-500'}`}
            >
              {formatRelativeDate(list.updatedAt)}
            </span>

            {/* Action button */}
            <div className="w-10 flex justify-end relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setActiveMenu(
                    activeMenu?.listId === list.id
                      ? null
                      : { listId: list.id, top: `${rect.bottom + 4}px`, left: `${rect.left - 120}px` }
                  );
                }}
                className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer
                  ${isDark
                    ? 'text-navy-500 hover:text-white hover:bg-navy-700'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <MoreHorizontal size={16} />
              </button>

              {/* Dropdown menu */}
              {activeMenu?.listId === list.id && (
                <ListActionMenu
                  position={{ top: activeMenu.top, left: activeMenu.left }}
                  onClose={() => setActiveMenu(null)}
                  onOpen={() => handleOpenList(list.id)}
                  onRename={() => startRenameList(list)}
                  onRemove={() => handleRemoveList(list.id)}
                  theme={theme}
                />
              )}
            </div>
          </div>
        ))}

        {/* Empty state */}
        {childLists.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4
                ${isDark ? 'bg-navy-800' : 'bg-gray-100'}`}
            >
              <ListChecks
                size={28}
                className={isDark ? 'text-navy-500' : 'text-gray-400'}
              />
            </div>
            <p
              className={`text-sm font-medium mb-1
                ${isDark ? 'text-navy-400' : 'text-gray-500'}`}
            >
              No tasklists in this clipboard
            </p>
            <p
              className={`text-xs
                ${isDark ? 'text-navy-600' : 'text-gray-400'}`}
            >
              Create a new one or move existing tasklists here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── List Action Menu ───────────────────────────────
function ListActionMenu({ position, onClose, onOpen, onRename, onRemove, theme }) {
  const isDark = theme === 'dark';
  const menuRef = useRef(null);

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

  return (
    <div
      ref={menuRef}
      className={`fixed z-50 w-44 rounded-lg shadow-xl border py-1.5
        ${isDark ? 'bg-navy-800 border-navy-700' : 'bg-white border-gray-200'}`}
      style={{ top: position.top, left: position.left }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onOpen(); onClose(); }}
        className={itemClass(isDark ? 'text-navy-200 hover:bg-navy-700' : 'text-gray-700 hover:bg-gray-50')}
      >
        <ExternalLink size={15} />
        <span>Open</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onRename(); onClose(); }}
        className={itemClass(isDark ? 'text-navy-200 hover:bg-navy-700' : 'text-gray-700 hover:bg-gray-50')}
      >
        <Pencil size={15} />
        <span>Rename</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className={itemClass('text-red-400 hover:bg-red-500/10')}
      >
        <Trash2 size={15} />
        <span>Remove</span>
      </button>
    </div>
  );
}
