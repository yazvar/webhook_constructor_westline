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
    // Destination: either a manually-typed webhook URL ('url') or a channel
    // picked via the bot ('channel'). channelId/guildId/channelLabel describe
    // the latter so the dropdown can restore the selection after a refresh.
    target: 'url', // 'url' | 'channel'
    webhookUrl: '',
    channelId: '',
    guildId: '',
    channelLabel: '',
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

/** Discord accepts only http(s) links — not data: URIs or pasted image blobs. */
export function isHttpUrl(url) {
  const t = trimmed(url);
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function invalidUrlHint(value) {
  const t = trimmed(value);
  if (!t) return null;
  if (t.startsWith('data:')) {
    return 'вставьте прямую HTTPS-ссылку на картинку (Discord не принимает base64 и вставку из буфера)';
  }
  return 'укажите корректную ссылку, начинающуюся с https://';
}

/** Strip empty sub-objects so we don't send blank fields to Discord. */
function buildEmbedPayload(embed) {
  const out = {};
  if (trimmed(embed.title)) out.title = embed.title.trim();
  if (trimmed(embed.description)) out.description = embed.description;
  if (isHttpUrl(embed.url)) out.url = embed.url.trim();

  const color = hexToInt(embed.color);
  if (color !== null) out.color = color;

  if (trimmed(embed.author.name)) {
    out.author = { name: embed.author.name.trim() };
    if (isHttpUrl(embed.author.url)) out.author.url = embed.author.url.trim();
    if (isHttpUrl(embed.author.iconUrl))
      out.author.icon_url = embed.author.iconUrl.trim();
  }

  if (trimmed(embed.footer.text)) {
    out.footer = { text: embed.footer.text.trim() };
    if (isHttpUrl(embed.footer.iconUrl))
      out.footer.icon_url = embed.footer.iconUrl.trim();
  }

  if (isHttpUrl(embed.image.url)) out.image = { url: embed.image.url.trim() };
  if (isHttpUrl(embed.thumbnail.url))
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
  if (isHttpUrl(message.avatarUrl)) payload.avatar_url = message.avatarUrl.trim();

  const embeds = message.embeds
    .map(buildEmbedPayload)
    .filter(embedHasContent);
  if (embeds.length) payload.embeds = embeds;

  return payload;
}

function collectUrlErrors(message) {
  const errors = [];
  const n = (i) => i + 1;

  if (trimmed(message.avatarUrl) && !isHttpUrl(message.avatarUrl)) {
    errors.push(`Аватар: ${invalidUrlHint(message.avatarUrl)}.`);
  }

  message.embeds.forEach((embed, i) => {
    const label = `Эмбед #${n(i)}`;
    const checks = [
      ['Ссылка заголовка', embed.url],
      ['Ссылка автора', embed.author?.url],
      ['Иконка автора', embed.author?.iconUrl],
      ['Картинка', embed.image?.url],
      ['Превью', embed.thumbnail?.url],
      ['Иконка подвала', embed.footer?.iconUrl],
    ];
    for (const [field, url] of checks) {
      if (trimmed(url) && !isHttpUrl(url)) {
        errors.push(`${label}, ${field}: ${invalidUrlHint(url)}.`);
      }
    }
  });

  return errors;
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
  errors.push(...collectUrlErrors(message));
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

function formatDiscordApiError(data) {
  if (!data || typeof data !== 'object') return '';
  const parts = [];
  if (data.message) parts.push(data.message);
  if (data.errors && typeof data.errors === 'object') {
    const walk = (obj, prefix = '') => {
      for (const [key, val] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (val && typeof val === 'object' && '_errors' in val) {
          for (const e of val._errors) {
            if (e?.message) parts.push(`${path}: ${e.message}`);
          }
        } else if (val && typeof val === 'object') {
          walk(val, path);
        }
      }
    };
    walk(data.errors);
  }
  return parts.join('; ');
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
      const extra = formatDiscordApiError(data);
      if (extra) detail = `${detail} — ${extra}`;
    } catch {
      /* response had no JSON body */
    }
    throw new Error(`Discord отклонил запрос: ${detail}`);
  }

  return res.status === 204 ? null : res.json().catch(() => null);
}
