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

  it('собирает таблицу листа в markdown-таблицу с названием', () => {
    const description = [
      {
        type: 'table',
        caption: 'Заклинания Метки письма',
        colLabels: ['Уровень', 'Заклинания'],
        rows: [
          ['1', '{@spell Приказ [Command]|url:command-phb}'],
          ['5', '{@spell Сновидение [Dream]|url:dream-phb}'],
        ],
      },
    ];

    expect(richTextToMarkdown(description)).toBe(
      '**Заклинания Метки письма**\n\n'
        + '| Уровень | Заклинания |\n'
        + '| --- | --- |\n'
        + '| 1 | Приказ [Command] |\n'
        + '| 5 | Сновидение [Dream] |',
    );
  });

  it('делает заголовком первую строку, если подписей столбцов нет', () => {
    expect(
      richTextToMarkdown([{ type: 'table', rows: [['А', 'Б'], ['1', '2']] }]),
    ).toBe('| А | Б |\n| --- | --- |\n| 1 | 2 |');
  });

  it('не даёт вертикальной черте в ячейке сломать таблицу', () => {
    expect(
      richTextToMarkdown([{ type: 'table', colLabels: ['Ключ'], rows: [['a|b']] }]),
    ).toBe('| Ключ |\n| --- |\n| a\\|b |');
  });

  it('возвращает пустую строку для пустого описания', () => {
    expect(richTextToMarkdown(undefined)).toBe('');
    expect(richTextToMarkdown([])).toBe('');
  });
});
