/**
 * Классы, вид и предыстория: лист TTG Club → записи актёра системы.
 *
 * @module convert/classes
 */

import type { CharacterSheet, SheetCharacterClass } from '@/sheet/schema';
import type {
  DndAbility,
  DndBackgroundEntry,
  DndCasterType,
  DndClassEntry,
  DndHitDie,
  DndHitPointGain,
  DndSpeciesEntry,
} from '@/types/dnd5e';

import { isAbilityKey, sizeByLabel, urlToKey } from './keys';

/** Кости хитов, которые понимает система */
const HIT_DICE: ReadonlySet<number> = new Set([6, 8, 10, 12]);

/** Кость хитов по умолчанию, если лист её не дал */
const DEFAULT_HIT_DIE: DndHitDie = 8;

/** Типы заклинателя, которые понимает система */
const CASTER_TYPES: ReadonlySet<string> = new Set<DndCasterType>([
  'full',
  'half',
  'third',
  'pact',
  'none',
]);

/** Тип существа по умолчанию: виды игроков — гуманоиды */
const DEFAULT_CREATURE_TYPE = 'humanoid';

/**
 * Считает модификатор характеристики.
 *
 * @param score - значение характеристики
 * @returns модификатор
 */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Приводит кость хитов листа к значению системы.
 *
 * @param die - размер кости с листа
 * @returns кость хитов; незнакомая заменяется на к8
 */
function toHitDie(die: number | undefined): DndHitDie {
  return die !== undefined && HIT_DICE.has(die)
    ? (die as DndHitDie)
    : DEFAULT_HIT_DIE;
}

/**
 * Приводит тип заклинателя листа к значению системы.
 *
 * @param casterType - тип заклинателя с листа (`NONE`, `FULL`)
 * @returns тип заклинателя или undefined, если он незнаком
 */
function toCasterType(
  casterType: string | null | undefined,
): DndCasterType | undefined {
  if (!casterType) {
    return undefined;
  }

  const key = casterType.toLowerCase();

  return CASTER_TYPES.has(key) ? (key as DndCasterType) : undefined;
}

/**
 * Собирает историю получения хитов по уровням для одного класса.
 *
 * Лист хранит ИТОГОВУЮ прибавку за уровень (вместе с модификатором
 * Телосложения), а система — «чистый» бросок: модификатор она добавляет сама
 * за каждый уровень. Поэтому модификатор здесь вычитается, иначе после
 * импорта максимум хитов удвоил бы вклад Телосложения.
 *
 * @param sheet - лист персонажа
 * @param classUrl - URL класса, чьи уровни отбираем
 * @param isPrimary - основной ли это класс (ему достаются уровни без привязки)
 * @returns история получения хитов
 */
function buildHitPointGains(
  sheet: CharacterSheet,
  classUrl: string | undefined,
  isPrimary: boolean,
): DndHitPointGain[] {
  const constitutionModifier = abilityModifier(sheet.abilities.constitution);

  return (sheet.health?.levelGains ?? [])
    .filter((gain) => {
      if (gain.classUrl) {
        return gain.classUrl === classUrl;
      }

      return isPrimary;
    })
    .map((gain) => ({
      level: gain.level ?? 1,
      method: 'custom' as const,
      rolled: Math.max(1, (gain.amount ?? 0) - constitutionModifier),
    }));
}

/**
 * Считает, сколько костей хитов уже потрачено.
 *
 * @param sheet - лист персонажа
 * @param die - размер кости класса
 * @param level - уровень в классе
 * @returns число потраченных костей
 */
function resolveHitDiceUsed(
  sheet: CharacterSheet,
  die: DndHitDie,
  level: number,
): number {
  const group = (sheet.hitDice ?? []).find((entry) => entry.die === die);

  if (!group) {
    return 0;
  }

  const max = group.max ?? level;
  const current = group.current ?? max;

  return Math.min(level, Math.max(0, max - current));
}

/**
 * Собирает запись одного класса персонажа.
 *
 * @param sheet - лист персонажа
 * @param entry - класс с листа
 * @param isPrimary - основной ли класс
 * @returns запись класса для `system.classes`
 */
function buildClassEntry(
  sheet: CharacterSheet,
  entry: SheetCharacterClass,
  isPrimary: boolean,
): DndClassEntry {
  const level = entry.level ?? 1;
  const hitDie = toHitDie(entry.hitDie);
  const casterType = toCasterType(entry.casterType);
  const spellcastingAbility = entry.spellcastingAbility;

  return {
    classKey: urlToKey(entry.url),
    className: entry.name ?? 'Класс',
    level,
    subclassKey: entry.subclassUrl ? urlToKey(entry.subclassUrl) : null,
    hitDie,
    hitDiceUsed: resolveHitDiceUsed(sheet, hitDie, level),
    hitPointsGained: buildHitPointGains(sheet, entry.url, isPrimary),
    chosenSkills: [],
    featureChoices: {},
    ...(isAbilityKey(spellcastingAbility)
      ? { spellcastingAbility: spellcastingAbility }
      : {}),
    ...(casterType ? { casterType } : {}),
  };
}

/**
 * Собирает классы персонажа (с мультиклассом).
 *
 * @param sheet - лист персонажа
 * @returns записи классов для `system.classes`
 */
export function buildClasses(sheet: CharacterSheet): DndClassEntry[] {
  const entries: DndClassEntry[] = [];

  if (sheet.characterClass) {
    entries.push(buildClassEntry(sheet, sheet.characterClass, true));
  }

  for (const additional of sheet.additionalClasses ?? []) {
    entries.push(buildClassEntry(sheet, additional, false));
  }

  return entries;
}

/**
 * Собирает запись вида персонажа.
 *
 * @param sheet - лист персонажа
 * @returns запись вида или null, если вида на листе нет
 */
export function buildSpecies(sheet: CharacterSheet): DndSpeciesEntry | null {
  const species = sheet.species;

  if (!species?.name) {
    return null;
  }

  return {
    speciesKey: urlToKey(species.url),
    speciesName: species.name,
    creatureType: DEFAULT_CREATURE_TYPE,
    size: sizeByLabel(sheet.size),
    featureChoices: {},
    grantChoices: {},
  };
}

/**
 * Собирает запись предыстории персонажа.
 *
 * Черту происхождения система ищет по имени, поэтому кладём имя черты с листа
 * (`features` того же листа несут её описание).
 *
 * @param sheet - лист персонажа
 * @returns запись предыстории или null, если предыстории нет
 */
export function buildBackground(
  sheet: CharacterSheet,
): DndBackgroundEntry | null {
  const background = sheet.characterBackground;

  if (!background?.name) {
    return null;
  }

  const abilityChoices: Partial<Record<DndAbility, number>> = {};

  for (const [ability, bonus] of Object.entries(
    background.abilityBonuses ?? {},
  )) {
    if (isAbilityKey(ability)) {
      abilityChoices[ability] = bonus;
    }
  }

  const grantedFeatName = (sheet.features ?? []).find(
    (feature) =>
      Boolean(background.featUrl)
      && feature.id === `feat:${background.featUrl}`,
  )?.name;

  return {
    backgroundKey: urlToKey(background.url),
    backgroundName: background.name,
    abilityChoices,
    // Лист не говорит, ОТКУДА пришло владение навыком, поэтому «навыки
    // предыстории» остаются пустыми, а сами владения переносятся напрямую в
    // `system.proficiencies.skills`: так лист не потеряет ни одного навыка и
    // не выдаст его дважды.
    skillChoices: [],
    toolChoices: [],
    ...(grantedFeatName ? { grantedFeatName } : {}),
  };
}
