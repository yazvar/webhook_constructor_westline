import { useMessage } from '../../context/messageStore';
import { renderMarkdown } from '../../utils/markdown';
import { EmbedPreview } from './EmbedPreview';
import './preview.css';

const FALLBACK_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' fill='%235865f2'/%3E%3Ccircle cx='20' cy='16' r='7' fill='%23fff'/%3E%3Cpath d='M8 36c0-7 6-11 12-11s12 4 12 11z' fill='%23fff'/%3E%3C/svg%3E";

function nowLabel() {
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** Right-hand column: a faithful-ish Discord render of the draft. */
export function DiscordPreview() {
  const { message } = useMessage();
  const username = message.username.trim() || 'Westline Bot';
  const avatar = message.avatarUrl.trim() || FALLBACK_AVATAR;

  const hasContent = !!message.content.trim();
  const hasEmbeds = message.embeds.length > 0;

  return (
    <div className="preview">
      <header className="preview__head">
        <span className="eyebrow">Превью</span>
        <h2 className="preview__title dotmatrix">Discord</h2>
      </header>

      <div className="dc">
        <div className="dc-msg">
          <img
            className="dc-msg__avatar"
            src={avatar}
            alt=""
            onError={(e) => {
              e.currentTarget.src = FALLBACK_AVATAR;
            }}
          />
          <div className="dc-msg__body">
            <div className="dc-msg__head">
              <span className="dc-msg__name">{username}</span>
              <span className="dc-msg__tag">BOT</span>
              <span className="dc-msg__time">сегодня в {nowLabel()}</span>
            </div>

            {hasContent && (
              <div
                className="dc-msg__content dc-markdown"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
              />
            )}

            {hasEmbeds && (
              <div className="dc-msg__embeds">
                {message.embeds.map((embed) => (
                  <EmbedPreview key={embed.id} embed={embed} />
                ))}
              </div>
            )}

            {!hasContent && !hasEmbeds && (
              <div className="dc-msg__placeholder">Сообщение пустое — начните печатать слева.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
