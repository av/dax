/**
 * Search signal.
 * Tracks search query, mode, and results.
 */
import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { SearchResult } from '@shared/file-types';

/** Search query and mode */
const [searchQuery, setSearchQuery] = createSignal<string>('');
const [searchMode, setSearchMode] = createSignal<'name' | 'content'>('name');

/** Search results store */
export interface SearchResultsState {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
}

const [searchResults, setSearchResults] = createStore<SearchResultsState>({
  results: [],
  loading: false,
  error: null,
});

export {
  searchQuery,
  setSearchQuery,
  searchMode,
  setSearchMode,
  searchResults,
  setSearchResults,
};

/** Clear search state. */
export function clearSearch(): void {
  setSearchQuery('');
  setSearchResults({ results: [], loading: false, error: null });
}
