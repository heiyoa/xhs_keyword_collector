import { readFileSync } from "node:fs";
import path from "node:path";

export class CredentialResolver {
  resolve(ref) {
    if (!ref) {
      return undefined;
    }

    if (ref.startsWith("env:")) {
      const envName = ref.slice(4);
      return process.env[envName];
    }

    if (ref.startsWith("file:")) {
      return this.#resolveFileRef(ref.slice(5));
    }

    return ref;
  }

  #resolveFileRef(fileRef) {
    const [rawPath, fieldName] = fileRef.split("#");
    const resolvedPath = path.resolve(rawPath);
    const content = readFileSync(resolvedPath, "utf8");

    if (!fieldName && !resolvedPath.toLowerCase().endsWith(".json")) {
      return content.trim();
    }

    const parsed = JSON.parse(content);
    if (!fieldName) {
      return parsed;
    }
    return parsed[fieldName];
  }
}
