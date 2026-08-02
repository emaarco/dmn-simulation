// Minimal ambient types for dmn-moddle (which ships no declarations). Only the
// slice the adapter tests use is declared.
declare module 'dmn-moddle' {
  export class DmnModdle {
    constructor(...args: unknown[])
    fromXML(xml: string): Promise<{ rootElement: any }>
  }
}
