/**
 * Каталог заклинаний мира: компендиум и «Мастерская» в одной форме.
 *
 * Компендиум отдаёт заклинание плоской записью `Spell` с `type: 'spell'`.
 * В «Мастерской» система хранит его обёрнутым в предмет — сама запись лежит
 * в `spellData` (так делает и система, `extractWorldSpells`). Сопоставлению
 * обе формы нужны одинаковыми, поэтому разворачиваются здесь.
 *
 * Записи приходят от хоста как `unknown` и проверяются схемой: от заклинания
 * нужны только опознавательные поля, остальное (механика) переносится на лист
 * как есть.
 *
 * @module spells/catalog
 */

import { z } from 'zod';

/** Опознавательные поля заклинания системы */
const catalogSpellSchema = z
  .object({
    type: z.literal('spell'),
    id: z.string().min(1),
    name: z.string().min(1),
    level: z.number(),
  })
  .passthrough();

/** Предмет «Мастерской» с заклинанием внутри */
const workshopSpellItemSchema = z
  .object({
    type: z.literal('spell'),
    spellData: z.unknown(),
  })
  .passthrough();

/** Откуда заклинание каталога */
export type CatalogSource = 'compendium' | 'workshop';

/** Заклинание каталога: опознавательные поля плюс вся запись системы */
export interface CatalogSpell {
  /** ID записи (у компендиума совпадает со ссылкой сайта) */
  id: string;
  /** Название */
  name: string;
  /** Круг (0 — заговор) */
  level: number;
  /** Откуда заклинание */
  source: CatalogSource;
  /** Запись заклинания целиком — она и ложится на лист */
  record: Record<string, unknown>;
}

/**
 * Разбирает запись как заклинание.
 *
 * @param entry - запись от хоста
 * @param source - откуда запись
 * @returns заклинание или null, если запись — не заклинание
 */
function toCatalogSpell(
  entry: unknown,
  source: CatalogSource,
): CatalogSpell | null {
  const parsed = catalogSpellSchema.safeParse(entry);

  if (!parsed.success) {
    return null;
  }

  const { id, name, level } = parsed.data;

  return { id, name, level, source, record: parsed.data };
}

/**
 * Заклинания компендиума.
 *
 * @param entries - записи компендиума вида `spell`
 * @returns заклинания, которые удалось опознать
 */
export function readCompendiumSpells(
  entries: ReadonlyArray<unknown>,
): CatalogSpell[] {
  return entries
    .map((entry) => toCatalogSpell(entry, 'compendium'))
    .filter((spell): spell is CatalogSpell => spell !== null);
}

/**
 * Заклинания «Мастерской»: плоские и обёрнутые в предмет (`spellData`).
 *
 * @param items - все записи «Мастерской»
 * @returns заклинания мира
 */
export function readWorkshopSpells(
  items: ReadonlyArray<unknown>,
): CatalogSpell[] {
  return items
    .map((item) => {
      const flat = toCatalogSpell(item, 'workshop');

      if (flat) {
        return flat;
      }

      const wrapped = workshopSpellItemSchema.safeParse(item);

      return wrapped.success
        ? toCatalogSpell(wrapped.data.spellData, 'workshop')
        : null;
    })
    .filter((spell): spell is CatalogSpell => spell !== null);
}
