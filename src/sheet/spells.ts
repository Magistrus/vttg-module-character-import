/**
 * Заклинания, которые лист персонажа приписывает персонажу.
 *
 * На листе TTG Club заклинания лежат НЕ в одном месте: верхнеуровневое поле
 * `spells` у заклинателя бывает пустым, а сами заклинания приходят изнутри
 * черт и умений (книга волшебника в «Использовании заклинаний», заклинания
 * метки дракона) и вида (`species.innateSpells` — «Дружба» у хоравара).
 * Считать только `spells` значит сообщить «заклинаний: 0» волшебнику с полной
 * книгой — поэтому все источники сводятся здесь.
 *
 * `spellList` черты — это список, ИЗ которого можно выбирать, а не то, что
 * персонаж знает, поэтому он не учитывается.
 *
 * @module sheet/spells
 */

import type { CharacterSheet } from './schema';

import { z } from 'zod';

/** Заклинание в одном из мест листа: важны только опознавательные поля */
const sheetSpellRefSchema = z
  .object({
    url: z.string().optional(),
    name: z.string().min(1),
    level: z.number().optional(),
    requiredLevel: z.number().optional(),
  })
  .passthrough();

/** Заклинание персонажа, найденное на листе */
export interface SheetSpellRef {
  /** Ссылка на заклинание на сайте (если есть) */
  url?: string;
  /** Название заклинания */
  name: string;
  /** Круг (0 — заговор) */
  level?: number;
  /** С какого уровня персонажа заклинание доступно */
  requiredLevel?: number;
}

/**
 * Разбирает один элемент списка заклинаний.
 *
 * @param entry - элемент списка с листа
 * @returns заклинание или null, если элемент не похож на заклинание
 */
function toSpellRef(entry: unknown): SheetSpellRef | null {
  const parsed = sheetSpellRefSchema.safeParse(entry);

  return parsed.success ? parsed.data : null;
}

/**
 * Разбирает список заклинаний из любого места листа.
 *
 * @param entries - список с листа (или что угодно — проверяется)
 * @returns заклинания, которые удалось опознать
 */
function toSpellRefs(entries: unknown): SheetSpellRef[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => toSpellRef(entry))
    .filter((spell): spell is SheetSpellRef => spell !== null);
}

/**
 * Собирает заклинания, которые персонаж знает на своём текущем уровне.
 *
 * Заклинание с `requiredLevel` выше уровня персонажа (у «Метки письма»
 * «Волшебные уста» открываются на 3 уровне) не учитывается: у персонажа его
 * ещё нет. Повторы (одно заклинание из двух источников) сворачиваются по
 * ссылке, а без ссылки — по названию.
 *
 * @param sheet - лист персонажа
 * @param characterLevel - текущий уровень персонажа
 * @returns заклинания персонажа без повторов, в порядке листа
 */
export function collectSheetSpells(
  sheet: CharacterSheet,
  characterLevel: number,
): SheetSpellRef[] {
  const innate = (sheet.species?.innateSpells ?? []).map((entry) => {
    const spell = toSpellRef(entry.spell);

    return spell && entry.requiredLevel !== undefined
      ? { ...spell, requiredLevel: entry.requiredLevel }
      : spell;
  });

  const candidates = [
    ...toSpellRefs(sheet.spells),
    ...(sheet.features ?? []).flatMap((feature) => toSpellRefs(feature.spells)),
    ...innate.filter((spell): spell is SheetSpellRef => spell !== null),
  ];

  const seen = new Set<string>();
  const spells: SheetSpellRef[] = [];

  for (const spell of candidates) {
    if (spell.requiredLevel !== undefined && spell.requiredLevel > characterLevel) {
      continue;
    }

    const identity = spell.url ?? spell.name;

    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    spells.push(spell);
  }

  return spells;
}
