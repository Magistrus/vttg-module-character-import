import type { VttgItemCreateInput, VttgModuleApi } from '@/types/vttg';

import { describe, expect, it, vi } from 'vitest';

import { parseSheetText } from '@/sheet/parse';
import { loadLocalSheet } from '@/testing/localSheet';

import { importSpells, isSpellTransferSupported } from './spells';

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

/** Компендиум мира: «Порча» и «Мистический заряд» */
const COMPENDIUM = [
  { type: 'spell', id: 'bane-phb', name: 'Порча', level: 1 },
  { type: 'spell', id: 'eldritch-blast-phb', name: 'Мистический заряд', level: 0 },
  { type: 'spell', id: 'tasha-s-hideous-laughter-phb', name: 'Жуткий смех Таши', level: 1 },
];

/**
 * Собирает заглушку хоста с компендиумом и «Мастерской».
 *
 * @param workshop - записи «Мастерской» мира
 * @returns заглушка API и шпион на создании записи
 */
function createApiStub(workshop: unknown[] = []): {
  api: VttgModuleApi;
  create: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn(async (input: VttgItemCreateInput) => ({
    id: 'item_1',
    name: input.name,
    type: input.type,
  }));

  const api = {
    scene: { isGM: () => true, getLoggedUserId: () => 'user-7' },
    modals: { open: vi.fn(), close: vi.fn(), closeAll: vi.fn() },
    notifications: { info: vi.fn(), warning: vi.fn(), error: vi.fn(), success: vi.fn() },
    settings: { get: vi.fn(), set: vi.fn() },
    extensions: { register: vi.fn(), unregister: vi.fn() },
    system: { getActiveSystemId: () => 'dnd5e-2024' },
    compendium: { getEntries: vi.fn(async () => COMPENDIUM) },
    items: { list: vi.fn(async () => workshop), create },
  } satisfies VttgModuleApi;

  return { api, create };
}

/**
 * Лист с тремя заклинаниями: книжное, копия с сайта и придуманное.
 *
 * @returns разобранный лист
 */
function sheetWithSpells(): ReturnType<typeof parseSheetText> {
  return parseSheetText(
    JSON.stringify({
      ...MINIMAL_SHEET,
      spells: [
        { url: 'eldritch-blast-phb', name: 'Мистический заряд', level: 0, prepared: false },
        { url: 'custom:aa', name: 'Порча', level: 1, prepared: true },
        {
          url: 'custom:bb',
          name: 'Песнь болота',
          level: 2,
          school: 'Иллюзия',
          range: '60 футов',
          description: ['Существо совершает спасбросок Мудрости.'],
        },
      ],
    }),
  );
}

describe('перенос заклинаний', () => {
  it('без компендиума у хоста ничего не делает', async () => {
    const { api } = createApiStub();

    delete api.compendium;

    expect(isSpellTransferSupported(api)).toBe(false);
    await expect(importSpells(api, sheetWithSpells())).resolves.toBeNull();
  });

  it('берёт из компендиума найденное и заводит в «Мастерской» только остальное', async () => {
    const { api, create } = createApiStub();

    const result = await importSpells(api, sheetWithSpells());

    expect(result?.matchedCount).toBe(2);
    expect(result?.createdInWorkshop).toEqual(['Песнь болота']);
    expect(result?.failed).toEqual([]);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        name: 'Песнь болота',
        type: 'spell',
        spellData: expect.objectContaining({ level: 2, school: 'illusion', saveType: 'wisdom' }),
      }),
    );

    expect(result?.spells.map((spell) => spell.name)).toEqual([
      'Мистический заряд',
      'Порча',
      'Песнь болота',
    ]);

    expect(new Set(result?.spells.map((spell) => spell.id)).size).toBe(3);
  });

  it('не заводит повторно то, что уже лежит в «Мастерской»', async () => {
    const { api, create } = createApiStub([
      { type: 'spell', spellData: { type: 'spell', id: 'spell_old', name: 'Песнь болота', level: 2 } },
    ]);

    const result = await importSpells(api, sheetWithSpells());

    expect(create).not.toHaveBeenCalled();
    expect(result?.matchedCount).toBe(3);
  });

  it('отказ сервера не срывает перенос остальных', async () => {
    const { api, create } = createApiStub();

    create.mockRejectedValue(new Error('Нет права создавать предметы'));

    const result = await importSpells(api, sheetWithSpells());

    expect(result?.spells).toHaveLength(2);
    expect(result?.failed).toEqual([
      { name: 'Песнь болота', reason: 'Нет права создавать предметы' },
    ]);
  });

  it('без «Мастерской» называет причину, а найденное переносит', async () => {
    const { api } = createApiStub();

    delete api.items;

    const result = await importSpells(api, sheetWithSpells());

    expect(result?.matchedCount).toBe(2);
    expect(result?.failed[0]?.reason).toContain('item-write');
  });
});

const warlock = loadLocalSheet('human-warlock.json');

describe.skipIf(!warlock.available)('лист колдуна', () => {
  it('находит копии с сайта в компендиуме по названию', async () => {
    const { api } = createApiStub();
    const result = await importSpells(api, parseSheetText(JSON.stringify(warlock.sheet)));
    const ids = result?.spells.map((spell) => spell.name) ?? [];

    expect(ids).toContain('Порча');
    expect(ids).toContain('Жуткий смех Таши');
    expect(result?.createdInWorkshop).not.toContain('Порча');
    expect(result?.createdInWorkshop).not.toContain('Жуткий смех Таши');
  });
});
