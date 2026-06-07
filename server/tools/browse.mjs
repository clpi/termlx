#!/usr/bin/env node
// Terax terminal web browser — fetches a URL and renders a readable, scrollable
// text view inside the PTY. Usage: `browse <url>` (or `web <url>`).
// Keys: ↑/↓/j/k scroll · space/PgDn, b/PgUp page · g new URL · type a number +
// Enter to follow a link · Backspace back · q quit.
import process from "node:process";
import { createScreen, color, readLine, sanitizeText } from "../games/lib/term.mjs";

const ESC = "\x1b";

const screen = createScreen({ mode: "text" });
let page = null; // { url, lines, links }
let top = 0;
let numInput = "";
let status = "";
const history = [];

function viewRows() {
  return Math.max(1, screen.size().rows - 2); // title row + status row
}
function width() {
  return Math.max(20, screen.size().cols - 1);
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "");
}
function decodeEntities(s) {
  const named = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    mdash: "\u2014",
    ndash: "\u2013",
    hellip: "\u2026",
    copy: "\u00a9",
    reg: "\u00ae",
    trade: "\u2122",
    rsquo: "\u2019",
    lsquo: "\u2018",
    ldquo: "\u201c",
    rdquo: "\u201d",
  };
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return m;
      try {
        return String.fromCodePoint(n);
      } catch {
        return m;
      }
    }
    const key = code.toLowerCase();
    return key in named ? named[key] : m;
  });
}
function resolveUrl(base, href) {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}
function normalizeUrl(url) {
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

function wrap(text, w) {
  const out = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/g, "");
    if (line.length <= w) {
      out.push(line);
      continue;
    }
    const indent = (line.match(/^\s*(?:•\s)?/) || [""])[0];
    let cur = "";
    for (const word of line.split(/(\s+)/)) {
      if ((cur + word).length > w && cur.trim()) {
        out.push(cur.replace(/\s+$/g, ""));
        cur = indent + word.replace(/^\s+/, "");
      } else {
        cur += word;
      }
    }
    if (cur.trim() || out.length === 0) out.push(cur.replace(/\s+$/g, ""));
  }
  return out;
}

function htmlToText(html, baseUrl, w) {
  const links = [];
  let h = html.replace(/<!--[\s\S]*?-->/g, "");
  h = h.replace(/<script[\s\S]*?<\/script>/gi, "");
  h = h.replace(/<style[\s\S]*?<\/style>/gi, "");
  h = h.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const titleMatch = h.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? sanitizeText(decodeEntities(stripTags(titleMatch[1]))).trim() : "";
  h = h.replace(/<head[\s\S]*?<\/head>/gi, "");
  h = h.replace(/<h([1-6])[^>]*>/gi, "\n\n## ");
  h = h.replace(/<\/h[1-6]>/gi, "\n");
  h = h.replace(/<br\s*\/?>/gi, "\n");
  h = h.replace(/<li[^>]*>/gi, "\n  \u2022 ");
  h = h.replace(/<\/(p|div|section|article|header|footer|nav|ul|ol|table|tr|li|h[1-6]|blockquote)>/gi, "\n");
  let n = 0;
  h = h.replace(/<a\b[^>]*?href=["']?([^"'>\s]+)["']?[^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
    const text = decodeEntities(stripTags(inner)).replace(/\s+/g, " ").trim();
    if (!href || /^(javascript:|#)/i.test(href)) return text;
    n += 1;
    links.push({ n, href: resolveUrl(baseUrl, href), text: text || href });
    return `${text}[${n}]`;
  });
  let text = sanitizeText(decodeEntities(stripTags(h)));
  text = text.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const lines = [];
  if (title) {
    lines.push(`${color.bold}${color.fg(81)}${title}${color.reset}`);
    lines.push("");
  }
  for (const l of wrap(text, w)) {
    lines.push(l.startsWith("## ") ? `${color.bold}${color.fg(220)}${l.slice(3)}${color.reset}` : l);
  }
  return { lines, links };
}

async function load(url, pushHistory = true) {
  const norm = normalizeUrl(url);
  status = `loading ${norm} …`;
  render();
  try {
    const res = await fetch(norm, {
      redirect: "follow",
      headers: { "user-agent": "TeraxBrowser/1.0", accept: "text/html,text/plain,*/*" },
    });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const finalUrl = res.url || norm;
    let lines;
    let links = [];
    if (ct.includes("html")) {
      const parsed = htmlToText(await res.text(), finalUrl, width());
      lines = parsed.lines;
      links = parsed.links;
    } else if (ct.startsWith("text/") || ct.includes("json") || ct.includes("xml")) {
      lines = wrap(sanitizeText(await res.text()).replace(/\t/g, "    "), width());
    } else {
      lines = [`${color.dim}[non-text content: ${ct || "unknown"}]${color.reset}`];
    }
    if (pushHistory && page) history.push(page.url);
    page = { url: finalUrl, lines, links };
    top = 0;
    status = `${res.status}  ${links.length} link(s)`;
  } catch (e) {
    status = `${color.fg(196)}error: ${e.message}${color.reset}`;
  }
  render();
}

function render() {
  const { cols } = screen.size();
  const view = viewRows();
  const clip = (s) => {
    const visLen = s.replace(/\x1b\[[0-9;]*m/g, "").length;
    return visLen > cols ? s.replace(/\x1b\[[0-9;]*m/g, "").slice(0, cols) : s;
  };
  let out = `${ESC}[H${ESC}[2J`;
  const titleUrl = page ? page.url : "Terax Browser";
  out += `${ESC}[7m ${clip(titleUrl).padEnd(cols - 1)}${ESC}[0m\r\n`;
  const lines = page ? page.lines : ["", "  Terax terminal browser", "", "  Press g to enter a URL, or run: browse <url>", "  q to quit."];
  for (let i = 0; i < view; i++) {
    const idx = top + i;
    out += `${ESC}[K`;
    out += idx < lines.length ? clip(lines[idx]) : `${color.fg(60)}~${color.reset}`;
    out += "\r\n";
  }
  const total = lines.length;
  const pct = total <= view ? "ALL" : `${Math.min(100, Math.round(((top + view) / total) * 100))}%`;
  const hint = numInput
    ? `${color.fg(220)}follow link [${numInput}] — Enter${color.reset}`
    : `${color.dim}j/k scroll · space pg · g url · #+Enter link · ⌫ back · q quit${color.reset}`;
  out += `${ESC}[7m ${pct.padEnd(5)}${ESC}[0m ${status || hint}${ESC}[K`;
  screen.write(out);
}

async function followLink() {
  const n = Number(numInput);
  numInput = "";
  if (!page) return;
  const link = page.links.find((l) => l.n === n);
  if (link) await load(link.href);
  else {
    status = `no link [${n}]`;
    render();
  }
}

async function prompt() {
  screen.write(`${ESC}[${screen.size().rows};1H${ESC}[2K`);
  const url = await readLine(screen, 1, screen.size().rows, { prompt: "url> " });
  bindKeys();
  if (url && url.trim()) await load(url.trim());
  else render();
}

function bindKeys() {
  screen.onKey((k) => {
    const view = viewRows();
    const max = page ? Math.max(0, page.lines.length - view) : 0;
    if (k >= "0" && k <= "9") {
      numInput += k;
      return render();
    }
    if (k === "enter") {
      if (numInput) followLink();
      return;
    }
    if (numInput && k !== "enter") numInput = "";
    switch (k) {
      case "q":
      case "escape":
        screen.end();
        process.stdout.write("\r\n");
        process.exit(0);
        return;
      case "up":
      case "k":
        top = Math.max(0, top - 1);
        break;
      case "down":
      case "j":
        top = Math.min(max, top + 1);
        break;
      case "space":
      case "pagedown":
        top = Math.min(max, top + view);
        break;
      case "b":
      case "pageup":
        top = Math.max(0, top - view);
        break;
      case "home":
        top = 0;
        break;
      case "end":
        top = max;
        break;
      case "g":
        return prompt();
      case "backspace": {
        const prev = history.pop();
        if (prev) load(prev, false);
        return;
      }
      default:
        return;
    }
    render();
  });
}

bindKeys();
const initial = process.argv.slice(2).join(" ").trim();
if (initial) load(initial, false);
else render();
