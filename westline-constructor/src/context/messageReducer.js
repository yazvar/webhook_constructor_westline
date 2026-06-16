/* ============================================================
   Reducer for the whole message draft.
   Pure function — no side effects, easy to test.
   ============================================================ */

import { createEmbed, createField, createMessage } from '../utils/discord';

export const initialMessage = createMessage();

export function messageReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return {
        ...createMessage(),
        target: state.target,
        webhookUrl: state.webhookUrl,
        channelId: state.channelId,
        guildId: state.guildId,
        channelLabel: state.channelLabel,
      };

    case 'REPLACE':
      return { ...createMessage(), ...action.message };

    case 'SET': // top-level scalar: webhookUrl, username, avatarUrl, content
      return { ...state, [action.key]: action.value };

    case 'ADD_EMBED':
      if (state.embeds.length >= 10) return state;
      return { ...state, embeds: [...state.embeds, createEmbed()] };

    case 'REMOVE_EMBED':
      return {
        ...state,
        embeds: state.embeds.filter((e) => e.id !== action.id),
      };

    case 'DUPLICATE_EMBED': {
      if (state.embeds.length >= 10) return state;
      const idx = state.embeds.findIndex((e) => e.id === action.id);
      const src = state.embeds[idx];
      if (!src) return state;
      const clone = structuredClone(src);
      clone.id = createEmbed().id;
      clone.fields = clone.fields.map((f) => ({ ...f, id: createField().id }));
      const embeds = [...state.embeds];
      embeds.splice(idx + 1, 0, clone);
      return { ...state, embeds };
    }

    case 'MOVE_EMBED': {
      const idx = state.embeds.findIndex((e) => e.id === action.id);
      const target = idx + action.dir;
      if (idx < 0 || target < 0 || target >= state.embeds.length) return state;
      const embeds = [...state.embeds];
      [embeds[idx], embeds[target]] = [embeds[target], embeds[idx]];
      return { ...state, embeds };
    }

    case 'EMBED_SET': // top-level embed key
      return {
        ...state,
        embeds: state.embeds.map((e) =>
          e.id === action.id ? { ...e, [action.key]: action.value } : e
        ),
      };

    case 'EMBED_SET_NESTED': // author/footer/image/thumbnail
      return {
        ...state,
        embeds: state.embeds.map((e) =>
          e.id === action.id
            ? {
                ...e,
                [action.group]: { ...e[action.group], [action.key]: action.value },
              }
            : e
        ),
      };

    case 'FIELD_ADD':
      return {
        ...state,
        embeds: state.embeds.map((e) =>
          e.id === action.embedId && e.fields.length < 25
            ? { ...e, fields: [...e.fields, createField()] }
            : e
        ),
      };

    case 'FIELD_REMOVE':
      return {
        ...state,
        embeds: state.embeds.map((e) =>
          e.id === action.embedId
            ? { ...e, fields: e.fields.filter((f) => f.id !== action.fieldId) }
            : e
        ),
      };

    case 'FIELD_SET':
      return {
        ...state,
        embeds: state.embeds.map((e) =>
          e.id === action.embedId
            ? {
                ...e,
                fields: e.fields.map((f) =>
                  f.id === action.fieldId ? { ...f, [action.key]: action.value } : f
                ),
              }
            : e
        ),
      };

    case 'FIELD_MOVE':
      return {
        ...state,
        embeds: state.embeds.map((e) => {
          if (e.id !== action.embedId) return e;
          const idx = e.fields.findIndex((f) => f.id === action.fieldId);
          const target = idx + action.dir;
          if (idx < 0 || target < 0 || target >= e.fields.length) return e;
          const fields = [...e.fields];
          [fields[idx], fields[target]] = [fields[target], fields[idx]];
          return { ...e, fields };
        }),
      };

    default:
      return state;
  }
}
