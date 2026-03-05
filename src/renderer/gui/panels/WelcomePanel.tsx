import { type Component, createSignal } from 'solid-js';
import { Button } from '../shared/Button';
import { Spinner } from '../shared/Spinner';
import { ipcClient } from '../../core/ipc-client';
import { bootstrapWorkspace } from '../../core/bootstrap';
import { setAppConfig } from '../../state/config';
import { setShowWelcome } from '../../state/ui';
import { toast } from '../overlays/Toast';

/**
 * WelcomePanel — shown on first launch when no workspace directory is stored.
 * Presents a "Choose Directory" button that opens the native directory picker.
 * After selection: scans directory, creates meshes, starts watcher.
 */
const WelcomePanel: Component = () => {
  const [loading, setLoading] = createSignal(false);

  const handleSelectDirectory = async () => {
    setLoading(true);
    try {
      const dirPath = await ipcClient.selectDirectory();
      if (!dirPath) {
        setLoading(false);
        return; // User cancelled
      }

      // Verify the directory is accessible
      const exists = await ipcClient.fsAccess(dirPath);
      if (!exists) {
        toast.error(`Directory not accessible: ${dirPath}`);
        setLoading(false);
        return;
      }

      // Store in config DB
      await ipcClient.configSet('workspace_path', dirPath);

      // Update app state
      setAppConfig({ workspacePath: dirPath, workspaceVerified: true });
      setShowWelcome(false);

      // Bootstrap the workspace: scan → mesh creation → watcher
      try {
        await bootstrapWorkspace(dirPath);
        toast.success(`Workspace loaded: ${dirPath}`);
      } catch (err) {
        console.error('Bootstrap workspace failed:', err);
        toast.error(`Failed to load workspace: ${(err as Error).message}`);
      }
    } catch (err) {
      toast.error(`Failed to select directory: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={backdropStyle}>
      <div style={panelStyle}>
        <div style={logoStyle}>DAX</div>
        <h2 style={headingStyle}>Welcome to DAX</h2>
        <p style={descStyle}>
          Select a directory to get started. DAX will mirror its contents as
          interactive 3D objects in a physics-based environment.
        </p>
        <Button
          onClick={handleSelectDirectory}
          disabled={loading()}
          style={{ 'min-width': '200px', 'margin-top': '16px' }}
        >
          {loading() ? (
            <>
              <Spinner size={16} color="#ffffff" />
              Opening...
            </>
          ) : (
            'Choose Directory'
          )}
        </Button>
      </div>
    </div>
  );
};

// ── Styles ──

const backdropStyle: Record<string, string> = {
  position: 'absolute',
  inset: '0',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  background: 'rgba(0, 0, 0, 0.6)',
  'backdrop-filter': 'blur(8px)',
  'z-index': '1000',
  'pointer-events': 'auto',
};

const panelStyle: Record<string, string> = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '12px',
  padding: '48px 56px',
  background: 'rgba(30, 30, 46, 0.95)',
  'border-radius': '16px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  'box-shadow': '0 24px 48px rgba(0, 0, 0, 0.5)',
  'max-width': '440px',
  'text-align': 'center',
};

const logoStyle: Record<string, string> = {
  'font-size': '48px',
  'font-weight': '900',
  color: '#e94560',
  'letter-spacing': '6px',
  'margin-bottom': '8px',
};

const headingStyle: Record<string, string> = {
  'font-size': '22px',
  'font-weight': '600',
  color: '#e0e0e0',
  margin: '0',
};

const descStyle: Record<string, string> = {
  'font-size': '14px',
  color: '#8a8a9a',
  'line-height': '1.6',
  margin: '0',
};

export { WelcomePanel };
