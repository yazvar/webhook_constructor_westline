/* ============================================================
   Seed presets inserted on first launch so the app isn't empty.
   They demonstrate webhook + embed templates with a project image.
   ============================================================ */

import { uid, createMessage, createEmbed, createField } from './discord';

function makeEmbed(overrides) {
  return { ...createEmbed(), ...overrides };
}

export function buildSamplePresets() {
  const now = Date.now();

  const announce = makeEmbed({
    title: 'Westline · Релиз v1.0',
    url: 'https://example.com',
    description:
      'Новая версия уже доступна.\n\n**Что нового:**\n- Конструктор эмбедов\n- Тёмная и светлая темы\n- Пресеты с сохранением',
    color: '#d71921',
    author: { name: 'Westline', url: '', iconUrl: '' },
    image: { url: 'https://picsum.photos/seed/westline/600/240' },
    thumbnail: { url: 'https://picsum.photos/seed/logo/120/120' },
    fields: [
      { ...createField(), name: 'Версия', value: '`v1.0.0`', inline: true },
      { ...createField(), name: 'Платформа', value: 'Web', inline: true },
    ],
    footer: { text: 'Westline Constructor', iconUrl: '' },
    timestamp: true,
  });

  const simple = makeEmbed({
    title: 'Заголовок объявления',
    description: 'Краткий текст объявления. Замените на свой.',
    color: '#ededed',
    fields: [],
  });

  return [
    {
      id: uid('preset'),
      name: 'Релиз проекта',
      order: 0,
      createdAt: now,
      updatedAt: now,
      message: {
        ...createMessage(),
        username: 'Westline Bot',
        content: '@everyone Большое обновление уже здесь!',
        embeds: [announce],
      },
    },
    {
      id: uid('preset'),
      name: 'Простое объявление',
      order: 1,
      createdAt: now,
      updatedAt: now,
      message: {
        ...createMessage(),
        username: '',
        content: '',
        embeds: [simple],
      },
    },
  ];
}
