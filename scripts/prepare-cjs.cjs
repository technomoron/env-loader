#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const outDir = path.join(__dirname, '..', 'dist', 'cjs');

fs.mkdirSync(outDir, { recursive: true });

const pkgPath = path.join(outDir, 'package.json');

fs.writeFileSync(pkgPath, `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`, 'utf8');

console.log(`Wrote ${pkgPath}`);
