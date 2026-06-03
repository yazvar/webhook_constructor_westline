import { useMessage } from '../../context/messageStore';
import { LIMITS } from '../../utils/discord';
import { Button, IconButton } from '../ui/Button';
import { Input, Checkbox } from '../ui/Field';

/** Editor for the inline fields of a single embed. */
export function FieldsEditor({ embed }) {
  const { dispatch } = useMessage();

  return (
    <div className="fields">
      <div className="fields__head">
        <span className="ui-field__label">Поля · {embed.fields.length}/{LIMITS.fields}</span>
      </div>

      {embed.fields.map((field, i) => (
        <div className="field-row" key={field.id}>
          <div className="field-row__top">
            <span className="eyebrow">Field {String(i + 1).padStart(2, '0')}</span>
            <div className="field-row__actions">
              <IconButton
                title="Вверх"
                disabled={i === 0}
                onClick={() =>
                  dispatch({ type: 'FIELD_MOVE', embedId: embed.id, fieldId: field.id, dir: -1 })
                }
              >
                ↑
              </IconButton>
              <IconButton
                title="Вниз"
                disabled={i === embed.fields.length - 1}
                onClick={() =>
                  dispatch({ type: 'FIELD_MOVE', embedId: embed.id, fieldId: field.id, dir: 1 })
                }
              >
                ↓
              </IconButton>
              <IconButton
                danger
                title="Удалить"
                onClick={() =>
                  dispatch({ type: 'FIELD_REMOVE', embedId: embed.id, fieldId: field.id })
                }
              >
                ✕
              </IconButton>
            </div>
          </div>
          <Input
            label="Название"
            value={field.name}
            max={LIMITS.fieldName}
            onChange={(v) =>
              dispatch({ type: 'FIELD_SET', embedId: embed.id, fieldId: field.id, key: 'name', value: v })
            }
          />
          <Input
            label="Значение"
            value={field.value}
            max={LIMITS.fieldValue}
            onChange={(v) =>
              dispatch({ type: 'FIELD_SET', embedId: embed.id, fieldId: field.id, key: 'value', value: v })
            }
          />
          <Checkbox
            label="В одну линию"
            checked={field.inline}
            onChange={(v) =>
              dispatch({ type: 'FIELD_SET', embedId: embed.id, fieldId: field.id, key: 'inline', value: v })
            }
          />
        </div>
      ))}

      <Button
        variant="ghost"
        block
        disabled={embed.fields.length >= LIMITS.fields}
        onClick={() => dispatch({ type: 'FIELD_ADD', embedId: embed.id })}
      >
        + Добавить поле
      </Button>
    </div>
  );
}
