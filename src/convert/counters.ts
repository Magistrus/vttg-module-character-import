/**
 * Счётчики ресурсов: лист TTG Club → `system.classCounters`.
 *
 * @module convert/counters
 */

import type { CharacterSheet, SheetClassResource } from '@/sheet/schema';
import type { DndCounterRecovery, DndCounterState } from '@/types/dnd5e';

import { counterKeyFromId } from '@/sheet/counterKey';

/**
 * Достаёт ключ счётчика из его идентификатора на листе.
 *
 * @param resource - ресурс с листа
 * @returns ключ счётчика; если идентификатора нет — имя ресурса
 */
function resolveCounterKey(resource: SheetClassResource): string {
  return (
    counterKeyFromId(resource.id ?? '') || resource.name || 'counter'
  );
}

/**
 * Определяет, чем восстанавливается счётчик.
 *
 * @param resource - ресурс с листа
 * @returns тип восстановления
 */
function resolveRecovery(resource: SheetClassResource): DndCounterRecovery {
  const shortRestMode = resource.shortRest?.mode;

  return shortRestMode && shortRestMode !== 'none' ? 'short' : 'long';
}

/**
 * Переводит счётчики ресурсов листа в состояния счётчиков актёра.
 *
 * Владельца счётчика лист не сообщает (ресурс может прийти и от черты, а не
 * от класса), поэтому владельцем становится основной класс персонажа: так
 * счётчик виден на листе и участвует в отдыхе.
 *
 * @param sheet - лист персонажа
 * @param primaryClassKey - ключ основного класса персонажа
 * @returns состояния счётчиков для `system.classCounters`
 */
export function buildCounters(
  sheet: CharacterSheet,
  primaryClassKey: string,
): DndCounterState[] {
  return (sheet.classResources ?? []).map((resource) => {
    const max = resource.max ?? 0;

    return {
      counterKey: resolveCounterKey(resource),
      classKey: primaryClassKey,
      current: Math.min(max, Math.max(0, resource.current ?? max)),
      max,
      ...(resource.name ? { name: resource.name } : {}),
      ...(resource.shortLabel ? { shortName: resource.shortLabel } : {}),
      recovery: resolveRecovery(resource),
    };
  });
}
