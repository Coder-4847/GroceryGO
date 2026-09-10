import { config } from '../config.js';
import { cache } from './cache.js';
import { createLogger } from './logger.js';

const log = createLogger('robots');

/**
 * Minimal robots.txt parser + checker. We only care about User-agent: * (and our
 * own UA token) Allow/Disallow rules for the paths we fetch. Cached for 12h.
 */
async function loadRules(origin) {
  const cacheKey = `robots:${origin}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let text = '';
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': config.userAgent },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) text = await res.text();
  } catch (err) {
    log.warn(`could not fetch robots for ${origin}: ${err.message}`);
  }

  const rules = parse(text);
  cache.set(cacheKey, rules, 12 * 60 * 60 * 1000);
  return rules;
}

function parse(text) {
  const groups = [];
  let current = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      if (current && current.rules.length === 0) {
        current.agents.push(value.toLowerCase());
      } else {
        current = { agents: [value.toLowerCase()], rules: [] };
        groups.push(current);
      }
    } else if ((field === 'allow' || field === 'disallow') && current) {
      current.rules.push({ type: field, path: value });
    }
  }
  return groups;
}

function matchGroup(groups, ua) {
  const uaLower = ua.toLowerCase();
  let starGroup = null;
  for (const g of groups) {
    for (const agent of g.agents) {
      if (agent === '*') starGroup = g;
      else if (uaLower.includes(agent)) return g;
    }
  }
  return starGroup;
}

/**
 * @returns {Promise<boolean>} true if fetching `url` is permitted.
 */
export async function isAllowed(url) {
  if (!config.respectRobots) return true;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const groups = await loadRules(parsed.origin);
  const group = matchGroup(groups, config.userAgent);
  if (!group) return true;

  const path = parsed.pathname + parsed.search;
  let decision = true;
  let longest = -1;
  for (const rule of group.rules) {
    if (rule.path === '') continue;
    if (pathMatches(path, rule.path) && rule.path.length > longest) {
      longest = rule.path.length;
      decision = rule.type === 'allow';
    }
  }
  return decision;
}

function pathMatches(path, pattern) {
  // Support the common `*` wildcard and `$` end-anchor.
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = new RegExp(
    '^' +
      body
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*') +
      (anchored ? '$' : '')
  );
  return regex.test(path);
}
