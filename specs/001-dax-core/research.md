# Research: Dax Core Platform

**Feature**: 001-dax-core | **Date**: 2024-12-04

## Research Questions & Findings

### 1. Rapier.js WASM Performance

**Question**: Can we maintain 60 FPS with 100+ physics bodies in browser WASM?

**Findings**:
- Rapier.js (Rust→WASM port) benchmarks show 10,000+ rigid bodies at 60 FPS
- For 100 objects with simple colliders (boxes, spheres), overhead is negligible
- Key optimizations:
  - Use `ColliderBuilder.ball()` or `ColliderBuilder.cuboid()` over mesh colliders
  - Enable sleeping for static/settled objects (`RigidBodyBuilder.sleeping(true)`)
  - Use broad-phase acceleration (default in Rapier)
  - Batch physics steps when possible

**Recommendation**: Rapier.js is suitable. Implement physics sleeping for settled objects to reduce CPU usage during idle states.

**Reference**: https://rapier.rs/docs/user_guides/javascript/getting_started

---

### 2. Tauri File Drop API

**Question**: How to handle drag-and-drop files from OS file explorer?

**Findings**:
- Tauri 2.x provides `tauri://file-drop` event on windows
- Frontend receives file paths (not contents) via event
- Must use Tauri commands to read file contents after drop

**Implementation**:
```typescript
// Frontend
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

await listen('tauri://file-drop', async (event) => {
  const paths: string[] = event.payload;
  for (const path of paths) {
    const metadata = await invoke('get_file_metadata', { path });
    // Create FileObject from metadata
  }
});

// Also handle hover for visual feedback
await listen('tauri://file-drop-hover', (event) => {
  // Show drop indicator
});

await listen('tauri://file-drop-cancelled', () => {
  // Hide drop indicator
});
```

**Recommendation**: Native file drop works well. Need to handle the async file metadata fetching gracefully with loading states.

**Reference**: https://v2.tauri.app/reference/javascript/api/namespacewindow/#file-drop-events

---

### 3. Embedded Python in Rust (Sandbox)

**Question**: Is PyO3 feasible for embedding Python in Tauri for sandboxed execution?

**Findings**:
- PyO3 works but requires Python to be installed on user's system
- Significant binary size increase (~20MB for embedded interpreter)
- Security sandboxing is complex with PyO3—Python has many escape hatches
- Alternative: Use subprocess with `--isolated` flag and resource limits

**Options Evaluated**:

| Approach | Binary Size | Security | Complexity |
|----------|-------------|----------|------------|
| PyO3 embedded | +20MB | Medium (hard to sandbox) | High |
| Subprocess + limits | +0MB | High (OS-level isolation) | Medium |
| RustPython | +5MB | High (pure Rust) | Medium (limited stdlib) |
| WASM Python (Pyodide) | +15MB | High (WASM sandbox) | Low |

**Recommendation**: Use subprocess approach with:
- `ulimit` (Linux/macOS) or Job Objects (Windows) for resource limits
- Timeout via process kill
- Restricted PATH and environment
- Temporary directory isolation

For JavaScript, use `deno_core` which has built-in sandboxing.

**Reference**: https://pyo3.rs, https://rustpython.github.io

---

### 4. Three.js Instancing

**Question**: Best approach for rendering many similar objects efficiently?

**Findings**:
- Three.js `InstancedMesh` is ideal for many identical objects
- For Dax: Objects are NOT identical (different file types, states, selections)
- Better approach: Use `InstancedMesh` per object type with attributes for variation

**Implementation Strategy**:
```typescript
// Group objects by visual type
const fileInstances = new Map<FileCategory, InstancedMesh>();

// Create instanced mesh per category
for (const category of ['text', 'code', 'image', 'document']) {
  const geometry = getGeometryForCategory(category);
  const material = getMaterialForCategory(category); // Uses instanced attributes
  const mesh = new InstancedMesh(geometry, material, MAX_OBJECTS_PER_TYPE);
  fileInstances.set(category, mesh);
}

// Update instance matrices and colors per frame
mesh.setMatrixAt(index, matrix);
mesh.setColorAt(index, color); // For selection highlight, etc.
mesh.instanceMatrix.needsUpdate = true;
```

**Additional Optimizations**:
- LOD (Level of Detail): Simpler geometry when zoomed out
- Frustum culling: Built into Three.js
- Occlusion culling: Not needed for top-down view

**Recommendation**: Implement instanced rendering grouped by file category. Add LOD for 500+ objects.

**Reference**: https://threejs.org/docs/#api/en/objects/InstancedMesh

---

### 5. LLM Streaming in Tauri

**Question**: Architecture for streaming LLM responses through Tauri IPC?

**Findings**:
- Tauri commands are request/response, not streaming
- Use Tauri events for streaming data from backend to frontend
- Backend maintains HTTP streaming connection, emits chunks as events

**Implementation**:
```rust
// Backend (src-tauri/src/commands/llm.rs)
use tauri::Emitter;

#[tauri::command]
async fn stream_llm(
    request_id: String,
    messages: Vec<ChatMessage>,
    app: tauri::AppHandle
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let mut stream = client.post(LLM_URL)
        .json(&request)
        .send()
        .await?
        .bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        app.emit("llm-chunk", LLMChunk {
            request_id: request_id.clone(),
            content: parse_sse_chunk(&chunk),
        })?;
    }

    app.emit("llm-complete", LLMComplete { request_id })?;
    Ok(())
}
```

```typescript
// Frontend
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen<LLMChunk>('llm-chunk', (event) => {
  if (event.payload.requestId === myRequestId) {
    appendToResponse(event.payload.content);
  }
});

// Cleanup
unlisten();
```

**Recommendation**: This pattern works well. Consider adding backpressure handling for very fast streams.

**Reference**: https://v2.tauri.app/develop/calling-rust/#events

---

## Technology Decisions Summary

| Component | Decision | Rationale |
|-----------|----------|-----------|
| 3D Engine | Three.js | Mature, well-documented, performant |
| Physics | Rapier.js (WASM) | Modern, fast, good WASM support |
| UI Framework | React 18 | Team familiarity, ecosystem |
| State | Zustand | Lightweight, works well with imperative 3D code |
| Bundler | Vite | Fast dev, good Tauri integration |
| Python Sandbox | Subprocess + limits | Best security/complexity tradeoff |
| JS Sandbox | deno_core | Built-in sandboxing |
| LLM Streaming | Tauri events | Only viable option for Tauri |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Physics performance with many objects | Low | High | Implement sleeping, LOD, object limits |
| LLM latency affects UX | Medium | Medium | Streaming, optimistic UI, caching |
| Sandbox escape | Low | Critical | Use OS-level isolation, audit |
| Memory leaks in long sessions | Medium | High | Proper cleanup, memory monitoring |
| Cross-platform inconsistencies | Medium | Medium | CI testing on all platforms |

---

## Open Questions for Phase 1

1. **LLM Provider Selection**: Should we support multiple providers at once, or single configured provider?
   - *Leaning*: Single provider, configurable. Simpler UX.

2. **Agent Personality**: How customizable should agent appearance/voice be?
   - *Leaning*: Limited presets for v1. Full customization is scope creep.

3. **Workspace Sync**: Should workspaces be cloud-syncable?
   - *Leaning*: No for v1. Local-first. Export/import for portability.

4. **File Content Indexing**: Should we build a search index of file contents?
   - *Leaning*: Yes, using SQLite FTS5. Needed for agent awareness.
