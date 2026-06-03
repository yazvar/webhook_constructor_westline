/* ============================================================
   Discord webhook helpers
   Factories, validation, color conversion and the send call.
   ============================================================ */

let seq = 0;
/** Small stable id generator for list rows. */
export function uid(prefix = 'id') {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

export const LIMITS = {
  username: 80,
  content: 2000,
  embeds: 10,
  embedTitle: 256,
  embedDescription: 4096,
  authorName: 256,
  footerText: 2048,
  fields: 25,
  fieldName: 256,
  fieldValue: 1024,
  totalEmbedChars: 6000,
};

export function createField() {
  return { id: uid('field'), name: '', value: '', inline: false };
}

export function createEmbed() {
  return {
    id: uid('embed'),
    author: { name: '', url: '', iconUrl: '' },
    title: '',
    url: '',
    description: '',
    color: '#d71921',
    fields: [],
    image: { url: '' },
    thumbnail: { url: '' },
    footer: { text: '', iconUrl: '' },
    timestamp: false,
  };
}

export function createMessage() {
  return {
    webhookUrl: '',
    username: '',
    avatarUrl: '',
    content: '',
    embeds: [],
  };
}

/** Convert "#rrggbb" to the integer Discord expects. */
export function hexToInt(hex) {
  if (!hex) return null;
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return parseInt(clean, 16);
}

const WEBHOOK_RE =
  /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/i;

export function isValidWebhookUrl(url) {
  return WEBHOOK_RE.test((url || '').trim());
}

function trimmed(value) {
  return (value || '').trim();
}

/** Strip empty sub-objects so we don't send blank fields to Discord. */
function buildEmbedPayload(embed) {
  const out = {};
  if (trimmed(embed.title)) out.title = embed.title.trim();
  if (trimmed(embed.description)) out.description = embed.description;
  if (trimmed(embed.url)) out.url = embed.url.trim();

  const color = hexToInt(embed.color);
  if (color !== null) out.color = color;

  if (trimmed(embed.author.name)) {
    out.author = { name: embed.author.name.trim() };
    if (trimmed(embed.author.url)) out.author.url = embed.author.url.trim();
    if (trimmed(embed.author.iconUrl))
      out.author.icon_url = embed.author.iconUrl.trim();
  }

  if (trimmed(embed.footer.text)) {
    out.footer = { text: embed.footer.text.trim() };
    if (trimmed(embed.footer.iconUrl))
      out.footer.icon_url = embed.footer.iconUrl.trim();
  }

  if (trimmed(embed.image.url)) out.image = { url: embed.image.url.trim() };
  if (trimmed(embed.thumbnail.url))
    out.thumbnail = { url: embed.thumbnail.url.trim() };

  if (embed.timestamp) out.timestamp = new Date().toISOString();

  const fields = embed.fields
    .filter((f) => trimmed(f.name) && trimmed(f.value))
    .map((f) => ({ name: f.name, value: f.value, inline: !!f.inline }));
  if (fields.length) out.fields = fields;

  return out;
}

/** An embed carrying only a color (no real content) should not be sent. */
function embedHasContent(payload) {
  const keys = Object.keys(payload).filter((k) => k !== 'color');
  return keys.length > 0;
}

/** Build the JSON body that gets POSTed to the webhook. */
export function buildPayload(message) {
  const payload = {};
  if (trimmed(message.content)) payload.content = message.content;
  if (trimmed(message.username)) payload.username = message.username.trim();
  if (trimmed(message.avatarUrl)) payload.avatar_url = message.avatarUrl.trim();

  const embeds = message.embeds
    .map(buildEmbedPayload)
    .filter(embedHasContent);
  if (embeds.length) payload.embeds = embeds;

  return payload;
}

/** Returns an array of human-readable validation problems. */
export function validateMessage(message) {
  const errors = [];
  const payload = buildPayload(message);
  const hasContent = !!payload.content;
  const hasEmbeds = (payload.embeds || []).length > 0;

  if (!hasContent && !hasEmbeds) {
    errors.push('Сообщение пустое — добавьте текст или эмбед.');
  }
  if ((message.content || '').length > LIMITS.content) {
    errors.push(`Текст превышает ${LIMITS.content} символов.`);
  }
  message.embeds.forEach((embed, i) => {
    const total =
      (embed.title || '').length +
      (embed.description || '').length +
      (embed.footer.text || '').length +
      (embed.author.name || '').length +
      embed.fields.reduce(
        (s, f) => s + (f.name || '').length + (f.value || '').length,
        0
      );
    if (total > LIMITS.totalEmbedChars) {
      errors.push(`Эмбед #${i + 1} превышает ${LIMITS.totalEmbedChars} символов.`);
    }
  });
  return errors;
}

/** POST the message to the webhook. Resolves on success, throws on failure. */
export async function sendToWebhook(message) {
  if (!isValidWebhookUrl(message.webhookUrl)) {
    throw new Error('Некорректный URL вебхука Discord.');
  }
  const errors = validateMessage(message);
  if (errors.length) {
    throw new Error(errors.join(' '));
  }

  const url = `${message.webhookUrl.trim()}?wait=true`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(message)),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.message) detail = `${detail} — ${data.message}`;
    } catch {
      /* response had no JSON body */
    }
    throw new Error(`Discord отклонил запрос: ${detail}`);
  }

  return res.status === 204 ? null : res.json().catch(() => null);
}
