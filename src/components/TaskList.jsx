import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useTasks, resolveTagColor, stripHtml } from '../context/TaskContext';
import TaskItem from './TaskItem';
import ColorPicker from './ColorPicker';
import { CheckboxCheckedIcon, CheckboxUncheckedIcon } from './Icons';
import { Plus, ArrowUpDown, Filter, Search, Trash2, ListChecks, X, Pencil, CalendarPlus, Copy, Bold, Italic, Underline, Type, Palette, ChevronDown } from 'lucide-react';

// Remove leftover empty formatting elements (e.g. a <span style="font-size:96px"></span>
// left behind after its text was deleted) — an empty node with a huge inline font-size
// still contributes its line-height to the container, inflating its height even though
// there's no visible text left.
function pruneEmptyFormattingNodes(el) {
  if (!el) return;
  el.querySelectorAll('span, b, i, u, strong, em, font').forEach(node => {
    if (node.textContent.length === 0) {
      node.remove();
    }
  });
}

// After the last character is deleted from a contenteditable element, Chrome (and other
// browsers) leave a stray <br> behind to give the cursor somewhere to sit. That leftover
// child means the element no longer matches the CSS `:empty` selector the placeholder
// text relies on, so the placeholder silently stops showing. Clear it back to a true
// empty state so `:empty` — and the placeholder — keep working.
function normalizeEmptyEditable(el) {
  if (el && el.textContent === '' && el.innerHTML !== '') {
    el.innerHTML = '';
  }
}

export default function TaskList() {
  const { theme } = useTheme();
  const { state, dispatch, filteredTasks, activeList } = useTasks();
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const headerTitleRef = useRef(null);
  const headerSubtitleRef = useRef(null);
  const headerTextWrapperRef = useRef(null);
  const sortRef = useRef(null);
  const filterRef = useRef(null);
  const prevListIdRef = useRef(null);
  const rootRef = useRef(null);
  const toolbarRef = useRef(null);
  const savedRangeRef = useRef(null);
  const isInteractingWithToolbar = useRef(false);

  // Text formatting selection states
  const [selectionRect, setSelectionRect] = useState(null);
  // Per-line client rects for the active selection, used to paint a fake highlight
  // that stays visible even after focus moves into a toolbar control (native
  // contenteditable selection highlight disappears once the element loses focus).
  const [selectionRects, setSelectionRects] = useState([]);
  const [activeEditable, setActiveEditable] = useState(null); // 'title' | 'subtitle' | null
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [fontSizeVal, setFontSizeVal] = useState(14);
  const [currentColor, setCurrentColor] = useState('#3b82f6');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  const completedCount = state.tasks.filter(t => t.completed).length;
  const totalCount = state.tasks.length;

  // Drag-and-drop state
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [draggedGroupIds, setDraggedGroupIds] = useState(null); // set when dragging a multi-selection as a block
  const [dropTargetId, setDropTargetId] = useState(null);
  const [dropPosition, setDropPosition] = useState(null); // 'above' or 'below'

  const canDrag = state.sortBy === 'created'; // Only allow reorder in default sort

  // Marquee / lasso selection state
  const taskListRef = useRef(null);
  const taskRowRefs = useRef({});
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const marqueeStartRef = useRef(null); // tracks pending drag before threshold
  const didMarqueeRef = useRef(false); // prevents click after marquee

  // Helper: check if two rectangles overlap
  const rectsOverlap = (r1, r2) => {
    return !(r1.right < r2.left || r1.left > r2.right || r1.bottom < r2.top || r1.top > r2.bottom);
  };

  // Compute the selection box in viewport coordinates
  const getSelectionRect = useCallback(() => {
    if (!selectionStart || !selectionEnd) return null;
    return {
      left: Math.min(selectionStart.x, selectionEnd.x),
      top: Math.min(selectionStart.y, selectionEnd.y),
      right: Math.max(selectionStart.x, selectionEnd.x),
      bottom: Math.max(selectionStart.y, selectionEnd.y),
    };
  }, [selectionStart, selectionEnd]);

  // Marquee mouse handlers - threshold-based to coexist with clicks
  const handleMarqueeMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    // Don't start if on interactive elements
    const target = e.target;
    if (target.closest('button') || target.closest('input') || target.closest('[draggable="true"]') || target.closest('[contenteditable]')) return;

    // Store the start point; we'll activate the marquee only after a drag threshold
    marqueeStartRef.current = { x: e.clientX, y: e.clientY };
    didMarqueeRef.current = false;
  }, []);

  useEffect(() => {
    const THRESHOLD = 5;

    const handleMouseMove = (e) => {
      // If we have a pending start but haven't activated marquee yet, check threshold
      if (marqueeStartRef.current && !isSelecting) {
        const dx = e.clientX - marqueeStartRef.current.x;
        const dy = e.clientY - marqueeStartRef.current.y;
        if (Math.abs(dx) > THRESHOLD || Math.abs(dy) > THRESHOLD) {
          setIsSelecting(true);
          setSelectionStart(marqueeStartRef.current);
          setSelectionEnd({ x: e.clientX, y: e.clientY });
          dispatch({ type: 'CLEAR_SELECTION' });
          didMarqueeRef.current = true;
        }
        return;
      }

      if (!isSelecting) return;

      setSelectionEnd({ x: e.clientX, y: e.clientY });

      // Clamp coordinates to task list container
      const containerRect = taskListRef.current?.getBoundingClientRect();
      const clampedStartY = containerRect ? Math.max(selectionStart.y, containerRect.top) : selectionStart.y;
      const clampedEndY = containerRect ? Math.max(e.clientY, containerRect.top) : e.clientY;

      // Compute which tasks are inside the selection box
      const selRect = {
        left: Math.min(selectionStart.x, e.clientX),
        top: Math.min(clampedStartY, clampedEndY),
        right: Math.max(selectionStart.x, e.clientX),
        bottom: Math.max(clampedStartY, clampedEndY),
      };

      const selectedIds = [];
      for (const task of filteredTasks) {
        const el = taskRowRefs.current[task.id];
        if (el) {
          const rowRect = el.getBoundingClientRect();
          if (rectsOverlap(selRect, rowRect)) {
            selectedIds.push(task.id);
          }
        }
      }
      if (selectedIds.length > 0) {
        dispatch({ type: 'RANGE_SELECT_TASKS', payload: selectedIds });
      } else {
        dispatch({ type: 'CLEAR_SELECTION' });
      }
    };

    const handleMouseUp = () => {
      marqueeStartRef.current = null;
      if (isSelecting) {
        setIsSelecting(false);
        setSelectionStart(null);
        setSelectionEnd(null);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSelecting, selectionStart, filteredTasks, dispatch]);



  // Rgb to Hex helper
  const rgbToHex = (rgbStr) => {
    if (!rgbStr) return '#3b82f6';
    if (rgbStr.startsWith('#')) return rgbStr;
    const match = rgbStr.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0], 10);
      const g = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }
    return '#3b82f6';
  };

  // Recompute the fake-highlight rects + saved range from a live Range, keeping the
  // toolbar's anchor and the visible "selection" overlay in sync with the real DOM.
  const syncSelectionVisuals = (range) => {
    setSelectionRect(range.getBoundingClientRect());
    setSelectionRects(Array.from(range.getClientRects()));
    savedRangeRef.current = range.cloneRange();
  };

  // Handle text formatting commands
  const handleFormat = (command, value = null) => {
    document.execCommand(command, false, value);

    // Sync formatting state indicators
    setIsBold(document.queryCommandState('bold'));
    setIsItalic(document.queryCommandState('italic'));
    setIsUnderline(document.queryCommandState('underline'));

    const format = resolveFormatTarget();
    if (activeList && format) {
      if (format.editable === 'title') {
        dispatch({ type: 'UPDATE_LIST', payload: { id: activeList.id, updates: { title: format.targetEl.innerHTML } } });
      } else if (format.editable === 'subtitle') {
        dispatch({ type: 'UPDATE_LIST', payload: { id: activeList.id, updates: { subtitle: format.targetEl.innerHTML } } });
      }
      if (format.editable !== activeEditable) {
        setActiveEditable(format.editable);
      }
    }
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      syncSelectionVisuals(selection.getRangeAt(0));
    }
  };

  // Resolve which field ('title' | 'subtitle') a formatting action should apply to.
  // Prefers the live browser selection, falling back to the last-saved selection/
  // activeEditable state only once the live selection has been dropped (e.g. focus
  // moved into a toolbar <input>).
  const resolveFormatTarget = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      if (headerTitleRef.current?.contains(range.commonAncestorContainer)) {
        return { editable: 'title', targetEl: headerTitleRef.current };
      }
      if (headerSubtitleRef.current?.contains(range.commonAncestorContainer)) {
        return { editable: 'subtitle', targetEl: headerSubtitleRef.current };
      }
    }
    if (activeEditable === 'title' && headerTitleRef.current) {
      return { editable: 'title', targetEl: headerTitleRef.current };
    }
    if (activeEditable === 'subtitle' && headerSubtitleRef.current) {
      return { editable: 'subtitle', targetEl: headerSubtitleRef.current };
    }
    return null;
  };

  // Selection range caching helper
  const restoreSelection = () => {
    if (savedRangeRef.current) {
      const targetEl = resolveFormatTarget()?.targetEl;
      if (targetEl) {
        targetEl.focus(); // CRITICAL: Focus editing element before restoring range!
      }
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(savedRangeRef.current);
    }
  };

  // Custom arbitrary font size application via styleWithCSS spans
  const handleCustomFontSize = (pxSize) => {
    restoreSelection();
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('fontSize', false, '7');
    const format = resolveFormatTarget();
    const targetEl = format?.targetEl;
    const editable = format?.editable;
    if (targetEl) {
      const postExecSelection = window.getSelection();
      const postExecRange = postExecSelection && postExecSelection.rangeCount > 0
        ? postExecSelection.getRangeAt(0)
        : null;
      const spans = targetEl.querySelectorAll('span');
      spans.forEach(span => {
        // Match the span execCommand just created (marked 'xxx-large', or already-computed
        // '48px' in some browsers) plus any span already nested inside it from a previous
        // size change — otherwise the innermost span keeps its old font-size and visually
        // overrides the new value.
        const isFreshSizeSpan = span.style.fontSize === 'xxx-large' || span.style.fontSize === '48px';
        const isNestedInSelection = postExecRange && span.style.fontSize && postExecRange.intersectsNode(span);
        if (isFreshSizeSpan || isNestedInSelection) {
          span.style.fontSize = `${pxSize}px`;
        }
      });
      if (activeList) {
        if (editable === 'title') {
          dispatch({ type: 'UPDATE_LIST', payload: { id: activeList.id, updates: { title: targetEl.innerHTML } } });
        } else if (editable === 'subtitle') {
          dispatch({ type: 'UPDATE_LIST', payload: { id: activeList.id, updates: { subtitle: targetEl.innerHTML } } });
        }
      }
      if (editable && editable !== activeEditable) {
        setActiveEditable(editable);
      }

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        syncSelectionVisuals(selection.getRangeAt(0));
      }
    }
  };

  // Update only state when typing, do not apply style yet
  const handleFontSizeInput = (newVal) => {
    setFontSizeVal(newVal);
  };

  const handleInputFocus = () => {
    // No-op (native selection is retained automatically)
  };

  const handleInputBlur = () => {
    setTimeout(() => {
      const activeEl = document.activeElement;
      const isToolbarFocused = activeEl && toolbarRef.current && toolbarRef.current.contains(activeEl);
      const isHovered = isInteractingWithToolbar.current;
      const selection = window.getSelection();

      if ((!selection || selection.isCollapsed) && !isToolbarFocused && !isHovered) {
        setSelectionRect(null);
        setSelectionRects([]);
        setActiveEditable(null);
        setShowSizeDropdown(false);
        setShowColorDropdown(false);
      }
    }, 150);
  };

  // Apply delta adjustments instantly and clamp between 12 and 96
  const handleFontSizeAdjust = (delta) => {
    const current = parseInt(fontSizeVal, 10);
    if (!isNaN(current)) {
      const next = Math.max(12, Math.min(96, current + delta));
      setFontSizeVal(next);

      const activeEl = document.activeElement;
      const isInputFocused = activeEl && activeEl.tagName === 'INPUT';
      // Named distinctly from the marquee-selection `selectionStart`/`selectionEnd`
      // state above — these are just the font-size input's own text caret position,
      // saved so we can restore it after handleCustomFontSize() steals focus.
      const inputCaretStart = isInputFocused ? activeEl.selectionStart : null;
      const inputCaretEnd = isInputFocused ? activeEl.selectionEnd : null;

      handleCustomFontSize(next);

      if (isInputFocused && activeEl) {
        activeEl.focus();
        if (inputCaretStart !== null && inputCaretEnd !== null) {
          activeEl.setSelectionRange(inputCaretStart, inputCaretEnd);
        }
      }
    }
  };

  const handleColorChange = (hex) => {
    setCurrentColor(hex);

    const activeEl = document.activeElement;
    const isInputFocused = activeEl && activeEl.tagName === 'INPUT';
    const inputCaretStart = isInputFocused ? activeEl.selectionStart : null;
    const inputCaretEnd = isInputFocused ? activeEl.selectionEnd : null;

    restoreSelection();
    handleFormat('foreColor', hex);

    if (isInputFocused && activeEl) {
      activeEl.focus();
      if (inputCaretStart !== null && inputCaretEnd !== null) {
        activeEl.setSelectionRange(inputCaretStart, inputCaretEnd);
      }
    }
  };

  const toggleColorDropdown = () => {
    setShowColorDropdown(!showColorDropdown);
  };

  // Selection change listener for inline formatting menu
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const activeEl = document.activeElement;
      const isToolbarFocused = activeEl && toolbarRef.current && toolbarRef.current.contains(activeEl);
      const isHovered = isInteractingWithToolbar.current;

      if (!selection || ((selection.rangeCount === 0 || selection.isCollapsed) && !isToolbarFocused && !isHovered)) {
        setSelectionRect(null);
        setSelectionRects([]);
        setActiveEditable(null);
        setShowSizeDropdown(false);
        setShowColorDropdown(false);
        return;
      }

      // Focus moved into a toolbar control (e.g. the font-size or hex/RGB inputs) — the
      // browser drops window.getSelection()'s range when a plain <input> takes focus, but
      // we're still actively editing, so keep the toolbar/state as-is rather than clearing it.
      if (selection.rangeCount === 0) return;

      if (!selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const titleEl = headerTitleRef.current;
        const subtitleEl = headerSubtitleRef.current;
        const startNode = range.startContainer;
        const endNode = range.endContainer;

        let isInsideTitle = false;
        let isInsideSubtitle = false;

        if (isToolbarFocused || isHovered) {
          isInsideTitle = activeEditable === 'title';
          isInsideSubtitle = activeEditable === 'subtitle';
        } else {
          // Enforce strict containment: selection must start and end inside the active focused container
          const isFocusedOnTitle = activeEl === titleEl;
          const isFocusedOnSubtitle = activeEl === subtitleEl;
          const isNoFocus = !activeEl || activeEl === document.body;

          isInsideTitle = titleEl && (isFocusedOnTitle || (isNoFocus && titleEl.contains(startNode))) && titleEl.contains(startNode) && titleEl.contains(endNode);
          isInsideSubtitle = subtitleEl && (isFocusedOnSubtitle || (isNoFocus && subtitleEl.contains(startNode))) && subtitleEl.contains(startNode) && subtitleEl.contains(endNode);
        }

        if (isInsideTitle || isInsideSubtitle) {
          const isTitle = isInsideTitle;
          setActiveEditable(isTitle ? 'title' : 'subtitle');
          syncSelectionVisuals(range);

          // Detect active formats
          setIsBold(document.queryCommandState('bold'));
          setIsItalic(document.queryCommandState('italic'));
          setIsUnderline(document.queryCommandState('underline'));

          // Only read computed styles when the toolbar isn't the thing driving the change.
          if (!isToolbarFocused && !isHovered) {
            // Detect size & color of selected text
            let node = range.startContainer;
            if (node && node.nodeType === Node.TEXT_NODE) {
              node = node.parentElement;
            }
            if (node) {
              const style = window.getComputedStyle(node);
              const sizePx = style.fontSize;
              if (sizePx) {
                const val = parseInt(sizePx, 10);
                if (!isNaN(val)) setFontSizeVal(val);
              }
              if (style.color) {
                setCurrentColor(rgbToHex(style.color));
              }
            }
          }
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [activeList?.id]);

  // Update selection rect when scrolling (to keep toolbar anchored during scroll)
  useEffect(() => {
    const handleScroll = () => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
        syncSelectionVisuals(selection.getRangeAt(0));
      }
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, []);

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (sortRef.current && !sortRef.current.contains(e.target)) setShowSortMenu(false);
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilterMenu(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clipboard ref for Ctrl+C / Ctrl+V of tasks
  const copiedTaskIdsRef = useRef([]);

  // Sync header contentEditable when active list changes or title updates externally
  useEffect(() => {
    if (activeList) {
      // Always update if list changed
      if (activeList.id !== prevListIdRef.current) {
        if (headerTitleRef.current) {
          headerTitleRef.current.innerHTML = activeList.title || '';
        }
        if (headerSubtitleRef.current) {
          headerSubtitleRef.current.innerHTML = activeList.subtitle || '';
        }
        prevListIdRef.current = activeList.id;
      } else {
        // Same list — update title only if the user is NOT currently editing the title div
        if (headerTitleRef.current && document.activeElement !== headerTitleRef.current) {
          headerTitleRef.current.innerHTML = activeList.title || '';
        }
        if (headerSubtitleRef.current && document.activeElement !== headerSubtitleRef.current) {
          headerSubtitleRef.current.innerHTML = activeList.subtitle || '';
        }
      }
    }
  }, [activeList?.id, activeList?.title, activeList?.subtitle]);

  // Keyboard shortcuts for multi-select + undo/redo
  useEffect(() => {
    function handleKeyDown(e) {
      // Don't capture keys when user is typing in an input/textarea
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

      // Ctrl+Z / Cmd+Z — Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        return;
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z — Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
        return;
      }

      // Ctrl+Y / Cmd+Y — Redo (alternative)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        dispatch({ type: 'REDO' });
        return;
      }

      // Ctrl+A / Cmd+A — select all filtered tasks
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const allFilteredIds = filteredTasks.map(t => t.id);
        if (allFilteredIds.length > 0) {
          dispatch({ type: 'RANGE_SELECT_TASKS', payload: allFilteredIds });
        }
        return;
      }

      // Enter — create a new task when nothing is selected
      if (e.key === 'Enter' && state.selectedTaskIds.length === 0 && !state.selectedTaskId) {
        e.preventDefault();
        dispatch({ type: 'ADD_AND_SELECT_TASK', payload: {} });
        return;
      }

      // Delete / Backspace — delete selected tasks
      if (state.selectedTaskIds.length > 0 && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        dispatch({ type: 'DELETE_SELECTED' });
      }

      // Escape — clear selection
      if (state.selectedTaskIds.length > 0 && e.key === 'Escape') {
        dispatch({ type: 'CLEAR_SELECTION' });
      }

      // Ctrl+C / Cmd+C — copy selected tasks to internal clipboard
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && state.selectedTaskIds.length > 0) {
        e.preventDefault();
        copiedTaskIdsRef.current = [...state.selectedTaskIds];
      }

      // Ctrl+V / Cmd+V — paste (duplicate) copied tasks
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && copiedTaskIdsRef.current.length > 0) {
        e.preventDefault();
        dispatch({ type: 'DUPLICATE_COPIED', payload: copiedTaskIdsRef.current });
      }

      // Ctrl+D / Cmd+D — duplicate selected tasks in place
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && state.selectedTaskIds.length > 0) {
        e.preventDefault();
        dispatch({ type: 'DUPLICATE_SELECTED' });
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedTaskIds, state.selectedTaskId, filteredTasks, dispatch]);


  const sortOptions = [
    { value: 'created', label: 'Date Created' },
    { value: 'dueDate', label: 'Due Date' },
    { value: 'startDate', label: 'Start Date' },
    { value: 'alphabetical', label: 'Alphabetical' },
  ];

  const filterOptions = [
    { value: 'all', label: 'All Tasks' },
    { value: 'active', label: 'Active Only' },
    { value: 'completed', label: 'Completed Only' },
  ];

  return (
    <div ref={rootRef} className="flex-1 flex flex-col min-w-0 h-full relative">
      {/* Header */}
      <div className={`px-6 pt-6 pb-4 flex-shrink-0 select-none`}>
        <div className="mb-1">
          <div ref={headerTextWrapperRef} className="flex-1 min-w-0 relative isolate">
            {/* Fake selection highlight — kept visible even when focus moves into a
                toolbar control, since the browser clears the real contenteditable
                selection highlight as soon as it loses focus. */}
            {activeEditable && selectionRects.map((rect, i) => {
              const wrapperEl = headerTextWrapperRef.current;
              if (!wrapperEl) return null;
              const wrapperRect = wrapperEl.getBoundingClientRect();
              return (
                <div
                  key={i}
                  className="absolute -z-10 pointer-events-none rounded-[2px]"
                  style={{
                    top: rect.top - wrapperRect.top,
                    left: rect.left - wrapperRect.left,
                    width: rect.width,
                    height: rect.height,
                    backgroundColor: 'rgba(59, 130, 246, 0.35)',
                  }}
                />
              );
            })}
            <div
              ref={headerTitleRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => {
                normalizeEmptyEditable(e.currentTarget);
                const html = e.currentTarget.innerHTML;
                if (activeList) {
                  dispatch({ type: 'RENAME_LIST', payload: { id: activeList.id, title: html } });
                }
              }}
              onBlur={(e) => {
                pruneEmptyFormattingNodes(e.currentTarget);
                const html = e.currentTarget.innerHTML || 'Untitled';
                if (activeList && html !== activeList.title) {
                  dispatch({ type: 'UPDATE_LIST', payload: { id: activeList.id, updates: { title: html } } });
                }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
              className={`formatting-editable select-text text-3xl p-0 outline-none cursor-text break-words
                ${theme === 'dark' ? 'text-white' : 'text-gray-900'}
                empty:before:content-['Untitled'] empty:before:opacity-40`}
            />
            <div
              ref={headerSubtitleRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => {
                normalizeEmptyEditable(e.currentTarget);
                const html = e.currentTarget.innerHTML;
                if (activeList) {
                  dispatch({ type: 'UPDATE_LIST', payload: { id: activeList.id, updates: { subtitle: html } } });
                }
              }}
              onBlur={(e) => {
                pruneEmptyFormattingNodes(e.currentTarget);
                const html = e.currentTarget.innerHTML || '';
                if (activeList && html !== activeList.subtitle) {
                  dispatch({ type: 'UPDATE_LIST', payload: { id: activeList.id, updates: { subtitle: html } } });
                }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
              className={`formatting-editable select-text min-h-[1.25em] w-fit max-w-full text-sm mt-1 p-0 outline-none cursor-text break-words
                ${theme === 'dark' ? 'text-navy-400' : 'text-gray-500'}
                empty:before:content-['Add_a_description...'] empty:before:opacity-40`}
            />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {/* View Toggle */}
          <div className={`flex items-center rounded-lg text-sm overflow-hidden
            ${theme === 'dark' ? 'bg-navy-800' : 'bg-gray-100'}`}>
            <button
              onClick={() => dispatch({ type: 'SET_FILTER_COMPLETED', payload: 'all' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors cursor-pointer
                ${state.filterCompleted === 'all'
                  ? theme === 'dark'
                    ? 'bg-navy-700 text-white'
                    : 'bg-white text-gray-900 shadow-sm'
                  : theme === 'dark'
                    ? 'text-navy-400 hover:text-white'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
            >
              <ListChecks size={14} />
              All Tasks
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_FILTER_COMPLETED', payload: 'active' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors cursor-pointer
                ${state.filterCompleted === 'active'
                  ? theme === 'dark'
                    ? 'bg-navy-700 text-white'
                    : 'bg-white text-gray-900 shadow-sm'
                  : theme === 'dark'
                    ? 'text-navy-400 hover:text-white'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
            >
              <CheckboxUncheckedIcon size={14} />
              Not Done
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_FILTER_COMPLETED', payload: 'completed' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors cursor-pointer
                ${state.filterCompleted === 'completed'
                  ? theme === 'dark'
                    ? 'bg-navy-700 text-white'
                    : 'bg-white text-gray-900 shadow-sm'
                  : theme === 'dark'
                    ? 'text-navy-400 hover:text-white'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
            >
              <CheckboxCheckedIcon size={14} />
              Done
            </button>
          </div>

          <div className="flex-1" />

          {/* Sort */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm
                transition-colors cursor-pointer
                ${theme === 'dark'
                  ? 'text-navy-400 hover:text-white hover:bg-navy-800'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              title="Sort"
            >
              <ArrowUpDown size={15} />
            </button>
            {showSortMenu && (
              <div className={`absolute right-0 top-full mt-1 w-44 rounded-lg shadow-xl border z-20
                ${theme === 'dark'
                  ? 'bg-navy-800 border-navy-700'
                  : 'bg-white border-gray-200'
                }`}>
                {sortOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      dispatch({ type: 'SET_SORT', payload: opt.value });
                      setShowSortMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer
                      ${state.sortBy === opt.value
                        ? theme === 'dark'
                          ? 'text-blue-400 bg-navy-700/50'
                          : 'text-blue-600 bg-blue-50'
                        : theme === 'dark'
                          ? 'text-navy-200 hover:bg-navy-700/50'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter by tag */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm
                transition-colors cursor-pointer
                ${state.filterTag
                  ? 'text-blue-400'
                  : theme === 'dark'
                    ? 'text-navy-400 hover:text-white hover:bg-navy-800'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              title="Filter by tag"
            >
              <Filter size={15} />
            </button>
            {showFilterMenu && (
              <div className={`absolute right-0 top-full mt-1 w-44 rounded-lg shadow-xl border z-20
                ${theme === 'dark'
                  ? 'bg-navy-800 border-navy-700'
                  : 'bg-white border-gray-200'
                }`}>
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_FILTER_TAG', payload: null });
                    setShowFilterMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer
                    ${!state.filterTag
                      ? theme === 'dark'
                        ? 'text-blue-400 bg-navy-700/50'
                        : 'text-blue-600 bg-blue-50'
                      : theme === 'dark'
                        ? 'text-navy-200 hover:bg-navy-700/50'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  All Tags
                </button>
                {state.tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      dispatch({ type: 'SET_FILTER_TAG', payload: tag.id });
                      setShowFilterMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2
                      transition-colors cursor-pointer
                      ${state.filterTag === tag.id
                        ? theme === 'dark'
                          ? 'text-blue-400 bg-navy-700/50'
                          : 'text-blue-600 bg-blue-50'
                        : theme === 'dark'
                          ? 'text-navy-200 hover:bg-navy-700/50'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor: resolveTagColor(tag.color),
                      }}
                    />
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm
              transition-colors cursor-pointer
              ${showSearch
                ? 'text-blue-400'
                : theme === 'dark'
                  ? 'text-navy-400 hover:text-white hover:bg-navy-800'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            title="Search"
          >
            <Search size={15} />
          </button>

          {/* Delete completed */}
          {completedCount > 0 && (
            <button
              onClick={() => dispatch({ type: 'DELETE_COMPLETED' })}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm
                text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              title="Delete completed tasks"
            >
              <Trash2 size={15} />
            </button>
          )}

          {/* New Task Button */}
          <button
            onClick={() => {
              dispatch({ type: 'ADD_AND_SELECT_TASK', payload: {} });
            }}
            className="flex items-center gap-2 bg-accent-blue hover:bg-blue-600
              text-white px-3 py-1.5 rounded-lg text-sm font-medium
              transition-colors duration-200 cursor-pointer shadow-sm shadow-blue-500/10"
          >
            <Plus size={15} />
            <span>New</span>
          </button>
        </div>

        {/* Search input */}
        {showSearch && (
          <div className={`mt-3 relative animate-fade-in-up`}>
            <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2
              ${theme === 'dark' ? 'text-navy-500' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder="Search tasks..."
              value={state.searchQuery}
              onChange={(e) => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
              className={`w-full pl-9 pr-8 py-2 rounded-lg text-sm outline-none
                transition-colors
                ${theme === 'dark'
                  ? 'bg-navy-800 text-white placeholder-navy-500 border border-navy-700 focus:border-navy-600'
                  : 'bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200 focus:border-gray-300'
                }`}
            />
            {state.searchQuery && (
              <button
                onClick={() => dispatch({ type: 'SET_SEARCH', payload: '' })}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer
                  ${theme === 'dark' ? 'text-navy-500 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Task List */}
      <div
        ref={taskListRef}
        className="flex-1 overflow-y-auto overflow-x-hidden relative"
        onMouseDown={handleMarqueeMouseDown}
        onClickCapture={(e) => {
          // After a marquee drag, suppress the click entirely so selection is preserved
          if (didMarqueeRef.current) {
            e.stopPropagation();
            e.preventDefault();
            didMarqueeRef.current = false;
            return;
          }
        }}
        onClick={(e) => {
          // Click on empty area clears multi-select and closes detail panel
          if (e.target === e.currentTarget) {
            if (state.selectedTaskIds.length > 0) {
              dispatch({ type: 'CLEAR_SELECTION' });
            }
            if (state.selectedTaskId) {
              dispatch({ type: 'SELECT_TASK', payload: null });
            }
          }
        }}
      >
        {filteredTasks.map((task, index) => {
          const dragHandleProps = canDrag ? {
            draggable: true,
            onDragStart: (e) => {
              e.stopPropagation();
              setDraggedTaskId(task.id);
              // Dragging a task that's part of a multi-selection moves the whole
              // group together, in their existing relative order.
              if (state.selectedTaskIds.length > 1 && state.selectedTaskIds.includes(task.id)) {
                const orderedGroupIds = state.tasks
                  .filter(t => state.selectedTaskIds.includes(t.id))
                  .map(t => t.id);
                setDraggedGroupIds(orderedGroupIds);
              } else {
                setDraggedGroupIds(null);
              }
              e.dataTransfer.effectAllowed = 'move';
              // Set a transparent drag image so the browser ghost is subtle
              const el = e.currentTarget.closest('.group');
              if (el) {
                e.dataTransfer.setDragImage(el, 20, 20);
              }
            },
          } : {};

          const isTaskInDraggedGroup = draggedGroupIds ? draggedGroupIds.includes(task.id) : draggedTaskId === task.id;

          const rowDragProps = canDrag ? {
            onDragEnter: (e) => {
              e.preventDefault();
            },
            onDragOver: (e) => {
              e.preventDefault();
              if (isTaskInDraggedGroup) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const midY = rect.top + rect.height / 2;
              const pos = e.clientY < midY ? 'above' : 'below';
              setDropTargetId(task.id);
              setDropPosition(pos);
            },
            onDragLeave: (e) => {
              // Only clear if leaving the element entirely
              if (!e.currentTarget.contains(e.relatedTarget)) {
                if (dropTargetId === task.id) {
                  setDropTargetId(null);
                  setDropPosition(null);
                }
              }
            },
            onDrop: (e) => {
              e.preventDefault();
              if (!draggedTaskId || isTaskInDraggedGroup) {
                setDraggedTaskId(null);
                setDraggedGroupIds(null);
                setDropTargetId(null);
                setDropPosition(null);
                return;
              }

              if (draggedGroupIds) {
                dispatch({
                  type: 'REORDER_TASKS_GROUP',
                  payload: { taskIds: draggedGroupIds, targetTaskId: task.id, position: dropPosition },
                });
              } else {
                const fromIndex = state.tasks.findIndex(t => t.id === draggedTaskId);
                let toIndex = state.tasks.findIndex(t => t.id === task.id);

                if (dropPosition === 'below') {
                  toIndex = fromIndex < toIndex ? toIndex : toIndex + 1;
                } else {
                  toIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
                }

                if (fromIndex !== toIndex) {
                  dispatch({ type: 'REORDER_TASK', payload: { fromIndex, toIndex } });
                }
              }

              setDraggedTaskId(null);
              setDraggedGroupIds(null);
              setDropTargetId(null);
              setDropPosition(null);
            },
          } : {};

          return (
            <div key={task.id}
              ref={(el) => { taskRowRefs.current[task.id] = el; }}
              data-task-id={task.id}
              {...rowDragProps}
              onDragEnd={() => {
                setDraggedTaskId(null);
                setDraggedGroupIds(null);
                setDropTargetId(null);
                setDropPosition(null);
              }}
            >
              <TaskItem
                task={task}
                index={index}
                filteredTasks={filteredTasks}
                dragHandleProps={dragHandleProps}
                isDragging={isTaskInDraggedGroup}
                isDropTarget={dropTargetId === task.id && !isTaskInDraggedGroup}
                dropPosition={dropTargetId === task.id ? dropPosition : null}
                didMarqueeRef={didMarqueeRef}
              />
            </div>
          );
        })}

        {/* Add task button - only show in 'All Tasks' view */}
        {state.filterCompleted === 'all' && (
          <button
            onClick={() => dispatch({ type: 'ADD_AND_SELECT_TASK', payload: {} })}
            className={`w-full flex items-center gap-3 mx-2 px-4 py-2.5 text-sm rounded-lg
              transition-colors cursor-pointer select-none
              ${theme === 'dark'
                ? 'text-navy-500 hover:text-navy-300 hover:bg-navy-800/30'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            style={{ width: 'calc(100% - 16px)' }}
          >
            <Plus size={16} />
            <span>New task</span>
          </button>
        )}

        {/* Empty state */}
        {filteredTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4
              ${theme === 'dark' ? 'bg-navy-800' : 'bg-gray-100'}`}>
              <ListChecks size={28} className={theme === 'dark' ? 'text-navy-500' : 'text-gray-400'} />
            </div>
            <p className={`text-sm font-medium
              ${theme === 'dark' ? 'text-navy-400' : 'text-gray-500'}`}>
              {state.searchQuery
                ? 'No tasks match your search'
                : state.filterCompleted === 'completed'
                  ? 'No completed tasks yet'
                  : 'No tasks yet. Add one above!'}
            </p>
          </div>
        )}

        {/* Marquee selection box */}
        {isSelecting && selectionStart && selectionEnd && taskListRef.current && (() => {
          const containerRect = taskListRef.current.getBoundingClientRect();
          const selRect = getSelectionRect();
          if (!selRect) return null;
          // Clamp to container bounds
          const left = Math.max(selRect.left - containerRect.left, 0);
          const top = Math.max(selRect.top - containerRect.top + taskListRef.current.scrollTop, 0);
          const right = Math.min(selRect.right - containerRect.left, containerRect.width);
          const bottom = Math.min(selRect.bottom - containerRect.top + taskListRef.current.scrollTop, taskListRef.current.scrollHeight);
          const width = right - left;
          const height = bottom - top;
          if (width < 3 && height < 3) return null;
          return (
            <div
              className="absolute pointer-events-none z-40 rounded-sm"
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                border: '1.5px solid rgba(59, 130, 246, 0.5)',
              }}
            />
          );
        })()}
      </div>

      {/* Footer stats */}
      <div className={`px-6 py-3 flex items-center justify-between text-xs border-t flex-shrink-0
        ${theme === 'dark'
          ? 'border-navy-800 text-navy-500'
          : 'border-gray-200 text-gray-400'
        }`}>
        <span>{totalCount} {totalCount === 1 ? 'Task' : 'Tasks'} Total</span>
        <span>{completedCount} Completed</span>
      </div>

      {/* Multi-select action bar */}
      {state.selectedTaskIds.length > 0 && (
        <div className={`absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-3
          px-5 py-3 rounded-xl shadow-2xl border backdrop-blur-sm z-50
          animate-fade-in-up
          ${theme === 'dark'
            ? 'bg-navy-800/95 border-navy-700 text-white'
            : 'bg-white/95 border-gray-200 text-gray-900'
          }`}>
          <span className={`text-sm font-medium
            ${theme === 'dark' ? 'text-navy-300' : 'text-gray-500'}`}>
            {state.selectedTaskIds.length} selected
          </span>
          <div className={`w-px h-5 ${theme === 'dark' ? 'bg-navy-600' : 'bg-gray-300'}`} />
          <button
            onClick={() => dispatch({ type: 'DUPLICATE_SELECTED' })}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer
              ${theme === 'dark'
                ? 'hover:bg-navy-700 text-navy-200'
                : 'hover:bg-gray-100 text-gray-700'
              }`}
            title="Ctrl+D"
          >
            <Copy size={14} />
            Duplicate
          </button>
          <button
            onClick={() => dispatch({ type: 'DELETE_SELECTED' })}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer
              text-red-400 hover:bg-red-500/10"
            title="Del"
          >
            <Trash2 size={14} />
            Delete
          </button>
          <button
            onClick={() => dispatch({ type: 'CLEAR_SELECTION' })}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer
              ${theme === 'dark'
                ? 'text-navy-400 hover:text-white hover:bg-navy-700'
                : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
              }`}
            title="Esc"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Text formatting floating toolbar */}
      {selectionRect && activeEditable && (
        (() => {
          const rootEl = rootRef.current;
          if (!rootEl) return null;
          const rootRect = rootEl.getBoundingClientRect();
          
          // Position relative to rootRef container
          let top = selectionRect.top - rootRect.top - 54; // toolbar height is around 40px + 14px offset
          let left = selectionRect.left - rootRect.left + selectionRect.width / 2;
          
          // Clamp top so it doesn't go above the container top
          if (top < 8) {
            top = selectionRect.bottom - rootRect.top + 8; // place below selection
          }

          // Clamp left so it doesn't overflow left or right edges
          // Toolbar is ~260px wide, so offset by 130px from left/right
          const halfWidth = 130;
          if (left < halfWidth + 10) {
            left = halfWidth + 10;
          } else if (left > rootRect.width - halfWidth - 10) {
            left = rootRect.width - halfWidth - 10;
          }

          // Dynamically decide popup direction: if toolbar is high up, open downwards
          const openDirection = top < 250 ? 'down' : 'up';

          return (
            <div
              ref={toolbarRef}
              className={`absolute flex items-center gap-2.5 p-1.5 rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.3)] border z-50 transition-all duration-150 animate-fade-in-up formatting-toolbar-transition-override
                ${theme === 'dark'
                  ? 'bg-navy-900/95 border-navy-700/80 text-white'
                  : 'bg-white/95 border-gray-200 text-gray-900 shadow-[0_10px_35px_rgba(0,0,0,0.1)]'
                }`}
              style={{
                top: `${top}px`,
                left: `${left}px`,
                transform: 'translateX(-50%)',
              }}
              onMouseEnter={() => { isInteractingWithToolbar.current = true; }}
              onMouseLeave={() => { isInteractingWithToolbar.current = false; }}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onMouseDown={(e) => {
                // Allow focus shift only for inputs so you can type; prevent for buttons/sliders
                if (e.target.tagName !== 'INPUT') {
                  e.preventDefault();
                }
              }}
            >
              {/* Font Size Changer: - [ Value ] + */}
              <div className="flex items-center gap-1 bg-transparent px-1">
                <button
                  onClick={() => handleFontSizeAdjust(-1)}
                  className={`w-6 h-6 flex items-center justify-center rounded hover:bg-navy-800/20 transition-colors cursor-pointer text-sm font-semibold
                    ${theme === 'dark' ? 'hover:bg-navy-850 text-navy-300' : 'hover:bg-gray-150 text-gray-700'}`}
                  title="Decrease Font Size"
                >
                  —
                </button>
                <input
                  type="text"
                  value={fontSizeVal}
                  onChange={(e) => handleFontSizeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const parsed = parseInt(fontSizeVal, 10);
                      if (!isNaN(parsed)) {
                        const clamped = Math.max(12, Math.min(96, parsed));
                        setFontSizeVal(clamped);
                        restoreSelection();
                        handleCustomFontSize(clamped);
                      }
                      e.currentTarget.blur();
                    }
                  }}
                  onBlur={handleInputBlur}
                  className={`w-9 h-6 text-center text-xs font-semibold rounded border outline-none bg-transparent
                    ${theme === 'dark' ? 'border-navy-700 text-white' : 'border-gray-300 text-gray-900'}`}
                  title="Font Size"
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={() => handleFontSizeAdjust(1)}
                  className={`w-6 h-6 flex items-center justify-center rounded hover:bg-navy-800/20 transition-colors cursor-pointer text-sm font-semibold
                    ${theme === 'dark' ? 'hover:bg-navy-850 text-navy-300' : 'hover:bg-gray-150 text-gray-700'}`}
                  title="Increase Font Size"
                >
                  +
                </button>
              </div>

              {/* Divider */}
              <div className={`w-px h-5 ${theme === 'dark' ? 'bg-navy-700' : 'bg-gray-200'}`} />

              {/* Bold */}
              <button
                onClick={() => handleFormat('bold')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer
                  ${isBold
                    ? theme === 'dark'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-blue-100 text-blue-900'
                    : theme === 'dark'
                      ? 'hover:bg-navy-800 text-navy-300'
                      : 'hover:bg-gray-150 text-gray-700'
                  }`}
                title="Bold"
              >
                <Bold size={15} />
              </button>

              {/* Italic */}
              <button
                onClick={() => handleFormat('italic')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer
                  ${isItalic
                    ? theme === 'dark'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-blue-100 text-blue-900'
                    : theme === 'dark'
                      ? 'hover:bg-navy-800 text-navy-300'
                      : 'hover:bg-gray-150 text-gray-700'
                  }`}
                title="Italic"
              >
                <Italic size={15} />
              </button>

              {/* Underline */}
              <button
                onClick={() => handleFormat('underline')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer
                  ${isUnderline
                    ? theme === 'dark'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-blue-100 text-blue-900'
                    : theme === 'dark'
                      ? 'hover:bg-navy-800 text-navy-300'
                      : 'hover:bg-gray-150 text-gray-700'
                  }`}
                title="Underline"
              >
                <Underline size={15} />
              </button>

              {/* Divider */}
              <div className={`w-px h-5 ${theme === 'dark' ? 'bg-navy-700' : 'bg-gray-200'}`} />

              {/* Color Selector */}
              <div className="relative">
                <button
                  onClick={toggleColorDropdown}
                  className={`flex items-center gap-1 p-1.5 rounded-lg transition-colors cursor-pointer
                    ${theme === 'dark' ? 'hover:bg-navy-800 text-navy-300' : 'hover:bg-gray-150 text-gray-700'}`}
                  title="Text Color"
                  style={{ borderBottom: `3.5px solid ${currentColor}` }}
                >
                  <Palette size={15} style={{ color: currentColor }} />
                  <ChevronDown size={10} />
                </button>

                {showColorDropdown && (
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 p-3 rounded-lg shadow-xl border w-[290px] z-50
                      ${openDirection === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}
                      ${theme === 'dark' ? 'bg-navy-800 border-navy-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                  >
                    <div className="flex flex-col gap-3">
                      {/* Presets */}
                      <div>
                        <div className={`text-[10px] font-bold uppercase tracking-wider mb-2
                          ${theme === 'dark' ? 'text-navy-500' : 'text-gray-400'}`}>Preset Colors</div>
                        <div className="grid grid-cols-5 gap-2">
                          {[
                            '#ffffff', '#1e293b', '#94a3b8', '#3b82f6', '#22c55e',
                            '#eab308', '#f97316', '#ef4444', '#a855f7', '#ec4899'
                          ].map(color => (
                            <button
                              key={color}
                              onClick={() => handleColorChange(color)}
                              className="w-5.5 h-5.5 rounded-md cursor-pointer transition-transform hover:scale-110 border"
                              style={{
                                backgroundColor: color,
                                borderColor: color === '#ffffff' ? '#cbd5e1' : 'transparent'
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className={`border-t ${theme === 'dark' ? 'border-navy-700' : 'border-gray-200'}`} />

                      {/* Custom color picker panel */}
                      <div>
                        <div className={`text-[10px] font-bold uppercase tracking-wider mb-2
                          ${theme === 'dark' ? 'text-navy-500' : 'text-gray-400'}`}>Custom Color</div>
                        <div className="color-picker-area">
                          <ColorPicker value={currentColor} onChange={handleColorChange} theme={theme} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}
