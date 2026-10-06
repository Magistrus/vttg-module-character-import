import type { SheetSpellRef } from '@/sheet/spells';

import { describe, expect, it } from 'vitest';

import { buildActorSpell } from './actorSpell';
import { readCompendiumSpells, readWorkshopSpells } from './catalog';
import {
  buildHomebrewSpell,
  parseCastingTime,
  parseComponents,
  parseDuration,
  parseRange,
} from './homebrew';
import { buildSpellCatalogIndex, findCatalogSpell } from './match';

/** Запись компендиума «Порча» — как её отдаёт система */
const BANE = { type: 'spell', id: 'bane-phb', name: 'Порча', level: 1, school: 'enchantment' };

/** «Жуткий смех Таши» лежит в двух паках: с хвостом книги и без */
const TASHA_PLAIN = { type: 'spell', id: 'tasha-s-hideous-laughter', name: 'Жуткий смех Таши', level: 1 };
const TASHA_BOOK = { type: 'spell', id: 'tasha-s-hideous-laughter-phb', name: 'Жуткий смех Таши', level: 1 };

/** Заговор компендиума */
const ELDRITCH_BLAST = { type: 'spell', id: 'eldritch-blast-phb', name: 'Мистический заряд', level: 0 };

/**
 * Собирает ссылку листа на заклинание.
 *
 * @param fields - поля заклинания с листа
 * @returns ссылка для сопоставления
 */
function sheetSpell(fields: Omit<SheetSpellRef, 'raw'>): SheetSpellRef {
  return { ...fields, raw: { ...fields } };
}

describe('каталог заклинаний', () => {
  it('отбрасывает записи, которые не заклинания', () => {
    expect(readCompendiumSpells([BANE, { type: 'weapon', id: 'x', name: 'Меч' }, null])).toEqual([
      { id: 'bane-phb', name: 'Порча', level: 1, source: 'compendium', record: BANE },
    ]);
  });

  it('разворачивает заклинание «Мастерской» из обёртки предмета', () => {
    const wrapped = { id: 'item_1', type: 'spell', name: 'Огонёк', spellData: { ...BANE, id: 'spell_9', name: 'Огонёк' } };

    expect(readWorkshopSpells([wrapped])).toEqual([
      expect.objectContaining({ id: 'spell_9', name: 'Огонёк', source: 'workshop' }),
    ]);
  });
});

describe('сопоставление с каталогом', () => {
  const index = buildSpellCatalogIndex(
    readCompendiumSpells([BANE, TASHA_PLAIN, TASHA_BOOK, ELDRITCH_BLAST]),
    [],
  );

  it('находит заклинание книги по ссылке сайта', () => {
    const found = findCatalogSpell(
      sheetSpell({ url: 'eldritch-blast-phb', name: 'Что угодно', level: 0 }),
      index,
    );

    expect(found?.id).toBe('eldritch-blast-phb');
  });

  it('находит копию с сайта по названию и кругу', () => {
    const found = findCatalogSpell(
      sheetSpell({ url: 'custom:0f1e', name: 'порча ', level: 1 }),
      index,
    );

    expect(found?.id).toBe('bane-phb');
  });

  it('из одноимённых записей берёт запись с хвостом книги', () => {
    const found = findCatalogSpell(
      sheetSpell({ url: 'custom:f098', name: 'Жуткий смех Таши', level: 1 }),
      index,
    );

    expect(found?.id).toBe('tasha-s-hideous-laughter-phb');
  });

  it('не принимает совпадение названия на другом круге', () => {
    expect(
      findCatalogSpell(sheetSpell({ url: 'custom:1', name: 'Порча', level: 2 }), index),
    ).toBeUndefined();
  });

  it('не ищет по одному названию, если круга нет', () => {
    expect(findCatalogSpell(sheetSpell({ name: 'Порча' }), index)).toBeUndefined();
  });

  it('берёт заведённое прошлым импортом из «Мастерской», а не плодит дубль', () => {
    const workshop = readWorkshopSpells([
      { type: 'spell', spellData: { type: 'spell', id: 'spell_7', name: 'Своя искра', level: 0 } },
    ]);

    const withWorkshop = buildSpellCatalogIndex([], workshop);

    expect(
      findCatalogSpell(sheetSpell({ url: 'custom:2', name: 'Своя искра', level: 0 }), withWorkshop)?.id,
    ).toBe('spell_7');
  });
});

describe('заклинание на листе актёра', () => {
  it('выданное видом подготовлено всегда и помнит источник', () => {
    const spell = buildActorSpell(
      BANE,
      sheetSpell({ name: 'Порча', level: 1, grant: { kind: 'species', source: 'Хоравар' } }),
      'spell_a',
    );

    expect(spell).toEqual(
      expect.objectContaining({
        id: 'spell_a',
        name: 'Порча',
        school: 'enchantment',
        prepared: true,
        alwaysPrepared: true,
        grantedByFeature: 'Хоравар',
        grantKind: 'species',
      }),
    );
  });

  it('заговор книги считается выученным, хотя сайт пишет prepared: false', () => {
    const spell = buildActorSpell(
      ELDRITCH_BLAST,
      sheetSpell({ name: 'Мистический заряд', level: 0, prepared: false }),
      'spell_b',
    );

    expect(spell.prepared).toBe(true);
    expect(spell).not.toHaveProperty('grantedByFeature');
  });

  it('у заклинания книги 1+ круга берёт отметку листа', () => {
    expect(
      buildActorSpell(BANE, sheetSpell({ name: 'Порча', level: 1, prepared: false }), 'spell_c').prepared,
    ).toBe(false);
  });

  it('переносит заклинательную характеристику источника', () => {
    const spell = buildActorSpell(
      BANE,
      sheetSpell({ name: 'Порча', level: 1, spellcastingAbility: 'charisma' }),
      'spell_d',
    );

    expect(spell.spellcastingAbility).toBe('charisma');
  });
});

describe('разбор полей своего заклинания', () => {
  it('разбирает время сотворения', () => {
    expect(parseCastingTime('Бонусное действие')).toEqual({ value: 1, unit: 'bonus-action' });
    expect(parseCastingTime('10 минут')).toEqual({ value: 10, unit: 'minute' });
    expect(parseCastingTime('Когда-нибудь')).toBeNull();
  });

  it('разбирает дистанцию', () => {
    expect(parseRange('120 футов')).toEqual({ range: 120, unit: 'ft' });
    expect(parseRange('Касание')).toEqual(expect.objectContaining({ delivery: 'touch' }));
    expect(parseRange('На себя')).toEqual(expect.objectContaining({ unit: 'self', delivery: 'self' }));
  });

  it('разбирает компоненты с материалом', () => {
    expect(parseComponents('В, С, М (кусочек пирога и перо)')).toEqual({
      verbal: true,
      somatic: true,
      material: true,
      materialDescription: 'кусочек пирога и перо',
    });
  });

  it('разбирает длительность', () => {
    expect(parseDuration('Концентрация, вплоть до 1 минуты')).toEqual({ value: 1, unit: 'minute' });
    expect(parseDuration('Мгновенная')).toEqual({ value: 0, unit: 'instantaneous' });
  });

  it('собирает своё заклинание и оставляет неразобранное видимым', () => {
    const spell = buildHomebrewSpell(
      sheetSpell({ url: 'custom:9', name: 'Смех', level: 1 }),
      'spell_x',
    );

    expect(spell).toEqual(
      expect.objectContaining({ id: 'spell_x', type: 'spell', name: 'Смех', level: 1, sourceKey: 'hb' }),
    );
  });

  it('видит спасбросок, концентрацию и сохраняет незнакомое поле в описании', () => {
    const fields = {
      url: 'custom:9',
      name: 'Смех',
      level: 1,
      school: 'Очарование',
      castingTime: 'Действие',
      range: '30 футов',
      duration: 'Концентрация, вплоть до 1 минуты',
      components: 'В, С, М (пирог)',
      description: ['Цель совершает спасбросок Мудрости.'],
    };

    const spell = buildHomebrewSpell(
      { name: 'Смех', level: 1, url: 'custom:9', raw: fields },
      'spell_y',
    );

    expect(spell).toEqual(
      expect.objectContaining({
        school: 'enchantment',
        range: 30,
        durationUnit: 'minute',
        concentration: true,
        saveType: 'wisdom',
        deliveryType: 'none',
      }),
    );

    const odd = buildHomebrewSpell(
      { name: 'Смех', level: 1, raw: { ...fields, range: 'Вид' } },
      'spell_z',
    );

    expect(odd.description).toContain('**С листа TTG Club (проверьте поля):** Дистанция: Вид.');
  });
});
