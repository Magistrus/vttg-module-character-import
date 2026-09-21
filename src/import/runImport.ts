/**
 * Сценарий импорта: лист персонажа → актёр мира.
 *
 * Шаг ровно один — создание актёра, но он асинхронный и может быть отклонён
 * сервером (нет права на создание персонажей), поэтому вынесен отдельно от UI:
 * мастеру импорта остаётся показать результат.
 *
 * @module import/runImport
 */

import type { CharacterSheet } from '@/sheet/schema';
import type { ImportOptions } from '@/convert/actor';
import type { VttgModuleApi } from '@/types/vttg';

import { buildActorDraft } from '@/convert/actor';

/** Система мира, для которой собирается актёр */
export const TARGET_SYSTEM_ID = 'dnd5e-2024';

/** Итог импорта — то, что показывается пользователю после создания */
export interface ImportResult {
  /** ID созданного актёра */
  actorId: string;
  /** Имя созданного актёра */
  actorName: string;
  /** Сколько черт перенесено */
  featureCount: number;
  /** Сколько предметов перенесено */
  itemCount: number;
  /** Что не поехало вместе с листом */
  warnings: string[];
}

/**
 * Создаёт актёра мира по листу персонажа.
 *
 * @param api - API модуля от хоста
 * @param sheet - разобранный лист персонажа
 * @param options - настройки импорта
 * @returns итог импорта
 * @throws Error если сервер не подтвердил создание актёра
 */
export async function runImport(
  api: VttgModuleApi,
  sheet: CharacterSheet,
  options: ImportOptions,
): Promise<ImportResult> {
  const ownerId = api.scene.getLoggedUserId();
  const { actor, warnings } = buildActorDraft(sheet, options, ownerId);

  const created = await api.actors.create(actor);

  return {
    actorId: created.id,
    actorName: created.name,
    featureCount: actor.features.length,
    itemCount: actor.equipment.length,
    warnings,
  };
}
