import { cpSync, mkdirSync } from 'node:fs'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'

/**
 * Bundle the library to ESM + CJS with type declarations, and copy the stylesheet
 * to `dist/assets/` (consumers import it by path — the bpmn.io convention).
 *
 * dmn-js / diagram-js / table-js and **inferno** stay external: they are provided
 * by the host dmn-js modeler, and bundling a second inferno would break rendering
 * into dmn-js's component tree. `inferno-create-element` (a tiny JSX helper) and
 * `feelin` (our FEEL engine) are bundled.
 */
function isExternal(id) {
  if (id === 'inferno' || id.startsWith('inferno/')) return true
  if (id === 'min-dom' || id === 'min-dash') return true
  return /^(dmn-js|diagram-js|table-js)(\/|$)/.test(id)
}

/** Copy `src/styles/*.css` → `dist/assets/` after the bundle is written. */
const copyStyles = {
  name: 'copy-styles',
  writeBundle() {
    mkdirSync('dist/assets', { recursive: true })
    cpSync('src/styles', 'dist/assets', { recursive: true })
  },
}

/** @type {import('rollup').RollupOptions} */
export default {
  input: 'src/index.ts',
  external: isExternal,
  output: [
    {
      file: 'dist/index.js',
      format: 'es',
      sourcemap: true,
    },
    {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
  ],
  plugins: [
    resolve({ browser: true, extensions: ['.ts', '.tsx', '.js', '.mjs'] }),
    commonjs(),
    typescript({ tsconfig: './tsconfig.build.json', outDir: 'dist', declaration: true, declarationDir: 'dist' }),
    copyStyles,
  ],
}
