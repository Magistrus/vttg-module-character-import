/**
 * Ручные настройки лимитов: лист TTG Club → `system` актёра.
 *
 * Грузоподъёмность и подготовка заклинаний на сайте и в системе устроены
 * одинаково — «своё значение вместо расчётного» плюс прибавка, — с одним
 * различием: сайт хранит прибавку к подготовке одним числом, а система —
 * списком записей с источником. Здесь число становится записью.
 *
 * @module convert/limits
 */

import type { CharacterSheet } from '@/sheet/schema';
import type {
  DndCarryingCapacity,
  DndLimitBonus,
  DndPreparedLimit,
} from '@/types/dnd5e';

import { toCreatureSizeOrNull } from './keys';

/** Подпись прибавки к подготовке, перенесённой с листа */
const SHEET_BONUS_LABEL = 'С листа TTG Club';

/** Настройка лимита на листе (подмножество, которое понимает модуль) */
interface SheetLimitSettings {
  /** Своё значение вместо расчётного */
  custom?: number | null;
  /** Прибавка к расчётному значению */
  bonus?: number;
}

/**
 * Превращает число-прибавку листа в список прибавок системы.
 *
 * @param bonus - прибавка с листа
 * @param bonusId - идентификатор записи (свой у заклинаний и у заговоров)
 * @returns пустой список для нуля, иначе одна запись
 */
function buildLimitBonuses(
  bonus: number | undefined,
  bonusId: string,
): DndLimitBonus[] {
  if (!bonus) {
    return [];
  }

  return [
    {
      id: bonusId,
      kind: 'flat',
      ability: 'strength',
      value: Math.trunc(bonus),
      label: SHEET_BONUS_LABEL,
    },
  ];
}

/**
 * Переносит ручную настройку лимита подготовки.
 *
 * @param settings - настройка с листа (нет — лимит считается по классу)
 * @param bonusId - идентификатор записи прибавки
 * @returns настройка лимита для системы
 */
export function buildPreparedLimit(
  settings: SheetLimitSettings | null | undefined,
  bonusId: string,
): DndPreparedLimit {
  return {
    custom: settings?.custom ?? null,
    bonuses: buildLimitBonuses(settings?.bonus, bonusId),
  };
}

/**
 * Переносит настройки грузоподъёмности.
 *
 * @param sheet - лист персонажа
 * @returns настройки грузоподъёмности для системы
 */
export function buildCarryingCapacity(
  sheet: CharacterSheet,
): DndCarryingCapacity {
  const settings = sheet.carryingCapacity;

  return {
    size: toCreatureSizeOrNull(settings?.size),
    custom: settings?.custom ?? null,
    bonus: settings?.bonus ?? 0,
  };
}
