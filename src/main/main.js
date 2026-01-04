import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import { createClient } from '@libsql/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database client - will be initialized on app ready
let dbClient = null;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers for filesystem operations

// Select folder dialog
ipcMain.handle('fs:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

// List directory contents
ipcMain.handle('fs:readDir', async (event, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  } catch (error) {
    throw new Error(`Failed to read directory: ${error.message}`);
  }
});

// Read file contents
ipcMain.handle('fs:readFile', async (event, filePath, encoding = 'utf-8') => {
  try {
    const content = await fs.readFile(filePath, encoding);
    return content;
  } catch (error) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

// Read file as buffer (for binary files)
ipcMain.handle('fs:readFileBuffer', async (event, filePath) => {
  try {
    const buffer = await fs.readFile(filePath);
    return Array.from(buffer);
  } catch (error) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

// Get file stats
ipcMain.handle('fs:stat', async (event, filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
    };
  } catch (error) {
    throw new Error(`Failed to get file stats: ${error.message}`);
  }
});

// Check if path exists
ipcMain.handle('fs:exists', async (event, filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

// Database IPC Handlers

// Initialize database
ipcMain.handle('db:initialize', async (event, config) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'dax.db');
    console.log('Initializing database at:', dbPath);

    dbClient = createClient({
      url: `file:${dbPath}`,
    });

    // Run migrations
    // In production (built), migrations are in dist/migrations
    // In development, migrations are in src/services/migrations
    let migrationsPath = path.join(__dirname, '../migrations');
    try {
      await fs.access(migrationsPath);
      console.log('Using production migrations path:', migrationsPath);
    } catch (error) {
      // Fallback to development path if production path doesn't exist
      console.log('Production migrations not found, using development path');
      migrationsPath = path.join(__dirname, '../../src/services/migrations');
    }
    const migrationFiles = await fs.readdir(migrationsPath);
    const sqlFiles = migrationFiles.filter(f => f.endsWith('.sql')).sort();

    for (const file of sqlFiles) {
      const sqlPath = path.join(migrationsPath, file);
      const sql = await fs.readFile(sqlPath, 'utf-8');

      // Split by semicolons and execute each statement
      const statements = sql.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await dbClient.execute(statement);
        }
      }
      console.log(`Executed migration: ${file}`);
    }

    // Create default admin user if not exists
    const result = await dbClient.execute({
      sql: 'SELECT COUNT(*) as count FROM users WHERE id = ?',
      args: ['admin'],
    });

    if (result.rows[0].count === 0) {
      await dbClient.execute({
        sql: `INSERT INTO users (id, username, email, role, permissions)
              VALUES (?, ?, ?, ?, ?)`,
        args: ['admin', 'admin', 'admin@dax.local', 'admin', JSON.stringify(['*'])],
      });
    }

    return { success: true, dbPath };
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
});

// Execute database query
ipcMain.handle('db:execute', async (event, query) => {
  try {
    if (!dbClient) {
      throw new Error('Database not initialized');
    }
    const result = await dbClient.execute(query);
    return {
      rows: result.rows,
      columns: result.columns,
      rowsAffected: result.rowsAffected,
    };
  } catch (error) {
    console.error('Database execute error:', error);
    throw error;
  }
});

// Close database
ipcMain.handle('db:close', async () => {
  if (dbClient) {
    await dbClient.close();
    dbClient = null;
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
