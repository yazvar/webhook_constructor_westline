import { useMessage } from '../../context/messageStore';
import { LIMITS } from '../../utils/discord';
import { Collapsible } from '../ui/Collapsible';
import { IconButton } from '../ui/Button';
import { Input, TextArea, ColorField, Checkbox } from '../ui/Field';
import { FieldsEditor } from './FieldsEditor';

/** Editor for one embed: author, body, fields, media and footer. */
export function EmbedEditor({ embed, index, total }) {
  const { dispatch } = useMessage();

  const set = (key, value) => dispatch({ type: 'EMBED_SET', id: embed.id, key, value });
  const setNested = (group, key, value) =>
    dispatch({ type: 'EMBED_SET_NESTED', id: embed.id, group, key, value });

  const title = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span className="embed-dot" style={{ background: embed.color }} />
      Эмбед {String(index + 1).padStart(2, '0')}
    </span>
  );

  const actions = (
    <>
      <IconButton
        title="Вверх"
        disabled={index === 0}
        onClick={() => dispatch({ type: 'MOVE_EMBED', id: embed.id, dir: -1 })}
      >
        ↑
      </IconButton>
      <IconButton
        title="Вниз"
        disabled={index === total - 1}
        onClick={() => dispatch({ type: 'MOVE_EMBED', id: embed.id, dir: 1 })}
      >
        ↓
      </IconButton>
      <IconButton
        title="Дублировать"
        disabled={total >= LIMITS.embeds}
        onClick={() => dispatch({ type: 'DUPLICATE_EMBED', id: embed.id })}
      >
        ⧉
      </IconButton>
      <IconButton danger title="Удалить" onClick={() => dispatch({ type: 'REMOVE_EMBED', id: embed.id })}>
        ✕
      </IconButton>
    </>
  );

  return (
    <Collapsible title={title} actions={actions} defaultOpen={index === 0}>
      {/* Author */}
      <fieldset className="group">
        <legend className="eyebrow">Автор</legend>
        <Input
          label="Имя автора"
          value={embed.author.name}
          max={LIMITS.authorName}
          onChange={(v) => setNested('author', 'name', v)}
        />
        <div className="grid-2">
          <Input
            label="Ссылка автора"
            value={embed.author.url}
            placeholder="https://"
            onChange={(v) => setNested('author', 'url', v)}
          />
          <Input
            label="Иконка автора"
            value={embed.author.iconUrl}
            placeholder="https://"
            onChange={(v) => setNested('author', 'iconUrl', v)}
          />
        </div>
      </fieldset>

      {/* Body */}
      <fieldset className="group">
        <legend className="eyebrow">Тело</legend>
        <Input
          label="Заголовок"
          value={embed.title}
          max={LIMITS.embedTitle}
          onChange={(v) => set('title', v)}
        />
        <Input
          label="Ссылка заголовка"
          value={embed.url}
          placeholder="https://"
          onChange={(v) => set('url', v)}
        />
        <TextArea
          label="Описание (Markdown)"
          value={embed.description}
          max={LIMITS.embedDescription}
          rows={5}
          onChange={(v) => set('description', v)}
        />
        <div className="grid-2 grid-2--align">
          <ColorField label="Цвет полосы" value={embed.color} onChange={(v) => set('color', v)} />
          <Checkbox
            label="Добавить метку времени"
            checked={embed.timestamp}
            onChange={(v) => set('timestamp', v)}
          />
        </div>
      </fieldset>

      {/* Fields */}
      <fieldset className="group">
        <legend className="eyebrow">Поля</legend>
        <FieldsEditor embed={embed} />
      </fieldset>

      {/* Media */}
      <fieldset className="group">
        <legend className="eyebrow">Медиа</legend>
        <div className="grid-2">
          <Input
            label="Картинка"
            value={embed.image.url}
            placeholder="https://"
            onChange={(v) => setNested('image', 'url', v)}
          />
          <Input
            label="Превью (thumbnail)"
            value={embed.thumbnail.url}
            placeholder="https://"
            onChange={(v) => setNested('thumbnail', 'url', v)}
          />
        </div>
      </fieldset>

      {/* Footer */}
      <fieldset className="group">
        <legend className="eyebrow">Подвал</legend>
        <Input
          label="Текст подвала"
          value={embed.footer.text}
          max={LIMITS.footerText}
          onChange={(v) => setNested('footer', 'text', v)}
        />
        <Input
          label="Иконка подвала"
          value={embed.footer.iconUrl}
          placeholder="https://"
          onChange={(v) => setNested('footer', 'iconUrl', v)}
        />
      </fieldset>
    </Collapsible>
  );
}
