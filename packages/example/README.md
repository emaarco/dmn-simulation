# @emaarco/dmn-js-simulation-example

A small [Vite](https://vitejs.dev/) app that embeds a [dmn-js](https://github.com/bpmn-io/dmn-js) modeler wired up with [`@emaarco/dmn-js-simulation`](../dmn-js-simulation). It's both the **live demo** ([emaarco.github.io/dmn-js-simulation](https://emaarco.github.io/dmn-js-simulation/)) and the reference integration for how to plug the add-on into a modeler.

> This package is `private` — it is never published to npm. It exists to demo and E2E-test the library.

## Running it

From the **repository root**:

```bash
npm install
npm run dev      # starts the example on http://localhost:5178
```

During `dev`, Vite aliases `@emaarco/dmn-js-simulation` straight to the sibling package's `src/` (see [`vite.config.ts`](./vite.config.ts)), so changes to the library are picked up without a rebuild.

## What it demonstrates

- Registering the simulation module on both the **decision-table** and **DRD** views via `additionalModules`.
- A file picker that loads bundled `.dmn` samples — plus drag-and-drop of your own `.dmn`/`.xml` files onto the canvas.
- Sample models under [`public/`](./public):
  - **`hit-policies/`** — one table per DMN hit policy (`unique`, `first`, `any`, `priority`, `collect`, `collect-sum`, `rule-order`, `output-order`).
  - **`chaining/`** — multi-decision DRDs that exercise DRD chaining across 2–3 levels.
  - **`miravelo/`** and `recommend-bike.dmn` — larger, realistic decisions.

## End-to-end tests

The [Playwright](https://playwright.dev/) suite in [`e2e/`](./e2e) drives this app to verify the simulation behavior in a real browser:

```bash
npm run test:e2e   # from the repo root, runs against this example
```

## Layout

```
example/
├─ index.html         # canvas + burger menu / file picker
├─ src/
│  ├─ main.ts         # boots the DmnModeler and registers the module
│  ├─ share.ts        # deep-link / share helpers
│  └─ style.css       # demo-app chrome (not part of the library)
├─ public/            # sample .dmn models served statically
└─ e2e/               # Playwright specs
```
