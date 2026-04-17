import React, { useState, useEffect, useMemo } from 'react';
import { Search, Database, Layers, PackageX, ChevronRight, X } from 'lucide-react';

const dataFiles = import.meta.glob('./data/*.json');

export default function App() {
  const [db, setDb] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeFile, setActiveFile] = useState('SCENE.HQR.json');
  const [search, setSearch] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);

  useEffect(() => {
    async function loadData() {
      const loaded = {};
      for (const path in dataFiles) {
        const mod = await dataFiles[path]();
        const filename = path.split('/').pop();
        // The default export or raw JSON is usually mod.default
        loaded[filename] = mod.default || mod;
      }
      setDb(loaded);
      setLoading(false);
    }
    loadData();
  }, []);

  const currentData = db[activeFile] || null;

  const filteredEntries = useMemo(() => {
    if (!currentData || !currentData.entries) return [];
    if (!search.trim()) return currentData.entries.map((e, idx) => ({ ...e, index: idx }));
    const s = search.toLowerCase();
    
    return currentData.entries
      .map((entry, index) => ({ ...entry, index }))
      .filter((entry) => {
        // Deep search through all stringable properties
        return Object.values(entry).some(val => 
          val && typeof val === 'string' && val.toLowerCase().includes(s)
        );
      });
  }, [currentData, search]);

  if (loading) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <h2 className="animate-pulse flex items-center gap-3">
          <Database className="animate-spin" /> Loading Metadata DB...
        </h2>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header>
        <h1>LBA1 Metadata Dashboard</h1>
        <p style={{ color: 'var(--text-muted)' }}>Browse and query HQR asset metadata intelligently.</p>
      </header>

      <div className="filters">
        <select 
          className="select-input" 
          value={activeFile} 
          onChange={(e) => {
            setActiveFile(e.target.value);
            setSearch('');
          }}
        >
          {Object.keys(db).sort().map(file => (
            <option key={file} value={file}>{file.replace('.json', '')}</option>
          ))}
        </select>

        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search entries, descriptions, IDs..." 
            style={{ paddingLeft: '2.5rem', width: '100%' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {currentData && (
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ color: 'var(--accent)' }}>
            {currentData.description || "No description provided."}
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Showing {filteredEntries.length} of {currentData.entries?.length || 0} entries.
          </p>
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', border: '1px dashed var(--panel-border)', borderRadius: 'var(--radius)' }}>
          <PackageX size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3>No entries matched your query.</h3>
        </div>
      ) : (
        <div className="grid-container">
          {filteredEntries.map((entry) => (
            <div 
              key={entry.index} 
              className="card"
              onClick={() => setSelectedEntry(entry)}
            >
              <div className="card-title">
                <span>Entry #{entry.index}</span>
                <span className="card-badge">{entry.type || "unknown"}</span>
              </div>
              <div className="card-desc">
                {entry.description || entry.name || (
                  <span style={{ fontStyle: 'italic', opacity: 0.7 }}>No description</span>
                )}
              </div>
              <ChevronRight size={18} style={{ position: 'absolute', right: '1rem', bottom: '1.5rem', opacity: 0.5, color: 'var(--accent)' }} />
            </div>
          ))}
        </div>
      )}

      {/* Modal Inspector */}
      {selectedEntry && (
        <div className="modal-overlay" onClick={() => setSelectedEntry(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedEntry(null)}><X /></button>
            <h2 style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers /> Entry #{selectedEntry.index} Details
            </h2>
            <div style={{ background: '#0a0a0f', padding: '1.5rem', borderRadius: '8px', border: '1px solid #222', marginTop: '1.5rem', overflowX: 'auto' }}>
              <pre style={{ color: '#fff', fontSize: '0.9rem', lineHeight: '1.5' }}>
                {JSON.stringify({ ...selectedEntry, index: undefined }, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
