/**
 * Потраченные ячейки заклинаний: лист TTG Club → `system` актёра.
 *
 * Лист хранит только ПОТРАЧЕННОЕ: `spellSlots: [{ level, used, kind }]`, где
 * `kind: 'pact'` — ячейки магии договора колдуна. Система хранит то же самое
 * в двух полях: массив по кругам (`spellSlotsUsed`, индекс 0 — 1-й круг) и
 * одно число для договора (`pactSlotsUsed`). Сколько ячеек всего, система
 * считает по классу сама, поэтому максимум с листа не переносится.
 *
 * @module convert/slots
 */

import type { CharacterSheet } from '@/sheet/schema';

import { z } from 'zod';

/** Количество кругов заклинаний в D&D 5e */
const SPELL_LEVELS = 9;

/** Вид ячеек магии договора на листе */
const PACT_SLOT_KIND = 'pact';

/** Запись о потраченных ячейках на листе */
const sheetSlotSchema = z
  .object({
    level: z.number().int().min(1).max(SPELL_LEVELS),
    used: z.number().int().min(0),
    kind: z.string().optional(),
  })
  .passthrough();

/** Потраченные ячейки в форме системы */
export interface UsedSpellSlots {
  /** Потрачено обычных ячеек по кругам (индекс 0 — 1-й круг) */
  spellSlotsUsed: number[];
  /** Потрачено ячеек магии договора */
  pactSlotsUsed: number;
}

/**
 * Переносит потраченные ячейки заклинаний.
 *
 * Непонятная запись (без круга или с кругом вне 1–9) пропускается: лучше
 * оставить ячейку свежей, чем записать её не в тот круг.
 *
 * @param sheet - лист персонажа
 * @returns потраченные ячейки для `system`
 */
export function buildUsedSpellSlots(sheet: CharacterSheet): UsedSpellSlots {
  const spellSlotsUsed = Array.from({ length: SPELL_LEVELS }, () => 0);
  let pactSlotsUsed = 0;

  for (const entry of sheet.spellSlots ?? []) {
    const parsed = sheetSlotSchema.safeParse(entry);

    if (!parsed.success) {
      continue;
    }

    const { level, used, kind } = parsed.data;

    if (kind === PACT_SLOT_KIND) {
      pactSlotsUsed += used;
    } else {
      spellSlotsUsed[level - 1] = (spellSlotsUsed[level - 1] ?? 0) + used;
    }
  }

  return { spellSlotsUsed, pactSlotsUsed };
}
