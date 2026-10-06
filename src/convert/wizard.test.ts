import type { ImportOptions } from './actor';

import { describe, expect, it } from 'vitest';

import { parseSheetText, summarizeSheet } from '@/sheet/parse';
import { loadLocalSheet } from '@/testing/localSheet';

import { buildActorDraft } from './actor';

/**
 * Регрессия на лист заклинателя (хоравар-волшебник 1 уровня).
 *
 * Этот лист не импортировался вовсе: владение инструментом пришло ссылкой
 * `{ name, url }`, а схема ждала строку, и весь лист отклонялся на
 * `proficiencies.tools.0`. Заодно он показал две тихие потери: заклинания
 * персонажа лежат внутри черт и вида (сводка говорила «заклинаний: 0»), а
 * таблица в описании черты пропадала целиком.
 */
const wizard = loadLocalSheet('khoravar-wizard.json');

/** Настройки импорта «перенести всё» */
const fullOptions: ImportOptions = {
  name: '',
  importFeatures: true,
  importInventory: true,
  importPersonality: true,
  assignOwner: true,
  isPublic: false,
};

describe.skipIf(!wizard.available)('лист заклинателя', () => {
  const sheetText = JSON.stringify(wizard.sheet);

  it('разбирается, хотя владение инструментом пришло ссылкой', () => {
    expect(() => parseSheetText(sheetText)).not.toThrow();
  });

  it('переносит владение инструментом названием', () => {
    const { actor } = buildActorDraft(parseSheetText(sheetText), fullOptions, null);

    expect(actor.system.proficiencies.tools).toEqual(['Инструменты каллиграфа']);
  });

  it('считает заклинания из черт и вида, а не только верхний список', () => {
    // Книга волшебника (9) + «Метка письма» на 1 уровне (2) + «Дружба» вида
    // (1). «Волшебные уста» открываются на 3 уровне — их у персонажа ещё нет.
    expect(summarizeSheet(parseSheetText(sheetText)).spellCount).toBe(12);
  });

  it('называет непереносимые заклинания поимённо', () => {
    const { warnings } = buildActorDraft(
      parseSheetText(sheetText),
      fullOptions,
      null,
    );

    const spellWarning = warnings.find((text) => text.startsWith('Заклинания (12)'));

    expect(spellWarning).toContain('Волшебная стрела');
    expect(spellWarning).toContain('Дружба');
    expect(spellWarning).not.toContain('Волшебные уста');
  });

  it('предупреждает об эффекте черты, который не переносится', () => {
    const { warnings } = buildActorDraft(
      parseSheetText(sheetText),
      fullOptions,
      null,
    );

    expect(warnings.some((text) => text.includes('Наследие фей'))).toBe(true);
  });

  it('сохраняет таблицу в описании черты', () => {
    const { actor } = buildActorDraft(parseSheetText(sheetText), fullOptions, null);
    const scribing = actor.features.find((entry) => entry.name === 'Метка письма');

    expect(scribing?.description).toContain('**Заклинания Метки письма**');
    expect(scribing?.description).toContain('| Уровень | Заклинания |');
    expect(scribing?.description).toContain(
      '| 5 | Сновидение [Dream] |',
    );
  });

  it('собирает класс волшебника с костью к6 и полным заклинателем', () => {
    const { actor } = buildActorDraft(parseSheetText(sheetText), fullOptions, null);

    expect(actor.system.classes).toEqual([
      expect.objectContaining({
        classKey: 'wizard',
        hitDie: 6,
        casterType: 'full',
        hitPointsGained: [{ level: 1, method: 'custom', rolled: 6 }],
      }),
    ]);
  });
});
