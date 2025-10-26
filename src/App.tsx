import React, { useEffect, useState } from 'react';
import { Canvas } from './components/canvas/Canvas';
import { Sidebar } from './components/sidebar/Sidebar';
import { Button } from './components/ui/button';
import { preferencesService } from './services/preferences';
import { Menu, Moon, Sun } from 'lucide-react';

function App() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const prefs = preferencesService.getPreferences();
    setTheme(prefs.theme);
    
    // Apply theme
    const root = document.documentElement;
    if (prefs.theme === 'dark' || (prefs.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    preferencesService.setTheme(newTheme);
    
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Top Menu Bar */}
      <div className="bg-white dark:bg-gray-800 border-b px-4 py-2 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setShowMenu(!showMenu)}>
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
        <div className="absolute top-14 left-4 bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-4 z-50">
          <div className="space-y-2">
            <div className="font-semibold mb-3">Menu</div>
            <Button variant="ghost" className="w-full justify-start">File</Button>
            <Button variant="ghost" className="w-full justify-start">Edit</Button>
            <Button variant="ghost" className="w-full justify-start">View</Button>
            <Button variant="ghost" className="w-full justify-start">Preferences</Button>
            <hr className="my-2" />
            <Button variant="ghost" className="w-full justify-start">About</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
