export class BrowserModuleError extends Error {
  constructor(message, details = undefined) {
    super(message);
    this.name = "BrowserModuleError";
    this.details = details;
  }
}

export class BindingNotFoundError extends BrowserModuleError {
  constructor(bindingKey) {
    super(`Binding not found: ${bindingKey}`, { bindingKey });
    this.name = "BindingNotFoundError";
  }
}

export class ProfilePathNotFoundError extends BrowserModuleError {
  constructor(dirId, attemptedPaths = []) {
    super(`Could not locate local profile path for dirId ${dirId}`, {
      dirId,
      attemptedPaths,
    });
    this.name = "ProfilePathNotFoundError";
  }
}
