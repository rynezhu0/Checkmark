import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useTasks, resolveTagColor } from '../context/TaskContext';
import { format } from 'date-fns';
import {
  X,
  Calendar,
  Tag,
  FileText,
  Trash2,
  Check,
  Plus,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  Sparkles,
} from 'lucide-react';

import CustomCalendar from './CustomCalendar';
import ColorPicker from './ColorPicker';

// ─── Status config ───────────────────────────────────
const STATUS_OPTIONS = [
  {
    value: 'not_started',
    label: 'Not started',
    group: 'To-do',
    dotColor: 'bg-gray-400',
    bgColor: 'bg-gray-500/15',
    textColor: 'text-gray-300',
    bgColorLight: 'bg-gray-200',
    textColorLight: 'text-gray-700',
  },
  {
    value: 'in_progress',
    label: 'In progress',
    group: 'In progress',
    dotColor: 'bg-blue-400',
    bgColor: 'bg-blue-500/15',
    textColor: 'text-blue-400',
    bgColorLight: 'bg-blue-100',
    textColorLight: 'text-blue-700',
  },
  {
    value: 'done',
    label: 'Done',
    group: 'Complete',
    dotColor: 'bg-green-400',
    bgColor: 'bg-green-500/15',
    textColor: 'text-green-400',
    bgColorLight: 'bg-green-100',
    textColorLight: 'text-green-700',
  },
];




// ─── Status Picker Component ─────────────────────────
function StatusPicker({ value, onChange, onClose, theme }) {
  const pickerRef = useRef(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    function handleClickOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Group statuses
  const groups = STATUS_OPTIONS.reduce((acc, opt) => {
    if (!acc[opt.group]) acc[opt.group] = [];
    acc[opt.group].push(opt);
    return acc;
  }, {});

  return (
    <div
      ref={pickerRef}
      className={`absolute left-0 top-full mt-1 w-[260px] rounded-lg shadow-xl border z-30 py-2
        ${isDark ? 'bg-navy-800 border-navy-700' : 'bg-white border-gray-200'}`}
    >
      {Object.entries(groups).map(([groupName, options]) => (
        <div key={groupName}>
          <div className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider
            ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>
            {groupName}
          </div>
          {options.map(opt => {
            const isActive = value === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); onClose(); }}
                className={`w-[calc(100%-12px)] mx-1.5 text-left px-3 py-2 flex items-center gap-2 cursor-pointer
                  transition-colors rounded-lg
                  ${isActive
                    ? isDark ? 'bg-navy-700/60' : 'bg-gray-100'
                    : isDark ? 'hover:bg-navy-700/40' : 'hover:bg-gray-50'
                  }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${opt.dotColor}`} />
                <span className={`text-sm font-medium px-2 py-0.5 rounded-full
                  ${isDark ? `${opt.bgColor} ${opt.textColor}` : `${opt.bgColorLight} ${opt.textColorLight}`}`}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Main TaskDetailPanel ────────────────────────────
export default function TaskDetailPanel({ isClosing = false, width = 380 }) {
  const { theme } = useTheme();
  const { state, dispatch, selectedTask, fullState } = useTasks();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [descValue, setDescValue] = useState('');
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showDueDateCal, setShowDueDateCal] = useState(false);
  const [showStartDateCal, setShowStartDateCal] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const newTagInputRef = useRef(null);
  const titleRef = useRef(null);
  const tagPickerRef = useRef(null);
  const prevTaskIdRef = useRef(null);
  const lastTaskRef = useRef(null);

  // Cache the task so it's available during close animation
  if (selectedTask) {
    lastTaskRef.current = selectedTask;
  }
  const displayTask = selectedTask || lastTaskRef.current;

  useEffect(() => {
    if (selectedTask) {
      setTitleValue(selectedTask.title);
      setDescValue(selectedTask.description);
      // Auto-focus title editing for new tasks (empty title)
      if (selectedTask.id !== prevTaskIdRef.current && selectedTask.title === '') {
        setEditingTitle(true);
      }
      prevTaskIdRef.current = selectedTask.id;
    }
  }, [selectedTask?.id]);

  // Sync title/desc when changed externally (but not while editing)
  useEffect(() => {
    if (selectedTask && !editingTitle) {
      setTitleValue(selectedTask.title);
    }
  }, [selectedTask?.title]);

  useEffect(() => {
    if (selectedTask) {
      setDescValue(selectedTask.description);
    }
  }, [selectedTask?.description]);

  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus();
      // Only select text if there's content; for new tasks, just place cursor
      if (titleRef.current.value) {
        titleRef.current.select();
      }
    }
  }, [editingTitle]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target)) {
        setShowTagPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Trigger open animation on mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // requestAnimationFrame ensures the initial width:0 renders first,
    // then transitions to 380px on the next frame
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!displayTask) return null;

  const update = (updates) => {
    if (selectedTask) {
      dispatch({ type: 'UPDATE_TASK', payload: { id: selectedTask.id, updates } });
    }
  };

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setTitleValue(newTitle);
    // Update task in real-time so the task list reflects changes letter-by-letter
    update({ title: newTitle });
  };

  const handleTitleSave = () => {
    setEditingTitle(false);
    // Trim on blur; if the title is empty after trimming, keep it empty for placeholder
    const trimmed = titleValue.trim();
    if (trimmed !== displayTask.title) {
      update({ title: trimmed });
    }
    setTitleValue(trimmed);
  };

  const handleDescSave = () => {
    if (descValue !== displayTask.description) {
      update({ description: descValue });
    }
  };

  const toggleTag = (tagId) => {
    const newTags = displayTask.tags.includes(tagId)
      ? displayTask.tags.filter(id => id !== tagId)
      : [...displayTask.tags, tagId];
    update({ tags: newTags });
  };

  const handleAddTag = () => {
    if (newTagName.trim()) {
      dispatch({ type: 'ADD_TAG', payload: { name: newTagName.trim(), color: newTagColor } });
      setNewTagName('');
      setNewTagColor('#3b82f6');
      setShowNewTagForm(false);
    }
  };

  const taskTags = displayTask.tags
    .map(tagId => state.tags.find(t => t.id === tagId))
    .filter(Boolean);

  const currentStatus = STATUS_OPTIONS.find(s => s.value === (displayTask.status || 'not_started')) || STATUS_OPTIONS[0];

  const panelOpen = mounted && !isClosing;

  // Search-result highlight — a brief flash on whichever field the search match came
  // from, cleared automatically as soon as the user does anything else.
  const isSearchHighlighted = fullState.highlightedTaskId === displayTask.id;
  const highlightQuery = (fullState.highlightedQuery || '').toLowerCase();
  const highlightTitle = isSearchHighlighted && highlightQuery && displayTask.title?.toLowerCase().includes(highlightQuery);
  const highlightDescription = isSearchHighlighted && highlightQuery && displayTask.description?.toLowerCase().includes(highlightQuery);

  return (
    <div
      className="h-full flex-shrink-0 overflow-hidden"
      style={{
        width: panelOpen ? `${width}px` : '0px',
        transition: 'width 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        className={`h-full border-l flex flex-col overflow-hidden
          ${theme === 'dark'
            ? 'bg-navy-900 border-navy-800'
            : 'bg-white border-gray-200'
          }`}
        style={{
          width: `${width}px`,
          transform: panelOpen ? 'translateX(0)' : 'translateX(60px)',
          opacity: panelOpen ? 1 : 0,
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
        }}
      >

      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-4 border-b flex-shrink-0
        ${theme === 'dark' ? 'border-navy-800' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium uppercase tracking-wider
            ${theme === 'dark' ? 'text-navy-400' : 'text-gray-400'}`}>
            Tasks
          </span>
          <ChevronRight size={12} className={theme === 'dark' ? 'text-navy-600' : 'text-gray-300'} />
          <span className={`text-xs font-medium uppercase tracking-wider
            ${theme === 'dark' ? 'text-navy-300' : 'text-gray-600'}`}>
            Details
          </span>
        </div>
        <button
          onClick={() => dispatch({ type: 'SELECT_TASK', payload: null })}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer
            ${theme === 'dark'
              ? 'text-navy-400 hover:text-white hover:bg-navy-800'
              : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
            }`}
          title="Close panel"
        >
          <ChevronsRight size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* Title */}
        {editingTitle ? (
          <input
            ref={titleRef}
            value={titleValue}
            onChange={handleTitleChange}
            onBlur={handleTitleSave}
            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
            placeholder="New Task"
            className={`w-full text-xl font-bold bg-transparent outline-none
              ${theme === 'dark' ? 'text-white placeholder-navy-500' : 'text-gray-900 placeholder-gray-400'}`}
          />
        ) : (
          <h2
            onClick={() => setEditingTitle(true)}
            className={`text-xl font-bold cursor-text rounded-md -mx-1 px-1
              ${highlightTitle ? 'animate-search-highlight' : ''}
              ${!displayTask.title
                ? theme === 'dark'
                  ? 'text-navy-500'
                  : 'text-gray-400'
                : displayTask.completed
                  ? theme === 'dark'
                    ? 'text-navy-500 line-through'
                    : 'text-gray-400 line-through'
                  : theme === 'dark'
                    ? 'text-white'
                    : 'text-gray-900'
              }`}
          >
            {displayTask.title || 'New Task'}
          </h2>
        )}

        {/* Properties */}
        <div className="space-y-4">
          {/* Due Date */}
          <div className="flex items-start gap-3 relative">
            <div className={`flex items-center gap-2 w-28 flex-shrink-0 pt-0.5
              ${theme === 'dark' ? 'text-navy-400' : 'text-gray-500'}`}>
              <Calendar size={14} />
              <span className="text-sm">Due Date</span>
            </div>
            <button
              onClick={() => { setShowDueDateCal(!showDueDateCal); setShowStartDateCal(false); setShowStatusPicker(false); }}
              className={`text-sm cursor-pointer transition-colors rounded px-2 py-0.5
                ${displayTask.dueDate
                  ? theme === 'dark' ? 'text-navy-200 hover:bg-navy-700' : 'text-gray-700 hover:bg-gray-100'
                  : theme === 'dark' ? 'text-navy-500 hover:text-navy-300' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              {displayTask.dueDate
                ? format(new Date(displayTask.dueDate + 'T00:00:00'), 'MMM d, yyyy')
                : 'Empty'}
            </button>
            {showDueDateCal && (
              <CustomCalendar
                value={displayTask.dueDate}
                onChange={(val) => update({ dueDate: val })}
                onClose={() => setShowDueDateCal(false)}
                theme={theme}
              />
            )}
          </div>

          {/* Start Date */}
          <div className="flex items-start gap-3 relative">
            <div className={`flex items-center gap-2 w-28 flex-shrink-0 pt-0.5
              ${theme === 'dark' ? 'text-navy-400' : 'text-gray-500'}`}>
              <Calendar size={14} />
              <span className="text-sm">Start Date</span>
            </div>
            <button
              onClick={() => { setShowStartDateCal(!showStartDateCal); setShowDueDateCal(false); setShowStatusPicker(false); }}
              className={`text-sm cursor-pointer transition-colors rounded px-2 py-0.5
                ${displayTask.startDate
                  ? theme === 'dark' ? 'text-navy-200 hover:bg-navy-700' : 'text-gray-700 hover:bg-gray-100'
                  : theme === 'dark' ? 'text-navy-500 hover:text-navy-300' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              {displayTask.startDate
                ? format(new Date(displayTask.startDate + 'T00:00:00'), 'MMM d, yyyy')
                : 'Empty'}
            </button>
            {showStartDateCal && (
              <CustomCalendar
                value={displayTask.startDate}
                onChange={(val) => update({ startDate: val })}
                onClose={() => setShowStartDateCal(false)}
                theme={theme}
              />
            )}
          </div>

          {/* Status */}
          <div className="flex items-start gap-3 relative">
            <div className={`flex items-center gap-2 w-28 flex-shrink-0 pt-0.5
              ${theme === 'dark' ? 'text-navy-400' : 'text-gray-500'}`}>
              <Sparkles size={14} />
              <span className="text-sm">Status</span>
            </div>
            <button
              onClick={() => { setShowStatusPicker(!showStatusPicker); setShowDueDateCal(false); setShowStartDateCal(false); }}
              className="cursor-pointer"
            >
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-0.5 rounded-full
                ${theme === 'dark'
                  ? `${currentStatus.bgColor} ${currentStatus.textColor}`
                  : `${currentStatus.bgColorLight} ${currentStatus.textColorLight}`
                }`}>
                <span className={`w-2 h-2 rounded-full ${currentStatus.dotColor}`} />
                {currentStatus.label}
              </span>
            </button>
            {showStatusPicker && (
              <StatusPicker
                value={displayTask.status || 'not_started'}
                onChange={(val) => {
                  update({ status: val, completed: val === 'done' });
                }}
                onClose={() => setShowStatusPicker(false)}
                theme={theme}
              />
            )}
          </div>

          {/* Tags */}
          <div className="flex items-start gap-3">
            <div className={`flex items-center gap-2 w-28 flex-shrink-0 pt-1
              ${theme === 'dark' ? 'text-navy-400' : 'text-gray-500'}`}>
              <Tag size={14} />
              <span className="text-sm">Tags</span>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {taskTags.map(tag => {
                  const hex = resolveTagColor(tag.color);
                  return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full
                      uppercase tracking-wide cursor-pointer hover:opacity-80 transition-opacity
                      flex items-center gap-1"
                    style={{
                      backgroundColor: `${hex}26`,
                      color: hex,
                    }}
                  >
                    {tag.name}
                    <X size={10} />
                  </button>
                );
                })}
              </div>
              <div className="relative" ref={tagPickerRef}>
                <button
                  onClick={() => setShowTagPicker(!showTagPicker)}
                  className={`flex items-center gap-1 text-xs cursor-pointer rounded-md px-1.5 py-1 -mx-1.5 -my-1
                    outline-none transition-colors focus-visible:ring-1 focus-visible:ring-blue-500/50
                    ${theme === 'dark'
                      ? 'text-navy-500 hover:text-navy-300'
                      : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  <Plus size={12} />
                  Add tag
                </button>
                {showTagPicker && (
                  <div className={`absolute right-0 top-full mt-1 rounded-lg shadow-xl border z-20 overflow-hidden
                    animate-calendar-in
                    ${state.tags.length === 0 && !showNewTagForm ? 'w-auto' : 'w-60'}
                    ${theme === 'dark'
                      ? 'bg-navy-800 border-navy-700'
                      : 'bg-white border-gray-200'
                    }`}>
                    {showNewTagForm ? (
                      /* ── New Tag Creation Form ── */
                      <div className="p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowNewTagForm(false)}
                            className={`p-1 rounded-md cursor-pointer transition-colors
                              ${theme === 'dark'
                                ? 'text-navy-400 hover:text-white hover:bg-navy-700'
                                : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
                              }`}
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <span className={`text-sm font-semibold
                            ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>New Tag</span>
                        </div>

                        <input
                          ref={newTagInputRef}
                          type="text"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                          placeholder="Tag name..."
                          autoFocus
                          className={`w-full text-sm px-2.5 py-1.5 rounded-md border outline-none
                            ${theme === 'dark'
                              ? 'bg-navy-900 border-navy-600 text-white placeholder-navy-500 focus:border-navy-500'
                              : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                            }`}
                        />

                        <div>
                          <span className={`text-[11px] font-medium uppercase tracking-wider mb-1.5 block
                            ${theme === 'dark' ? 'text-navy-500' : 'text-gray-400'}`}>Color</span>
                          <ColorPicker
                            value={newTagColor}
                            onChange={setNewTagColor}
                            theme={theme}
                          />
                        </div>

                        <button
                          onClick={handleAddTag}
                          disabled={!newTagName.trim()}
                          className={`w-full text-sm font-medium py-2 rounded-lg cursor-pointer transition-colors
                            ${newTagName.trim()
                              ? 'text-white hover:opacity-90'
                              : theme === 'dark'
                                ? 'bg-navy-700 text-navy-500 cursor-not-allowed'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                          style={newTagName.trim() ? { backgroundColor: newTagColor } : undefined}
                        >
                          Create Tag
                        </button>
                      </div>
                    ) : (
                      /* ── Tag List ── */
                      <>
                        {state.tags.length > 0 && (
                        <div className="p-1.5">
                          {state.tags.map(tag => {
                            const isAssigned = displayTask.tags.includes(tag.id);
                            return (
                              <div
                                key={tag.id}
                                className={`group/tag flex items-center gap-2 px-2.5 py-1.5 text-sm
                                  rounded-lg transition-colors cursor-pointer
                                  ${isAssigned
                                    ? theme === 'dark'
                                      ? 'bg-navy-700/60 text-white'
                                      : 'bg-blue-50 text-gray-900'
                                    : theme === 'dark'
                                      ? 'text-navy-200 hover:bg-navy-700/40'
                                      : 'text-gray-700 hover:bg-gray-50'
                                  }`}
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: resolveTagColor(tag.color) }}
                                  onClick={() => toggleTag(tag.id)}
                                />
                                <span className="flex-1 truncate" onClick={() => toggleTag(tag.id)}>
                                  {tag.name}
                                </span>
                                {isAssigned && <Check size={12} className="flex-shrink-0 text-blue-400" />}
                                <button
                                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DELETE_TAG', payload: tag.id }); }}
                                  className={`flex-shrink-0 p-0.5 rounded opacity-0 group-hover/tag:opacity-100
                                    transition-opacity cursor-pointer
                                    ${theme === 'dark'
                                      ? 'text-navy-500 hover:text-red-400'
                                      : 'text-gray-300 hover:text-red-500'
                                    }`}
                                  title="Delete tag"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        )}

                        {state.tags.length > 0 && (
                          <div className={`border-t mx-1.5 ${theme === 'dark' ? 'border-navy-700' : 'border-gray-200'}`} />
                        )}

                        <div className="p-1.5">
                          <button
                            onClick={() => { setShowNewTagForm(true); setNewTagColor('#3b82f6'); setNewTagName(''); }}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-lg
                              transition-colors cursor-pointer
                              ${theme === 'dark'
                                ? 'text-navy-400 hover:text-navy-200 hover:bg-navy-700/40'
                                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                              }`}
                          >
                            <Plus size={14} />
                            New Tag
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <div className={`flex items-center gap-2 mb-2
            ${theme === 'dark' ? 'text-navy-400' : 'text-gray-500'}`}>
            <FileText size={14} />
            <span className="text-sm font-medium uppercase tracking-wider">Description</span>
          </div>
          <textarea
            value={descValue}
            onChange={(e) => setDescValue(e.target.value)}
            onBlur={handleDescSave}
            placeholder="Add a description..."
            rows={6}
            className={`w-full text-sm bg-transparent outline-none resize-none
              rounded-lg p-3 border transition-colors
              ${highlightDescription ? 'animate-search-highlight' : ''}
              ${theme === 'dark'
                ? 'text-navy-200 placeholder-navy-600 border-navy-800 focus:border-navy-600'
                : 'text-gray-700 placeholder-gray-400 border-gray-200 focus:border-gray-300'
              }`}
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className={`px-5 py-4 border-t flex items-center gap-3 flex-shrink-0
        ${theme === 'dark' ? 'border-navy-800' : 'border-gray-200'}`}>
        <button
          onClick={() => {
            // TOGGLE_COMPLETE syncs status in the same dispatch — no separate update needed.
            dispatch({ type: 'TOGGLE_COMPLETE', payload: displayTask.id });
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium
            transition-colors cursor-pointer
            ${displayTask.completed
              ? theme === 'dark'
                ? 'bg-navy-800 text-navy-300 hover:bg-navy-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              : 'bg-accent-blue text-white hover:bg-blue-600'
            }`}
        >
          <Check size={16} />
          {displayTask.completed ? 'Mark as Incomplete' : 'Mark as Complete'}
        </button>
        <button
          onClick={() => {
            dispatch({ type: 'DELETE_TASK', payload: displayTask.id });
          }}
          className={`p-2.5 rounded-lg transition-colors cursor-pointer
            ${theme === 'dark'
              ? 'text-navy-500 hover:text-red-400 hover:bg-red-500/10'
              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
            }`}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
    </div>
  );
}
