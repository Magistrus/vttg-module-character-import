import type { ImportOptions } from './actor';

import { describe, expect, it } from 'vitest';

import { parseSheetText, summarizeSheet } from '@/sheet/parse';
import { loadLocalSheet } from '@/testing/localSheet';

import { buildActorDraft } from './actor';

/**
 * Регрессия на лист колдуна (человек-колдун 1 уровня, «Алис»).
 *
 * Этот лист не разбирался: у инструментов из черты «Музыкант» ссылки нет —
 * `{ name: 'Лира', url: null }`, — а схема допускала отсутствие `url`, но не
 * `null`. Заодно на нём терялись потраченная ячейка договора, выбор в чертах
 * и описание своего доспеха.
 */
const warlock = loadLocalSheet('human-warlock.json');

/** Настройки импорта «перенести всё» */
const fullOptions: ImportOptions = {
  name: '',
  importFeatures: true,
  importInventory: true,
  importPersonality: true,
  assignOwner: true,
  isPublic: false,
};

describe.skipIf(!warlock.available)('лист колдуна', () => {
  const sheetText = JSON.stringify(warlock.sheet);

  it('разбирается, хотя у владений бывает `url: null`', () => {
    expect(() => parseSheetText(sheetText)).not.toThrow();
  });

  it('переносит инструменты названиями', () => {
    const { actor } = buildActorDraft(parseSheetText(sheetText), fullOptions, null);

    expect(actor.system.proficiencies.tools).toEqual(['Флейта', 'Лира', 'Барабан']);
  });

  it('сохраняет потраченную ячейку договора', () => {
    const { actor } = buildActorDraft(parseSheetText(sheetText), fullOptions, null);

    expect(actor.system.pactSlotsUsed).toBe(1);
    expect(actor.system.spellSlotsUsed.every((used) => used === 0)).toBe(true);
  });

  it('собирает класс колдуна с договорной магией', () => {
    const { actor } = buildActorDraft(parseSheetText(sheetText), fullOptions, null);

    expect(actor.system.classes).toEqual([
      expect.objectContaining({ classKey: 'warlock', hitDie: 8, casterType: 'pact' }),
    ]);
  });

  it('видит все 7 заклинаний и делит их на книжные и свои', () => {
    const sheet = parseSheetText(sheetText);
    const { warnings } = buildActorDraft(sheet, fullOptions, null);

    expect(summarizeSheet(sheet).spellCount).toBe(7);
    expect(warnings).toContainEqual(expect.stringContaining('Заклинания (5)'));
    expect(warnings).toContainEqual(
      expect.stringMatching(/^Свои заклинания с сайта \(2\)/),
    );
  });

  it('дописывает сделанный выбор к черте вида', () => {
    const { actor } = buildActorDraft(parseSheetText(sheetText), fullOptions, null);
    const skilled = actor.features.find((entry) => entry.name === 'Умелость');

    expect(skilled?.description).toContain('**Выбрано:** Убеждение');
  });

  it('переносит описание своего доспеха', () => {
    const { actor } = buildActorDraft(parseSheetText(sheetText), fullOptions, null);
    const armor = actor.equipment.find((entry) => entry.name === 'Кожаный доспех');

    expect(armor?.description).toContain('**КД:** 11 + модификатор Ловкости.');
    expect(armor?.equipmentCategory).toBe('light');
  });

  it('переносит вдохновение', () => {
    const { actor } = buildActorDraft(parseSheetText(sheetText), fullOptions, null);

    expect(actor.system.inspiration).toBe(true);
  });
});
