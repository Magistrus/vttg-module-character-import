import { describe, expect, it } from 'vitest';

import { hasLocalSheet, localSheet as fixture } from '@/testing/localSheet';

import {
  countCounters,
  dropNullProperties,
  isSheetFileName,
  parseSheetText,
  resolveTotalLevel,
  summarizeSheet,
} from './parse';

/** Текст листа-эталона из `fixtures/` */
const sheetText = JSON.stringify(fixture);

describe('isSheetFileName', () => {
  it('принимает только JSON', () => {
    expect(isSheetFileName('Гоги.json')).toBe(true);
    expect(isSheetFileName('ГОГИ.JSON')).toBe(true);
    expect(isSheetFileName('map.dd2vtt')).toBe(false);
  });
});

/** Минимальный лист, который принимает схема */
const MINIMAL_SHEET = {
  name: 'Тест',
  abilities: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  },
};

describe('dropNullProperties', () => {
  it('убирает null-свойства на любой глубине', () => {
    expect(
      dropNullProperties({ a: null, b: { c: null, d: 1 }, e: [{ f: null, g: 'x' }] }),
    ).toEqual({ b: { d: 1 }, e: [{ g: 'x' }] });
  });

  it('не трогает null-элементы массивов — это позиции', () => {
    expect(dropNullProperties({ rows: [['1', null]] })).toEqual({
      rows: [['1', null]],
    });
  });
});

describe('parseSheetText', () => {
  it('принимает владение-ссылку без ссылки (`url: null`)', () => {
    // Так приходят инструменты из черты «Музыкант»: из-за одного `null` лист
    // колдуна отклонялся на `proficiencies.tools.1`.
    const sheet = parseSheetText(
      JSON.stringify({
        ...MINIMAL_SHEET,
        avatarUrl: null,
        proficiencies: { tools: [{ name: 'Лира', url: null }] },
      }),
    );

    expect(sheet.proficiencies?.tools).toEqual([{ name: 'Лира' }]);
  });

  it.skipIf(!hasLocalSheet)('разбирает лист персонажа с сайта', () => {
    const sheet = parseSheetText(sheetText);

    expect(sheet.name).toBe('Гоги');
    expect(sheet.abilities.strength).toBe(16);
  });

  it('объясняет, что файл не JSON', () => {
    expect(() => parseSheetText('<html>')).toThrowError(/не читается как JSON/);
  });

  it('объясняет, что JSON не похож на лист', () => {
    expect(() => parseSheetText('{"foo":1}')).toThrowError(
      /не похоже на лист персонажа/,
    );
  });

  it.skipIf(!hasLocalSheet)('не спотыкается о незнакомые поля листа', () => {
    const sheet = parseSheetText(
      JSON.stringify({ ...fixture, somethingNew: { nested: true } }),
    );

    expect(sheet.name).toBe('Гоги');
  });
});

describe.skipIf(!hasLocalSheet)('summarizeSheet', () => {
  const summary = summarizeSheet(parseSheetText(sheetText));

  it('собирает шапку персонажа', () => {
    expect(summary).toEqual(
      expect.objectContaining({
        name: 'Гоги',
        level: 1,
        classes: 'Воин 1',
        speciesName: 'Дварф',
        backgroundName: 'Солдат',
        hitPointsCurrent: 13,
        hitPointsMax: 13,
      }),
    );
  });

  it('считает содержимое листа', () => {
    expect(summary).toEqual(
      expect.objectContaining({
        featureCount: 9,
        itemCount: 13,
        spellCount: 0,
        counterCount: 1,
        languageCount: 2,
      }),
    );
  });
});

describe.skipIf(!hasLocalSheet)('resolveTotalLevel', () => {
  it('берёт уровень с листа', () => {
    expect(resolveTotalLevel(parseSheetText(sheetText))).toBe(1);
  });

  it('складывает уровни классов, если общего уровня нет', () => {
    const multiclass = parseSheetText(
      JSON.stringify({
        ...fixture,
        level: undefined,
        additionalClasses: [{ url: 'rogue-phb', name: 'Плут', level: 2 }],
      }),
    );

    expect(resolveTotalLevel(multiclass)).toBe(3);
  });
});

describe.skipIf(!hasLocalSheet)('countCounters', () => {
  it('не считает один ресурс дважды', () => {
    expect(countCounters(parseSheetText(sheetText))).toBe(1);
  });
});
