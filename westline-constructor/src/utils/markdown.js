/* ============================================================
   Minimal Discord-flavoured markdown -> HTML
   Used only by the live preview. Input is escaped first, so the
   resulting string is safe to inject.
   ============================================================ */

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

const isSafeUrl = (url) => /^https?:\/\//i.test(url);

/**
 * Convert a Discord-ish markdown string into an HTML string.
 * Supports: code blocks, inline code, bold, underline, italic,
 * strikethrough, spoiler, headers, blockquotes, lists and links.
 */
export function renderMarkdown(input) {
  if (!input) return '';

  // 1. Pull code out first so its contents are never formatted.
  const stash = [];
  let text = input;

  // Private-use unicode chars act as placeholders (never valid input).
  const OPEN = '\uE000';
  const CLOSE = '\uE001';
  text = text.replace(/```(?:[a-zA-Z0-9+#-]*\n)?([\s\S]*?)```/g, (_, code) => {
    const i = stash.push(`<pre class="md-codeblock">${escapeHtml(code.replace(/\n$/, ''))}</pre>`) - 1;
    return `${OPEN}${i}${CLOSE}`;
  });
  text = text.replace(/`([^`\n]+?)`/g, (_, code) => {
    const i = stash.push(`<code class="md-code">${escapeHtml(code)}</code>`) - 1;
    return `${OPEN}${i}${CLOSE}`;
  });

  // 2. Escape everything that's left.
  text = escapeHtml(text);

  // 3. Block-level transforms, line by line.
  const lines = text.split('\n');
  const out = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (let raw of lines) {
    const header = raw.match(/^(#{1,3})\s+(.*)$/);
    const quote = raw.match(/^&gt;\s?(.*)$/);
    const bullet = raw.match(/^\s*[-*]\s+(.*)$/);

    if (bullet) {
      if (!inList) {
        out.push('<ul class="md-list">');
        inList = true;
      }
      out.push(`<li>${bullet[1]}</li>`);
      continue;
    }
    closeList();

    if (header) {
      const level = header[1].length;
      out.push(`<div class="md-h md-h${level}">${header[2]}</div>`);
    } else if (quote) {
      out.push(`<blockquote class="md-quote">${quote[1]}</blockquote>`);
    } else {
      out.push(raw);
    }
  }
  closeList();
  text = out.join('\n');

  // 4. Inline transforms (order matters).
  text = text
    .replace(/\|\|([\s\S]+?)\|\|/g, '<span class="md-spoiler">$1</span>')
    .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([\s\S]+?)__/g, '<u>$1</u>')
    .replace(/~~([\s\S]+?)~~/g, '<s>$1</s>')
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, '$1<em>$2</em>');

  // Masked links [text](url)
  text = text.replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) =>
    isSafeUrl(url)
      ? `<a class="md-link" href="${escapeAttr(url)}" target="_blank" rel="noreferrer noopener">${label}</a>`
      : label
  );

  // Bare links
  text = text.replace(
    /(^|[\s(])((https?:\/\/)[^\s<)]+)/g,
    (m, pre, url) =>
      `${pre}<a class="md-link" href="${escapeAttr(url)}" target="_blank" rel="noreferrer noopener">${url}</a>`
  );

  // 5. Newlines -> <br>, then restore stashed code.
  text = text.replace(/\n/g, '<br>');
  text = text.replace(/<br>(\s*<(?:div|blockquote|ul|pre))/g, '$1');
  text = text.replace(/\uE000(\d+)\uE001/g, (_, i) => stash[Number(i)]);

  return text;
}
