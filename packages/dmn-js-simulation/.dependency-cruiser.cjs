/**
 * Architecture guardrail for the library's source layers.
 *
 * Layering (imports only ever point "down"):
 *   integration/ -> ui/, simulation/, adapter/, domain/   (the dmn-js modules)
 *   ui/          -> simulation/, domain/                   (Inferno components)
 *   adapter/     -> domain/                                (moddle -> domain model)
 *   simulation/  -> domain/                                (shared run/result store)
 *   domain/      -> (leaf; pure evaluation, no dmn-js, no DOM)
 *
 * The point of the boundary is that `domain/` stays a pure, framework-free
 * evaluation core that is testable in plain Node.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Circular dependencies make the module graph hard to reason about.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-is-a-leaf',
      comment: 'domain/ is the pure evaluation core; it must not import from any upper layer.',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { path: '^src/(adapter|simulation|ui|integration)/' },
    },
    {
      name: 'adapter-only-to-domain',
      comment: 'adapter/ maps moddle -> domain; it must not know about UI/integration/store.',
      severity: 'error',
      from: { path: '^src/adapter/' },
      to: { path: '^src/(simulation|ui|integration)/' },
    },
    {
      name: 'simulation-only-to-domain',
      comment: 'The simulation store must not depend on UI or dmn-js integration.',
      severity: 'error',
      from: { path: '^src/simulation/' },
      to: { path: '^src/(adapter|ui|integration)/' },
    },
    {
      name: 'ui-not-to-integration-or-adapter',
      comment: 'UI components render from domain types + the store; they must not import the modules or the adapter.',
      severity: 'error',
      from: { path: '^src/ui/' },
      to: { path: '^src/(integration|adapter)/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    includeOnly: '^src/',
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js'],
    },
  },
}
