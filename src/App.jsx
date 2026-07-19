import { useState, useCallback, useEffect, useRef } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { TaskProvider } from './context/TaskContext';
import SplashScreen from './components/SplashScreen';
import Sidebar from './components/Sidebar';
import TaskList from './components/TaskList';
import TaskDetailPanel from './components/TaskDetailPanel';
import ClipboardsPage from './components/ClipboardsPage';
import ClipboardDetailPage from './components/ClipboardDetailPage';
import SearchModal from './components/SearchModal';
import { useTasks } from './context/TaskContext';
import { useTheme } from './context/ThemeContext';

// ─── Panel width constraints ────────────────────────────
const MIN_PANEL_WIDTH = 320;  // minimum so content still fits
const MAX_PANEL_WIDTH = 550;  // maximum reasonable width
const DEFAULT_PANEL_WIDTH = 380;

function AppLayout() {
  const { theme } = useTheme();
  const { selectedTask, activeView, fullState, dispatch } = useTasks();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const prevSelectedRef = useRef(null);

  // Clear a search-result highlight as soon as the user does anything else —
  // it's meant to be a brief "here's what matched" cue, not a persistent marker.
  useEffect(() => {
    if (!fullState.highlightedTaskId) return;
    let armed = false;
    const raf = requestAnimationFrame(() => { armed = true; });
    const clear = () => {
      if (armed) dispatch({ type: 'CLEAR_HIGHLIGHT' });
    };
    document.addEventListener('mousedown', clear);
    document.addEventListener('keydown', clear);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', clear);
      document.removeEventListener('keydown', clear);
    };
  }, [fullState.highlightedTaskId, dispatch]);

  // Global Ctrl/Cmd+K to open search from anywhere, matching the ChatGPT-style affordance.
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ─── Resizable panel state ──────────────────────────
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_PANEL_WIDTH);

  useEffect(() => {
    if (selectedTask) {
      // Opening
      setShowPanel(true);
      setIsClosing(false);
    } else if (prevSelectedRef.current) {
      // Closing — play exit animation then unmount
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShowPanel(false);
        setIsClosing(false);
      }, 350); // match CSS animation duration
      return () => clearTimeout(timer);
    }
    prevSelectedRef.current = selectedTask;
  }, [selectedTask]);

  // ─── Resize drag handlers ────────────────────────────
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [panelWidth]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      // Dragging left → wider panel, dragging right → narrower panel
      const delta = startX.current - e.clientX;
      const newWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidth.current + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className={`flex h-screen overflow-hidden
      ${theme === 'dark' ? 'bg-navy-900' : 'bg-gray-50'}`}>
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} onOpenSearch={() => setShowSearchModal(true)} />
      {showSearchModal && <SearchModal onClose={() => setShowSearchModal(false)} theme={theme} />}
      <main className="flex-1 flex min-w-0 overflow-hidden">
        {activeView?.type === 'clipboards' ? (
          <ClipboardsPage />
        ) : activeView?.type === 'clipboard' ? (
          <ClipboardDetailPage clipboardId={activeView.id} />
        ) : (
          <TaskList />
        )}
        {showPanel && activeView?.type === 'list' && (
          <>
            {/* ── Resize handle ── */}
            <div
              onMouseDown={handleResizeStart}
              className={`w-1 flex-shrink-0 cursor-col-resize group relative z-10
                transition-colors duration-150
                ${theme === 'dark'
                  ? 'hover:bg-accent-blue/40 active:bg-accent-blue/60'
                  : 'hover:bg-blue-300/50 active:bg-blue-400/60'
                }`}
              style={{ marginRight: '-2px', marginLeft: '-2px' }}
              title="Drag to resize"
            >
              {/* Wider invisible hit area for easier grabbing */}
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>
            <TaskDetailPanel isClosing={isClosing} width={panelWidth} />
          </>
        )}
      </main>
    </div>
  );
}

function App() {
  const [splashDone, setSplashDone] = useState(() => {
    return sessionStorage.getItem('checkmark-splash-seen') === 'true';
  });

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true);
    sessionStorage.setItem('checkmark-splash-seen', 'true');
  }, []);

  return (
    <ThemeProvider>
      <TaskProvider>
        {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
        <AppLayout />
      </TaskProvider>
    </ThemeProvider>
  );
}

export default App;
