/**
 * Инвентарь: лист TTG Club → `actor.equipment`.
 *
 * Предметы собираются по форме предметов системы (`src/engine/srd/*`): id
 * совпадает со слагом сайта (`greatsword-phb`), оружие несёт `damageParts`,
 * доспех — `baseArmorAC`/`maxDexBonus`, магический бонус превращается в
 * активный эффект предмета, который переносится на носителя при экипировке.
 *
 * @module convert/inventory
 */

import type { CharacterSheet, SheetInventoryItem } from '@/sheet/schema';
import type {
  DndDamagePart,
  DndEquipmentCategory,
  DndGameItem,
  DndItemActiveEffect,
  DndItemRarity,
  DndItemType,
  DndWeaponCategory,
} from '@/types/dnd5e';

import { isAbilityKey, skillKeyByLabel, toDamageType } from './keys';

/** Категория предмета на листе для магических предметов */
const MAGIC_ITEM_CATEGORY = 'MAGIC_ITEM';

/** Приоритет изменения по умолчанию — как у эффектов самой системы */
const DEFAULT_EFFECT_PRIORITY = 20;

/** Режимы изменения, которые понимает система */
const EFFECT_MODES: ReadonlySet<string> = new Set([
  'add',
  'multiply',
  'override',
  'upgrade',
  'downgrade',
  'custom',
]);

/** Русские названия редкости с листа → ключи редкости системы */
const RARITY_BY_LABEL: ReadonlyArray<[string, DndItemRarity]> = [
  ['очень редк', 'very-rare'],
  ['необычн', 'uncommon'],
  ['обычн', 'common'],
  ['редк', 'rare'],
  ['легендарн', 'legendary'],
  ['артефакт', 'artifact'],
];

/** Подписи типов доспеха с листа → категории снаряжения системы */
const ARMOR_CATEGORY_BY_LABEL: ReadonlyArray<[string, DndEquipmentCategory]> = [
  ['лёгкий доспех', 'light'],
  ['легкий доспех', 'light'],
  ['средний доспех', 'medium'],
  ['тяжёлый доспех', 'heavy'],
  ['тяжелый доспех', 'heavy'],
  ['щит', 'shield'],
];

/** Ограничение бонуса Ловкости по значению поля `dexterityMod` листа */
const MAX_DEX_BY_MODE: Record<string, number | null> = {
  none: 0,
  limited: 2,
  medium: 2,
  full: null,
};

/**
 * Определяет редкость предмета по подписи типа с листа.
 *
 * @param typesLabel - подпись вида «Чудесный предмет, необычный»
 * @returns редкость предмета
 */
function resolveRarity(typesLabel: string | undefined): DndItemRarity {
  const label = (typesLabel ?? '').toLowerCase();

  for (const [needle, rarity] of RARITY_BY_LABEL) {
    if (label.includes(needle)) {
      return rarity;
    }
  }

  return 'none';
}

/**
 * Определяет категорию оружия.
 *
 * Поле `weapon.category` на листе не всегда соответствует книге, поэтому
 * сначала смотрим на подпись типа («Воинское оружие»), и только затем — на
 * само поле.
 *
 * @param item - предмет с листа
 * @returns категория оружия
 */
function resolveWeaponCategory(item: SheetInventoryItem): DndWeaponCategory {
  const label = (item.typesLabel ?? '').toLowerCase();

  if (label.includes('воинско')) {
    return 'martial';
  }

  if (label.includes('простое')) {
    return 'simple';
  }

  return item.weapon?.category === 'martial' ? 'martial' : 'simple';
}

/**
 * Определяет категорию снаряжения (тип доспеха).
 *
 * @param item - предмет с листа
 * @returns категория снаряжения или undefined, если предмет не доспех
 */
function resolveEquipmentCategory(
  item: SheetInventoryItem,
): DndEquipmentCategory | undefined {
  if (item.armor?.shield) {
    return 'shield';
  }

  const label = (item.typesLabel ?? '').toLowerCase();

  for (const [needle, category] of ARMOR_CATEGORY_BY_LABEL) {
    if (label.includes(needle)) {
      return category;
    }
  }

  return item.armor ? 'medium' : undefined;
}

/**
 * Собирает формулу кубиков урона.
 *
 * @param diceCount - количество кубиков
 * @param diceFaces - граней у кубика
 * @param bonus - плоская прибавка
 * @returns формула вида `2к6+1`
 */
function buildDamageFormula(
  diceCount: number,
  diceFaces: number,
  bonus: number,
): string {
  const dice = `${Math.max(1, diceCount)}к${diceFaces}`;

  if (bonus > 0) {
    return `${dice}+${bonus}`;
  }

  if (bonus < 0) {
    return `${dice}${bonus}`;
  }

  return dice;
}

/**
 * Собирает части урона оружия.
 *
 * Модификатор характеристики в формулу НЕ попадает: система добавляет его
 * сама при броске, иначе бонус учёлся бы дважды.
 *
 * @param item - предмет с листа
 * @returns части урона или undefined, если урона на листе нет
 */
function buildDamageParts(
  item: SheetInventoryItem,
): DndDamagePart[] | undefined {
  const damage = item.weapon?.damage;

  if (!damage?.diceFaces) {
    return undefined;
  }

  const versatile = item.weapon?.versatileDamage;

  const part: DndDamagePart = {
    formula: buildDamageFormula(
      damage.diceCount ?? 1,
      damage.diceFaces,
      damage.bonus ?? 0,
    ),
    ...(toDamageType(damage.type) ? { type: toDamageType(damage.type) } : {}),
    ...(versatile?.diceFaces
      ? {
          versatileFormula: buildDamageFormula(
            versatile.diceCount ?? 1,
            versatile.diceFaces,
            versatile.bonus ?? 0,
          ),
        }
      : {}),
  };

  return [part];
}

/**
 * Собирает свойства оружия из флагов листа.
 *
 * @param item - предмет с листа
 * @returns список свойств оружия
 */
function buildWeaponProperties(item: SheetInventoryItem): string[] {
  const properties: string[] = [];

  if (item.weapon?.finesse) {
    properties.push('finesse');
  }

  if (item.weapon?.heavy) {
    properties.push('heavy');
  }

  if (item.weapon?.versatileDamage) {
    properties.push('versatile');
  }

  return properties;
}

/**
 * Переводит бонус предмета в ключ эффекта системы.
 *
 * @param kind - вид бонуса с листа (`ability`, `skill`, `armorClass`)
 * @param key - на что он влияет
 * @returns ключ изменения или null, если бонус незнаком
 */
function resolveEffectKey(
  kind: string | undefined,
  key: string | undefined,
): string | null {
  switch (kind) {
    case 'ability':
      return isAbilityKey(key) ? `ability.${key}` : null;
    case 'save':
    case 'savingThrow':
      return isAbilityKey(key) ? `save.${key}` : null;
    case 'skill': {
      const skillKey = key ? skillKeyByLabel(key) ?? key : null;

      return skillKey ? `skill.${skillKey}` : null;
    }
    case 'armorClass':
    case 'ac':
      return 'armorClass';
    case 'initiative':
      return 'initiative';
    case 'speed':
    case 'movement':
      return key ? `movement.${key}` : 'movement.walk';
    default:
      return null;
  }
}

/**
 * Собирает активные эффекты предмета из его числовых бонусов.
 *
 * Эффект помечен `transfer: true`, поэтому система переносит его на носителя
 * при экипировке — ровно как на листе сайта, где бонус работает у надетого
 * предмета.
 *
 * @param item - предмет с листа
 * @param itemId - идентификатор собранного предмета
 * @returns активные эффекты предмета (пустой список, если бонусов нет)
 */
function buildItemEffects(
  item: SheetInventoryItem,
  itemId: string,
): DndItemActiveEffect[] {
  return (item.bonuses ?? [])
    .map((bonus, index): DndItemActiveEffect | null => {
      const key = resolveEffectKey(bonus.kind, bonus.key);

      if (!key || bonus.value === undefined) {
        return null;
      }

      const mode =
        bonus.mode && EFFECT_MODES.has(bonus.mode) ? bonus.mode : 'add';

      return {
        id: `${itemId}-bonus-${index + 1}`,
        name: item.name,
        description: '',
        disabled: false,
        origin: 'item' as const,
        originId: itemId,
        transfer: true,
        duration: { type: 'permanent' as const },
        changes: [
          {
            key,
            mode,
            value: String(bonus.value),
            priority: bonus.priority ?? DEFAULT_EFFECT_PRIORITY,
          },
        ],
        flags: [],
      };
    })
    .filter((effect): effect is DndItemActiveEffect => effect !== null);
}

/**
 * Определяет тип предмета для системы.
 *
 * @param item - предмет с листа
 * @returns тип предмета
 */
function resolveItemType(item: SheetInventoryItem): DndItemType {
  if (item.weapon) {
    return 'weapon';
  }

  const label = (item.typesLabel ?? '').toLowerCase();

  if (label.includes('инструмент')) {
    return 'tool';
  }

  return 'equipment';
}

/**
 * Переводит один предмет листа в предмет инвентаря актёра.
 *
 * @param item - предмет с листа
 * @param index - его позиция в инвентаре (запасной источник идентификатора)
 * @returns предмет для `actor.equipment`
 */
export function buildInventoryItem(
  item: SheetInventoryItem,
  index: number,
): DndGameItem {
  const itemId = item.url ?? item.id ?? `sheet-item-${index + 1}`;
  const type = resolveItemType(item);
  const isMagical = item.category === MAGIC_ITEM_CATEGORY;
  const equipmentCategory = resolveEquipmentCategory(item);
  const damageParts = buildDamageParts(item);
  const effects = buildItemEffects(item, itemId);
  const dexterityMod = item.armor?.dexterityMod ?? 'full';

  return {
    id: itemId,
    name: item.name,
    description: item.passiveNote ?? '',
    type,
    ...(item.typesLabel ? { typeLabel: item.typesLabel } : {}),
    quantity: item.quantity ?? 1,
    weight: item.weight ?? 0,
    cost: item.cost ?? '',
    rarity: resolveRarity(item.typesLabel),
    equipped: item.equipped ?? false,
    isReadOnly: false,
    ...(isMagical ? { isMagical: true } : {}),
    ...(item.requiresAttunement
      ? {
          magicAttunement: 'required' as const,
          isAttuned: item.attuned ?? false,
        }
      : {}),
    // --- Оружие ---
    ...(type === 'weapon'
      ? {
          weaponCategory: resolveWeaponCategory(item),
          rangeType: item.weapon?.ranged ? ('ranged' as const) : ('melee' as const),
          weaponProperties: buildWeaponProperties(item),
          ...(damageParts ? { damageParts } : {}),
          ...(item.weapon?.attackBonus
            ? { attackBonus: item.weapon.attackBonus }
            : {}),
        }
      : {}),
    // --- Доспех ---
    ...(item.armor
      ? {
          baseArmorAC: item.armor.baseArmorClass ?? 10,
          maxDexBonus: MAX_DEX_BY_MODE[dexterityMod] ?? null,
          stealthDisadvantage: item.armor.stealthDisadvantage ?? false,
        }
      : {}),
    ...(equipmentCategory ? { equipmentCategory } : {}),
    ...(effects.length > 0 ? { activeEffects: effects } : {}),
  };
}

/**
 * Переводит инвентарь листа в снаряжение актёра.
 *
 * @param sheet - лист персонажа
 * @returns предметы для `actor.equipment`
 */
export function buildInventory(sheet: CharacterSheet): DndGameItem[] {
  return (sheet.inventory ?? []).map((item, index) =>
    buildInventoryItem(item, index),
  );
}

/**
 * Считает предметы, чьи бонусы не удалось перевести в эффекты.
 *
 * @param sheet - лист персонажа
 * @returns названия предметов с непонятыми бонусами
 */
export function collectUnmappedBonusItems(sheet: CharacterSheet): string[] {
  const names: string[] = [];

  for (const item of sheet.inventory ?? []) {
    const bonuses = item.bonuses ?? [];

    if (bonuses.length === 0) {
      continue;
    }

    const mapped = bonuses.filter(
      (bonus) => resolveEffectKey(bonus.kind, bonus.key) !== null,
    );

    if (mapped.length < bonuses.length) {
      names.push(item.name);
    }
  }

  return names;
}
