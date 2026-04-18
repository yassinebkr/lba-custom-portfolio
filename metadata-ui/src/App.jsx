import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, Image as ImageIcon, Star, StarOff, X, Download, Filter, Layers, MapPin, Grid, Home, Upload, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { AssetUploader } from './AssetUploader';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'hud', label: 'HUD / Inventory', match: /(heart|magic\b|^magic$|key\b|leaf|clover|bottle|syrup|coin|package|book|keypad|globe|bomb)/i },
  { id: 'doors', label: 'Doors / Passages', match: /(door|hatchway|passage|padlock)/i },
  { id: 'platforms', label: 'Platforms / Ground', match: /(platform|plataform|ground|hatchway|false ground|frozen ground)/i },
  { id: 'walls', label: 'Walls / Fences', match: /(fence|wall)/i },
  { id: 'projectiles', label: 'Projectiles / FX', match: /(bullet|missile|ball|bolt|explosion|sequence)/i },
  { id: 'temple', label: 'Temple of Bu`', match: /temple of bu/i },
  { id: 'decor', label: 'Decorations / NPC props', match: /(statue|bust|cadre|safe|barrel|sign|runic|mushroom|sleeping|talk symbol|z \(sleep)/i },
  { id: 'levers', label: 'Levers / Controls', match: /(lever|keypad|broken lever)/i },
  { id: 'unknown', label: 'Unknown / ??', match: /\?\?|^$/i },
];

const PORTFOLIO_SCENES = [
  { id: 43, label: 'Museum (hub)' },
  { id: 5,  label: "Twinsen's house" },
  { id: 42, label: 'Proxim City (CinePi)' },
  { id: 54, label: "Inventor's house" },
  { id: 60, label: 'Rebel camp (GSAT)' },
  { id: 17, label: 'Ruins (OpenClaw)' },
];
const PORTFOLIO_SCENE_IDS = new Set(PORTFOLIO_SCENES.map(s => s.id));

const STORAGE_KEY = 'lba-portfolio-targets-v1';

const BRICK_BUCKETS = [
  { id: 'all',       label: 'All bricks' },
  { id: 'floor',     label: 'Floor (48×26)' },
  { id: 'wall',      label: 'Wall (48/46×38)' },
  { id: 'half-tile', label: 'Half-tile (24×23)' },
  { id: 'tall',      label: 'Tall / pillar' },
  { id: 'thin',      label: 'Thin / edge' },
  { id: 'other',     label: 'Other' },
];

function classify(description = '') {
  const matches = [];
  for (const cat of CATEGORIES) {
    if (cat.id === 'all') continue;
    if (cat.match && cat.match.test(description)) matches.push(cat.id);
  }
  return matches.length ? matches : ['unknown'];
}

export default function App() {
  const [mode, setMode] = useState('scenes'); // 'scenes' | 'sprites' | 'bricks'

  return (
    <div className="app-container">
      <header>
        <h1>LBA1 Asset Editor</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Paint whole rooms as one image in the <strong>Scenes</strong> tab, or edit individual <strong>Sprites</strong> (billboards) and <strong>Bricks</strong> (tiles) for fine control.
        </p>
      </header>

      <div className="tab-bar">
        <button
          className={`tab-button ${mode === 'scenes' ? 'tab-active' : ''}`}
          onClick={() => setMode('scenes')}
        >
          <Home size={16} /> Scenes
        </button>
        <button
          className={`tab-button ${mode === 'sprites' ? 'tab-active' : ''}`}
          onClick={() => setMode('sprites')}
        >
          <ImageIcon size={16} /> Sprites
        </button>
        <button
          className={`tab-button ${mode === 'bricks' ? 'tab-active' : ''}`}
          onClick={() => setMode('bricks')}
        >
          <Grid size={16} /> Bricks
        </button>
      </div>

      {mode === 'scenes'  && <ScenesView />}
      {mode === 'sprites' && <SpritesView />}
      {mode === 'bricks'  && <BricksView />}
    </div>
  );
}

function ScenesView() {
  return (
    <div className="scenes-grid">
      <div className="scenes-intro">
        <p>
          Each card is a flat isometric render of one portfolio room. <strong>Download</strong> the
          template, paint over it in your editor of choice (Photoshop, Procreate, Nano Banana, Krita —
          anything), then <strong>drop the painted PNG back in</strong>. Pixels get sampled per brick,
          mode-picked, palette-snapped, and injected into <code>LBA_BRK.HQR</code>.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>
          Bricks tile across the room. If you paint 1246 floor cells with the same pattern, the engine
          reproduces it faithfully. If you paint each floor cell differently, the "mode pixel" wins —
          the <em>paint-consistency</em> score in the injector tells you which bricks averaged cleanly.
        </p>
      </div>
      {PORTFOLIO_SCENES.map(s => <SceneCard key={s.id} scene={s} />)}
    </div>
  );
}

function SceneCard({ scene }) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [nonce, setNonce] = useState(0);
  const fileRef = useRef(null);

  const templateUrl = `/scenes/scene-${scene.id}-template.png?v=${nonce}`;

  const upload = async (file) => {
    if (!file) return;
    if (!file.type.includes('png') && !file.name.toLowerCase().endsWith('.png')) {
      setError('PNG only — export from your editor as PNG.');
      return;
    }
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/save-scene/${scene.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: file,
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      if (!res.ok || !json?.ok) {
        throw new Error(`injector failed (exit ${json?.exitCode}):\n${json?.log || text}`);
      }
      setResult(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    upload(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="scene-card">
      <div className="scene-card-head">
        <h3>{scene.label}</h3>
        <span className="scene-id">scene {scene.id}</span>
      </div>

      <a href={templateUrl} download={`scene-${scene.id}-template.png`} className="scene-template-link">
        <img src={templateUrl} alt={`scene ${scene.id}`} className="scene-template" />
        <div className="scene-template-overlay"><Download size={16} /> Download template</div>
      </a>

      <div
        className={`scene-drop ${dragOver ? 'scene-drop-active' : ''} ${uploading ? 'scene-drop-busy' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <><RefreshCw size={16} className="spin" /> Injecting…</>
        ) : (
          <><Upload size={16} /> Drop painted PNG or click</>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png"
          style={{ display: 'none' }}
          onChange={e => upload(e.target.files?.[0])}
        />
      </div>

      {error && (
        <div className="scene-error">
          <AlertTriangle size={14} /> <pre>{error}</pre>
        </div>
      )}

      {result && (
        <div className="scene-success">
          <Check size={14} /> Injected {Math.round(result.bytes / 1024)} KB →{' '}
          <code>output/LBA_BRK.HQR</code>
          <details>
            <summary>injector log</summary>
            <pre>{result.log}</pre>
          </details>
          <div className="scene-next">
            Next: <code>bash scripts/build-web-bundle.sh</code> to rebuild the game.
          </div>
        </div>
      )}
    </div>
  );
}

function SpritesView() {
  const [metadata, setMetadata] = useState(null);
  const [sceneIndex, setSceneIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [activeScene, setActiveScene] = useState('all');
  const [onlyTargets, setOnlyTargets] = useState(false);
  const [targets, setTargets] = useState({});
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/sprites/_metadata.json').then(r => r.ok ? r.json() : Promise.reject(new Error(`sprites: ${r.status}`))),
      fetch('/scene-sprites.json').then(r => r.ok ? r.json() : Promise.reject(new Error(`scenes: ${r.status}`))),
    ])
      .then(([spritesMeta, sceneMeta]) => {
        setMetadata(spritesMeta);
        setSceneIndex(sceneMeta);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setTargets(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(targets)); } catch {}
  }, [targets]);

  const entries = useMemo(() => {
    if (!metadata?.entries) return [];
    const spriteToScenes = sceneIndex?.spriteToScenes || {};
    return metadata.entries.map(e => {
      const scenes = spriteToScenes[e.index] || [];
      const portfolioScenes = scenes.filter(id => PORTFOLIO_SCENE_IDS.has(id));
      return { ...e, categories: classify(e.description), scenes, portfolioScenes };
    });
  }, [metadata, sceneIndex]);

  const version = metadata?.version || metadata?.generatedAt || 0;
  const nonce = useMemo(() => Date.now().toString(36) + Math.random().toString(36).slice(2), []);
  const imgQuery = `v=${version}&n=${nonce}`;

  const counts = useMemo(() => {
    const c = { all: entries.length };
    for (const cat of CATEGORIES) if (cat.id !== 'all') c[cat.id] = 0;
    for (const e of entries) for (const cid of e.categories) if (c[cid] !== undefined) c[cid]++;
    return c;
  }, [entries]);

  const portfolioSpriteSet = useMemo(() => {
    const s = new Set();
    for (const e of entries) if (e.portfolioScenes.length) s.add(e.index);
    return s;
  }, [entries]);

  const activeSceneSpriteSet = useMemo(() => {
    if (activeScene === 'all') return null;
    if (activeScene === 'portfolio') return portfolioSpriteSet;
    const s = sceneIndex?.scenes?.[activeScene];
    return new Set(s?.sprites || []);
  }, [activeScene, portfolioSpriteSet, sceneIndex]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(e => {
      if (onlyTargets && !targets[e.index]?.marked) return false;
      if (activeCat !== 'all' && !e.categories.includes(activeCat)) return false;
      if (activeSceneSpriteSet && !activeSceneSpriteSet.has(e.index)) return false;
      if (q) {
        const hay = `${e.index} ${e.filename} ${e.description || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, activeCat, activeSceneSpriteSet, search, onlyTargets, targets]);

  const toggleTarget = useCallback((idx) => {
    setTargets(prev => {
      const cur = prev[idx] || {};
      return { ...prev, [idx]: { ...cur, marked: !cur.marked } };
    });
  }, []);

  const updateNote = useCallback((idx, note) => {
    setTargets(prev => ({ ...prev, [idx]: { ...(prev[idx] || {}), note, marked: true } }));
  }, []);

  const exportTargets = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: 'SPRITES.HQR',
      entries: entries
        .filter(e => targets[e.index]?.marked)
        .map(e => ({
          index: e.index,
          filename: e.filename,
          description: e.description,
          width: e.width,
          height: e.height,
          scenes: e.scenes,
          portfolioScenes: e.portfolioScenes,
          note: targets[e.index]?.note || '',
        })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio-targets.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [entries, targets]);

  const targetCount = Object.values(targets).filter(t => t?.marked).length;

  if (loading) return <LoadingBlock label="Loading sprite metadata…" />;
  if (error) return <ErrorBlock message={error} hint="Run npm run extract and extract-scene-sprites.js" />;

  const allScenes = sceneIndex?.scenes || {};
  const sceneEntries = Object.entries(allScenes)
    .map(([id, info]) => ({ id: Number(id), ...info }))
    .sort((a, b) => a.id - b.id);

  return (
    <>
      <div className="filters">
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="search-input"
            placeholder="Search by description, filename, or index…"
            style={{ paddingLeft: '2.5rem', width: '100%' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="select-input"
          value={activeScene}
          onChange={(e) => {
            const v = e.target.value;
            setActiveScene(v === 'all' || v === 'portfolio' ? v : Number(v));
          }}
          title="Filter by scene"
        >
          <option value="all">All scenes</option>
          <option value="portfolio">⭐ Portfolio scenes only ({portfolioSpriteSet.size} sprites)</option>
          <optgroup label="Portfolio rooms">
            {PORTFOLIO_SCENES.map(s => {
              const info = allScenes[s.id];
              const count = info?.sprites?.length || 0;
              return (
                <option key={s.id} value={s.id}>
                  #{s.id} {s.label} — {count} sprite{count === 1 ? '' : 's'}
                </option>
              );
            })}
          </optgroup>
          <optgroup label="All scenes">
            {sceneEntries.map(s => (
              <option key={s.id} value={s.id}>
                #{s.id} {s.description?.replace(/^Scene \d+: /, '')} — {s.sprites.length}
              </option>
            ))}
          </optgroup>
        </select>

        <button
          className={`chip ${onlyTargets ? 'chip-active' : ''}`}
          onClick={() => setOnlyTargets(v => !v)}
          title="Show only portfolio-marked sprites"
        >
          <Star size={14} /> Marked ({targetCount})
        </button>

        <button className="chip" onClick={exportTargets} disabled={!targetCount} title="Download portfolio-targets.json">
          <Download size={14} /> Export
        </button>
      </div>

      <div className="chip-row">
        <Filter size={14} style={{ color: 'var(--text-muted)', alignSelf: 'center' }} />
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`chip ${activeCat === cat.id ? 'chip-active' : ''}`}
            onClick={() => setActiveCat(cat.id)}
          >
            {cat.label} <span className="chip-count">{counts[cat.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {activeScene !== 'all' && (
        <ScenePanel
          activeScene={activeScene}
          allScenes={allScenes}
          onClear={() => setActiveScene('all')}
        />
      )}

      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}>
        Showing {filtered.length} of {entries.length} sprites.
      </p>

      <div className="sprite-grid">
        {filtered.map(entry => {
          const marked = !!targets[entry.index]?.marked;
          const inPortfolio = entry.portfolioScenes.length > 0;
          return (
            <div
              key={entry.index}
              className={`sprite-card ${marked ? 'sprite-card-marked' : ''}`}
              onClick={() => setSelected(entry)}
            >
              <button
                className="sprite-star"
                onClick={(e) => { e.stopPropagation(); toggleTarget(entry.index); }}
                title={marked ? 'Unmark portfolio target' : 'Mark as portfolio target'}
              >
                {marked ? <Star size={16} fill="currentColor" /> : <StarOff size={16} />}
              </button>
              {inPortfolio && (
                <div className="sprite-portfolio-badge" title={`Used in ${entry.portfolioScenes.length} portfolio scene(s)`}>
                  <MapPin size={10} /> {entry.portfolioScenes.length}
                </div>
              )}
              <div className="sprite-thumb">
                {entry.empty ? (
                  <div className="sprite-empty">empty</div>
                ) : (
                  <img src={`/sprites/${entry.filename}?${imgQuery}`} alt={entry.description} loading="lazy" />
                )}
              </div>
              <div className="sprite-meta">
                <div className="sprite-index">#{String(entry.index).padStart(3, '0')}</div>
                <div className="sprite-desc">{entry.description || <em>??</em>}</div>
                <div className="sprite-dims">
                  {entry.width}×{entry.height}
                  {entry.scenes.length > 0 && <span className="sprite-scene-count"> · {entry.scenes.length} scene{entry.scenes.length === 1 ? '' : 's'}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <SpriteModal
          entry={selected}
          target={targets[selected.index] || {}}
          allScenes={allScenes}
          imgQuery={imgQuery}
          onClose={() => setSelected(null)}
          onToggle={() => toggleTarget(selected.index)}
          onNote={(note) => updateNote(selected.index, note)}
          onJumpToScene={(sceneId) => { setActiveScene(sceneId); setSelected(null); }}
        />
      )}
    </>
  );
}

function BricksView() {
  const [metadata, setMetadata] = useState(null);
  const [sceneIndex, setSceneIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [activeBucket, setActiveBucket] = useState('all');
  const [activeScene, setActiveScene] = useState('portfolio');
  const [pageSize, setPageSize] = useState(300);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/bricks/_metadata.json').then(r => r.ok ? r.json() : Promise.reject(new Error(`bricks: ${r.status}`))),
      fetch('/scene-bricks.json').then(r => r.ok ? r.json() : Promise.reject(new Error(`scene-bricks: ${r.status}`))),
    ])
      .then(([bricksMeta, sceneMeta]) => {
        setMetadata(bricksMeta);
        setSceneIndex(sceneMeta);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const nonce = useMemo(() => Date.now().toString(36) + Math.random().toString(36).slice(2), []);
  const version = metadata?.version || 0;
  const imgQuery = `v=${version}&n=${nonce}`;

  const bucketCounts = metadata?.buckets || {};
  const totalCount = metadata?.entries?.filter(e => !e.empty).length || 0;

  const portfolioBrickSet = useMemo(() => {
    if (!sceneIndex?.scenes) return new Set();
    const s = new Set();
    for (const id of PORTFOLIO_SCENE_IDS) {
      const info = sceneIndex.scenes[id];
      if (info?.bricks) for (const b of info.bricks) s.add(b);
    }
    return s;
  }, [sceneIndex]);

  const activeSceneBrickSet = useMemo(() => {
    if (activeScene === 'all') return null;
    if (activeScene === 'portfolio') return portfolioBrickSet;
    const info = sceneIndex?.scenes?.[activeScene];
    return new Set(info?.bricks || []);
  }, [activeScene, portfolioBrickSet, sceneIndex]);

  const brickToScenes = sceneIndex?.brickToScenes || {};

  const entriesWithMeta = useMemo(() => {
    if (!metadata?.entries) return [];
    return metadata.entries.map(e => {
      const scenes = brickToScenes[e.index] || [];
      const portfolioScenes = scenes.filter(id => PORTFOLIO_SCENE_IDS.has(id));
      return { ...e, scenes, portfolioScenes };
    });
  }, [metadata, brickToScenes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entriesWithMeta.filter(e => {
      if (e.empty) return false;
      if (activeBucket !== 'all' && e.bucket !== activeBucket) return false;
      if (activeSceneBrickSet && !activeSceneBrickSet.has(e.index)) return false;
      if (q) {
        const hay = `${e.index} ${e.filename} ${e.width}x${e.height} ${e.bucket}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entriesWithMeta, activeBucket, activeSceneBrickSet, search]);

  const visible = filtered.slice(0, pageSize);
  const hiddenCount = filtered.length - visible.length;

  if (loading) return <LoadingBlock label="Loading 8715 bricks + scene map…" />;
  if (error) return <ErrorBlock message={error} hint="Run extract-bricks.js AND extract-scene-bricks.js" />;

  const allScenes = sceneIndex?.scenes || {};
  const sceneEntries = Object.entries(allScenes)
    .map(([id, info]) => ({ id: Number(id), ...info }))
    .sort((a, b) => a.id - b.id);

  return (
    <>
      <div className="filters">
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="search-input"
            placeholder="Search by index or dimensions…"
            style={{ paddingLeft: '2.5rem', width: '100%' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="select-input"
          value={activeScene}
          onChange={(e) => {
            const v = e.target.value;
            setActiveScene(v === 'all' || v === 'portfolio' ? v : Number(v));
            setPageSize(300);
          }}
          title="Filter by scene"
        >
          <option value="all">All scenes (no filter)</option>
          <option value="portfolio">⭐ Portfolio scenes only ({portfolioBrickSet.size} bricks)</option>
          <optgroup label="Portfolio rooms">
            {PORTFOLIO_SCENES.map(s => {
              const info = allScenes[s.id];
              const count = info?.brickCount || 0;
              return (
                <option key={s.id} value={s.id}>
                  #{s.id} {s.label} — {count} bricks
                </option>
              );
            })}
          </optgroup>
          <optgroup label="All scenes">
            {sceneEntries.map(s => (
              <option key={s.id} value={s.id}>
                #{s.id} {s.description?.replace(/^Scene \d+: /, '')} — {s.brickCount}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      <div className="chip-row">
        <Filter size={14} style={{ color: 'var(--text-muted)', alignSelf: 'center' }} />
        {BRICK_BUCKETS.map(b => {
          const count = b.id === 'all' ? totalCount : (bucketCounts[b.id] || 0);
          return (
            <button
              key={b.id}
              className={`chip ${activeBucket === b.id ? 'chip-active' : ''}`}
              onClick={() => { setActiveBucket(b.id); setPageSize(300); }}
            >
              {b.label} <span className="chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {activeScene !== 'all' && (
        <BrickScenePanel
          activeScene={activeScene}
          allScenes={allScenes}
          portfolioSize={portfolioBrickSet.size}
          onClear={() => setActiveScene('all')}
        />
      )}

      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}>
        Showing {visible.length} of {filtered.length} bricks
        {hiddenCount > 0 && ` (${hiddenCount} hidden — `}
        {hiddenCount > 0 && <button className="chip" onClick={() => setPageSize(pageSize + 300)} style={{ display: 'inline-flex', padding: '0.1rem 0.5rem', marginLeft: '0.25rem' }}>show 300 more</button>}
        {hiddenCount > 0 && ')'}
      </p>

      <div className="sprite-grid">
        {visible.map(brick => {
          const inPortfolio = brick.portfolioScenes.length > 0;
          return (
            <div
              key={brick.index}
              className="sprite-card"
              onClick={() => setSelected(brick)}
            >
              {inPortfolio && (
                <div className="sprite-portfolio-badge" title={`In ${brick.portfolioScenes.length} portfolio scene(s)`}>
                  <MapPin size={10} /> {brick.portfolioScenes.length}
                </div>
              )}
              <div className="sprite-thumb">
                <img src={`/bricks/${brick.filename}?${imgQuery}`} alt={`brick ${brick.index}`} loading="lazy" />
              </div>
              <div className="sprite-meta">
                <div className="sprite-index">#{String(brick.index).padStart(4, '0')}</div>
                <div className="sprite-dims">
                  {brick.width}×{brick.height} · <span style={{ color: 'var(--text-muted)' }}>{brick.bucket}</span>
                </div>
                {brick.scenes.length > 0 && (
                  <div className="sprite-dims" style={{ fontSize: '0.65rem' }}>
                    in {brick.scenes.length} scene{brick.scenes.length === 1 ? '' : 's'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <BrickModal
          brick={selected}
          allScenes={allScenes}
          imgQuery={imgQuery}
          onClose={() => setSelected(null)}
          onJumpToScene={(sceneId) => { setActiveScene(sceneId); setSelected(null); setPageSize(300); }}
        />
      )}
    </>
  );
}

function BrickScenePanel({ activeScene, allScenes, portfolioSize, onClear }) {
  if (activeScene === 'portfolio') {
    return (
      <div className="scene-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="scene-panel-title">⭐ Bricks used by all portfolio rooms</div>
            <div className="scene-panel-sub">
              {portfolioSize} unique bricks across {PORTFOLIO_SCENES.length} rooms — edit any one and every room that shares it updates.
            </div>
          </div>
          <button className="chip" onClick={onClear}><X size={14} /> Clear</button>
        </div>
      </div>
    );
  }

  const info = allScenes[activeScene];
  if (!info) return null;

  return (
    <div className="scene-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <div className="scene-panel-title">
            <MapPin size={14} /> {info.description}
          </div>
          <div className="scene-panel-sub">
            {info.brickCount} bricks used to build this room's walls, floor, and pillars
            {PORTFOLIO_SCENE_IDS.has(Number(activeScene)) && <span className="scene-panel-star"> · ⭐ portfolio</span>}
          </div>
        </div>
        <button className="chip" onClick={onClear}><X size={14} /> Clear</button>
      </div>
    </div>
  );
}

function LoadingBlock({ label }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
      <h2><ImageIcon className="spin" /> {label}</h2>
    </div>
  );
}

function ErrorBlock({ message, hint }) {
  return (
    <div>
      <h2 style={{ color: '#ff6b6b' }}>Failed to load</h2>
      <p style={{ color: 'var(--text-muted)' }}>{message}</p>
      <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>{hint}</p>
    </div>
  );
}

function ScenePanel({ activeScene, allScenes, onClear }) {
  if (activeScene === 'portfolio') {
    return (
      <div className="scene-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="scene-panel-title">⭐ All portfolio scenes</div>
            <div className="scene-panel-sub">
              Union of sprites across {PORTFOLIO_SCENES.length} rooms: {PORTFOLIO_SCENES.map(s => `#${s.id} ${s.label}`).join(' · ')}
            </div>
          </div>
          <button className="chip" onClick={onClear}><X size={14} /> Clear</button>
        </div>
      </div>
    );
  }

  const info = allScenes[activeScene];
  if (!info) return null;

  return (
    <div className="scene-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <div className="scene-panel-title">
            <MapPin size={14} /> {info.description}
          </div>
          <div className="scene-panel-sub">
            {info.numActors} actors · {info.sprites.length} sprite prop{info.sprites.length === 1 ? '' : 's'}
            {PORTFOLIO_SCENE_IDS.has(Number(activeScene)) && <span className="scene-panel-star"> · ⭐ portfolio</span>}
          </div>
        </div>
        <button className="chip" onClick={onClear}><X size={14} /> Clear</button>
      </div>
    </div>
  );
}

function SpriteModal({ entry, target, allScenes, imgQuery, onClose, onToggle, onNote, onJumpToScene }) {
  const [note, setNote] = useState(target.note || '');
  const [zoom, setZoom] = useState(8);

  useEffect(() => { setNote(target.note || ''); }, [entry.index]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X /></button>

        <h2 style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers /> Sprite #{String(entry.index).padStart(3, '0')}
        </h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>{entry.filename}</p>

        <div className="modal-preview">
          {entry.empty ? (
            <div className="sprite-empty" style={{ padding: '3rem' }}>empty entry</div>
          ) : (
            <img
              src={`/sprites/${entry.filename}?${imgQuery}`}
              alt={entry.description}
              style={{
                width: entry.width * zoom,
                height: entry.height * zoom,
                imageRendering: 'pixelated',
              }}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Zoom</span>
          {[2, 4, 8, 12].map(z => (
            <button key={z} className={`chip ${zoom === z ? 'chip-active' : ''}`} onClick={() => setZoom(z)}>
              {z}×
            </button>
          ))}
        </div>

        <div className="kv-grid">
          <div className="kv-k">Description</div><div className="kv-v">{entry.description || '—'}</div>
          <div className="kv-k">Dimensions</div><div className="kv-v">{entry.width} × {entry.height} px</div>
          <div className="kv-k">Offset</div><div className="kv-v">{entry.offsetX}, {entry.offsetY}</div>
          <div className="kv-k">Categories</div><div className="kv-v">{entry.categories?.join(', ') || '—'}</div>
          <div className="kv-k">File</div><div className="kv-v"><code>modded_assets/sprites/{entry.filename}</code></div>
          <div className="kv-k">Used in scenes</div>
          <div className="kv-v">
            {entry.scenes.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                not referenced as a sprite actor in any scene
              </span>
            ) : (
              <div className="scene-list">
                {entry.scenes.map(sid => {
                  const info = allScenes[sid];
                  const isPortfolio = PORTFOLIO_SCENE_IDS.has(sid);
                  return (
                    <button
                      key={sid}
                      className={`chip ${isPortfolio ? 'chip-active' : ''}`}
                      onClick={() => onJumpToScene(sid)}
                      title="Filter to this scene"
                    >
                      {isPortfolio && <Star size={12} fill="currentColor" />}
                      #{sid} {info?.description?.replace(/^Scene \d+: /, '') || ''}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className={`chip ${target.marked ? 'chip-active' : ''}`} onClick={onToggle}>
            {target.marked ? <Star size={14} fill="currentColor" /> : <StarOff size={14} />}
            {target.marked ? 'Portfolio target' : 'Mark as portfolio target'}
          </button>
        </div>

        <label style={{ display: 'block', marginTop: '1rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Note / portfolio intent</span>
          <textarea
            className="search-input"
            style={{ width: '100%', marginTop: '0.25rem', minHeight: '60px', resize: 'vertical' }}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => onNote(note)}
            placeholder="e.g. replace with project logo, recolor to brand accent, use as scene 12 HUD icon…"
          />
        </label>

        {!entry.empty && (
          <AssetUploader
            kind="sprites"
            filename={entry.filename}
            expectedWidth={entry.width}
            expectedHeight={entry.height}
            originalSrc={`/sprites/${entry.filename}?${imgQuery}`}
          />
        )}
      </div>
    </div>
  );
}

function BrickModal({ brick, allScenes, imgQuery, onClose, onJumpToScene }) {
  const [zoom, setZoom] = useState(8);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X /></button>

        <h2 style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Grid /> Brick #{String(brick.index).padStart(4, '0')}
        </h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>{brick.filename}</p>

        <div className="modal-preview">
          <img
            src={`/bricks/${brick.filename}?${imgQuery}`}
            alt={`brick ${brick.index}`}
            style={{
              width: brick.width * zoom,
              height: brick.height * zoom,
              imageRendering: 'pixelated',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Zoom</span>
          {[2, 4, 8, 12].map(z => (
            <button key={z} className={`chip ${zoom === z ? 'chip-active' : ''}`} onClick={() => setZoom(z)}>
              {z}×
            </button>
          ))}
        </div>

        <div className="kv-grid">
          <div className="kv-k">Dimensions</div><div className="kv-v">{brick.width} × {brick.height} px</div>
          <div className="kv-k">Offset</div><div className="kv-v">{brick.offsetX}, {brick.offsetY}</div>
          <div className="kv-k">Bucket</div><div className="kv-v">{brick.bucket}</div>
          <div className="kv-k">File</div><div className="kv-v"><code>modded_assets/bricks/{brick.filename}</code></div>
          <div className="kv-k">Used in scenes</div>
          <div className="kv-v">
            {brick.scenes.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                not referenced by any scene grid
              </span>
            ) : (
              <div className="scene-list">
                {brick.scenes.map(sid => {
                  const info = allScenes[sid];
                  const isPortfolio = PORTFOLIO_SCENE_IDS.has(sid);
                  return (
                    <button
                      key={sid}
                      className={`chip ${isPortfolio ? 'chip-active' : ''}`}
                      onClick={() => onJumpToScene(sid)}
                      title="Filter to this scene"
                    >
                      {isPortfolio && <Star size={12} fill="currentColor" />}
                      #{sid} {info?.description?.replace(/^Scene \d+: /, '') || ''}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <AssetUploader
          kind="bricks"
          filename={brick.filename}
          expectedWidth={brick.width}
          expectedHeight={brick.height}
          originalSrc={`/bricks/${brick.filename}?${imgQuery}`}
        />
      </div>
    </div>
  );
}
