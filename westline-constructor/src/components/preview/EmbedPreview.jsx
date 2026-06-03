import { renderMarkdown } from '../../utils/markdown';
import { hexToInt } from '../../utils/discord';

function Markdown({ text, className }) {
  if (!text) return null;
  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
  );
}

const has = (v) => !!(v && String(v).trim());

/** Renders a single embed the way Discord would display it. */
export function EmbedPreview({ embed }) {
  const color = hexToInt(embed.color) !== null ? embed.color : '#202225';

  const hasAuthor = has(embed.author.name);
  const hasFooter = has(embed.footer.text) || embed.timestamp;
  const visibleFields = embed.fields.filter((f) => has(f.name) && has(f.value));

  const nothingVisible =
    !hasAuthor &&
    !has(embed.title) &&
    !has(embed.description) &&
    visibleFields.length === 0 &&
    !has(embed.image.url) &&
    !has(embed.thumbnail.url) &&
    !hasFooter;

  if (nothingVisible) return null;

  const timeText =
    embed.timestamp &&
    new Date().toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="dc-embed" style={{ borderColor: color }}>
      <div className="dc-embed__grid">
        <div className="dc-embed__content">
          {hasAuthor && (
            <div className="dc-embed__author">
              {has(embed.author.iconUrl) && (
                <img className="dc-embed__author-icon" src={embed.author.iconUrl} alt="" />
              )}
              {has(embed.author.url) ? (
                <a
                  className="dc-embed__author-name dc-link"
                  href={embed.author.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {embed.author.name}
                </a>
              ) : (
                <span className="dc-embed__author-name">{embed.author.name}</span>
              )}
            </div>
          )}

          {has(embed.title) &&
            (has(embed.url) ? (
              <a
                className="dc-embed__title dc-link"
                href={embed.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                {embed.title}
              </a>
            ) : (
              <div className="dc-embed__title">{embed.title}</div>
            ))}

          <Markdown className="dc-embed__desc dc-markdown" text={embed.description} />

          {visibleFields.length > 0 && (
            <div className="dc-embed__fields">
              {visibleFields.map((f) => (
                <div
                  className={`dc-embed__field${f.inline ? ' dc-embed__field--inline' : ''}`}
                  key={f.id}
                >
                  <div className="dc-embed__field-name">{f.name}</div>
                  <Markdown className="dc-embed__field-val dc-markdown" text={f.value} />
                </div>
              ))}
            </div>
          )}

          {has(embed.image.url) && (
            <img className="dc-embed__image" src={embed.image.url} alt="" />
          )}
        </div>

        {has(embed.thumbnail.url) && (
          <img className="dc-embed__thumb" src={embed.thumbnail.url} alt="" />
        )}
      </div>

      {hasFooter && (
        <div className="dc-embed__footer">
          {has(embed.footer.iconUrl) && (
            <img className="dc-embed__footer-icon" src={embed.footer.iconUrl} alt="" />
          )}
          <span className="dc-embed__footer-text">
            {embed.footer.text}
            {has(embed.footer.text) && timeText ? ' • ' : ''}
            {timeText || ''}
          </span>
        </div>
      )}
    </div>
  );
}
