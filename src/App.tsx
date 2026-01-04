import { useEffect, useState, useRef } from 'react';
import { Canvas } from './components/canvas/Canvas';
import { Sidebar } from './components/sidebar/Sidebar';
import { PreferencesModal } from './components/PreferencesModal';
import { RDFViewer } from './components/RDFViewer';
import { AboutDialog } from './components/AboutDialog';
import { Button } from './components/ui/button';
import { preferencesService } from './services/preferences';
import { initializeApp } from './services/init';
import { getDatabaseInstance } from './services/database';
import { DEFAULT_USER_ID } from './lib/constants';
import { Menu, Moon, Sun } from 'lucide-react';

function App() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [showMenu, setShowMenu] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showRDFViewer, setShowRDFViewer] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    async function init() {
      try {
        // Initialize the application and database
        await initializeApp();

        // Load preferences
        await preferencesService.loadPreferences();
        const prefs = preferencesService.getPreferences();
        setTheme(prefs.theme);

        // Apply theme
        const root = document.documentElement;
        if (prefs.theme === 'dark' || (prefs.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Initialization error:', error);
        setInitError(error instanceof Error ? error.message : 'Failed to initialize application');
      }
    }

    init();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMenu && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        // Check if the click was on the menu button itself
        if (menuButtonRef.current && menuButtonRef.current.contains(event.target as Node)) {
          return;
        }
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    await preferencesService.setTheme(newTheme);

    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const handleClearCanvas = async () => {
    if (!confirm('Are you sure you want to clear all nodes from the canvas? This action cannot be undone.')) {
      return;
    }

    try {
      const db = getDatabaseInstance();
      const nodes = await db.getCanvasNodes(DEFAULT_USER_ID);
      
      // Delete all nodes
      await Promise.all(nodes.map(node => db.deleteCanvasNode(node.id, DEFAULT_USER_ID)));
      
      // Trigger a reload by dispatching a custom event
      window.dispatchEvent(new CustomEvent('canvas-cleared'));
      
      setShowMenu(false);
    } catch (error) {
      console.error('Failed to clear canvas:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to clear canvas: ${errorMessage}`);
    }
  };

  if (initError) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Initialization Error</h1>
          <p className="text-red-600 mb-4">{initError}</p>
          <p className="text-sm text-muted-foreground">
            Please check your database configuration and try again.
          </p>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Initializing DAX...</h1>
          <div className="animate-pulse text-muted-foreground">Loading database...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Top Menu Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-border px-4 py-2 flex items-center gap-4">
        <Button 
          ref={menuButtonRef}
          variant="ghost" 
          size="icon" 
          onClick={() => setShowMenu(!showMenu)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">DAX</h1>
        <span className="text-sm text-muted-foreground">Data Agent eXplorer</span>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <Canvas />
        <Sidebar />
      </div>

      {/* Menu Overlay */}
      {showMenu && (
        <div ref={menuRef} className="absolute top-14 left-4 bg-white dark:bg-slate-900 border border-border rounded-lg shadow-lg p-4 z-50">
          <div className="space-y-2">
            <div className="font-semibold mb-3">Menu</div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground px-2 py-1">File</div>
              <Button 
                variant="ghost" 
                className="w-full justify-start pl-4"
                onClick={handleClearCanvas}
              >
                Clear All Nodes
              </Button>
            </div>
            <hr className="my-2 border-border" />
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => {
                setShowMenu(false);
                setShowRDFViewer(true);
              }}
            >
              RDF Knowledge Graph
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => {
                setShowMenu(false);
                setShowPreferences(true);
              }}
            >
              Preferences
            </Button>
            <hr className="my-2 border-border" />
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => {
                setShowMenu(false);
                setShowAbout(true);
              }}
            >
              About
            </Button>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      <PreferencesModal 
        isOpen={showPreferences} 
        onClose={() => setShowPreferences(false)} 
      />

      {/* RDF Viewer */}
      <RDFViewer 
        isOpen={showRDFViewer} 
        onClose={() => setShowRDFViewer(false)} 
      />

      {/* About Dialog */}
      <AboutDialog 
        isOpen={showAbout} 
        onClose={() => setShowAbout(false)} 
      />
    </div>
  );
}

export default App;
