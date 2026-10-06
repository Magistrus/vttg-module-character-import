/**
 * Черты и умения: лист TTG Club → `actor.features`.
 *
 * @module convert/features
 */

import type { CharacterSheet, SheetFeature } from '@/sheet/schema';
import type { DndFeature } from '@/types/dnd5e';

import { richTextToMarkdown } from '@/sheet/richText';

/** Происхождение черты на листе → тип особенности системы */
const FEATURE_TYPE_BY_ORIGIN: Record<string, DndFeature['featureType']> = {
  feat: 'feat',
  species: 'species',
  lineage: 'species',
  class: 'class',
  subclass: 'subclass',
  background: 'background',
};

/**
 * Собирает уникальный идентификатор особенности.
 *
 * Идентификатор с листа (`class:fighter-phb:boevoj-stil`) уже уникален в
 * пределах персонажа — берём его, чтобы повторный импорт давал те же ID.
 * Если листу его не хватило, собираем из индекса.
 *
 * @param feature - черта с листа
 * @param index - её позиция в списке
 * @returns идентификатор особенности
 */
function resolveFeatureId(feature: SheetFeature, index: number): string {
  return feature.id ?? `sheet-feature-${index + 1}`;
}

/**
 * Сводит значение ответа на выбор к списку названий.
 *
 * @param answer - ответ с листа: строка или список строк
 * @returns непустые названия
 */
function toChoiceNames(answer: unknown): string[] {
  return (Array.isArray(answer) ? answer : [answer])
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Собирает сделанный на листе выбор черты.
 *
 * Описание черты говорит «навык на ваш выбор», а что выбрано, лист хранит
 * отдельно: `choice` («Убеждение») и `choiceAnswers` — ответы по ключам
 * (заклинания, список, заклинательная характеристика). Без них в мире
 * оставалось бы одно «на ваш выбор». Ключи ответов — машинные (`spell-list`),
 * поэтому переносятся только сами ответы, группами в порядке листа.
 *
 * @param feature - черта с листа
 * @returns группы выбора; каждая — названия через запятую
 */
function collectFeatureChoices(feature: SheetFeature): string[] {
  const groups = toChoiceNames(feature.choice).map((name) => [name]);
  const answers = feature.choiceAnswers;

  if (typeof answers === 'object' && answers !== null && !Array.isArray(answers)) {
    for (const answer of Object.values(answers)) {
      groups.push(toChoiceNames(answer));
    }
  }

  return groups
    .filter((names) => names.length > 0)
    .map((names) => names.join(', '));
}

/**
 * Переводит одну черту листа в особенность актёра.
 *
 * @param feature - черта с листа
 * @param index - её позиция в списке
 * @returns особенность для `actor.features`
 */
export function buildFeature(feature: SheetFeature, index: number): DndFeature {
  const featureType = feature.origin
    ? FEATURE_TYPE_BY_ORIGIN[feature.origin]
    : undefined;

  const description = richTextToMarkdown(feature.description);
  const choices = collectFeatureChoices(feature);

  return {
    id: resolveFeatureId(feature, index),
    name: feature.name,
    description:
      choices.length > 0
        ? `${description}\n\n**Выбрано:** ${choices.join('; ')}`.trim()
        : description,
    ...(typeof feature.level === 'number' ? { level: feature.level } : {}),
    ...(featureType ? { featureType } : { featureType: 'custom' }),
    ...(feature.originName ? { grantedBy: feature.originName } : {}),
  };
}

/**
 * Переводит все черты листа в особенности актёра.
 *
 * @param sheet - лист персонажа
 * @returns особенности для `actor.features`
 */
export function buildFeatures(sheet: CharacterSheet): DndFeature[] {
  return (sheet.features ?? []).map((feature, index) =>
    buildFeature(feature, index),
  );
}
