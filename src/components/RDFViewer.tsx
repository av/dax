import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Plus, Trash2, Search, Link as LinkIcon, X, Save } from 'lucide-react';
import { RDFEntity, RDFLink } from '@/types';
import { rdfService } from '@/services/rdf';
import { generateUUID } from '@/lib/utils';

interface RDFViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RDFViewer: React.FC<RDFViewerProps> = ({ isOpen, onClose }) => {
  const [entities, setEntities] = useState<RDFEntity[]>([]);
  const [links, setLinks] = useState<RDFLink[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<RDFEntity | null>(null);
  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newEntity, setNewEntity] = useState<Partial<RDFEntity>>({
    type: '',
    attributes: {},
  });
  const [newLink, setNewLink] = useState<Partial<RDFLink>>({
    from: '',
    to: '',
    type: 'relates_to',
  });
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const allEntities = await rdfService.getAllEntities();
      const allLinks = await rdfService.getAllLinks();
      setEntities(allEntities);
      setLinks(allLinks);
    } catch (error) {
      console.error('Failed to load RDF data:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      await loadData();
      return;
    }

    try {
      const results = await rdfService.search(searchTerm);
      setEntities(results);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleAddEntity = async () => {
    if (!newEntity.type) {
      alert('Entity type is required');
      return;
    }

    const entity: RDFEntity = {
      id: `entity-${generateUUID()}`,
      type: newEntity.type,
      attributes: newEntity.attributes || {},
      links: [],
    };

    try {
      await rdfService.addEntity(entity);
      await loadData();
      setIsAddingEntity(false);
      setNewEntity({ type: '', attributes: {} });
    } catch (error) {
      console.error('Failed to add entity:', error);
    }
  };

  const handleDeleteEntity = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entity?')) return;

    try {
      await rdfService.deleteEntity(id);
      await loadData();
      if (selectedEntity?.id === id) {
        setSelectedEntity(null);
      }
    } catch (error) {
      console.error('Failed to delete entity:', error);
    }
  };

  const handleAddLink = async () => {
    if (!newLink.from || !newLink.to || !newLink.type) {
      alert('All link fields are required');
      return;
    }

    try {
      await rdfService.addLink(newLink as RDFLink);
      await loadData();
      setIsAddingLink(false);
      setNewLink({ from: '', to: '', type: 'relates_to' });
    } catch (error) {
      console.error('Failed to add link:', error);
    }
  };

  const handleDeleteLink = async (from: string, to: string) => {
    if (!confirm('Are you sure you want to delete this link?')) return;

    try {
      await rdfService.deleteLink(from, to);
      await loadData();
    } catch (error) {
      console.error('Failed to delete link:', error);
    }
  };

  const handleAddAttribute = () => {
    if (!newAttrKey || !newAttrValue) return;

    setNewEntity({
      ...newEntity,
      attributes: {
        ...(newEntity.attributes || {}),
        [newAttrKey]: newAttrValue,
      },
    });

    setNewAttrKey('');
    setNewAttrValue('');
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear ALL RDF data? This cannot be undone.')) return;

    try {
      await rdfService.clear();
      await loadData();
      setSelectedEntity(null);
    } catch (error) {
      console.error('Failed to clear RDF data:', error);
    }
  };

  if (!isOpen) return null;

  const filteredEntities = searchTerm
    ? entities.filter(e =>
        e.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        Object.values(e.attributes).some(v =>
          String(v).toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    : entities;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>RDF Knowledge Graph</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsAddingEntity(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Entity
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsAddingLink(true)}>
                <LinkIcon className="h-4 w-4 mr-1" />
                Link
              </Button>
              <Button size="sm" variant="destructive" onClick={handleClearAll}>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <Input
              placeholder="Search entities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <div>{entities.length} entities</div>
            <div>{links.length} links</div>
          </div>

          {/* Add Entity Form */}
          {isAddingEntity && (
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="text-base">New Entity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <Input
                    value={newEntity.type || ''}
                    onChange={(e) => setNewEntity({ ...newEntity, type: e.target.value })}
                    placeholder="Person, Organization, Event..."
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Attributes</label>
                  <div className="space-y-2 mt-2">
                    {Object.entries(newEntity.attributes || {}).map(([key, value]) => (
                      <div key={key} className="flex gap-2 items-center">
                        <span className="text-xs font-medium w-24">{key}:</span>
                        <span className="text-xs flex-1">{String(value)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const attrs = { ...(newEntity.attributes || {}) };
                            delete attrs[key];
                            setNewEntity({ ...newEntity, attributes: attrs });
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Key"
                        value={newAttrKey}
                        onChange={(e) => setNewAttrKey(e.target.value)}
                        className="text-xs"
                      />
                      <Input
                        placeholder="Value"
                        value={newAttrValue}
                        onChange={(e) => setNewAttrValue(e.target.value)}
                        className="text-xs"
                      />
                      <Button size="sm" onClick={handleAddAttribute}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAddEntity} className="flex-1">
                    <Save className="h-4 w-4 mr-2" />
                    Add Entity
                  </Button>
                  <Button variant="outline" onClick={() => setIsAddingEntity(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add Link Form */}
          {isAddingLink && (
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="text-base">New Link</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium">From Entity</label>
                  <select
                    value={newLink.from || ''}
                    onChange={(e) => setNewLink({ ...newLink, from: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-input bg-background text-foreground rounded text-sm"
                  >
                    <option value="">Select entity...</option>
                    {entities.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.type} - {e.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">To Entity</label>
                  <select
                    value={newLink.to || ''}
                    onChange={(e) => setNewLink({ ...newLink, to: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-input bg-background text-foreground rounded text-sm"
                  >
                    <option value="">Select entity...</option>
                    {entities.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.type} - {e.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Link Type</label>
                  <Input
                    value={newLink.type || ''}
                    onChange={(e) => setNewLink({ ...newLink, type: e.target.value })}
                    placeholder="relates_to, knows, located_at..."
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAddLink} className="flex-1">
                    <Save className="h-4 w-4 mr-2" />
                    Add Link
                  </Button>
                  <Button variant="outline" onClick={() => setIsAddingLink(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Entities Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Entities List */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Entities</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredEntities.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No entities found
                  </div>
                ) : (
                  filteredEntities.map((entity) => (
                    <Card
                      key={entity.id}
                      className={`cursor-pointer transition-colors ${
                        selectedEntity?.id === entity.id ? 'border-primary' : ''
                      }`}
                      onClick={() => setSelectedEntity(entity)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{entity.type}</div>
                            <div className="text-xs text-muted-foreground">
                              {Object.entries(entity.attributes)
                                .slice(0, 2)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(', ')}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEntity(entity.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Entity Details */}
            <div>
              <h3 className="font-semibold text-sm mb-2">Details</h3>
              {selectedEntity ? (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">Type</div>
                      <div className="text-sm">{selectedEntity.type}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">ID</div>
                      <div className="text-xs font-mono">{selectedEntity.id}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Attributes</div>
                      {Object.entries(selectedEntity.attributes).length === 0 ? (
                        <div className="text-xs text-muted-foreground">No attributes</div>
                      ) : (
                        <div className="space-y-1">
                          {Object.entries(selectedEntity.attributes).map(([key, value]) => (
                            <div key={key} className="text-xs">
                              <span className="font-medium">{key}:</span> {String(value)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Links</div>
                      {links.filter(l => l.from === selectedEntity.id || l.to === selectedEntity.id).length === 0 ? (
                        <div className="text-xs text-muted-foreground">No links</div>
                      ) : (
                        <div className="space-y-1">
                          {links
                            .filter(l => l.from === selectedEntity.id || l.to === selectedEntity.id)
                            .map((link, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs">
                                <span>
                                  {link.from === selectedEntity.id ? '→' : '←'} {link.type}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteLink(link.from, link.to)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center text-sm text-muted-foreground py-8">
                  Select an entity to view details
                </div>
              )}
            </div>
          </div>

          {/* Links Summary */}
          {links.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2">All Links</h3>
              <div className="space-y-1 max-h-[150px] overflow-y-auto">
                {links.map((link, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-2 bg-slate-50 dark:bg-slate-800 rounded">
                    <span>
                      {link.from} → [{link.type}] → {link.to}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteLink(link.from, link.to)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
