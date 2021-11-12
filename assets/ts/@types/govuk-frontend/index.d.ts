// simplification of types exported by govuk-frontend @3.14.0

// eslint-disable-next-line max-classes-per-file
declare module 'govuk-frontend' {
  export declare function initAll(options?: {scope?: ParentNode} = {scope: document}): void

  // NB: not a real class, but indicates common interface
  declare class Component {
    constructor($module: Element)

    init(): void
  }

  export declare class Accordion extends Component {}

  export declare class Button extends Component {}

  export declare class Details extends Component {}

  export declare class CharacterCount extends Component {}

  export declare class Checkboxes extends Component {}

  export declare class ErrorSummary extends Component {}

  export declare class Header extends Component {}

  // declare class NotificationBanner extends Component {}

  export declare class Radios extends Component {}

  export declare class Tabs extends Component {}

  export default {
    initAll,
    Accordion,
    Button,
    Details,
    CharacterCount,
    Checkboxes,
    ErrorSummary,
    Header,
    // NB: this component is not exported:
    // NotificationBanner,
    Radios,
    Tabs,
  }
}

interface Window {
  readonly GOVUKFrontend: typeof import('govuk-frontend')
}
