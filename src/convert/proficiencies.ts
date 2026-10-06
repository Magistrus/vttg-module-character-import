/**
 * Владения персонажа: лист TTG Club → `system.proficiencies`.
 *
 * @module convert/proficiencies
 */

import type { CharacterSheet } from '@/sheet/schema';
import type {
  DndAbility,
  DndProficiencies,
  DndProficiencyLevel,
  DndSkill,
} from '@/types/dnd5e';

import { isAbilityKey, skillKeyByLabel, toProficiencyLevel } from './keys';

/**
 * Собирает владения навыками.
 *
 * Навыки без владения на лист персонажа не попадают: система считает их
 * отсутствие тем же, что `none`, и хранит только реальные владения.
 *
 * @param sheet - лист персонажа
 * @returns карта «навык → уровень владения»
 */
export function buildSkillProficiencies(
  sheet: CharacterSheet,
): Partial<Record<DndSkill, DndProficiencyLevel>> {
  const skills: Partial<Record<DndSkill, DndProficiencyLevel>> = {};

  for (const skill of sheet.skills ?? []) {
    const key = skillKeyByLabel(skill.name);
    const level = toProficiencyLevel(skill.proficiency);

    if (key && level !== 'none') {
      skills[key] = level;
    }
  }

  return skills;
}

/**
 * Собирает владения спасбросками.
 *
 * @param sheet - лист персонажа
 * @returns характеристики, по которым персонаж владеет спасбросками
 */
export function buildSavingThrowProficiencies(
  sheet: CharacterSheet,
): DndAbility[] {
  const abilities: DndAbility[] = [];

  for (const savingThrow of sheet.savingThrows ?? []) {
    const ability = savingThrow.ability ?? savingThrow.key;

    if (savingThrow.proficient && isAbilityKey(ability)) {
      abilities.push(ability);
    }
  }

  return abilities;
}

/** Владение на листе: строка или ссылка на справочник `{ name, url }` */
type SheetProficiencyEntry = string | { name: string };

/**
 * Сводит владения листа к названиям.
 *
 * Система хранит владения человекочитаемыми строками («Всё простое оружие»,
 * «Инструменты каллиграфа»), а лист отдаёт их то строкой, то ссылкой на
 * справочник. От ссылки остаётся название — ссылку на сайт в мире некуда вести.
 *
 * @param entries - владения с листа
 * @returns названия владений без пустых и повторов
 */
function toProficiencyNames(
  entries: readonly SheetProficiencyEntry[] | undefined,
): string[] {
  const names = (entries ?? [])
    .map((entry) => (typeof entry === 'string' ? entry : entry.name).trim())
    .filter((name) => name.length > 0);

  return [...new Set(names)];
}

/**
 * Собирает владения персонажа целиком.
 *
 * @param sheet - лист персонажа
 * @returns владения для `system.proficiencies`
 */
export function buildProficiencies(sheet: CharacterSheet): DndProficiencies {
  const source = sheet.proficiencies;

  return {
    armor: toProficiencyNames(source?.armor),
    weapons: toProficiencyNames(source?.weapons),
    weaponMasteries: toProficiencyNames(source?.weaponMasteries),
    tools: toProficiencyNames(source?.tools),
    languages: toProficiencyNames(source?.languages),
    savingThrows: buildSavingThrowProficiencies(sheet),
    skills: buildSkillProficiencies(sheet),
  };
}
