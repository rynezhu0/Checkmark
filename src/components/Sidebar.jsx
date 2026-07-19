import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useTasks, stripHtml, stripFontSize, generateId } from '../context/TaskContext';
import { useLiveClipboardColorRef } from '../context/liveColorBus';
import { CheckmarkLogo, SunIcon, MoonIcon } from './Icons';
import {
  Plus,
  Search,
  Clipboard,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Pin,
  MoreHorizontal,
  Pencil,
  FolderInput,
  FolderMinus,
  Trash2,
  X,
  FolderPlus,
  FolderOpen,
  Settings,
  Check,
  FileText,
  AlignLeft,
  ListChecks,
} from 'lucide-react';

// ─── Delete Confirmation Dialog ─────────────────────
function DeleteDialog({ listName, onConfirm, onCancel, theme }) {
  const isDark = theme === 'dark';

  useEffect(() => {
    function handleKey(e) {
      // Ignore keys typed into another field (e.g. a modal opened on top of this one).
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onConfirm, onCancel]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      {/* Dialog */}
      <div className={`relative w-[400px] rounded-xl p-6 shadow-2xl border
        ${isDark ? 'bg-navy-800 border-navy-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-base font-semibold mb-2
          ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Delete list?
        </h3>
        <p className={`text-sm mb-5
          ${isDark ? 'text-navy-300' : 'text-gray-600'}`}>
          This will delete <strong className={isDark ? 'text-white' : 'text-gray-900'}>{listName}</strong> and all of its data.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className={`px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors
              ${isDark
                ? 'text-navy-200 hover:bg-navy-700'
                : 'text-gray-700 hover:bg-gray-100'
              }`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="min-w-[80px] px-4 py-2 text-sm font-medium rounded-lg cursor-pointer
              bg-red-600 hover:bg-red-700 text-white transition-colors text-center"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Color Palette for Clipboards ────────────────────
const CLIPBOARD_COLORS = [
  { name: 'White', hex: '#ffffff' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Pink', hex: '#f472b6' },
];

// ─── Create Clipboard Dialog ─────────────────────────
const CLIPBOARD_NAME_IDEAS = [
  'Dream Trip', 'Back To School', 'Home Renovation', 'Wedding Planning',
  'Fitness Goals', 'Meal Prep', 'Side Project', 'Book List', 'Gift Ideas',
  'Move Checklist', 'Game Night', 'Garden Plans', 'Road Trip', 'Budget Tracker',
];

function CreateClipboardDialog({ onConfirm, onCancel, theme }) {
  const isDark = theme === 'dark';
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [placeholder] = useState(() => CLIPBOARD_NAME_IDEAS[Math.floor(Math.random() * CLIPBOARD_NAME_IDEAS.length)]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const handleCreate = () => {
    onConfirm({ name: name.trim() || placeholder, color });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      {/* Dialog */}
      <div className={`relative w-[440px] rounded-xl p-6 shadow-2xl border
        ${isDark ? 'bg-navy-800 border-navy-700' : 'bg-white border-gray-200'}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className={`text-base font-semibold
            ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Create clipboard
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer
                ${isDark ? 'text-navy-400 hover:text-white hover:bg-navy-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
              title="Customize color"
            >
              <Settings size={17} />
            </button>
            <button
              onClick={onCancel}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer
                ${isDark ? 'text-navy-400 hover:text-white hover:bg-navy-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Name label */}
        <label className={`text-xs font-medium mb-1.5 block
          ${isDark ? 'text-navy-300' : 'text-gray-600'}`}>
          Clipboard name
        </label>

        {/* Name input with icon */}
        <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border mb-3
          ${isDark ? 'bg-navy-900 border-navy-600' : 'bg-gray-50 border-gray-200'}`}>
          <ClipboardList size={16} style={{ color }} className="flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            placeholder={placeholder}
            className={`flex-1 bg-transparent outline-none text-sm
              ${isDark ? 'text-white placeholder-navy-500' : 'text-gray-900 placeholder-gray-400'}`}
          />
        </div>

        {/* Color picker panel */}
        {showColorPicker && (
          <div className={`rounded-lg border p-3 mb-3
            ${isDark ? 'bg-navy-900 border-navy-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex flex-wrap gap-2.5">
              {CLIPBOARD_COLORS.map(c => (
                <button
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  className="relative w-8 h-8 rounded-full cursor-pointer transition-transform hover:scale-110
                    flex items-center justify-center"
                  style={{
                    backgroundColor: c.hex,
                    border: c.hex === '#ffffff'
                      ? `2px solid ${isDark ? '#475569' : '#d1d5db'}`
                      : '2px solid transparent',
                    boxShadow: color === c.hex ? `0 0 0 2px ${isDark ? '#1e293b' : '#fff'}, 0 0 0 4px ${c.hex}` : 'none',
                  }}
                  title={c.name}
                >
                  {color === c.hex && (
                    <Check size={14} className={c.hex === '#ffffff' || c.hex === '#eab308' ? 'text-gray-800' : 'text-white'} />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info text */}
        <div className={`flex items-start gap-2.5 p-3 rounded-lg mb-4
          ${isDark ? 'bg-navy-900/60' : 'bg-gray-50'}`}>
          <ClipboardList size={15} className={`flex-shrink-0 mt-0.5 ${isDark ? 'text-navy-400' : 'text-gray-400'}`} />
          <p className={`text-xs leading-relaxed
            ${isDark ? 'text-navy-300' : 'text-gray-500'}`}>
            Clipboards organize your tasklists in one place. Use them for ongoing work or to keep things tidy.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end">
          <button
            onClick={handleCreate}
            className={`px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors
              ${isDark
                ? 'bg-navy-700 text-white hover:bg-navy-600 border border-navy-600'
                : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
          >
            Create clipboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Clipboard Submenu ──────────────────────────────
function ClipboardSubmenuIcon({ clipboard }) {
  const colorRef = useLiveClipboardColorRef(clipboard.id, clipboard.color || '#3b82f6');
  return (
    <ClipboardList ref={colorRef} size={14} className="clipboard-color-swatch" />
  );
}

function ClipboardSubmenu({ clipboards, onSelect, onCreateNew, theme, menuRef }) {
  const isDark = theme === 'dark';

  return (
    <div
      ref={menuRef}
      className={`absolute left-full top-0 ml-1 w-48 rounded-lg shadow-xl border z-[60] py-1
        ${isDark ? 'bg-navy-800 border-navy-700' : 'bg-white border-gray-200'}`}
    >
      <button
        onClick={onCreateNew}
        className={`w-[calc(100%-12px)] mx-1.5 flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer
          ${isDark ? 'text-navy-200 hover:bg-navy-700' : 'text-gray-700 hover:bg-gray-50'}`}
      >
        <FolderPlus size={14} />
        New Clipboard
      </button>
      {clipboards.length > 0 && (
        <div className={`my-1 border-t ${isDark ? 'border-navy-700' : 'border-gray-200'}`} />
      )}
      {clipboards.map(cb => (
        <button
          key={cb.id}
          onClick={() => onSelect(cb.id)}
          className={`w-[calc(100%-12px)] mx-1.5 flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer
            ${isDark ? 'text-navy-200 hover:bg-navy-700' : 'text-gray-700 hover:bg-gray-50'}`}
        >
          <ClipboardSubmenuIcon clipboard={cb} />
          <span className="truncate">{cb.name}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Context Menu ───────────────────────────────────
function ContextMenu({ list, position, onClose, theme, dispatch, onOpenCreateDialog }) {
  const isDark = theme === 'dark';
  // Read straight from context rather than as a prop, so this array isn't threaded
  // through the memoized SidebarListItem/SidebarClipboardItem for a submenu that's
  // rarely even opened.
  const { fullState } = useTasks();
  const menuRef = useRef(null);
  const [showClipboardMenu, setShowClipboardMenu] = useState(false);
  const clipboardMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
          (!clipboardMenuRef.current || !clipboardMenuRef.current.contains(e.target))) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleRename = () => {
    onClose('rename');
  };

  const handlePin = () => {
    dispatch({ type: list.pinned ? 'UNPIN_LIST' : 'PIN_LIST', payload: list.id });
    onClose();
  };

  const handleDelete = () => {
    onClose('delete');
  };

  const handleMoveToClipboard = (clipboardId) => {
    dispatch({ type: 'MOVE_TO_CLIPBOARD', payload: { listId: list.id, clipboardId } });
    onClose();
  };

  const handleCreateClipboard = () => {
    setShowClipboardMenu(false);
    onClose();
    onOpenCreateDialog?.(list.id);
  };

  const handleRemoveFromClipboard = () => {
    dispatch({ type: 'REMOVE_FROM_CLIPBOARD', payload: list.id });
    onClose();
  };

  const menuItems = [
    { id: 'rename', label: 'Rename', icon: Pencil, onClick: handleRename },
    { id: 'clipboard', label: 'Move To Clipboard', icon: FolderInput, hasSubmenu: true },
    ...(list.clipboardId
      ? [{ id: 'removeFromClipboard', label: 'Remove from Clipboard', icon: FolderMinus, onClick: handleRemoveFromClipboard }]
      : []),
    { id: 'pin', label: list.pinned ? 'Unpin List' : 'Pin List', icon: Pin, onClick: handlePin },
    { id: 'delete', label: 'Delete', icon: Trash2, danger: true, onClick: handleDelete },
  ];

  return (
    <div
      ref={menuRef}
      className={`absolute z-50 w-52 rounded-lg shadow-xl border py-1
        ${isDark ? 'bg-navy-800 border-navy-700' : 'bg-white border-gray-200'}`}
      style={{ top: position.top, left: position.left }}
    >
      {menuItems.map(item => (
        <div key={item.id} className="relative">
          <button
            onClick={item.hasSubmenu ? () => setShowClipboardMenu(!showClipboardMenu) : item.onClick}
            className={`w-[calc(100%-12px)] mx-1.5 flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer
              ${item.danger
                ? 'text-red-400 hover:bg-red-500/10'
                : isDark
                  ? 'text-navy-200 hover:bg-navy-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
          >
            <item.icon size={15} />
            <span className="flex-1 text-left">{item.label}</span>
            {item.hasSubmenu && <ChevronRight size={14} className={isDark ? 'text-navy-500' : 'text-gray-400'} />}
          </button>
          {item.hasSubmenu && showClipboardMenu && (
            <ClipboardSubmenu
              clipboards={fullState.clipboards || []}
              onSelect={handleMoveToClipboard}
              onCreateNew={handleCreateClipboard}
              theme={theme}
              menuRef={clipboardMenuRef}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Collapsible Section ────────────────────────────
function SectionHeader({ label, collapsed, onToggle, theme, show }) {
  if (!show) return null;
  const isDark = theme === 'dark';

  return (
    <button
      onClick={onToggle}
      className={`group w-full flex items-center gap-1 px-3 pt-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider
        cursor-pointer select-none transition-colors
        ${isDark ? 'text-navy-500 hover:text-navy-300' : 'text-gray-400 hover:text-gray-600'}`}
    >
      <ChevronDown
        size={12}
        className={`transition-transform duration-200 opacity-0 group-hover:opacity-100
          ${collapsed ? '-rotate-90' : 'rotate-0'}`}
      />
      {label}
    </button>
  );
}

// The clipboard badge also needs its translucent background kept in sync, not just
// its text/icon color, so it gets its own apply function instead of the default.
function applyBadgeColorStyle(el, hex) {
  el.style.color = hex;
  el.style.backgroundColor = `${hex}26`;
}

// ─── Sidebar List Item ──────────────────────────────
function SidebarListItemImpl({ list, isActive, onSelect, onContextMenu, theme, dispatch, clipboardBadge, onOpenCreateDialog, indent = false, showListIcon = false }) {
  const isDark = theme === 'dark';
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(() => stripHtml(list.title));
  const [originalTitle, setOriginalTitle] = useState(() => stripHtml(list.title));
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const itemRef = useRef(null);
  const inputRef = useRef(null);
  const badgeRef = useLiveClipboardColorRef(clipboardBadge?.id, clipboardBadge?.color, applyBadgeColorStyle);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameChange = (e) => {
    const val = e.target.value;
    setRenameValue(val);
    if (val.trim()) {
      dispatch({ type: 'RENAME_LIST', payload: { id: list.id, title: val.trim() } });
    }
  };

  const handleRenameBlur = () => {
    setIsRenaming(false);
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameValue(originalTitle);
      dispatch({ type: 'RENAME_LIST', payload: { id: list.id, title: originalTitle } });
    }
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape') {
      setRenameValue(originalTitle);
      dispatch({ type: 'RENAME_LIST', payload: { id: list.id, title: originalTitle } });
      setIsRenaming(false);
    }
  };

  const openMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = itemRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPosition({
        top: `${rect.bottom + 2}px`,
        left: `${rect.left}px`,
      });
    }
    setShowMenu(true);
  };

  const handleMenuClose = (action) => {
    setShowMenu(false);
    if (action === 'rename') {
      setIsRenaming(true);
      setRenameValue(stripHtml(list.title));
      setOriginalTitle(stripHtml(list.title));
    } else if (action === 'delete') {
      onContextMenu?.('delete', list);
    }
  };

  // Keyboard shortcuts
  const handleKeyDown = (e) => {
    if (isRenaming) return;
    if (e.key === 'Enter') { onSelect(list.id); }
    if (e.key === 'F2') { e.preventDefault(); setIsRenaming(true); setRenameValue(stripHtml(list.title)); setOriginalTitle(stripHtml(list.title)); }
    if (e.key === 'Delete') { e.preventDefault(); onContextMenu?.('delete', list); }
    if (e.key === ' ' || (e.key === 'F10' && e.shiftKey)) { e.preventDefault(); openMenu(e); }
  };

  return (
    <>
      <div
        ref={itemRef}
        tabIndex={0}
        role="listitem"
        aria-label={list.title || 'Untitled'}
        onClick={() => !isRenaming && onSelect(list.id)}
        onContextMenu={openMenu}
        onKeyDown={handleKeyDown}
        className={`group flex items-center gap-2 mx-2 mb-0.5 ${indent ? 'pl-6 pr-2.5' : 'px-2.5'} py-2 rounded-lg text-sm cursor-pointer
          transition-colors duration-150 select-none relative outline-none
          ${isActive
            ? isDark
              ? 'bg-navy-800 text-white'
              : 'bg-gray-100 text-gray-900'
            : isDark
              ? 'text-navy-300 hover:bg-navy-800/60'
              : 'text-gray-600 hover:bg-gray-100'
          }
          focus-visible:ring-1 focus-visible:ring-blue-500/50`}
      >
        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={handleRenameChange}
            onBlur={handleRenameBlur}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            className={`flex-1 bg-transparent outline-none text-sm min-w-0
              ${isDark ? 'text-white' : 'text-gray-900'}`}
          />
        ) : (
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            {showListIcon && (
              <ListChecks size={14} className={`flex-shrink-0 ${isDark ? 'text-navy-400' : 'text-gray-400'}`} />
            )}
            <span className="flex-1 min-w-0 truncate" dangerouslySetInnerHTML={{ __html: stripFontSize(list.title || 'Untitled') }} />
            {clipboardBadge && (
              <span
                ref={badgeRef}
                className="clipboard-color-swatch flex items-center gap-1 text-[11px] font-medium flex-shrink-0 truncate max-w-[90px]
                  px-1.5 py-0.5 rounded-full"
              >
                <ClipboardList size={10} className="flex-shrink-0" />
                <span className="truncate">{clipboardBadge.name}</span>
              </span>
            )}
          </div>
        )}

        {/* Hover action buttons */}
        {!isRenaming && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: list.pinned ? 'UNPIN_LIST' : 'PIN_LIST', payload: list.id });
              }}
              className={`p-1 rounded transition-colors cursor-pointer
                ${list.pinned
                  ? 'text-blue-400 hover:text-blue-300'
                  : isDark
                    ? 'text-navy-500 hover:text-white hover:bg-navy-700'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'
                }`}
              title={list.pinned ? 'Unpin' : 'Pin'}
            >
              <Pin size={13} className={list.pinned ? 'fill-current' : ''} />
            </button>
            <button
              onClick={openMenu}
              className={`p-1 rounded transition-colors cursor-pointer
                ${isDark
                  ? 'text-navy-500 hover:text-white hover:bg-navy-700'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'
                }`}
              title="More actions"
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Context menu portal */}
      {showMenu && (
        <ContextMenu
          list={list}
          position={menuPosition}
          onClose={handleMenuClose}
          theme={theme}
          dispatch={dispatch}
          onOpenCreateDialog={onOpenCreateDialog}
        />
      )}
    </>
  );
}

// `clipboardBadge` is a fresh object every parent render (from getClipboardBadge), so
// it's compared by value here rather than by reference.
function sidebarListItemPropsEqual(prev, next) {
  return (
    prev.list === next.list &&
    prev.isActive === next.isActive &&
    prev.onSelect === next.onSelect &&
    prev.onContextMenu === next.onContextMenu &&
    prev.theme === next.theme &&
    prev.dispatch === next.dispatch &&
    prev.onOpenCreateDialog === next.onOpenCreateDialog &&
    prev.indent === next.indent &&
    prev.showListIcon === next.showListIcon &&
    prev.clipboardBadge?.color === next.clipboardBadge?.color &&
    prev.clipboardBadge?.name === next.clipboardBadge?.name
  );
}

const SidebarListItem = memo(SidebarListItemImpl, sidebarListItemPropsEqual);

// ─── Clipboard Context Menu (for pinned/sidebar clipboards) ──
function ClipboardContextMenu({ clipboard, position, onClose, onRename, dispatch, theme }) {
  const isDark = theme === 'dark';
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={menuRef}
      className={`fixed z-50 w-52 rounded-lg shadow-xl border py-1.5
        ${isDark ? 'bg-navy-800 border-navy-700' : 'bg-white border-gray-200'}`}
      style={{ top: position.top, left: position.left }}>
      <button onClick={(e) => { e.stopPropagation(); onRename(); onClose(); }}
        className={`w-[calc(100%-12px)] mx-1.5 flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer
          ${isDark ? 'text-navy-200 hover:bg-navy-700' : 'text-gray-700 hover:bg-gray-50'}`}>
        <Pencil size={15} /><span>Rename</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); dispatch({ type: clipboard.pinned ? 'UNPIN_CLIPBOARD' : 'PIN_CLIPBOARD', payload: clipboard.id }); onClose(); }}
        className={`w-[calc(100%-12px)] mx-1.5 flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer
          ${isDark ? 'text-navy-200 hover:bg-navy-700' : 'text-gray-700 hover:bg-gray-50'}`}>
        <Pin size={15} className={clipboard.pinned ? 'fill-current' : ''} /><span>{clipboard.pinned ? 'Unpin' : 'Pin'}</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DELETE_CLIPBOARD', payload: clipboard.id }); onClose(); }}
        className="w-[calc(100%-12px)] mx-1.5 flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer text-red-400 hover:bg-red-500/10">
        <Trash2 size={15} /><span>Delete</span>
      </button>
    </div>
  );
}

// ─── Sidebar Clipboard Item (for pinned clipboards) ──
function SidebarClipboardItemImpl({ clipboard, lists, dispatch, theme, onSelectList, activeView, activeListId, onContextMenu, onOpenCreateDialog }) {
  const isDark = theme === 'dark';
  const [expanded, setExpanded] = useState(true);
  const [showCbMenu, setShowCbMenu] = useState(false);
  const [cbMenuPos, setCbMenuPos] = useState({ top: 0, left: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(clipboard.name);
  const originalNameRef = useRef(clipboard.name);
  const renameInputRef = useRef(null);
  const isActive = activeView?.type === 'clipboard' && activeView?.id === clipboard.id;
  const iconColorRef = useLiveClipboardColorRef(clipboard.id, clipboard.color || '#3b82f6');
  const childLists = lists.filter(l => l.clipboardId === clipboard.id);
  const cbRef = useRef(null);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const openCbMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = cbRef.current?.getBoundingClientRect();
    if (rect) setCbMenuPos({ top: `${rect.bottom + 2}px`, left: `${rect.left}px` });
    setShowCbMenu(true);
  };

  const startRenameClipboard = () => {
    originalNameRef.current = clipboard.name;
    setRenameValue(clipboard.name);
    setIsRenaming(true);
  };

  const handleClipboardRenameChange = (e) => {
    const val = e.target.value;
    setRenameValue(val);
    if (val.trim()) {
      dispatch({ type: 'RENAME_CLIPBOARD', payload: { id: clipboard.id, name: val.trim() } });
    }
  };

  const handleClipboardRenameBlur = () => {
    if (!renameValue.trim()) {
      dispatch({ type: 'RENAME_CLIPBOARD', payload: { id: clipboard.id, name: originalNameRef.current } });
    }
    setIsRenaming(false);
  };

  const handleClipboardRenameKeyDown = (e) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') {
      dispatch({ type: 'RENAME_CLIPBOARD', payload: { id: clipboard.id, name: originalNameRef.current } });
      setIsRenaming(false);
    }
  };

  // Keyboard shortcuts
  const handleKeyDown = (e) => {
    if (isRenaming) return;
    if (e.key === 'Enter') dispatch({ type: 'SET_VIEW', payload: { type: 'clipboard', id: clipboard.id } });
    if (e.key === ' ' || (e.key === 'F10' && e.shiftKey)) { e.preventDefault(); openCbMenu(e); }
    if (e.key === 'Delete') { e.preventDefault(); dispatch({ type: 'DELETE_CLIPBOARD', payload: clipboard.id }); }
  };

  return (
    <div>
      <div
        ref={cbRef}
        tabIndex={0}
        role="listitem"
        aria-label={clipboard.name}
        onContextMenu={openCbMenu}
        onKeyDown={handleKeyDown}
        className={`group flex items-center gap-2 mx-2 mb-0.5 px-2.5 py-2 rounded-lg text-sm cursor-pointer
          transition-colors duration-150 select-none relative outline-none
          ${isActive
            ? isDark ? 'bg-navy-800 text-white' : 'bg-gray-100 text-gray-900'
            : isDark ? 'text-navy-300 hover:bg-navy-800/60' : 'text-gray-600 hover:bg-gray-100'
          }
          focus-visible:ring-1 focus-visible:ring-blue-500/50`}
        onClick={() => { if (!isRenaming) dispatch({ type: 'SET_VIEW', payload: { type: 'clipboard', id: clipboard.id } }); }}
      >
        <ClipboardList ref={iconColorRef} size={14} className="flex-shrink-0 clipboard-color-swatch" />
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={handleClipboardRenameChange}
            onBlur={handleClipboardRenameBlur}
            onKeyDown={handleClipboardRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            className={`flex-1 min-w-0 bg-transparent outline-none border-b text-sm
              ${isDark ? 'text-white border-navy-600' : 'text-gray-900 border-gray-300'}`}
          />
        ) : (
          <span className="flex-1 truncate">{clipboard.name}</span>
        )}

        {/* Hover actions */}
        {!isRenaming && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {childLists.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className={`p-1 rounded transition-colors cursor-pointer
                ${isDark ? 'text-navy-500 hover:text-white hover:bg-navy-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'}`}
              title={expanded ? 'Collapse' : 'Expand'}
            >
              <ChevronDown size={13} className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
            </button>
          )}
          <button
            onClick={openCbMenu}
            className={`p-1 rounded transition-colors cursor-pointer
              ${isDark ? 'text-navy-500 hover:text-white hover:bg-navy-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'}`}
            title="More actions"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
        )}
      </div>

      {/* Expanded child tasklists — same font/hover/menu as regular sidebar items,
          just indented via inner padding so the hover box still spans the full width */}
      {expanded && childLists.length > 0 && (
        <div>
          {childLists.map(list => (
            <SidebarListItem
              key={list.id}
              list={list}
              isActive={activeListId === list.id && activeView?.type === 'list'}
              onSelect={onSelectList}
              onContextMenu={onContextMenu}
              theme={theme}
              dispatch={dispatch}
              onOpenCreateDialog={onOpenCreateDialog}
              indent
            />
          ))}
        </div>
      )}

      {/* Clipboard context menu */}
      {showCbMenu && (
        <ClipboardContextMenu
          clipboard={clipboard}
          position={cbMenuPos}
          onClose={() => setShowCbMenu(false)}
          onRename={startRenameClipboard}
          dispatch={dispatch}
          theme={theme}
        />
      )}
    </div>
  );
}

const SidebarClipboardItem = memo(SidebarClipboardItemImpl);

// ─── Collapsed-rail flyout (Pinned / Recents quick-access panel) ──
function CollapsedFlyoutClipboardIcon({ clipboardId, color }) {
  const colorRef = useLiveClipboardColorRef(clipboardId, color);
  return <ClipboardList ref={colorRef} size={14} className="flex-shrink-0 clipboard-color-swatch" />;
}

function CollapsedFlyout({ title, items, onClose, position, theme }) {
  const isDark = theme === 'dark';
  const panelRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className={`fixed z-50 w-64 max-h-[70vh] overflow-y-auto rounded-xl shadow-2xl border py-2
        animate-fade-in-up
        ${isDark ? 'bg-navy-800 border-navy-700' : 'bg-white border-gray-200'}`}
      style={{ top: position.top, left: position.left }}
    >
      <div className={`px-3.5 pb-1.5 text-xs font-semibold uppercase tracking-wider
        ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>
        {title}
      </div>
      {items.length === 0 ? (
        <div className={`px-3.5 py-3 text-sm ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>
          Nothing here yet
        </div>
      ) : (
        items.map(item => (
          <button
            key={item.id}
            onClick={item.onSelect}
            className={`w-[calc(100%-12px)] mx-1.5 flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-lg
              transition-colors cursor-pointer text-left
              ${isDark ? 'text-navy-200 hover:bg-navy-700' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            {item.type === 'clipboard' ? (
              <CollapsedFlyoutClipboardIcon clipboardId={item.id} color={item.color} />
            ) : (
              <ListChecks size={14} className={`flex-shrink-0 ${isDark ? 'text-navy-500' : 'text-gray-400'}`} />
            )}
            <span className="truncate flex-1" dangerouslySetInnerHTML={{ __html: item.labelHtml }} />
          </button>
        ))
      )}
    </div>
  );
}

// ─── Main Sidebar Component ─────────────────────────
export default function Sidebar({ collapsed, setCollapsed, onOpenSearch }) {
  const { theme, toggleTheme } = useTheme();
  const { fullState, dispatch, activeView } = useTasks();
  const isDark = theme === 'dark';

  const [pinnedCollapsed, setPinnedCollapsed] = useState(false);
  const [recentsCollapsed, setRecentsCollapsed] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // list to delete
  const [collapsedFlyout, setCollapsedFlyout] = useState(null); // 'pinned' | 'recents' | null
  const [flyoutPosition, setFlyoutPosition] = useState({ top: 0, left: 0 });
  const [createClipboardDialog, setCreateClipboardDialog] = useState(null); // { listId: string|null } | null
  const pinnedIconRef = useRef(null);
  const recentsIconRef = useRef(null);

  const openFlyout = (which, ref) => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setFlyoutPosition({ top: `${rect.top}px`, left: `${rect.right + 8}px` });
    setCollapsedFlyout(collapsedFlyout === which ? null : which);
  };

  const handleOpenCreateDialog = useCallback((listId) => {
    setCreateClipboardDialog({ listId: listId || null });
  }, []);

  const handleCreateClipboardConfirm = ({ name, color }) => {
    const newId = generateId();
    dispatch({ type: 'CREATE_CLIPBOARD', payload: { id: newId, name, color } });
    if (createClipboardDialog?.listId) {
      dispatch({ type: 'MOVE_TO_CLIPBOARD', payload: { listId: createClipboardDialog.listId, clipboardId: newId } });
    }
    setCreateClipboardDialog(null);
  };

  // Partition lists
  const allLists = fullState.lists || [];
  const allClipboards = fullState.clipboards || [];
  const filteredLists = allLists;

  const pinnedClipboards = allClipboards.filter(c => c.pinned);
  const pinnedClipboardIds = new Set(pinnedClipboards.map(c => c.id));
  // A list that lives inside a pinned clipboard already appears nested under that
  // clipboard's own collapsible section, so keep it out of Recents — it should only
  // ever show in one place there.
  const inPinnedClipboard = (l) => l.clipboardId && pinnedClipboardIds.has(l.clipboardId);
  // Every pinned list gets a flat entry here, with a badge naming its clipboard if it
  // has one — this is the only place a pinned list shows when its clipboard isn't
  // pinned, so that clipboard never renders as if it were pinned itself.
  const pinnedLists = filteredLists.filter(l => l.pinned);
  const recentLists = filteredLists
    .filter(l => !l.pinned && !inPinnedClipboard(l))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  const getClipboardBadge = (list) => {
    if (!list.clipboardId) return null;
    const cb = allClipboards.find(c => c.id === list.clipboardId);
    return cb ? { id: cb.id, name: cb.name, color: cb.color || '#3b82f6' } : null;
  };

  const hasPinned = pinnedLists.length > 0 || pinnedClipboards.length > 0;

  const handleNewList = () => {
    dispatch({ type: 'CREATE_LIST', payload: { title: 'New List' } });
  };

  // Stable identities so they don't defeat SidebarListItem/SidebarClipboardItem's memoization.
  const handleSelectList = useCallback((listId) => {
    dispatch({ type: 'SET_ACTIVE_LIST', payload: listId });
  }, [dispatch]);

  const handleContextAction = useCallback((action, list) => {
    if (action === 'delete') {
      setDeleteTarget(list);
    }
  }, []);

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      dispatch({ type: 'DELETE_LIST', payload: deleteTarget.id });
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <aside
        className={`h-screen flex flex-col border-r transition-all duration-300 ease-in-out flex-shrink-0
          ${collapsed ? 'w-[68px]' : 'w-[240px]'}
          ${isDark ? 'bg-navy-950 border-navy-800' : 'bg-white border-gray-200'}`}
      >
        {/* ── Logo / Collapse Toggle ── */}
        <div className="flex items-center justify-between px-4 h-14 flex-shrink-0">
          {collapsed ? (
            <button
              onClick={() => setCollapsed(false)}
              className={`w-full flex items-center justify-center p-1.5 rounded-lg transition-all duration-200 cursor-pointer
                ${isDark
                  ? 'text-navy-400 hover:bg-navy-800/60 hover:text-white'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-900'
                }`}
              title="Expand sidebar"
            >
              <ChevronRight size={22} />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <CheckmarkLogo
                  size={26}
                  className={isDark ? 'text-blue-400' : 'text-brand'}
                />
                <span className="text-[15px] font-bold tracking-tight">
                  <span className={isDark ? 'text-white' : 'text-brand'}>Check</span>
                  <span className={isDark ? 'text-blue-400' : 'text-accent-blue'}>mark</span>
                </span>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer
                  ${isDark
                    ? 'text-navy-400 hover:bg-navy-800/60 hover:text-white'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                title="Collapse sidebar"
              >
                <ChevronLeft size={18} />
              </button>
            </>
          )}
        </div>

        {/* ── Top Actions ── */}
        <div className={`px-2 pb-1 space-y-0.5 flex-shrink-0 ${collapsed ? 'px-2' : ''}`}>
          {/* New List */}
          <button
            onClick={handleNewList}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium
              transition-all duration-200 cursor-pointer
              ${collapsed ? 'justify-center' : ''}
              ${isDark
                ? 'bg-navy-800/80 text-navy-200 hover:bg-navy-800 hover:text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            title={collapsed ? 'New List' : undefined}
          >
            <Plus size={18} className="flex-shrink-0" />
            {!collapsed && <span>New List</span>}
          </button>

          {/* Search — opens the global search modal (Ctrl/Cmd+K) */}
          <button
            onClick={onOpenSearch}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm
              transition-all duration-200 cursor-pointer
              ${collapsed ? 'justify-center' : ''}
              ${isDark
                ? 'text-navy-400 hover:bg-navy-800/60 hover:text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            title={collapsed ? 'Search (Ctrl+K)' : undefined}
          >
            <Search size={18} className="flex-shrink-0" />
            {!collapsed && (
              <span className="flex-1 flex items-center justify-between">
                Search
                <span className={`text-[11px] ${isDark ? 'text-navy-600' : 'text-gray-400'}`}>Ctrl+K</span>
              </span>
            )}
          </button>

          {/* Clipboards */}
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: { type: 'clipboards' } })}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm
              transition-all duration-200 cursor-pointer
              ${collapsed ? 'justify-center' : ''}
              ${activeView?.type === 'clipboards' || activeView?.type === 'clipboard'
                ? isDark
                  ? 'bg-navy-800 text-white'
                  : 'bg-gray-100 text-gray-900'
                : isDark
                  ? 'text-navy-400 hover:bg-navy-800/60 hover:text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            title={collapsed ? 'Clipboards' : undefined}
          >
            <ClipboardList size={18} className="flex-shrink-0" />
            {!collapsed && <span>Clipboards</span>}
          </button>
        </div>

        {/* ── Divider ── */}
        <div className={`mx-3 border-t ${isDark ? 'border-navy-800/60' : 'border-gray-200'}`} />

        {/* ── Scrollable List Area ── */}
        {!collapsed && (
          <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
            {/* Pinned Section */}
            {hasPinned && (
              <>
                <SectionHeader
                  label="Pinned"
                  collapsed={pinnedCollapsed}
                  onToggle={() => setPinnedCollapsed(!pinnedCollapsed)}
                  theme={theme}
                  show={true}
                />
                {!pinnedCollapsed && (
                  <>
                    {pinnedClipboards.map(cb => (
                      <SidebarClipboardItem
                        key={cb.id}
                        clipboard={cb}
                        lists={allLists}
                        dispatch={dispatch}
                        theme={theme}
                        onSelectList={handleSelectList}
                        activeView={activeView}
                        activeListId={fullState.activeListId}
                        onContextMenu={handleContextAction}
                        onOpenCreateDialog={handleOpenCreateDialog}
                      />
                    ))}
                    {/* Flat pinned-tasklist shortcuts — every pinned list gets one here,
                        even lists that already appear nested under a clipboard above, so
                        pinning something inside a clipboard still gives it a quick-access
                        entry of its own. */}
                    {pinnedLists.map(list => (
                      <SidebarListItem
                        key={list.id}
                        list={list}
                        isActive={fullState.activeListId === list.id && activeView?.type === 'list'}
                        onSelect={handleSelectList}
                        onContextMenu={handleContextAction}
                        theme={theme}
                        dispatch={dispatch}
                        clipboardBadge={getClipboardBadge(list)}
                        onOpenCreateDialog={handleOpenCreateDialog}
                        showListIcon
                      />
                    ))}
                  </>
                )}
              </>
            )}

            {/* Recents Section */}
            {recentLists.length > 0 && (
              <>
                <SectionHeader
                  label="Recents"
                  collapsed={recentsCollapsed}
                  onToggle={() => setRecentsCollapsed(!recentsCollapsed)}
                  theme={theme}
                  show={true}
                />
                {!recentsCollapsed && recentLists.map(list => (
                  <SidebarListItem
                    key={list.id}
                    list={list}
                    isActive={fullState.activeListId === list.id && activeView?.type === 'list'}
                    onSelect={handleSelectList}
                    onContextMenu={handleContextAction}
                    theme={theme}
                    dispatch={dispatch}
                    clipboardBadge={getClipboardBadge(list)}
                    onOpenCreateDialog={handleOpenCreateDialog}
                  />
                ))}
              </>
            )}

            {/* Empty state */}
            {filteredLists.length === 0 && (
              <div className={`px-4 py-8 text-center text-xs
                ${isDark ? 'text-navy-600' : 'text-gray-400'}`}>
                No lists yet
              </div>
            )}
          </div>
        )}

        {/* Collapsed: icon-only rail (ChatGPT-style) — Pinned/Recents open a flyout
            with their contents instead of listing every tasklist as its own icon */}
        {collapsed && (
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
            <button
              ref={pinnedIconRef}
              onClick={() => openFlyout('pinned', pinnedIconRef)}
              className={`w-full flex items-center justify-center p-2.5 rounded-lg transition-colors cursor-pointer
                ${collapsedFlyout === 'pinned'
                  ? isDark ? 'bg-navy-800 text-white' : 'bg-gray-100 text-gray-900'
                  : isDark ? 'text-navy-400 hover:bg-navy-800/60 hover:text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              title="Pinned"
            >
              <Pin size={18} />
            </button>
            <button
              ref={recentsIconRef}
              onClick={() => openFlyout('recents', recentsIconRef)}
              className={`w-full flex items-center justify-center p-2.5 rounded-lg transition-colors cursor-pointer
                ${collapsedFlyout === 'recents'
                  ? isDark ? 'bg-navy-800 text-white' : 'bg-gray-100 text-gray-900'
                  : isDark ? 'text-navy-400 hover:bg-navy-800/60 hover:text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              title="Recents"
            >
              <ListChecks size={18} />
            </button>
          </div>
        )}

        {/* Collapsed-rail flyout panels */}
        {collapsed && collapsedFlyout === 'pinned' && (
          <CollapsedFlyout
            title="Pinned"
            position={flyoutPosition}
            theme={theme}
            onClose={() => setCollapsedFlyout(null)}
            items={[
              ...pinnedClipboards.map(cb => ({
                id: cb.id,
                type: 'clipboard',
                color: cb.color || '#3b82f6',
                labelHtml: cb.name,
                onSelect: () => {
                  dispatch({ type: 'SET_VIEW', payload: { type: 'clipboard', id: cb.id } });
                  setCollapsedFlyout(null);
                },
              })),
              // pinnedLists already covers every pinned list, including ones that live
              // inside a (pinned or unpinned) clipboard — no need to list them twice.
              ...pinnedLists.map(l => ({
                id: l.id,
                type: 'list',
                labelHtml: stripFontSize(l.title || 'Untitled'),
                onSelect: () => {
                  dispatch({ type: 'SET_ACTIVE_LIST', payload: l.id });
                  dispatch({ type: 'SET_VIEW', payload: { type: 'list' } });
                  setCollapsedFlyout(null);
                },
              })),
            ]}
          />
        )}
        {collapsed && collapsedFlyout === 'recents' && (
          <CollapsedFlyout
            title="Recents"
            position={flyoutPosition}
            theme={theme}
            onClose={() => setCollapsedFlyout(null)}
            items={recentLists.map(l => ({
              id: l.id,
              type: 'list',
              labelHtml: stripFontSize(l.title || 'Untitled'),
              onSelect: () => {
                dispatch({ type: 'SET_ACTIVE_LIST', payload: l.id });
                dispatch({ type: 'SET_VIEW', payload: { type: 'list' } });
                setCollapsedFlyout(null);
              },
            }))}
          />
        )}

        {/* ── Theme Toggle ── */}
        <div className="px-2 py-1.5">
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm
              transition-all duration-200 cursor-pointer
              ${collapsed ? 'justify-center' : ''}
              ${isDark
                ? 'text-navy-400 hover:bg-navy-800/60 hover:text-amber-300'
                : 'text-gray-500 hover:bg-gray-100 hover:text-indigo-600'
              }`}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <div className="relative w-[20px] h-[20px] overflow-hidden flex-shrink-0">
              <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500
                ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}`}>
                <SunIcon size={20} />
              </div>
              <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500
                ${!isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`}>
                <MoonIcon size={20} />
              </div>
            </div>
            {!collapsed && (
              <span className="text-sm">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            )}
          </button>
        </div>
      </aside>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteDialog
          listName={stripHtml(deleteTarget.title) || 'Untitled'}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
          theme={theme}
        />
      )}

      {/* Create clipboard dialog */}
      {createClipboardDialog && (
        <CreateClipboardDialog
          onConfirm={handleCreateClipboardConfirm}
          onCancel={() => setCreateClipboardDialog(null)}
          theme={theme}
        />
      )}
    </>
  );
}
