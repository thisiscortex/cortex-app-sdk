export interface BrowserHost {
  readonly dialogs: {
    pickDirectory(options?: { title?: string; buttonLabel?: string }): Promise<string | null>;
  };
}

/** Returns null in a normal standalone browser. */
export declare function connectHost(): BrowserHost | null;
