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
      <div className="h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="text-center max-w-lg">
          <div className="inline-block p-6 bg-red-100 dark:bg-red-900/30 rounded-full mb-6">
            <svg className="h-16 w-16 text-red-600 dark:text-red-400" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-4">Unable to Initialize</h1>
          <p className="text-red-600 dark:text-red-400 mb-6 font-medium">{initError}</p>
          <div className="bg-muted/30 rounded-lg p-4 text-left">
            <p className="text-sm text-muted-foreground mb-2">
              <strong className="text-foreground">Troubleshooting steps:</strong>
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Check your database configuration in <code className="bg-background px-1 rounded">.env</code></li>
              <li>Ensure the database file or connection is accessible</li>
              <li>Verify file permissions if using local database</li>
              <li>Try restarting the application</li>
            </ul>
          </div>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-6"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="inline-block p-8 bg-primary/10 rounded-full mb-6 animate-pulse">
            <svg className="h-16 w-16 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Initializing DAX</h1>
          <div className="text-muted-foreground">Setting up your workspace...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Skip to main content for keyboard navigation */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>

      {/* Top Menu Bar */}
      <div className="bg-card border-b-2 border-border px-6 py-4 flex items-center gap-4 shadow-sm">
        <Button 
          ref={menuButtonRef}
          variant="ghost" 
          size="icon"
          className="hover:bg-accent shrink-0 rounded-lg h-10 w-10 transition-colors"
          onClick={() => setShowMenu(!showMenu)}
          aria-label="Open menu"
          title="Menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-black tracking-tight">DAX</h1>
          <span className="text-sm text-muted-foreground font-semibold tracking-wide">Data Agent eXplorer</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            className="hover:bg-accent shrink-0 rounded-lg h-10 w-10 transition-colors"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div id="main-content" className="flex-1 flex overflow-hidden" role="main">
        <Canvas />
        <Sidebar />
      </div>

      {/* Menu Overlay */}
      {showMenu && (
        <div ref={menuRef} className="absolute top-20 left-6 bg-card border-2 border-border rounded-xl shadow-2xl py-2 z-50 min-w-[250px] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-3 py-2 border-b border-border mb-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Workspace</p>
          </div>
          <button
            className="w-full px-4 py-3 text-left hover:bg-accent transition-colors flex items-center gap-3 group rounded-lg"
            onClick={handleClearCanvas}
          >
            <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center group-hover:bg-destructive/20 transition-colors">
              <svg className="h-4 w-4 text-destructive" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">Clear All Nodes</div>
              <div className="text-xs text-muted-foreground">Remove everything from canvas</div>
            </div>
          </button>
          <div className="h-px bg-border my-2" />
          <div className="px-3 py-2 border-b border-border mb-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tools</p>
          </div>
          <button
            className="w-full px-4 py-3 text-left hover:bg-accent transition-colors flex items-center gap-3 group rounded-lg"
            onClick={() => {
              setShowMenu(false);
              setShowRDFViewer(true);
            }}
          >
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <svg className="h-4 w-4 text-primary" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 013.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">RDF Knowledge Graph</div>
              <div className="text-xs text-muted-foreground">View and manage entities</div>
            </div>
          </button>
          <button
            className="w-full px-4 py-3 text-left hover:bg-accent transition-colors flex items-center gap-3 group rounded-lg"
            onClick={() => {
              setShowMenu(false);
              setShowPreferences(true);
            }}
          >
            <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-muted transition-colors">
              <svg className="h-4 w-4" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">Preferences</div>
              <div className="text-xs text-muted-foreground">Theme, language, settings</div>
            </div>
          </button>
          <div className="h-px bg-border my-2" />
          <button
            className="w-full px-4 py-3 text-left hover:bg-accent transition-colors flex items-center gap-3 group rounded-lg"
            onClick={() => {
              setShowMenu(false);
              setShowAbout(true);
            }}
          >
            <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-muted transition-colors">
              <svg className="h-4 w-4" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">About DAX</div>
              <div className="text-xs text-muted-foreground">Version and information</div>
            </div>
          </button>
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
