export function parseArgs(argv = process.argv.slice(2)) {
  const positional = [];
  const options = {};

  for (const token of argv) {
    if (token.startsWith("--")) {
      const [key, rawValue] = token.slice(2).split("=");
      options[key] = rawValue === undefined ? true : rawValue;
      continue;
    }
    positional.push(token);
  }

  return { positional, options };
}

export function requireOption(options, key) {
  const value = options[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required option --${key}`);
  }
  return value;
}

export function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}
