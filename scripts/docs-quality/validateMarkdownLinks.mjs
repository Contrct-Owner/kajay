import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

const EXCLUDED_DIRECTORIES = new Set(['.git', 'node_modules']);
const LINK = /!?\[[^\]]*\]\(([^)]+)\)/gu;

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return extname(entry.name) === '.md' ? [path] : [];
  });
}

function proseOnly(source) {
  let inFence = false;
  let marker = '';
  return source.split('\n').map((line) => {
    const fence = line.match(/^\s*(`{3,}|~{3,})/u)?.[1];
    if (fence !== undefined) {
      if (!inFence) {
        inFence = true;
        marker = fence[0] ?? '';
      } else if (fence[0] === marker) {
        inFence = false;
      }
      return '';
    }
    return inFence ? '' : line.replaceAll(/`[^`]*`/gu, '');
  }).join('\n');
}

function targetFrom(raw) {
  const trimmed = raw.trim();
  const enclosed = trimmed.startsWith('<') ? trimmed.slice(1, trimmed.indexOf('>')) : trimmed;
  return enclosed.split(/\s+["']/u, 1)[0] ?? '';
}

function localPath(target) {
  if (target === '' || target.startsWith('#') || target.startsWith('/')) return;
  if (/^[a-z][a-z0-9+.-]*:/iu.test(target)) return;
  const path = target.split(/[?#]/u, 1)[0] ?? '';
  if (path === '') return;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/** Finds repository-local Markdown targets that do not exist on disk. */
export function validateMarkdownLinks(repositoryRoot) {
  const errors = [];
  for (const sourcePath of markdownFiles(repositoryRoot)) {
    for (const match of proseOnly(readFileSync(sourcePath, 'utf8')).matchAll(LINK)) {
      const target = targetFrom(match[1] ?? '');
      const path = localPath(target);
      if (path !== undefined && !existsSync(resolve(dirname(sourcePath), path))) {
        errors.push(`${relative(repositoryRoot, sourcePath)}: local link ${JSON.stringify(target)} does not exist.`);
      }
    }
  }
  return errors;
}
