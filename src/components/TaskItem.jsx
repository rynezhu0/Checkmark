import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useTasks, resolveTagColor } from '../context/TaskContext';
import { Pencil, CalendarPlus, Minus, GripVertical } from 'lucide-react';
import { format } from 'date-fns';
import CustomCalendar from './CustomCalendar';

export default function TaskItem({ task, index, filteredTasks, dragHandleProps, isDragging, isDropTarget, dropPosition, didMarqueeRef }) {
  const { theme } = useTheme();
  const { state, fullState, dispatch } = useTasks();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [justChecked, setJustChecked] = useState(false);
  const [isAddingDate, setIsAddingDate] = useState(false);
  const inputRef = useRef(null);
  const rowRef = useRef(null);

  const isSelected = state.selectedTaskId === task.id;
  const isMultiSelected = state.selectedTaskIds.includes(task.id);
  const isInProgress = task.status === 'in_progress';
  const isSearchHighlighted = fullState.highlightedTaskId === task.id;

  useEffect(() => {
    if (isSearchHighlighted) {
      rowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [isSearchHighlighted]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleCalendarClose = useCallback(() => {
    setIsAddingDate(false);
  }, []);

  const handleToggle = (e) => {
    e.stopPropagation();
    setJustChecked(true);
    // TOGGLE_COMPLETE syncs status in the same dispatch — no separate UPDATE_TASK needed.
    dispatch({ type: 'TOGGLE_COMPLETE', payload: task.id });
    setTimeout(() => setJustChecked(false), 300);
  };

  const handleClick = (e) => {
    if (isEditing) return;

    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+click: toggle individual selection
      e.preventDefault();
      dispatch({ type: 'TOGGLE_SELECT_TASK', payload: task.id });
    } else if (e.shiftKey && filteredTasks) {
      // Shift+click: range select
      e.preventDefault();
      const lastSelected = state.selectedTaskIds.length > 0
        ? state.selectedTaskIds[state.selectedTaskIds.length - 1]
        : state.selectedTaskId;

      const lastIdx = lastSelected ? filteredTasks.findIndex(t => t.id === lastSelected) : -1;
      if (lastIdx !== -1) {
        // A negative start index here (e.g. if the anchor task had since been
        // filtered/searched out of view) would make Array.slice count from the END
        // of the array instead of doing nothing, silently selecting a bogus range.
        const curIdx = filteredTasks.findIndex(t => t.id === task.id);
        const start = Math.min(lastIdx, curIdx);
        const end = Math.max(lastIdx, curIdx);
        const rangeIds = filteredTasks.slice(start, end + 1).map(t => t.id);
        dispatch({ type: 'RANGE_SELECT_TASKS', payload: rangeIds });
      } else {
        dispatch({ type: 'TOGGLE_SELECT_TASK', payload: task.id });
      }
    } else {
      // Normal click: open detail panel, clear multi-select
      dispatch({ type: 'SELECT_TASK', payload: task.id });
    }
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editTitle.trim() && editTitle !== task.title) {
      dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, updates: { title: editTitle.trim() } } });
    } else {
      setEditTitle(task.title);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
    if (e.key === 'Escape') {
      setEditTitle(task.title);
      setIsEditing(false);
    }
  };

  const taskTags = task.tags
    .map(tagId => state.tags.find(t => t.id === tagId))
    .filter(Boolean);

  const renderTitle = () => {
    const title = task.title || 'New Task';
    if (isSearchHighlighted && fullState.highlightedQuery) {
      const q = fullState.highlightedQuery;
      const idx = title.toLowerCase().indexOf(q.toLowerCase());
      if (idx !== -1) {
        return (
          <>
            {title.slice(0, idx)}
            <mark className={theme === 'dark' ? 'bg-blue-500/40 text-white rounded-sm' : 'bg-yellow-200 text-gray-900 rounded-sm'}>
              {title.slice(idx, idx + q.length)}
            </mark>
            {title.slice(idx + q.length)}
          </>
        );
      }
    }
    return title;
  };

  // Render the checkbox/status indicator
  const renderCheckbox = () => {
    if (isInProgress && !task.completed) {
      return (
        <div
          onClick={handleToggle}
          className={`flex-shrink-0 w-[18px] h-[18px] rounded-[4px] flex items-center justify-center cursor-pointer
            bg-accent-blue transition-all duration-200 ${justChecked ? 'animate-check-pop' : ''}`}
          title="In progress"
        >
          <Minus size={12} className="text-white" strokeWidth={3} />
        </div>
      );
    }

    return (
      <div
        className={`flex-shrink-0 w-[18px] h-[18px] flex items-center justify-center ${justChecked ? 'animate-check-pop' : ''}`}
        onClick={handleToggle}
      >
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => {}}
          className="task-checkbox"
        />
      </div>
    );
  };

  return (
    <div
      ref={rowRef}
      onClick={handleClick}
      className={`group flex items-center gap-0 px-2 py-0.5 border-b cursor-pointer
        transition-all duration-200 select-none relative
        ${isDragging ? 'opacity-40' : ''}
        ${isSearchHighlighted ? 'animate-search-highlight' : ''}
        ${theme === 'dark' ? 'border-navy-800/50' : 'border-gray-100'}`}
    >
      {/* Drop indicator line */}
      {isDropTarget && dropPosition === 'above' && (
        <div className="absolute -top-[1.5px] left-0 right-0 h-[3px] bg-accent-blue rounded-full z-10 pointer-events-none" />
      )}
      {isDropTarget && dropPosition === 'below' && (
        <div className="absolute -bottom-[1.5px] left-0 right-0 h-[3px] bg-accent-blue rounded-full z-10 pointer-events-none" />
      )}

      {/* Drag handle - outside the highlight area */}
      <div
        {...dragHandleProps}
        className={`flex-shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100
          transition-opacity duration-150 p-1
          ${theme === 'dark' ? 'text-navy-500 hover:text-navy-300' : 'text-gray-300 hover:text-gray-500'}`}
        title="Drag to reorder"
      >
        <GripVertical size={16} className="pointer-events-none" />
      </div>

      {/* Inner content area with rounded hover highlight */}
      <div className={`flex-1 flex items-center gap-3 px-4 py-2.5 rounded-lg min-w-0
        transition-colors duration-200
        ${isMultiSelected
          ? theme === 'dark'
            ? 'bg-accent-blue/15'
            : 'bg-blue-100/60'
          : isSelected
            ? theme === 'dark'
              ? 'bg-navy-800/80'
              : 'bg-blue-50/80'
            : theme === 'dark'
              ? 'hover:bg-navy-800/40'
              : 'hover:bg-gray-50'
        }`}
      >
      {/* Checkbox / Status Indicator */}
      {renderCheckbox()}

      {/* Title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <input
              ref={inputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className={`w-full bg-transparent border-none outline-none text-sm font-medium
                ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            />
          ) : (
            <>
              <span
                onDoubleClick={handleDoubleClick}
                className={`text-sm font-medium truncate
                  ${!task.title
                    ? theme === 'dark'
                      ? 'text-navy-500 italic'
                      : 'text-gray-400 italic'
                    : task.completed
                      ? theme === 'dark'
                        ? 'text-navy-500'
                        : 'text-gray-400'
                      : theme === 'dark'
                        ? 'text-white'
                        : 'text-gray-900'
                  }`}
              >
                {renderTitle()}
              </span>
              {/* Edit button on hover - hide during multi-select */}
              {state.selectedTaskIds.length === 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                  className={`opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1 rounded cursor-pointer
                    ${theme === 'dark'
                      ? 'text-navy-400 hover:text-white hover:bg-navy-700'
                      : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'
                    }`}
                  title="Edit title"
                >
                  <Pencil size={13} />
                </button>
              )}
            </>
          )}

          {/* Inline tags */}
          {taskTags.length > 0 && (
            <div className="flex gap-1.5 flex-shrink-0">
              {taskTags.map(tag => {
                const hex = resolveTagColor(tag.color);
                return (
                <span
                  key={tag.id}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide"
                  style={{
                    backgroundColor: `${hex}26`,
                    color: hex,
                  }}
                >
                  {tag.name}
                </span>
              );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Due date or Add Due date */}
      <div className="relative flex-shrink-0">
        {task.dueDate ? (
          <button
            onClick={(e) => { e.stopPropagation(); setIsAddingDate(!isAddingDate); }}
            className={`text-sm font-medium cursor-pointer transition-colors rounded px-2 py-0.5
              ${task.completed
                ? theme === 'dark' ? 'text-navy-500 hover:bg-navy-700' : 'text-gray-400 hover:bg-gray-100'
                : 'text-accent-blue hover:bg-accent-blue/10'
              }`}
          >
            {format(new Date(task.dueDate + 'T00:00:00'), 'MMM d, yyyy')}
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setIsAddingDate(true); }}
            className={`opacity-0 group-hover:opacity-100 flex items-center gap-1.5 text-xs
              transition-opacity duration-150 px-2 py-1 rounded cursor-pointer
              ${theme === 'dark'
                ? 'text-navy-400 hover:text-white hover:bg-navy-700'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'
              }`}
            title="Add Due Date"
          >
            <CalendarPlus size={13} />
            Add Due Date
          </button>
        )}
        {isAddingDate && (
          <CustomCalendar
            value={task.dueDate}
            onChange={(val) => {
              dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, updates: { dueDate: val } } });
              setIsAddingDate(false);
            }}
            onClose={handleCalendarClose}
            theme={theme}
            position="right"
          />
        )}
      </div>
      </div>
    </div>
  );
}
