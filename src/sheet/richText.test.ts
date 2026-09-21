import { describe, expect, it } from 'vitest';

import { richTextToMarkdown, unwrapSiteMarkup } from './richText';

describe('unwrapSiteMarkup', () => {
  it('оставляет от ссылки на справочник только её текст', () => {
    expect(
      unwrapSiteMarkup(
        'У вас есть {@glossary тёмное зрение|url:darkvision-phb} в пределах 120 фт.',
      ),
    ).toBe('У вас есть тёмное зрение в пределах 120 фт.');
  });

  it('переводит жирный текст и перенос строки', () => {
    expect(unwrapSiteMarkup('{@b Нет.}{@br}Дальше')).toBe('**Нет.**\nДальше');
  });

  it('сохраняет формулу броска', () => {
    expect(unwrapSiteMarkup('восстановить {@roll 1к10} хитов')).toBe(
      'восстановить 1к10 хитов',
    );
  });

  it('не ломается на тексте без разметки', () => {
    expect(unwrapSiteMarkup('Обычный текст')).toBe('Обычный текст');
  });
});

describe('richTextToMarkdown', () => {
  it('собирает абзацы через пустую строку', () => {
    expect(richTextToMarkdown(['Первый', 'Второй'])).toBe('Первый\n\nВторой');
  });

  it('переводит список узлов редактора в markdown-список', () => {
    const description = [
      'Вы получаете следующие эффекты:',
      {
        type: 'list',
        content: [
          {
            type: 'li',
            content: [
              { type: 'bold', content: [{ type: 'text', text: 'Очки удачи.' }] },
              { type: 'text', text: ' У вас есть очки удачи.' },
            ],
          },
        ],
      },
    ];

    expect(richTextToMarkdown(description)).toBe(
      'Вы получаете следующие эффекты:\n\n- **Очки удачи.** У вас есть очки удачи.',
    );
  });

  it('оформляет цитату и заголовок внутри неё', () => {
    const description = [
      {
        type: 'quote',
        content: [
          [{ type: 'heading', attrs: { level: '4' }, content: [{ type: 'text', text: 'Совет' }] }],
          ['{@b Вопрос?}'],
        ],
      },
    ];

    expect(richTextToMarkdown(description)).toBe('> #### Совет\n\n> **Вопрос?**');
  });

  it('возвращает пустую строку для пустого описания', () => {
    expect(richTextToMarkdown(undefined)).toBe('');
    expect(richTextToMarkdown([])).toBe('');
  });
});
