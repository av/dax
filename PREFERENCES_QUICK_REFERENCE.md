# Preferences Quick Reference Guide

## Overview
DAX Preferences provide 7 configurable settings for customizing the application behavior and appearance.

## Accessing Preferences
1. Click the **Menu** button (☰) in the top-left corner
2. Select **"Preferences"** from the dropdown menu
3. The preferences modal will open

## Settings Categories

### 1. Appearance
- **Theme**: Choose between Light, Dark, or System (follows OS preference)
- **Language**: Select from English, Spanish, French, German, Japanese, or Chinese

### 2. System
- **Launch on Startup**: Enable/disable automatic app launch when system starts
- **Data Directory**: Specify where application data is stored (default: `./data`)

### 3. Backup
- **Enable Automatic Backups**: Turn backups on/off
- **Backup Interval**: How often to backup (5 minutes to 24 hours)
- **Backup Location**: Where to store backups (default: `./backups`)

### 4. Cloud Sync
- **Enable Cloud Sync**: Turn sync on/off
- **Provider**: Choose from Dropbox, Google Drive, OneDrive, or Custom S3

### 5. Keyboard Shortcuts
Customize hotkeys for common actions:
- **New Node**: Default `Ctrl+N`
- **Save**: Default `Ctrl+S`
- **Undo**: Default `Ctrl+Z`
- **Redo**: Default `Ctrl+Y`

## Validation Rules

### Data Directory & Backup Location
- No invalid characters: `< > " | ? * or control characters`
- No path traversal patterns (`..`)

### Backup Interval
- Minimum: 5 minutes (300 seconds)
- Maximum: 24 hours (1440 minutes)

### Hotkeys
- Format: `Modifier+Key` (e.g., `Ctrl+S`)
- Valid modifiers: `Ctrl`, `Alt`, `Shift`, `Meta`
- Must include at least one modifier

### Language
- Must be valid ISO 639-1 language code
- Supported: en, es, fr, de, ja, zh

## Saving Changes

1. Modify any settings
2. The **"Save Preferences"** button becomes enabled
3. Click **"Save Preferences"** to apply changes
4. Theme changes apply immediately
5. Other changes take effect on next app restart (if applicable)

## Resetting to Defaults

1. Click the **"Reset"** button
2. Confirm in the dialog
3. All preferences reset to factory defaults:
   - Theme: System
   - Autostart: Off
   - Data Directory: `./data`
   - Backup: Off, 60 minutes, `./backups`
   - Sync: Off
   - Language: English (en)
   - Hotkeys: Standard defaults

## Data Storage

Preferences are stored in two locations:
1. **Primary**: Turso database (persistent, synced)
2. **Fallback**: Browser localStorage (if database unavailable)

## Error Handling

Invalid input is highlighted with:
- Red border around the input field
- Red error message below the field
- Save button remains enabled, but validation prevents save

## Testing

Run automated tests:
```bash
npm run test:preferences-features
```

Expected: 67/67 tests passing

## Files

- **Service**: `src/services/preferences.ts`
- **UI Component**: `src/components/PreferencesModal.tsx`
- **Types**: `src/types/index.ts`
- **Database Schema**: `src/services/schema.sql`
- **Validation**: `src/lib/validation.ts`
- **Tests**: `scripts/verify-preferences-features.js`

## API Reference

### PreferencesService Methods

```typescript
// Load preferences from database
await preferencesService.loadPreferences(): Promise<Preferences>

// Save preferences to database
await preferencesService.savePreferences(prefs: Partial<Preferences>): Promise<void>

// Get current preferences
preferencesService.getPreferences(): Preferences

// Get current theme
preferencesService.getTheme(): 'light' | 'dark' | 'system'

// Set theme
await preferencesService.setTheme(theme: 'light' | 'dark' | 'system'): Promise<void>

// Get specific hotkey
preferencesService.getHotkey(action: string): string | undefined

// Set specific hotkey
await preferencesService.setHotkey(action: string, key: string): Promise<void>

// Reset all preferences to defaults
await preferencesService.resetToDefaults(): Promise<void>
```

## Troubleshooting

### Preferences Not Saving
- Check database connection
- Check browser console for errors
- Preferences will fallback to localStorage if DB unavailable

### Theme Not Applying
- Check if theme is set correctly in preferences
- Check browser console for JavaScript errors
- Try refreshing the application

### Invalid Input Not Saving
- Check for red error messages in the UI
- Correct the invalid input
- Try saving again

## Support

For issues or questions:
1. Check `PREFERENCES_VERIFICATION_REPORT.md` for detailed documentation
2. Run tests: `npm run test:preferences-features`
3. Check console for error messages
