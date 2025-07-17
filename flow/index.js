import path from 'path';
import fs from 'fs';
import serveStatic from 'serve-static';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLORS = {
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

function log(...args) {
  const now = new Date();
  const time = now.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  const timestamp = `${COLORS.cyan}${time}${COLORS.reset}`;
  const tag = `${COLORS.yellow}[flow]${COLORS.reset}`;
  console.log(`${timestamp} ${tag}`, ...args);
}

function logError(...args) {
  const now = new Date();
  const time = now.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  const timestamp = `${COLORS.cyan}${time}${COLORS.reset}`;
  const tag = `${COLORS.red}[flow]${COLORS.reset}`;
  console.error(`${timestamp} ${tag}`, ...args);
}

function parseImports(content) {
  const importRegex = /import\s+[^'"]*['"](.+)['"]/g;
  const imports = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function generateTrace(projectRoot) {
  const srcDir = path.join(projectRoot, 'src');
  const nodes = new Set();
  const edges = [];

  const walk = (dir) => {
    for (const file of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (/\.(jsx?|tsx?)$/.test(file)) {
        const relativePath = path.relative(srcDir, fullPath);
        const id = relativePath.replace(/\\/g, '/');
        nodes.add(id);

        const content = fs.readFileSync(fullPath, 'utf-8');
        const imports = parseImports(content);
        for (const imported of imports) {
          if (imported.startsWith('.')) {
            let importedPath = path.normalize(path.join(path.dirname(id), imported)).replace(/\\/g, '/');
            if (!/\.(js|jsx|ts|tsx)$/.test(importedPath)) {
              importedPath += '.js'; // assume .js if no extension
            }
            edges.push({ from: id, to: importedPath });
            nodes.add(importedPath);
          }
        }
      }
    }
  };

  walk(srcDir);

  const steps = [...nodes].map((id) => ({
    id,
    label: id.split('/').pop(),
    next: edges.filter((edge) => edge.from === id).map((edge) => edge.to),
  }));

  return {
    updated: new Date().toISOString(),
    steps,
  };
}

export default function flowPlugin() {
  let currentTrace = {};
  let serverRoot = '';
  const uiDistPath = path.resolve(__dirname, 'ui/dist');

  function loadTrace() {
    try {
      const trace = generateTrace(serverRoot);
      currentTrace = trace;
      log('Trace generated from src/');
    } catch (err) {
      logError('Error generating trace:', err);
      currentTrace = { error: 'Failed to generate trace' };
    }
  }

  return {
    name: 'vite-plugin-flow',

    configResolved(config) {
      serverRoot = config.root;
    },

    configureServer(server) {
      loadTrace();

      const watchPath = path.join(serverRoot, 'src');
      fs.watch(watchPath, { recursive: true }, () => {
        loadTrace();

        server.ws.send({
          type: 'custom',
          event: 'flow:traceUpdate',
          data: currentTrace,
        });
      });

      // Serve API for UI
      server.middlewares.use('/api/trace', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(currentTrace));
      });

      // Serve built UI from dist/
      server.middlewares.use(
        '/__flow/',
        serveStatic(uiDistPath, {
          index: ['index.html'],
        })
      );

      log('Flow plugin running and watching src/, UI available at /__flow/');
    },
  };
}
