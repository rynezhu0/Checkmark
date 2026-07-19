import { createContext, useContext, useReducer, useEffect, useMemo } from 'react';

const TaskContext = createContext();

// ─── Color helpers ────────────────────────────────────
const NAMED_COLOR_TO_HEX = {
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  purple: '#a855f7',
  pink: '#ec4899',
  orange: '#f97316',
  teal: '#14b8a6',
};

export function resolveTagColor(color) {
  if (!color) return '#3b82f6';
  if (color.startsWith('#')) return color;
  return NAMED_COLOR_TO_HEX[color] || '#3b82f6';
}

export function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function stripFontSize(html) {
  if (!html) return '';
  return html
    .replace(/font-size\s*:\s*[^;"]+;?/gi, '')
    .replace(/style\s*=\s*"\s*"/gi, '')
    .replace(/\bsize\s*=\s*"[^"]*"/gi, '')
    .replace(/\bsize\s*=\s*'[^']*'/gi, '');
}

function migrateTags(tags) {
  return tags.map(tag => ({
    ...tag,
    color: resolveTagColor(tag.color),
  }));
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ─── Default list template ───────────────────────────
const DEFAULT_TAGS = [
  { id: 'tag-work', name: 'Work', color: '#3b82f6' },
  { id: 'tag-personal', name: 'Personal', color: '#22c55e' },
  { id: 'tag-planning', name: 'Planning', color: '#a855f7' },
  { id: 'tag-research', name: 'Research', color: '#eab308' },
  { id: 'tag-urgent', name: 'Urgent', color: '#ef4444' },
];

function createNewList(title = 'New List', clipboardId = null) {
  const id = generateId();
  return {
    id,
    title,
    subtitle: '',
    pinned: false,
    clipboardId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: [],
    tags: DEFAULT_TAGS.map(t => ({ ...t, id: generateId() })),
    sortBy: 'created',
    filterCompleted: 'all',
    filterTag: null,
    searchQuery: '',
  };
}

// ─── Initial state ───────────────────────────────────
const firstList = createNewList('Todo List');
firstList.subtitle = 'Stay organized with tasks, your way.';

const initialState = {
  lists: [firstList],
  clipboards: [],
  activeListId: firstList.id,
  activeView: { type: 'list' }, // 'list' | 'clipboards' | { type: 'clipboard', id: '...' }
  selectedTaskId: null,
  selectedTaskIds: [],
  // Undo / redo
  undoStack: [],
  redoStack: [],
  // Ephemeral search-result highlight — never persisted, cleared on the next interaction
  highlightedTaskId: null,
  highlightedQuery: null,
};

// ─── Undo/redo helpers ───────────────────────────────
const MAX_UNDO = 50;

// Snapshot only the data we want to undo (exclude undo/redo stacks themselves)
function snapshot(state) {
  return {
    lists: JSON.parse(JSON.stringify(state.lists)),
    clipboards: JSON.parse(JSON.stringify(state.clipboards)),
    activeListId: state.activeListId,
    activeView: state.activeView,
    selectedTaskId: state.selectedTaskId,
    selectedTaskIds: [...state.selectedTaskIds],
  };
}

function pushUndo(state) {
  const snap = snapshot(state);
  const stack = [...state.undoStack, snap];
  if (stack.length > MAX_UNDO) stack.shift();
  return { undoStack: stack, redoStack: [] };
}

// ─── Active-list helper ──────────────────────────────
function updateActiveList(state, updater) {
  return {
    ...state,
    lists: state.lists.map(l =>
      l.id === state.activeListId
        ? { ...updater(l), updatedAt: new Date().toISOString() }
        : l
    ),
  };
}

// ─── Reducer ─────────────────────────────────────────
function taskReducer(state, action) {
  switch (action.type) {

    // ── Undo / Redo ─────────────────────────────────
    case 'UNDO': {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      const newUndo = state.undoStack.slice(0, -1);
      const snap = snapshot(state);
      return {
        ...state,
        ...prev,
        undoStack: newUndo,
        redoStack: [...state.redoStack, snap],
      };
    }
    case 'REDO': {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      const newRedo = state.redoStack.slice(0, -1);
      const snap = snapshot(state);
      return {
        ...state,
        ...next,
        undoStack: [...state.undoStack, snap],
        redoStack: newRedo,
      };
    }

    // ── List management ─────────────────────────────
    case 'CREATE_LIST': {
      const undo = pushUndo(state);
      const newList = createNewList(action.payload?.title || 'New List', action.payload?.clipboardId || null);
      return {
        ...state,
        ...undo,
        lists: [...state.lists, newList],
        activeListId: newList.id,
        activeView: { type: 'list' },
        selectedTaskId: null,
        selectedTaskIds: [],
      };
    }
    case 'DELETE_LIST': {
      const undo = pushUndo(state);
      const listId = action.payload;
      const remaining = state.lists.filter(l => l.id !== listId);
      // If deleting the active list, switch to another
      let newActiveId = state.activeListId;
      if (state.activeListId === listId) {
        newActiveId = remaining.length > 0 ? remaining[0].id : null;
      }
      // If no lists remain, create a fresh one
      if (remaining.length === 0) {
        const fresh = createNewList('Todo List');
        fresh.subtitle = 'Stay organized with tasks, your way.';
        return {
          ...state,
          ...undo,
          lists: [fresh],
          activeListId: fresh.id,
          selectedTaskId: null,
          selectedTaskIds: [],
        };
      }
      return {
        ...state,
        ...undo,
        lists: remaining,
        activeListId: newActiveId,
        selectedTaskId: state.activeListId === listId ? null : state.selectedTaskId,
        selectedTaskIds: state.activeListId === listId ? [] : state.selectedTaskIds,
      };
    }
    case 'RENAME_LIST': {
      const undo = pushUndo(state);
      const { id, title } = action.payload;
      return {
        ...state,
        ...undo,
        lists: state.lists.map(l =>
          l.id === id ? { ...l, title, updatedAt: new Date().toISOString() } : l
        ),
      };
    }
    case 'UPDATE_LIST': {
      const undo = pushUndo(state);
      const { id: listId, updates } = action.payload;
      return {
        ...state,
        ...undo,
        lists: state.lists.map(l =>
          l.id === listId ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l
        ),
      };
    }
    case 'PIN_LIST': {
      const undo = pushUndo(state);
      return {
        ...state,
        ...undo,
        lists: state.lists.map(l =>
          l.id === action.payload ? { ...l, pinned: true } : l
        ),
      };
    }
    case 'UNPIN_LIST': {
      const undo = pushUndo(state);
      return {
        ...state,
        ...undo,
        lists: state.lists.map(l =>
          l.id === action.payload ? { ...l, pinned: false } : l
        ),
      };
    }
    case 'SET_ACTIVE_LIST': {
      return {
        ...state,
        activeListId: action.payload,
        activeView: { type: 'list' },
        selectedTaskId: null,
        selectedTaskIds: [],
      };
    }
    case 'SET_VIEW': {
      return {
        ...state,
        activeView: action.payload,
      };
    }
    case 'MOVE_TO_CLIPBOARD': {
      const undo = pushUndo(state);
      const { listId, clipboardId } = action.payload;
      return {
        ...state,
        ...undo,
        lists: state.lists.map(l =>
          l.id === listId ? { ...l, clipboardId, updatedAt: new Date().toISOString() } : l
        ),
        clipboards: state.clipboards.map(c =>
          c.id === clipboardId ? { ...c, updatedAt: new Date().toISOString() } : c
        ),
      };
    }
    case 'REMOVE_FROM_CLIPBOARD': {
      const undo = pushUndo(state);
      const removeListId = action.payload;
      const theList = state.lists.find(l => l.id === removeListId);
      const cbId = theList?.clipboardId;
      return {
        ...state,
        ...undo,
        lists: state.lists.map(l =>
          l.id === removeListId ? { ...l, clipboardId: null, updatedAt: new Date().toISOString() } : l
        ),
        clipboards: cbId ? state.clipboards.map(c =>
          c.id === cbId ? { ...c, updatedAt: new Date().toISOString() } : c
        ) : state.clipboards,
      };
    }

    // ── Clipboard management ────────────────────────
    case 'CREATE_CLIPBOARD': {
      const undo = pushUndo(state);
      const newCb = {
        id: action.payload?.id || generateId(),
        name: action.payload?.name || 'New Clipboard',
        color: action.payload?.color || '#3b82f6',
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { ...state, ...undo, clipboards: [...state.clipboards, newCb] };
    }
    case 'DELETE_CLIPBOARD': {
      const undo = pushUndo(state);
      const cbId = action.payload;
      return {
        ...state,
        ...undo,
        clipboards: state.clipboards.filter(c => c.id !== cbId),
        // Un-assign lists from this clipboard
        lists: state.lists.map(l =>
          l.clipboardId === cbId ? { ...l, clipboardId: null } : l
        ),
      };
    }
    case 'RENAME_CLIPBOARD': {
      const undo = pushUndo(state);
      const { id: cbId, name } = action.payload;
      return {
        ...state,
        ...undo,
        clipboards: state.clipboards.map(c =>
          c.id === cbId ? { ...c, name, updatedAt: new Date().toISOString() } : c
        ),
      };
    }
    case 'SET_CLIPBOARD_COLOR': {
      const { id: cbId, color } = action.payload;
      // No pushUndo — this dispatches on every color-picker drag frame, and pushUndo's
      // deep clone would flood undo history and lag the drag. updatedAt is left alone
      // too, so recoloring doesn't bump a clipboard to the top of a recency sort.
      return {
        ...state,
        clipboards: state.clipboards.map(c =>
          c.id === cbId ? { ...c, color } : c
        ),
      };
    }
    case 'PIN_CLIPBOARD': {
      const undo = pushUndo(state);
      return {
        ...state,
        ...undo,
        clipboards: state.clipboards.map(c =>
          c.id === action.payload ? { ...c, pinned: true } : c
        ),
      };
    }
    case 'UNPIN_CLIPBOARD': {
      const undo = pushUndo(state);
      return {
        ...state,
        ...undo,
        clipboards: state.clipboards.map(c =>
          c.id === action.payload ? { ...c, pinned: false } : c
        ),
      };
    }

    // ── Task actions (operate on active list) ───────
    case 'ADD_TASK': {
      const undo = pushUndo(state);
      const newTask = {
        id: generateId(),
        title: action.payload.title ?? '',
        description: '',
        completed: false,
        tags: [],
        startDate: new Date().toISOString().split('T')[0],
        dueDate: null,
        createdAt: new Date().toISOString(),
        status: 'not_started',
      };
      return { ...updateActiveList({ ...state, ...undo }, l => ({ ...l, tasks: [...l.tasks, newTask] })) };
    }
    case 'ADD_AND_SELECT_TASK': {
      const undo = pushUndo(state);
      const newTask = {
        id: generateId(),
        title: action.payload.title ?? '',
        description: '',
        completed: false,
        tags: [],
        startDate: new Date().toISOString().split('T')[0],
        dueDate: null,
        createdAt: new Date().toISOString(),
        status: 'not_started',
      };
      const updated = updateActiveList({ ...state, ...undo }, l => ({
        ...l,
        tasks: [...l.tasks, newTask],
        filterCompleted: 'all',
      }));
      return { ...updated, selectedTaskId: newTask.id };
    }
    case 'UPDATE_TASK': {
      // No undo push for real-time typing updates (title, description)
      return updateActiveList(state, l => ({
        ...l,
        tasks: l.tasks.map(t =>
          t.id === action.payload.id ? { ...t, ...action.payload.updates } : t
        ),
      }));
    }
    case 'TOGGLE_COMPLETE': {
      const undo = pushUndo(state);
      const s = { ...state, ...undo };
      return updateActiveList(s, l => ({
        ...l,
        tasks: l.tasks.map(t =>
          t.id === action.payload
            ? { ...t, completed: !t.completed, status: !t.completed ? 'done' : 'not_started' }
            : t
        ),
      }));
    }
    case 'DELETE_TASK': {
      const undo = pushUndo(state);
      const s = { ...state, ...undo };
      const result = updateActiveList(s, l => ({
        ...l,
        tasks: l.tasks.filter(t => t.id !== action.payload),
      }));
      return {
        ...result,
        selectedTaskId: state.selectedTaskId === action.payload ? null : state.selectedTaskId,
      };
    }
    case 'DELETE_COMPLETED': {
      const undo = pushUndo(state);
      const s = { ...state, ...undo };
      const activeList = s.lists.find(l => l.id === s.activeListId);
      const completedIds = activeList ? activeList.tasks.filter(t => t.completed).map(t => t.id) : [];
      const result = updateActiveList(s, l => ({
        ...l,
        tasks: l.tasks.filter(t => !t.completed),
      }));
      return {
        ...result,
        selectedTaskId: completedIds.includes(state.selectedTaskId) ? null : state.selectedTaskId,
      };
    }
    case 'SELECT_TASK': {
      return { ...state, selectedTaskId: action.payload, selectedTaskIds: [] };
    }
    case 'TOGGLE_SELECT_TASK': {
      const id = action.payload;
      const ids = state.selectedTaskIds.includes(id)
        ? state.selectedTaskIds.filter(i => i !== id)
        : [...state.selectedTaskIds, id];
      return { ...state, selectedTaskIds: ids, selectedTaskId: null };
    }
    case 'RANGE_SELECT_TASKS': {
      return { ...state, selectedTaskIds: action.payload, selectedTaskId: null };
    }
    case 'CLEAR_SELECTION': {
      return { ...state, selectedTaskIds: [] };
    }
    case 'DELETE_SELECTED': {
      const undo = pushUndo(state);
      const idsToDelete = state.selectedTaskIds;
      const s = { ...state, ...undo };
      const result = updateActiveList(s, l => ({
        ...l,
        tasks: l.tasks.filter(t => !idsToDelete.includes(t.id)),
      }));
      return {
        ...result,
        selectedTaskIds: [],
        selectedTaskId: idsToDelete.includes(state.selectedTaskId) ? null : state.selectedTaskId,
      };
    }
    case 'DUPLICATE_SELECTED': {
      const undo = pushUndo(state);
      const s = { ...state, ...undo };
      return {
        ...updateActiveList(s, l => {
          const orderedIds = [...state.selectedTaskIds].sort(
            (a, b) => l.tasks.findIndex(t => t.id === a) - l.tasks.findIndex(t => t.id === b)
          );
          const newTasks = orderedIds
            .map(id => l.tasks.find(t => t.id === id))
            .filter(Boolean)
            .map(t => ({ ...t, id: generateId(), createdAt: new Date().toISOString() }));
          return { ...l, tasks: [...l.tasks, ...newTasks] };
        }),
        selectedTaskIds: [],
      };
    }
    case 'DUPLICATE_COPIED': {
      const undo = pushUndo(state);
      const copiedIds = action.payload;
      const s = { ...state, ...undo };
      return updateActiveList(s, l => {
        const orderedCopied = [...copiedIds].sort(
          (a, b) => l.tasks.findIndex(t => t.id === a) - l.tasks.findIndex(t => t.id === b)
        );
        const copiedTasks = orderedCopied
          .map(id => l.tasks.find(t => t.id === id))
          .filter(Boolean)
          .map(t => ({ ...t, id: generateId(), createdAt: new Date().toISOString() }));
        if (copiedTasks.length === 0) return l;
        return { ...l, tasks: [...l.tasks, ...copiedTasks] };
      });
    }
    case 'SET_SORT': {
      return updateActiveList(state, l => ({ ...l, sortBy: action.payload }));
    }
    case 'SET_FILTER_COMPLETED': {
      return updateActiveList(state, l => ({ ...l, filterCompleted: action.payload }));
    }
    case 'SET_FILTER_TAG': {
      return updateActiveList(state, l => ({ ...l, filterTag: action.payload }));
    }
    case 'SET_SEARCH': {
      return updateActiveList(state, l => ({ ...l, searchQuery: action.payload }));
    }
    case 'ADD_TAG': {
      const undo = pushUndo(state);
      const payload = action.payload;
      const name = typeof payload === 'string' ? payload : payload.name;
      const color = typeof payload === 'string' ? '#3b82f6' : (payload.color || '#3b82f6');
      const newTag = { id: generateId(), name, color };
      return updateActiveList({ ...state, ...undo }, l => ({
        ...l,
        tags: [...l.tags, newTag],
      }));
    }
    case 'DELETE_TAG': {
      const undo = pushUndo(state);
      return updateActiveList({ ...state, ...undo }, l => ({
        ...l,
        tags: l.tags.filter(t => t.id !== action.payload),
        tasks: l.tasks.map(t => ({
          ...t,
          tags: t.tags.filter(tagId => tagId !== action.payload),
        })),
        // Clear the filter too if it was pointing at this tag, or the list would stay
        // filtered against an id nothing has anymore and show zero tasks.
        filterTag: l.filterTag === action.payload ? null : l.filterTag,
      }));
    }
    case 'REORDER_TASK': {
      const { fromIndex, toIndex } = action.payload;
      // A negative index would make splice() count from the end instead of no-op'ing.
      if (fromIndex < 0 || toIndex < 0) return state;
      const undo = pushUndo(state);
      return updateActiveList({ ...state, ...undo }, l => {
        if (fromIndex >= l.tasks.length || toIndex >= l.tasks.length) return l;
        const tasks = [...l.tasks];
        const [moved] = tasks.splice(fromIndex, 1);
        tasks.splice(toIndex, 0, moved);
        return { ...l, tasks };
      });
    }
    case 'REORDER_TASKS_GROUP': {
      const undo = pushUndo(state);
      const { taskIds, targetTaskId, position } = action.payload;
      const idSet = new Set(taskIds);
      if (idSet.has(targetTaskId)) return state;
      return updateActiveList({ ...state, ...undo }, l => {
        const moving = taskIds.map(id => l.tasks.find(t => t.id === id)).filter(Boolean);
        const remaining = l.tasks.filter(t => !idSet.has(t.id));
        const targetIndex = remaining.findIndex(t => t.id === targetTaskId);
        if (targetIndex === -1) return l;
        const insertAt = position === 'below' ? targetIndex + 1 : targetIndex;
        const tasks = [...remaining];
        tasks.splice(insertAt, 0, ...moving);
        return { ...l, tasks };
      });
    }
    case 'SET_HIGHLIGHT': {
      return { ...state, highlightedTaskId: action.payload.taskId, highlightedQuery: action.payload.query };
    }
    case 'CLEAR_HIGHLIGHT': {
      if (!state.highlightedTaskId) return state;
      return { ...state, highlightedTaskId: null, highlightedQuery: null };
    }
    case 'LOAD_STATE': {
      return action.payload;
    }
    default:
      return state;
  }
}

// ─── Sorting / filtering (operates on active list) ──
function getSortedFilteredTasks(activeList) {
  if (!activeList) return [];
  let filtered = [...activeList.tasks];

  if (activeList.filterCompleted === 'active') {
    filtered = filtered.filter(t => !t.completed);
  } else if (activeList.filterCompleted === 'completed') {
    filtered = filtered.filter(t => t.completed);
  }

  if (activeList.filterTag) {
    filtered = filtered.filter(t => t.tags.includes(activeList.filterTag));
  }

  if (activeList.searchQuery) {
    const q = activeList.searchQuery.toLowerCase();
    filtered = filtered.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    );
  }

  switch (activeList.sortBy) {
    case 'dueDate':
      filtered.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
      break;
    case 'startDate':
      filtered.sort((a, b) => {
        if (!a.startDate && !b.startDate) return 0;
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return new Date(a.startDate) - new Date(b.startDate);
      });
      break;
    case 'alphabetical':
      filtered.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'created':
    default:
      break;
  }

  return filtered;
}

// ─── Global search across every list's tasks ────────
export function searchAllTasks(lists, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results = [];
  for (const list of lists || []) {
    for (const task of list.tasks || []) {
      const title = task.title || '';
      const description = task.description || '';
      const titleMatch = title.toLowerCase().includes(q);
      const descMatch = description.toLowerCase().includes(q);
      if (titleMatch || descMatch) {
        results.push({
          listId: list.id,
          listTitle: stripHtml(list.title) || 'Untitled',
          task,
          matchIn: titleMatch ? 'title' : 'description',
        });
      }
    }
  }
  return results;
}

// ─── Migration: old single-list format → multi-list ─
function migrateFromLegacy(saved) {
  // Old format had { tasks: [], tags: [] } at root
  if (saved.tasks && !saved.lists) {
    const list = createNewList('Todo List');
    list.subtitle = 'Stay organized with tasks, your way.';
    list.tasks = saved.tasks || [];
    list.tags = migrateTags(saved.tags || DEFAULT_TAGS);
    return {
      ...initialState,
      lists: [list],
      activeListId: list.id,
    };
  }
  // New format — migrate tags in each list
  if (saved.lists) {
    return {
      ...initialState,
      ...saved,
      lists: saved.lists.map(l => ({
        ...l,
        tags: migrateTags(l.tags || []),
      })),
      clipboards: (saved.clipboards || []).map(c => ({
        ...c,
        pinned: c.pinned ?? false,
        color: c.color || '#3b82f6',
        updatedAt: c.updatedAt || c.createdAt || new Date().toISOString(),
      })),
      activeView: saved.activeView || { type: 'list' },
      // Always reset undo/redo on load
      undoStack: [],
      redoStack: [],
    };
  }
  return initialState;
}

// ─── Provider ────────────────────────────────────────
export function TaskProvider({ children }) {
  const [state, dispatch] = useReducer(taskReducer, initialState, () => {
    const saved = localStorage.getItem('checkmark-data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return migrateFromLegacy(parsed);
      } catch (e) {
        console.error('Failed to load saved data:', e);
      }
    }
    return initialState;
  });

  // Persist to localStorage with a debounce (exclude undo/redo stacks) to prevent lag during dragging operations
  useEffect(() => {
    const timer = setTimeout(() => {
      const toSave = {
        lists: state.lists,
        clipboards: state.clipboards,
        activeListId: state.activeListId,
        activeView: state.activeView,
      };
      localStorage.setItem('checkmark-data', JSON.stringify(toSave));
    }, 200);
    return () => clearTimeout(timer);
  }, [state.lists, state.clipboards, state.activeListId, state.activeView]);

  // Derived data from active list
  const activeList = useMemo(
    () => state.lists.find(l => l.id === state.activeListId) || null,
    [state.lists, state.activeListId]
  );

  const filteredTasks = useMemo(
    () => getSortedFilteredTasks(activeList),
    [activeList]
  );

  const selectedTask = useMemo(
    () => (activeList ? activeList.tasks.find(t => t.id === state.selectedTaskId) || null : null),
    [activeList, state.selectedTaskId]
  );

  // Expose a flat "state" object that looks similar to the old shape for TaskList/TaskItem compatibility
  const compatState = useMemo(() => ({
    tasks: activeList?.tasks || [],
    tags: activeList?.tags || [],
    selectedTaskId: state.selectedTaskId,
    selectedTaskIds: state.selectedTaskIds,
    sortBy: activeList?.sortBy || 'created',
    filterCompleted: activeList?.filterCompleted || 'all',
    filterTag: activeList?.filterTag || null,
    searchQuery: activeList?.searchQuery || '',
  }), [activeList, state.selectedTaskId, state.selectedTaskIds]);

  return (
    <TaskContext.Provider value={{
      state: compatState,
      fullState: state,
      dispatch,
      filteredTasks,
      selectedTask,
      activeList,
      activeView: state.activeView,
    }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) throw new Error('useTasks must be used within TaskProvider');
  return context;
}
