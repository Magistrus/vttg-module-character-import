import type { ImportOptions } from './actor';
import type { DndGameItem } from '@/types/dnd5e';

import { describe, expect, it } from 'vitest';

import { hasLocalSheet, localSheet as fixture } from '@/testing/localSheet';
import { parseSheetText } from '@/sheet/parse';

import { buildActorDraft, buildDescription, collectWarnings } from './actor';

/** Лист дварфа-воина 1 уровня из `fixtures/` — эталон для всех проверок */
const sheet = parseSheetText(JSON.stringify(fixture));

/** Настройки импорта «перенести всё» */
const fullOptions: ImportOptions = {
  name: '',
  importFeatures: true,
  importInventory: true,
  importPersonality: true,
  assignOwner: true,
  isPublic: false,
};

/**
 * Достаёт предмет собранного актёра по его идентификатору.
 *
 * @param equipment - снаряжение собранного актёра
 * @param id - идентификатор предмета
 * @returns найденный предмет
 */
function findItem(equipment: DndGameItem[], id: string): DndGameItem {
  const item = equipment.find((entry) => entry.id === id);

  if (!item) {
    throw new Error(`В снаряжении нет предмета ${id}`);
  }

  return item;
}

describe.skipIf(!hasLocalSheet)('buildActorDraft — нейтральная часть', () => {
  const { actor } = buildActorDraft(sheet, fullOptions, { ownerId: 'user-1' });

  it('берёт имя с листа, если своё не задано', () => {
    expect(actor.name).toBe('Гоги');
  });

  it('делает импортировавшего владельцем', () => {
    expect(actor.ownerIds).toEqual(['user-1']);
  });

  it('кладёт картинку и в аватар, и в токен — сцена читает только токен', () => {
    const withPicture = parseSheetText(
      JSON.stringify({ ...fixture, avatarUrl: 'https://ttg.club/media/gogi.png' }),
    );

    const { actor: fromSheet } = buildActorDraft(withPicture, fullOptions);

    expect(fromSheet.avatar).toBe('https://ttg.club/media/gogi.png');
    expect(fromSheet.token?.imageUrl).toBe('https://ttg.club/media/gogi.png');

    // Картинку перенесли в файлы мира — в актёра едет путь оттуда.
    const { actor: uploaded } = buildActorDraft(withPicture, fullOptions, {
      avatar: 'avatars/gogi.webp',
    });

    expect(uploaded.avatar).toBe('avatars/gogi.webp');
    expect(uploaded.token?.imageUrl).toBe('avatars/gogi.webp');
  });

  it('не выдумывает картинку, если её нет на листе', () => {
    expect(actor.avatar).toBeUndefined();
    expect(actor.token?.imageUrl).toBeUndefined();
  });

  it('переносит зрение персонажа в настройки токена', () => {
    expect(actor.token?.vision).toEqual({
      enabled: true,
      range: 0,
      darkvision: 60,
      angle: 360,
    });
  });
});

describe.skipIf(!hasLocalSheet)('buildActorDraft — системные данные', () => {
  const { actor } = buildActorDraft(sheet, fullOptions);
  const system = actor.system;

  it('переносит характеристики как есть', () => {
    expect(system.abilities).toEqual({
      strength: 16,
      dexterity: 14,
      constitution: 16,
      intelligence: 11,
      wisdom: 13,
      charisma: 13,
    });
  });

  it('собирает класс с ключом без хвоста источника', () => {
    expect(system.classes).toEqual([
      expect.objectContaining({
        classKey: 'fighter',
        className: 'Воин',
        level: 1,
        hitDie: 10,
        subclassKey: null,
        casterType: 'none',
      }),
    ]);
  });

  it('вычитает модификатор Телосложения из прибавки хитов за уровень', () => {
    // На листе 13 хитов за 1 уровень при Телосложении 16 (+3): системе нужен
    // «чистый» бросок 10 — модификатор она добавит сама.
    expect(system.classes[0]?.hitPointsGained).toEqual([
      { level: 1, method: 'custom', rolled: 10 },
    ]);
  });

  it('переносит вид, размер и предысторию', () => {
    expect(system.species).toEqual(
      expect.objectContaining({ speciesKey: 'dwarf', speciesName: 'Дварф', size: 'medium' }),
    );

    expect(system.background).toEqual(
      expect.objectContaining({
        backgroundKey: 'soldier',
        backgroundName: 'Солдат',
        abilityChoices: { strength: 2, constitution: 1 },
        grantedFeatName: 'Дикий атакующий',
      }),
    );
  });

  it('переносит только реальные владения навыками', () => {
    expect(system.proficiencies.skills).toEqual({
      acrobatics: 'proficient',
      athletics: 'proficient',
      intimidation: 'proficient',
    });
  });

  it('переносит владения спасбросками, доспехами и языками', () => {
    expect(system.proficiencies.savingThrows).toEqual([
      'strength',
      'constitution',
    ]);

    expect(system.proficiencies.armor).toContain('Вся тяжёлая броня');
    expect(system.proficiencies.languages).toEqual(['Общий', 'Дварфийский']);
  });

  it('оставляет расчёт КД системе, пока лист не задал его вручную', () => {
    expect(system.armorClass).toEqual({
      value: 10,
      calculation: 'default',
      formula: '',
      flat: null,
    });
  });

  it('переносит хиты и передвижение', () => {
    expect(system.hitPoints).toEqual({ current: 13, max: 13, temp: 0 });

    expect(system.movement).toEqual({
      walk: 30,
      swim: 0,
      fly: 0,
      climb: 0,
      burrow: 0,
      hover: false,
      units: 'ft',
    });
  });

  it('переводит монеты листа в валюту системы', () => {
    expect(system.currency).toEqual({ cp: 0, sp: 0, ep: 0, gp: 18, pp: 0 });
  });

  it('заполняет поля, которые новый актёр системы получает по умолчанию', () => {
    expect(system.carryingCapacity).toEqual({ size: null, custom: null, bonus: 0 });
    expect(system.preparedSpells).toEqual({ custom: null, bonuses: [] });
    expect(system.preparedCantrips).toEqual({ custom: null, bonuses: [] });
    expect(system.cantripsTracked).toBe(true);
    expect(actor.token?.disposition).toBe('friendly');
  });

  it('переводит число-прибавку листа в запись прибавки системы', () => {
    const tuned = parseSheetText(
      JSON.stringify({
        ...fixture,
        spellcasting: {
          prepared: { custom: null, bonus: 2 },
          preparedCantrips: { custom: 4, bonus: 0 },
        },
        carryingCapacity: { size: 'Большой', custom: null, bonus: 30 },
      }),
    );

    const tunedSystem = buildActorDraft(tuned, fullOptions).actor.system;

    expect(tunedSystem.preparedSpells).toEqual({
      custom: null,
      bonuses: [
        {
          id: 'sheet-prepared-spells',
          kind: 'flat',
          ability: 'strength',
          value: 2,
          label: 'С листа TTG Club',
        },
      ],
    });

    expect(tunedSystem.preparedCantrips).toEqual({ custom: 4, bonuses: [] });

    expect(tunedSystem.carryingCapacity).toEqual({
      size: 'large',
      custom: null,
      bonus: 30,
    });
  });

  it('не подставляет средний размер в грузоподъёмность, если размер незнаком', () => {
    const odd = parseSheetText(
      JSON.stringify({
        ...fixture,
        carryingCapacity: { size: 'Колоссальный', custom: null, bonus: 0 },
      }),
    );

    expect(
      buildActorDraft(odd, fullOptions).actor.system.carryingCapacity.size,
    ).toBeNull();
  });

  it('переносит счётчики ресурсов на основной класс', () => {
    expect(system.classCounters).toEqual([
      {
        counterKey: 'luck-points',
        classKey: 'fighter',
        name: 'Очки удачи',
        shortName: 'Удача',
        current: 2,
        max: 2,
        recovery: 'long',
      },
    ]);
  });
});

describe.skipIf(!hasLocalSheet)('buildActorDraft — черты и инвентарь', () => {
  const { actor } = buildActorDraft(sheet, fullOptions);
  const features = actor.features;
  const equipment = actor.equipment;

  it('переносит все черты листа', () => {
    expect(features).toHaveLength(9);
  });

  it('разворачивает разметку сайта в описании черты', () => {
    const darkvision = features.find((entry) => entry.name === 'Тёмное зрение');

    expect(darkvision?.description).toBe(
      'У вас есть тёмное зрение в пределах 120 фт.',
    );

    expect(darkvision?.featureType).toBe('species');
    expect(darkvision?.grantedBy).toBe('Дварф');
  });

  it('переносит весь инвентарь', () => {
    expect(equipment).toHaveLength(13);
  });

  it('собирает оружие с формулой урона без модификатора характеристики', () => {
    const greatsword = findItem(equipment, 'greatsword-phb');

    expect(greatsword.type).toBe('weapon');
    expect(greatsword.weaponCategory).toBe('martial');
    expect(greatsword.rangeType).toBe('melee');
    expect(greatsword.damageParts).toEqual([
      { formula: '2к6', type: 'slashing' },
    ]);
    expect(greatsword.weaponProperties).toContain('heavy');
  });

  it('переносит альтернативный урон универсального оружия', () => {
    const spear = findItem(equipment, 'spear-phb');

    expect(spear.damageParts?.[0]).toEqual({
      formula: '1к6',
      type: 'piercing',
      versatileFormula: '1к8',
    });

    expect(spear.weaponProperties).toContain('versatile');
  });

  it('собирает доспех с КД, лимитом Ловкости и помехой на Скрытность', () => {
    const chainMail = findItem(equipment, 'chain-mail-phb');

    expect(chainMail.type).toBe('equipment');
    expect(chainMail.equipmentCategory).toBe('heavy');
    expect(chainMail.baseArmorAC).toBe(16);
    expect(chainMail.maxDexBonus).toBe(0);
    expect(chainMail.stealthDisadvantage).toBe(true);
    expect(chainMail.equipped).toBe(true);
  });

  it('превращает бонус магического предмета в переносимый эффект', () => {
    const gauntlets = findItem(equipment, 'gauntlets-of-ogre-power-dmg');

    expect(gauntlets.isMagical).toBe(true);
    expect(gauntlets.magicAttunement).toBe('required');
    expect(gauntlets.isAttuned).toBe(true);
    expect(gauntlets.rarity).toBe('uncommon');

    expect(gauntlets.activeEffects?.[0]).toEqual(
      expect.objectContaining({
        origin: 'item',
        transfer: true,
        duration: { type: 'permanent' },
        changes: [
          {
            key: 'ability.strength',
            mode: 'upgrade',
            value: '19',
            priority: 20,
          },
        ],
      }),
    );
  });

  it('не переносит черты и инвентарь, если их выключили', () => {
    const { actor: lean } = buildActorDraft(
      sheet,
      { ...fullOptions, importFeatures: false, importInventory: false }
    );

    expect(lean.features).toEqual([]);
    expect(lean.equipment).toEqual([]);
  });
});

describe.skipIf(!hasLocalSheet)('описание и предупреждения', () => {
  it('складывает внешность персонажа в описание', () => {
    expect(buildDescription(sheet)).toContain(
      '**Мировоззрение:** Законопослушный Нейтральный',
    );

    expect(buildDescription(sheet)).toContain('**Глаза:** Карие');
  });

  it('не жалуется, когда переносить нечего', () => {
    expect(collectWarnings(sheet)).toEqual([]);
  });

  it('предупреждает о заклинаниях и истощении', () => {
    const caster = parseSheetText(
      JSON.stringify({
        ...fixture,
        spells: [{ name: 'Огненный снаряд' }],
        health: { current: 5, max: 13, temporary: 0, exhaustion: 2 },
      }),
    );

    const warnings = collectWarnings(caster);

    expect(warnings.some((text) => text.includes('Заклинания (1)'))).toBe(true);
    expect(warnings.some((text) => text.includes('Истощение 2'))).toBe(true);
  });
});
