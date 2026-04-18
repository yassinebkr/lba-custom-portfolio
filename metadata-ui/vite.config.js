import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'

const ROOT   = path.resolve(__dirname, '..')
const PUBLIC = path.resolve(__dirname, 'public')
const HQR    = path.resolve(ROOT, 'scripts', 'hqr-tools')

/**
 * Dev-only middleware: accept PUT /api/save-asset/<kind>/<filename> with a
 * raw PNG body and write it to both modded_assets/<kind>/ (for the repack
 * pipeline) and metadata-ui/public/<kind>/ (for immediate preview reload).
 */
function saveAssetPlugin() {
  return {
    name: 'save-asset',
    configureServer(server) {
      server.middlewares.use('/api/save-asset/', async (req, res) => {
        try {
          if (req.method !== 'PUT') { res.statusCode = 405; return res.end('use PUT'); }
          const url = req.url.replace(/^\//, '').split('?')[0];
          const [kind, filename] = url.split('/');
          if (!['sprites', 'bricks'].includes(kind)) {
            res.statusCode = 400; return res.end('bad kind');
          }
          if (!/^[\w\-]+\.png$/.test(filename)) {
            res.statusCode = 400; return res.end('bad filename');
          }
          const chunks = [];
          for await (const c of req) chunks.push(c);
          const buf = Buffer.concat(chunks);
          if (buf.length < 8 || buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') {
            res.statusCode = 400; return res.end('not a PNG');
          }
          const moddedDir = path.join(ROOT, 'modded_assets', kind);
          const publicDir = path.join(PUBLIC, kind);
          fs.mkdirSync(moddedDir, { recursive: true });
          fs.mkdirSync(publicDir, { recursive: true });
          fs.writeFileSync(path.join(moddedDir, filename), buf);
          fs.writeFileSync(path.join(publicDir, filename), buf);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, bytes: buf.length }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: String(e) }));
        }
      });
    },
  };
}

function saveScenePlugin() {
  return {
    name: 'save-scene',
    configureServer(server) {
      server.middlewares.use('/api/save-scene/', async (req, res) => {
        try {
          if (req.method !== 'PUT') { res.statusCode = 405; return res.end('use PUT'); }
          const url = req.url.replace(/^\//, '').split('?')[0];
          const sceneIdx = parseInt(url, 10);
          if (!Number.isFinite(sceneIdx) || sceneIdx < 0 || sceneIdx > 120) {
            res.statusCode = 400; return res.end('bad sceneIdx');
          }
          const chunks = [];
          for await (const c of req) chunks.push(c);
          const buf = Buffer.concat(chunks);
          if (buf.length < 8 || buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') {
            res.statusCode = 400; return res.end('not a PNG');
          }
          const scenesDir = path.join(ROOT, 'modded_assets', 'scenes');
          fs.mkdirSync(scenesDir, { recursive: true });
          const paintedPath = path.join(scenesDir, `scene-${sceneIdx}-painted.png`);
          fs.writeFileSync(paintedPath, buf);

          // Run the injector synchronously-from-client's POV but streaming logs.
          const logs = [];
          const proc = spawn(process.execPath, [
            path.join(HQR, 'inject-scene-image.js'),
            String(sceneIdx),
            paintedPath,
          ], { cwd: HQR });
          proc.stdout.on('data', d => logs.push(d.toString()));
          proc.stderr.on('data', d => logs.push(d.toString()));
          const exitCode = await new Promise(resolve => proc.on('close', resolve));

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            ok: exitCode === 0,
            exitCode,
            bytes: buf.length,
            log: logs.join(''),
            paintedPath: path.relative(ROOT, paintedPath),
          }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: String(e) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), saveAssetPlugin(), saveScenePlugin()],
  server: {
    port: 5173,
    fs: {
      allow: ['.', path.resolve(__dirname, '../modded_assets/sprites'), path.resolve(__dirname, '../modded_assets/bricks')],
    },
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  resolve: {
    alias: {
      '@sprites': path.resolve(__dirname, '../modded_assets/sprites'),
      '@bricks':  path.resolve(__dirname, '../modded_assets/bricks'),
    },
  },
})
