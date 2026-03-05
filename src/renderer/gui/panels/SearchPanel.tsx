/**
 * SearchPanel — Top overlay for file search.
 *
 * Features:
 * - Ctrl+F toggles open/close
 * - Name search: instant, debounced 150ms, filters in-memory file list
 * - Content search: uses ripgrep/grep via IPC after pressing Enter
 * - Results show file path + matching line preview (for content search)
 * - Click result → camera flies to object + highlights it
 * - Matched objects glow (HighlightLayer), non-matched dim to 30% opacity
 * - Escape/Clear restores normal rendering
 * - Max 100 results with truncation indicator
 */
import {
  type Component,
  Show,
  For,
  createSignal,
  createEffect,
  onCleanup,
  onMount,
} from 'solid-js';
import {
  searchQuery,
  setSearchQuery,
  searchMode,
  setSearchMode,
  searchResults,
  setSearchResults,
  clearSearch,
} from '../../state/search';
import { showSearch, setShowSearch, setIsTextInputFocused } from '../../state/ui';
import { fileTree } from '../../state/file-tree';
import { appConfig } from '../../state/config';
import type { SearchResult } from '@shared/file-types';
import { SEARCH_DEBOUNCE_MS, MAX_SEARCH_RESULTS } from '@shared/constants';

export interface SearchPanelCallbacks {
  /** Search files via IPC (content search) */
  onContentSearch: (query: string, dir: string) => Promise<SearchResult[]>;
  /** Fly camera to a specific file object path */
  onFlyToObject: (path: string) => void;
  /** Apply search highlights: glow matched, dim non-matched */
  onApplyHighlights: (matchedPaths: Set<string>) => void;
  /** Clear all search highlights (restore normal rendering) */
  onClearHighlights: () => void;
}

export const SearchPanel: Component<{ callbacks: SearchPanelCallbacks }> = (props) => {
  let inputRef: HTMLInputElement | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const [totalCount, setTotalCount] = createSignal<number | null>(null);

  // Focus input when panel opens
  createEffect(() => {
    if (showSearch()) {
      // Small delay for DOM to be ready
      setTimeout(() => {
        inputRef?.focus();
        setIsTextInputFocused(true);
      }, 50);
    } else {
      setIsTextInputFocused(false);
    }
  });

  // Auto name-search on query change (debounced)
  createEffect(() => {
    const query = searchQuery();
    const mode = searchMode();

    if (!query) {
      setSearchResults({ results: [], loading: false, error: null });
      setTotalCount(null);
      props.callbacks.onClearHighlights();
      return;
    }

    if (mode === 'name') {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        performNameSearch(query);
      }, SEARCH_DEBOUNCE_MS);
    }
  });

  // Apply highlights when results change
  createEffect(() => {
    const results = searchResults.results;
    if (results.length > 0) {
      const matchedPaths = new Set(results.map((r) => r.path));
      props.callbacks.onApplyHighlights(matchedPaths);
    }
  });

  function performNameSearch(query: string): void {
    const entries = fileTree.entries;
    const lowerQuery = query.toLowerCase();

    const allMatches = entries.filter(
      (e) =>
        e.name.toLowerCase().includes(lowerQuery) ||
        e.path.toLowerCase().includes(lowerQuery),
    );

    const totalMatches = allMatches.length;
    const truncated = allMatches.slice(0, MAX_SEARCH_RESULTS);

    const results: SearchResult[] = truncated.map((e) => ({
      path: e.path,
      name: e.name,
    }));

    setSearchResults({ results, loading: false, error: null });
    setTotalCount(totalMatches > MAX_SEARCH_RESULTS ? totalMatches : null);
  }

  async function performContentSearch(): Promise<void> {
    const query = searchQuery();
    const dir = appConfig.workspacePath;
    if (!query || !dir) return;

    setSearchResults({ results: [], loading: true, error: null });
    setTotalCount(null);

    try {
      const results = await props.callbacks.onContentSearch(query, dir);
      setSearchResults({ results, loading: false, error: null });
      if (results.length >= MAX_SEARCH_RESULTS) {
        setTotalCount(MAX_SEARCH_RESULTS); // Indicate truncation
      }
    } catch (err) {
      setSearchResults({
        results: [],
        loading: false,
        error: (err as Error).message,
      });
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      handleClose();
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (e.key === 'Enter' && searchMode() === 'content') {
      performContentSearch();
      e.preventDefault();
      return;
    }
  }

  function handleClose(): void {
    clearSearch();
    setTotalCount(null);
    setShowSearch(false);
    props.callbacks.onClearHighlights();
  }

  function handleClear(): void {
    clearSearch();
    setTotalCount(null);
    props.callbacks.onClearHighlights();
    inputRef?.focus();
  }

  function handleResultClick(result: SearchResult): void {
    props.callbacks.onFlyToObject(result.path);
  }

  onCleanup(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    setIsTextInputFocused(false);
  });

  return (
    <Show when={showSearch()}>
      <div style={panelStyle}>
        {/* Search input row */}
        <div style={inputRowStyle}>
          <div style={searchIconStyle}>⌕</div>
          <input
            ref={inputRef}
            type="text"
            placeholder={searchMode() === 'name' ? 'Search files by name...' : 'Search file contents...'}
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsTextInputFocused(true)}
            onBlur={() => setIsTextInputFocused(false)}
            style={inputStyle}
          />

          {/* Mode toggle */}
          <div style={toggleGroupStyle}>
            <button
              style={{
                ...toggleBtnStyle,
                ...(searchMode() === 'name' ? toggleActiveStyle : {}),
              }}
              onClick={() => setSearchMode('name')}
              title="Search by filename"
            >
              Name
            </button>
            <button
              style={{
                ...toggleBtnStyle,
                ...(searchMode() === 'content' ? toggleActiveStyle : {}),
              }}
              onClick={() => setSearchMode('content')}
              title="Search file contents (Enter to search)"
            >
              Content
            </button>
          </div>

          {/* Clear button */}
          <Show when={searchQuery()}>
            <button style={clearBtnStyle} onClick={handleClear} title="Clear search">
              ✕
            </button>
          </Show>

          {/* Close button */}
          <button style={closeBtnStyle} onClick={handleClose} title="Close search (Esc)">
            ✕
          </button>
        </div>

        {/* Results */}
        <Show when={searchQuery()}>
          <div style={resultsContainerStyle}>
            {/* Loading indicator */}
            <Show when={searchResults.loading}>
              <div style={statusStyle}>Searching...</div>
            </Show>

            {/* Error */}
            <Show when={searchResults.error}>
              <div style={errorStyle}>{searchResults.error}</div>
            </Show>

            {/* Results list */}
            <Show when={!searchResults.loading && searchResults.results.length > 0}>
              <div style={resultsListStyle}>
                <For each={searchResults.results}>
                  {(result) => (
                    <button
                      style={resultItemStyle}
                      onClick={() => handleResultClick(result)}
                      title={result.path}
                    >
                      <span style={resultNameStyle}>{result.name}</span>
                      <span style={resultPathStyle}>{result.path}</span>
                      <Show when={result.lineNumber != null}>
                        <span style={resultLineStyle}>
                          L{result.lineNumber}: {result.linePreview}
                        </span>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>

            {/* Truncation indicator */}
            <Show when={totalCount() != null}>
              <div style={truncationStyle}>
                Showing {Math.min(MAX_SEARCH_RESULTS, searchResults.results.length)} of {totalCount()} results
              </div>
            </Show>

            {/* No results */}
            <Show when={
              !searchResults.loading &&
              searchResults.results.length === 0 &&
              !searchResults.error &&
              searchQuery()
            }>
              <div style={statusStyle}>No results found</div>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );
};

// ── Styles ──

const panelStyle: Record<string, string> = {
  position: 'absolute',
  top: '60px',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '600px',
  'max-width': '90vw',
  'background-color': 'rgba(18, 18, 28, 0.95)',
  'border-radius': '12px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  'box-shadow': '0 8px 32px rgba(0, 0, 0, 0.5)',
  'pointer-events': 'auto',
  overflow: 'hidden',
  'z-index': '1000',
  'backdrop-filter': 'blur(20px)',
};

const inputRowStyle: Record<string, string> = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  padding: '12px 16px',
  'border-bottom': '1px solid rgba(255, 255, 255, 0.06)',
};

const searchIconStyle: Record<string, string> = {
  'font-size': '18px',
  color: '#8a8a9a',
  'flex-shrink': '0',
};

const inputStyle: Record<string, string> = {
  flex: '1',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: '#e0e0e0',
  'font-size': '14px',
  'font-family': 'monospace',
  padding: '4px 0',
};

const toggleGroupStyle: Record<string, string> = {
  display: 'flex',
  gap: '2px',
  'flex-shrink': '0',
};

const toggleBtnStyle: Record<string, string> = {
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  color: '#8a8a9a',
  padding: '4px 10px',
  'font-size': '11px',
  'border-radius': '6px',
  cursor: 'pointer',
  transition: 'all 0.15s',
};

const toggleActiveStyle: Record<string, string> = {
  background: 'rgba(79, 195, 247, 0.2)',
  color: '#4fc3f7',
  'border-color': 'rgba(79, 195, 247, 0.4)',
};

const clearBtnStyle: Record<string, string> = {
  background: 'transparent',
  border: 'none',
  color: '#6a6a7a',
  'font-size': '14px',
  cursor: 'pointer',
  padding: '4px 8px',
  'border-radius': '4px',
};

const closeBtnStyle: Record<string, string> = {
  background: 'transparent',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  color: '#8a8a9a',
  'font-size': '12px',
  cursor: 'pointer',
  padding: '4px 8px',
  'border-radius': '6px',
};

const resultsContainerStyle: Record<string, string> = {
  'max-height': '400px',
  'overflow-y': 'auto',
};

const statusStyle: Record<string, string> = {
  padding: '16px',
  color: '#6a6a7a',
  'font-size': '13px',
  'text-align': 'center',
};

const errorStyle: Record<string, string> = {
  padding: '12px 16px',
  color: '#e94560',
  'font-size': '13px',
};

const resultsListStyle: Record<string, string> = {
  padding: '4px 0',
};

const resultItemStyle: Record<string, string> = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '2px',
  width: '100%',
  padding: '8px 16px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  'text-align': 'left',
  color: '#e0e0e0',
  transition: 'background 0.15s',
};

const resultNameStyle: Record<string, string> = {
  'font-size': '13px',
  'font-weight': '600',
  color: '#e0e0e0',
};

const resultPathStyle: Record<string, string> = {
  'font-size': '11px',
  color: '#6a6a7a',
  'font-family': 'monospace',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
};

const resultLineStyle: Record<string, string> = {
  'font-size': '11px',
  color: '#8a8a9a',
  'font-family': 'monospace',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
  'margin-top': '2px',
};

const truncationStyle: Record<string, string> = {
  padding: '8px 16px',
  'font-size': '11px',
  color: '#e94560',
  'text-align': 'center',
  'border-top': '1px solid rgba(255, 255, 255, 0.06)',
};
