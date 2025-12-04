# Feature Specification: Precise Camera Pan with Cursor Anchoring

**Feature Branch**: `002-precise-camera-pan`  
**Created**: 2025-12-04  
**Status**: Draft  
**Input**: User description: "Camera pan when dragging - the anchor of the cursor must stay precisely exactly under the cursor, not approximately, it must be literally computed as a raycast to the world plane and coords must be cast from screen to world plane"

## Problem Statement

When users pan the camera by dragging (middle mouse button), the point on the world plane that was initially under the cursor must remain **exactly** under the cursor throughout the entire drag operation. This requires mathematically precise coordinate transformation from screen space to world space using raycasting against the world ground plane.

The current implementation may have imprecision due to:
1. Screen coordinates not being properly offset relative to the viewport container's position in the document
2. Potential floating-point drift during continuous pan operations
3. Incorrect NDC (Normalized Device Coordinates) calculation when the viewport is not at document origin

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Precise Camera Panning (Priority: P1)

A user wants to navigate the 3D workspace by panning the camera. When they click and drag with the middle mouse button, the exact point on the ground plane that was under the cursor at the start of the drag must remain precisely under the cursor as they move the mouse. This creates an intuitive "grab and drag the world" interaction where the world moves exactly with the cursor.

**Why this priority**: This is the core and only functionality of this feature. Precise camera control is fundamental to a good 3D editing experience—users need to trust that their navigation inputs produce exact, predictable results.

**Independent Test**: Can be fully tested by clicking on a recognizable point (e.g., a grid intersection) and dragging. The grid intersection must stay exactly under the cursor throughout the drag.

**Acceptance Scenarios**:

1. **Given** the camera is viewing the workspace from any angle, **When** the user presses the middle mouse button with the cursor over a specific point on the ground plane (e.g., world coordinates X=5, Z=10), **Then** that exact world point (5, 0, 10) must remain directly under the cursor for the entire duration of the drag operation.

2. **Given** the user has initiated a pan drag, **When** they move the mouse by any amount in any direction, **Then** the world point originally under the cursor must track the cursor position with zero visual drift or offset.

3. **Given** the viewport container is positioned with an offset from the browser window origin (e.g., due to a sidebar or header), **When** the user performs a pan operation, **Then** the screen-to-world coordinate conversion must correctly account for the container's offset, and the anchor point must remain precisely under the cursor.

4. **Given** the camera is at any zoom level or rotation angle, **When** the user pans, **Then** the precision of cursor anchoring must be maintained regardless of camera orientation or distance.

---

### User Story 2 - Pan Release Stability (Priority: P2)

When the user releases the middle mouse button to end a pan operation, the camera must stop at its current position without any drift, snap, or adjustment.

**Why this priority**: Complements the primary panning behavior. Users expect that releasing the drag leaves the view exactly where they positioned it.

**Independent Test**: Pan to a new position and release. The view must remain exactly where it was at the moment of release.

**Acceptance Scenarios**:

1. **Given** the user is in the middle of a pan operation, **When** they release the middle mouse button, **Then** the camera target must remain at the exact position it was at the moment of release, with no post-release movement or correction.

2. **Given** the user releases the pan drag, **When** they immediately begin a new pan operation, **Then** the new anchor point must be calculated fresh from the current cursor position, and the previous pan state must have no influence.

---

### Edge Cases

- **Cursor outside viewport during drag**: If the user drags the cursor outside the viewport bounds while panning, the system should continue panning based on the projected ray direction, maintaining smooth behavior. The anchor relationship may not be preservable when the ray doesn't intersect the ground plane, but there should be no visual jump or error.

- **Ray does not intersect ground plane**: When the camera angle is such that the cursor's ray is parallel to or pointing away from the ground plane (e.g., looking straight up), the pan operation should gracefully handle this by either ignoring the pan input or using an alternative panning method (e.g., screen-space translation). No crashes or undefined behavior should occur.

- **Very small or very large drag movements**: Both micro-movements (1-2 pixels) and large rapid drags must maintain precision. There should be no threshold below which precision degrades.

- **High DPI / Retina displays**: The coordinate transformation must correctly handle device pixel ratio differences, ensuring precision on high-DPI displays where physical pixels differ from CSS pixels.

- **Container resize during pan**: If the viewport is resized while a pan is in progress, the system should either abort the pan gracefully or recalculate based on new container dimensions without causing jumps.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST compute the world-space anchor point by casting a ray from the camera through the cursor's screen position and intersecting it with the world ground plane (Y=0).

- **FR-002**: System MUST use the viewport container's bounding rectangle offset (not just window coordinates) when converting screen coordinates to normalized device coordinates (NDC).

- **FR-003**: System MUST maintain the invariant that the world-space anchor point captured at pan start remains at the same screen position throughout the drag operation.

- **FR-004**: System MUST recalculate the current cursor-to-world intersection on every mouse move during a pan operation, then adjust the camera target so the original anchor appears at the current cursor position.

- **FR-005**: System MUST handle the case where the cursor ray does not intersect the ground plane by gracefully degrading (ignoring input or using fallback) rather than producing errors or visual artifacts.

- **FR-006**: System MUST support correct operation regardless of the viewport container's position within the browser window (e.g., with sidebars, headers, or when not at 0,0).

- **FR-007**: System MUST correctly account for device pixel ratio when present, ensuring coordinate transformations are accurate on high-DPI displays.

- **FR-008**: System MUST clear the pan anchor state when the mouse button is released, ensuring no stale state affects subsequent operations.

### Key Entities

- **Screen Point**: A 2D coordinate in screen/client space (pixels from viewport container origin). Represents where the cursor is physically located on screen.

- **Normalized Device Coordinates (NDC)**: A 2D coordinate in the range [-1, 1] for both X and Y axes, representing position relative to the viewport. (−1, −1) is bottom-left, (1, 1) is top-right.

- **World Point**: A 3D coordinate in world space. For ground plane intersection, Y=0.

- **Camera Ray**: A ray originating from the camera position, passing through a point on the near plane corresponding to the NDC coordinates.

- **Ground Plane**: The infinite horizontal plane at Y=0 against which cursor rays are intersected.

- **Pan Anchor**: The world-space point captured at the start of a pan drag operation. This point must remain under the cursor throughout the drag.

- **Camera Target**: The world-space point the camera orbits around / looks at. Adjusting this point moves the camera's view.

## Assumptions

- The ground plane is always at Y=0 and is infinite in extent for intersection purposes.
- Middle mouse button (button 1) is the trigger for pan operations.
- The viewport container correctly reports its bounding rectangle via standard browser APIs.
- The camera uses a perspective projection (as indicated by existing PerspectiveCamera usage).
- Device pixel ratio is available and accurate via standard browser APIs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can place their cursor over any visible point on the ground plane, perform a pan drag, and observe that the original point remains exactly under the cursor with zero perceptible drift throughout the operation.

- **SC-002**: The anchor point precision holds for drag distances ranging from 1 pixel to the full screen diagonal, with no degradation at any scale.

- **SC-003**: The pan behavior works correctly when the viewport container has any offset from the window origin (testable by adding UI elements that offset the viewport).

- **SC-004**: 100% of pan operations complete without visual jumps, snaps, or errors, including edge cases like ray-parallel-to-ground scenarios.

- **SC-005**: Users on high-DPI displays experience the same precision as users on standard displays.
