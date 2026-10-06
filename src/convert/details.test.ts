import type { ImportOptions } from './actor';

import { describe, expect, it } from 'vitest';

import { parseSheetText } from '@/sheet/parse';

import { buildActorDraft, collectWarnings } from './actor';
import { buildFeature } from './features';
import { buildInventoryItem } from './inventory';
import { buildUsedSpellSlots } from './slots';

/**
 * Мелочи переноса, которые всплыли на листе колдуна и терялись молча:
 * потраченные ячейки договора, выбор в чертах, описание своего предмета и
 * свои заклинания. Тесты синтетические — работают и без локальных листов.
 */

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

/** Настройки импорта «перенести всё» */
const fullOptions: ImportOptions = {
  name: '',
  importFeatures: true,
  importInventory: true,
  importPersonality: true,
  assignOwner: true,
  isPublic: false,
};

describe('потраченные ячейки заклинаний', () => {
  it('разносит ячейки договора и обычные по своим полям', () => {
    const sheet = parseSheetText(
      JSON.stringify({
        ...MINIMAL_SHEET,
        spellSlots: [
          { level: 1, used: 1, kind: 'pact' },
          { level: 2, used: 2 },
        ],
      }),
    );

    expect(buildUsedSpellSlots(sheet)).toEqual({
      spellSlotsUsed: [0, 2, 0, 0, 0, 0, 0, 0, 0],
      pactSlotsUsed: 1,
    });
  });

  it('пропускает запись с кругом вне 1–9, а не пишет её не туда', () => {
    const sheet = parseSheetText(
      JSON.stringify({ ...MINIMAL_SHEET, spellSlots: [{ level: 0, used: 3 }] }),
    );

    expect(buildUsedSpellSlots(sheet).spellSlotsUsed).toEqual(
      Array.from({ length: 9 }, () => 0),
    );
  });

  it('попадает в системные данные актёра', () => {
    const sheet = parseSheetText(
      JSON.stringify({
        ...MINIMAL_SHEET,
        spellSlots: [{ level: 1, used: 1, kind: 'pact' }],
      }),
    );

    expect(buildActorDraft(sheet, fullOptions, null).actor.system.pactSlotsUsed).toBe(1);
  });
});

describe('выбор в черте', () => {
  it('дописывает выбор навыка к описанию', () => {
    const feature = buildFeature(
      {
        name: 'Умелость',
        description: ['Вы получаете владение 1 навыком на ваш выбор.'],
        choice: 'Убеждение',
      },
      0,
    );

    expect(feature.description).toBe(
      'Вы получаете владение 1 навыком на ваш выбор.\n\n**Выбрано:** Убеждение',
    );
  });

  it('переносит ответы группами в порядке листа', () => {
    const feature = buildFeature(
      {
        name: 'Посвящённый в магию',
        description: ['Вы изучаете заговоры.'],
        choiceAnswers: {
          'spell': ['Щит веры'],
          'cantrip': ['Наставление', 'Починка'],
          'spell-list': ['Жрец'],
        },
      },
      0,
    );

    expect(feature.description).toContain(
      '**Выбрано:** Щит веры; Наставление, Починка; Жрец',
    );
  });

  it('не дописывает ничего, если выбора нет', () => {
    const feature = buildFeature({ name: 'Черта', description: ['Текст.'] }, 0);

    expect(feature.description).toBe('Текст.');
  });
});

describe('свой предмет с сайта', () => {
  it('переносит описание предмета и заметку владельца', () => {
    const item = buildInventoryItem(
      {
        id: 'custom:115c48f9',
        url: 'custom:115c48f9',
        name: 'Кожаный доспех',
        description: ['{@b КД:} 11 + модификатор Ловкости.'],
        passiveNote: 'Подарок наставника',
      },
      0,
    );

    expect(item.description).toBe(
      '**КД:** 11 + модификатор Ловкости.\n\nПодарок наставника',
    );
  });

  it('оставляет пустое описание у предмета из справочника без заметки', () => {
    expect(buildInventoryItem({ name: 'Серп', passiveNote: '' }, 0).description).toBe('');
  });
});

describe('свои заклинания с сайта', () => {
  it('предупреждает о них отдельно: в компендиуме их нет', () => {
    const sheet = parseSheetText(
      JSON.stringify({
        ...MINIMAL_SHEET,
        spells: [
          { url: 'eldritch-blast-phb', name: 'Мистический заряд', level: 0 },
          { url: 'custom:f0988b0d', name: 'Жуткий смех Таши', level: 1 },
        ],
      }),
    );

    const warnings = collectWarnings(sheet);

    expect(warnings).toContainEqual(expect.stringContaining('Заклинания (1)'));
    expect(warnings).toContainEqual(
      expect.stringMatching(/^Свои заклинания с сайта \(1\).*Жуткий смех Таши/),
    );
  });
});
