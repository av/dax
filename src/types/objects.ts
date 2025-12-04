export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type DataObjectType = 'file' | 'snippet' | 'boundary' | 'beacon';

export interface DataObject {
  id: string;
  type: DataObjectType;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  velocity: Vector3;
  isStatic: boolean;
  isSelected: boolean;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

export type FileCategory =
  | 'text'
  | 'code'
  | 'image'
  | 'document'
  | 'data'
  | 'archive'
  | 'media'
  | 'unknown';

export interface FilePreview {
  type: 'thumbnail' | 'text' | 'none';
  data?: string;
}

export interface FileObject extends DataObject {
  type: 'file';
  path: string;
  name: string;
  extension: string;
  category: FileCategory;
  sizeBytes: number;
  mimeType: string;
  preview?: FilePreview;
  isEditable: boolean;
  lastModified: number;
}

export interface TextRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface Snippet extends DataObject {
  type: 'snippet';
  content: string;
  title?: string;
  sourceFileId?: string;
  sourceRange?: TextRange;
  tags: string[];
  color: string;
}

export type BoundaryAction =
  | 'organize'
  | 'summarize'
  | 'review'
  | 'ignore'
  | 'protect'
  | 'custom';

export interface BoundaryInstruction {
  id: string;
  action: BoundaryAction;
  parameters: Record<string, unknown>;
  priority: number;
}

export interface Boundary extends DataObject {
  type: 'boundary';
  vertices: Vector3[];
  instructions: BoundaryInstruction[];
  color: string;
  label?: string;
  isActive: boolean;
}

export type BeaconType =
  | 'attract'
  | 'repel'
  | 'speed'
  | 'careful'
  | 'notify'
  | 'pause';

export interface Beacon extends DataObject {
  type: 'beacon';
  beaconType: BeaconType;
  radius: number;
  intensity: number;
  color: string;
  label?: string;
  isActive: boolean;
}

export type AnyDataObject = FileObject | Snippet | Boundary | Beacon;

export function createVector3(x = 0, y = 0, z = 0): Vector3 {
  return { x, y, z };
}

export function createDefaultDataObject(
  id: string,
  type: DataObjectType,
  position: Vector3 = createVector3()
): Omit<DataObject, 'type'> & { type: DataObjectType } {
  const now = Date.now();
  return {
    id,
    type,
    position,
    rotation: createVector3(),
    scale: createVector3(1, 1, 1),
    velocity: createVector3(),
    isStatic: false,
    isSelected: false,
    createdAt: now,
    updatedAt: now,
    metadata: {},
  };
}
