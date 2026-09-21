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

/**
 * Собирает владения персонажа целиком.
 *
 * Доспехи, оружие, инструменты и языки лист хранит человекочитаемыми
 * строками («Всё простое оружие») — система хранит их так же, поэтому
 * переносим как есть.
 *
 * @param sheet - лист персонажа
 * @returns владения для `system.proficiencies`
 */
export function buildProficiencies(sheet: CharacterSheet): DndProficiencies {
  const source = sheet.proficiencies;

  return {
    armor: [...(source?.armor ?? [])],
    weapons: [...(source?.weapons ?? [])],
    weaponMasteries: [...(source?.weaponMasteries ?? [])],
    tools: [...(source?.tools ?? [])],
    languages: [...(source?.languages ?? [])],
    savingThrows: buildSavingThrowProficiencies(sheet),
    skills: buildSkillProficiencies(sheet),
  };
}
