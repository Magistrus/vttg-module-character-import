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

  return {
    id: resolveFeatureId(feature, index),
    name: feature.name,
    description: richTextToMarkdown(feature.description),
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
