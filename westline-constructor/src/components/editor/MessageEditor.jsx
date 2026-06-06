import { useMessage } from '../../context/messageStore';
import { LIMITS } from '../../utils/discord';
import { Button } from '../ui/Button';
import { Input, TextArea } from '../ui/Field';
import { EmbedEditor } from './EmbedEditor';
import './editor.css';

/** Left-hand editing column: profile override, content and embeds. */
export function MessageEditor() {
  const { message, dispatch } = useMessage();
  const set = (key, value) => dispatch({ type: 'SET', key, value });

  return (
    <div className="editor">
      <section className="panel">
        <header className="panel__head">
          <span className="eyebrow">01 / Профиль</span>
          <h2 className="panel__title dotmatrix">Отправитель</h2>
        </header>
        <div className="panel__body">
          <div className="grid-2">
            <Input
              label="Имя (override)"
              value={message.username}
              max={LIMITS.username}
              placeholder="Westline Bot"
              onChange={(v) => set('username', v)}
            />
            <Input
              label="Аватар (URL)"
              value={message.avatarUrl}
              placeholder="https://… (только ссылка, не вставка картинки)"
              onChange={(v) => set('avatarUrl', v)}
            />
          </div>
        </div>
      </section>

      <section className="panel">
        <header className="panel__head">
          <span className="eyebrow">02 / Сообщение</span>
          <h2 className="panel__title dotmatrix">Контент</h2>
        </header>
        <div className="panel__body">
          <TextArea
            label="Текст (Markdown)"
            value={message.content}
            max={LIMITS.content}
            rows={6}
            placeholder="Введите текст сообщения… поддерживается **markdown**"
            onChange={(v) => set('content', v)}
          />
        </div>
      </section>

      <section className="panel">
        <header className="panel__head">
          <span className="eyebrow">03 / Эмбеды · {message.embeds.length}/{LIMITS.embeds}</span>
          <h2 className="panel__title dotmatrix">Embeds</h2>
        </header>
        <div className="panel__body">
          {message.embeds.length === 0 && (
            <p className="editor__empty">Эмбеды отсутствуют. Добавьте первый блок ниже.</p>
          )}
          <div className="editor__embeds">
            {message.embeds.map((embed, i) => (
              <EmbedEditor key={embed.id} embed={embed} index={i} total={message.embeds.length} />
            ))}
          </div>
          <Button
            variant="ghost"
            block
            disabled={message.embeds.length >= LIMITS.embeds}
            onClick={() => dispatch({ type: 'ADD_EMBED' })}
          >
            + Добавить эмбед
          </Button>
        </div>
      </section>
    </div>
  );
}
