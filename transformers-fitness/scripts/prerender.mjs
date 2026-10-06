// Gera o HTML final com todo o conteúdo já renderizado, para que Google e
// prévias de links leiam a página completa sem depender de JavaScript.
import { readFile, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const { render } = await import(pathToFileURL(resolve('dist-ssr/entry-server.js')).href);
const file = resolve('dist/index.html');
const html = await readFile(file, 'utf8');
if (!html.includes('<!--app-->')) throw new Error('Marcador <!--app--> não encontrado em dist/index.html');
await writeFile(file, html.replace('<!--app-->', render()));
await rm('dist-ssr', { recursive: true, force: true });
console.log('✓ dist/index.html pré-renderizado');
