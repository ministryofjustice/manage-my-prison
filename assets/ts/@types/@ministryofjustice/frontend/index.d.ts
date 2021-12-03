// simplification of types exported by @ministryofjustice/frontend @1.0.0

// eslint-disable-next-line max-classes-per-file
type ElementOrJQuery<T = HTMLElement> = JQuery.Selector | T | JQuery<T>

type ValidatorRule = {
  method: (field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, params?: unknown) => boolean | string
  message: string
  params?: unknown
}

declare module '@ministryofjustice/frontend' {
  export declare function initAll(options?: {scope?: ParentNode} = {scope: document}): void

  export declare class AddAnother {
    constructor(container: ElementOrJQuery)

    getItems(): JQuery
  }

  export declare class ButtonMenu {
    constructor(params: {
      container: JQuery
      menuClasses?: string
      buttonClasses?: string
      buttonText: string
      mq: string
    })
  }

  export declare class FilterToggleButton {
    constructor(options: {
      toggleButton: {
        container: JQuery
        classes: string
        showText: string
        hideText: string
      }
      closeButtons?: {
        container: JQuery
        text: string
      }
      filter: {container: JQuery}
      startHidden?: boolean
      bigModeMediaQuery: string
    })
  }

  export declare class FormValidator {
    constructor(form: HTMLFormElement, options: {summary?: ElementOrJQuery})

    addValidator(fieldName: string, rules: ValidatorRule[]): void
  }

  export declare class MultiFileUpload {
    constructor(params: {
      container: JQuery
      uploadUrl: string
      deleteUrl: string
      uploadFileEntryHook?: (this: MultiFileUpload, file: string) => void
      uploadFileExitHook?: (this: MultiFileUpload, file: string, response: unknown) => void
      uploadFileErrorHook?: (
        this: MultiFileUpload,
        file: string,
        jqXHR: JQuery.jqXHR,
        textStatus: string,
        errorThrown: unknown
      ) => void
      fileDeleteHook?: (this: MultiFileUpload, response: unknown) => void
      uploadStatusText?: string
      dropzoneHintText?: string
      dropzoneButtonText?: string
    })
  }

  export declare class MultiSelect {
    constructor(options: {container: ElementOrJQuery; checkboxes: ElementOrJQuery; checked?: boolean})

    checkAll(): void

    uncheckAll(): void
  }

  export declare class PasswordReveal {
    constructor(element: HTMLInputElement)
  }

  export declare class RichTextEditor {
    constructor(options: {
      textarea: ElementOrJQuery<HTMLTextAreaElement>
      toolbar?: {
        bold: boolean
        italic: boolean
        underline: boolean
        bullets: boolean
        numbers: boolean
      }
    })

    getContent(): string
  }

  export declare class SearchToggle {
    constructor(options: {search: {container: JQuery}; toggleButton: {container: JQuery; text: string}})
  }

  export declare class SortableTable {
    constructor(params: {
      table: ElementOrJQuery<HTMLTableElement>
      statusMessage?: string
      ascendingText?: string
      descendingText?: string
    })

    getTableRowsArray(): HTMLTableRowElement[]
  }

  export default {
    initAll,
    AddAnother,
    ButtonMenu,
    FilterToggleButton,
    FormValidator,
    MultiFileUpload,
    MultiSelect,
    PasswordReveal,
    RichTextEditor,
    SearchToggle,
    SortableTable,
  }
}

interface Window {
  readonly MOJFrontend: typeof import('@ministryofjustice/frontend')
}
