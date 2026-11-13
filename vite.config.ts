import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

let root = process.cwd();
const readLegalDocument = (fileName: string) => readFileSync(resolve(root, fileName), 'utf8');

const legalDocuments: Plugin = {
  name: 'legal-documents',
  configResolved(config) {
    root = config.root;
  },
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const path = request.url?.split('?')[0];
      if (path !== '/LICENSE.txt' && path !== '/NOTICE.txt') return next();
      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.end(readLegalDocument(path.slice(1, -4)));
    });
  },
  generateBundle() {
    for (const fileName of ['LICENSE', 'NOTICE']) {
      this.emitFile({ type: 'asset', fileName: `${fileName}.txt`, source: readLegalDocument(fileName) });
    }
  },
};

export default defineConfig({
  base: './',
  plugins: [legalDocuments],
  build: {
    rollupOptions: {
      input: { main: 'index.html' },
    },
  },
});
