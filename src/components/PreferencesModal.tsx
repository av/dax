import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { X, Save, RotateCcw } from 'lucide-react';
import { Preferences } from '@/types';
import { preferencesService } from '@/services/preferences';
import { validators } from '@/lib/validation';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose }) => {
  const [preferences, setPreferences] = useState<Preferences>(preferencesService.getPreferences());
  const [hasChanges, setHasChanges] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setPreferences(preferencesService.getPreferences());
      setHasChanges(false);
      setErrors({});
    }
  }, [isOpen]);

  const handleChange = (updates: Partial<Preferences>) => {
    setPreferences({ ...preferences, ...updates });
    setHasChanges(true);
  };

  const validatePreferences = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate theme
    const themeError = validators.theme(preferences.theme);
    if (themeError) newErrors.theme = themeError;

    // Validate data directory
    const dataDirError = validators.directoryPath(preferences.dataDir);
    if (dataDirError) newErrors.dataDir = dataDirError;

    // Validate backup settings
    if (preferences.backup.enabled) {
      const intervalError = validators.backupInterval(preferences.backup.interval);
      if (intervalError) newErrors.backupInterval = intervalError;

      const locationError = validators.directoryPath(preferences.backup.location);
      if (locationError) newErrors.backupLocation = locationError;
    }

    // Validate language
    const languageError = validators.languageCode(preferences.language);
    if (languageError) newErrors.language = languageError;

    // Validate hotkeys
    for (const [action, key] of Object.entries(preferences.hotkeys)) {
      const hotkeyError = validators.hotkey(key);
      if (hotkeyError) {
        newErrors[`hotkey_${action}`] = hotkeyError;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validatePreferences()) {
      return;
    }

    await preferencesService.savePreferences(preferences);
    setHasChanges(false);
    setErrors({});
    
    // Apply theme immediately
    const root = document.documentElement;
    if (preferences.theme === 'dark' || (preferences.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    onClose();
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all preferences to defaults?')) {
      await preferencesService.resetToDefaults();
      setPreferences(preferencesService.getPreferences());
      setHasChanges(false);
    }
  };

  const handleHotkeyChange = (action: string, key: string) => {
    handleChange({
      hotkeys: { ...preferences.hotkeys, [action]: key },
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-background/95 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preferences-dialog-title"
    >
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto shadow-2xl border-2 animate-in zoom-in-95 duration-200">
        <CardHeader className="space-y-1 pb-4 border-b">
          <div className="flex items-center justify-between">
            <CardTitle id="preferences-dialog-title" className="text-2xl font-semibold">Preferences</CardTitle>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={onClose}
              className="h-8 w-8 p-0 hover:bg-accent"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 pt-6">
          {/* Appearance */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Appearance</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Theme</label>
                <select
                  value={preferences.theme}
                  onChange={(e) => handleChange({ theme: e.target.value as 'light' | 'dark' | 'system' })}
                  className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Language</label>
                <select
                  value={preferences.language}
                  onChange={(e) => handleChange({ language: e.target.value })}
                  className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="ja">日本語</option>
                  <option value="zh">中文</option>
                </select>
              </div>
            </div>
          </section>

          {/* System */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">System</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                <div className="space-y-1">
                  <label htmlFor="autostart-checkbox" className="text-sm font-medium leading-none cursor-pointer">Launch on Startup</label>
                  <p className="text-xs text-muted-foreground">Start DAX automatically when you log in</p>
                </div>
                <input
                  id="autostart-checkbox"
                  type="checkbox"
                  checked={preferences.autostart}
                  onChange={(e) => handleChange({ autostart: e.target.checked })}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Data Directory</label>
                <Input
                  value={preferences.dataDir}
                  onChange={(e) => handleChange({ dataDir: e.target.value })}
                  placeholder="./data"
                  className={errors.dataDir ? 'border-red-500 focus:ring-red-500' : ''}
                />
                {errors.dataDir && (
                  <p className="text-xs text-red-600 dark:text-red-400">{errors.dataDir}</p>
                )}
              </div>
            </div>
          </section>

          {/* Backup */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Backup</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                <div className="space-y-1">
                  <label htmlFor="backup-enabled-checkbox" className="text-sm font-medium leading-none cursor-pointer">Enable Automatic Backups</label>
                  <p className="text-xs text-muted-foreground">Automatically backup your data periodically</p>
                </div>
                <input
                  id="backup-enabled-checkbox"
                  type="checkbox"
                  checked={preferences.backup.enabled}
                  onChange={(e) => 
                    handleChange({
                      backup: { ...preferences.backup, enabled: e.target.checked },
                    })
                  }
                  className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
              
              {preferences.backup.enabled && (
                <>
                  <div>
                    <label className="text-sm font-medium">Backup Interval (minutes)</label>
                    <Input
                      type="number"
                      value={Math.floor(preferences.backup.interval / 60000)}
                      onChange={(e) =>
                        handleChange({
                          backup: {
                            ...preferences.backup,
                            interval: parseInt(e.target.value, 10) * 60000,
                          },
                        })
                      }
                      placeholder="60"
                      min="5"
                      max="1440"
                      className={errors.backupInterval ? 'border-red-500' : ''}
                    />
                    {errors.backupInterval && (
                      <p className="text-xs text-red-500 mt-1">{errors.backupInterval}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Backup Location</label>
                    <Input
                      value={preferences.backup.location}
                      onChange={(e) =>
                        handleChange({
                          backup: { ...preferences.backup, location: e.target.value },
                        })
                      }
                      placeholder="./backups"
                      className={errors.backupLocation ? 'border-red-500' : ''}
                    />
                    {errors.backupLocation && (
                      <p className="text-xs text-red-500 mt-1">{errors.backupLocation}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Sync */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Cloud Sync</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="sync-enabled-checkbox" className="text-sm font-medium cursor-pointer">Enable Cloud Sync</label>
                  <p className="text-xs text-muted-foreground">Sync your data across devices</p>
                </div>
                <input
                  id="sync-enabled-checkbox"
                  type="checkbox"
                  checked={preferences.sync.enabled}
                  onChange={(e) =>
                    handleChange({
                      sync: { ...preferences.sync, enabled: e.target.checked },
                    })
                  }
                  className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>

              {preferences.sync.enabled && (
                <div>
                  <label className="text-sm font-medium">Provider</label>
                  <select
                    value={preferences.sync.provider || ''}
                    onChange={(e) =>
                      handleChange({
                        sync: { ...preferences.sync, provider: e.target.value },
                      })
                    }
                    className="w-full mt-1 px-3 py-2 border border-input bg-background text-foreground rounded text-sm"
                  >
                    <option value="">Select provider...</option>
                    <option value="dropbox">Dropbox</option>
                    <option value="gdrive">Google Drive</option>
                    <option value="onedrive">OneDrive</option>
                    <option value="custom">Custom S3</option>
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Keyboard Shortcuts</h3>
            <div className="space-y-2">
              {Object.entries(preferences.hotkeys).map(([action, key]) => (
                <div key={action}>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium capitalize">
                      {action.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    <Input
                      value={key}
                      onChange={(e) => handleHotkeyChange(action, e.target.value)}
                      className={`w-40 ${errors[`hotkey_${action}`] ? 'border-red-500' : ''}`}
                      placeholder="Ctrl+N"
                    />
                  </div>
                  {errors[`hotkey_${action}`] && (
                    <p className="text-xs text-red-500 mt-1 text-right">{errors[`hotkey_${action}`]}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-border">
            <Button onClick={handleSave} disabled={!hasChanges} className="flex-1 font-medium">
              <Save className="h-4 w-4 mr-2" />
              Save Preferences
            </Button>
            <Button variant="outline" onClick={handleReset} className="font-medium">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button variant="outline" onClick={onClose} className="font-medium">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
