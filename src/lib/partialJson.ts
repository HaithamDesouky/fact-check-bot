function close(s: string): string {
  const stack: string[] = [];
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') stack.pop();
  }
  return s + (inString ? '"' : '') + stack.reverse().join('');
}

export function parsePartialJson<T>(s: string): T | null {
  for (let end = s.length; end > 0; end--) {
    try {
      return JSON.parse(close(s.slice(0, end).replace(/[,:\s]+$/, ''))) as T;
    } catch {
    }
  }
  return null;
}
