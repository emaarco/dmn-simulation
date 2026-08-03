/**
 * Permissive JSX typing for the Inferno components. dmn-js renders these into its
 * own Inferno tree; we compile JSX to `createElement` (see tsconfig `jsxFactory`)
 * and keep the element/attribute types intentionally loose — runtime behavior is
 * validated by the example app + E2E, not by structural JSX types.
 */
declare namespace JSX {
  type Element = any
  interface IntrinsicElements {
    [elemName: string]: any
  }
  interface ElementClass {
    render(): any
  }
  interface ElementAttributesProperty {
    props: unknown
  }
  interface ElementChildrenAttribute {
    children: unknown
  }
}
