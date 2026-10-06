/**
 * Сопоставление заклинаний листа с каталогом мира.
 *
 * Порядок строгий, от надёжного к допустимому:
 *
 * 1. **По ссылке.** У заклинания книги ссылка сайта (`magic-missile-phb`)
 *    совпадает с ID записи компендиума один в один.
 * 2. **По названию и кругу** — для ссылок `custom:<uuid>`: так сайт помечает
 *    заклинание, добавленное в лист пользовательской копией, хотя это обычное
 *    заклинание книги («Порча» = `bane-phb`). Сначала ищем в «Мастерской»
 *    мира: там лежат заклинания, заведённые прошлым импортом, и найти их —
 *    значит не плодить дубли. Потом — в компендиуме.
 *
 * Совпадение по одному названию без круга не принимается: одноимённые
 * заклинания разных кругов бывают, и подцепить чужое хуже, чем завести своё.
 *
 * @module spells/match
 */

import type { CatalogSpell } from './catalog';
import type { SheetSpellRef } from '@/sheet/spells';

/** Хвост ID записи с сокращением источника — так оформлены записи книг */
const BOOK_ID_SUFFIX_REGEX = /-[a-z][a-z0-9]{1,4}$/;

/** Ссылка сайта на заклинание, созданное пользователем */
const CUSTOM_URL_PREFIX = 'custom:';

/**
 * Приводит название к виду для сравнения: регистр, ё/е и лишние пробелы на
 * сайте и в компендиуме расходятся без смысла.
 *
 * @param name - название заклинания
 * @returns название для сравнения
 */
export function normalizeSpellName(name: string): string {
  return name.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

/**
 * Проверяет, создано ли заклинание пользователем на сайте.
 *
 * @param url - ссылка с листа
 * @returns true для `custom:…`
 */
export function isCustomSpellUrl(url: string | undefined): boolean {
  return url?.startsWith(CUSTOM_URL_PREFIX) ?? false;
}

/** Индекс каталога для поиска заклинаний листа */
export interface SpellCatalogIndex {
  /** Заклинания компендиума по ID */
  compendiumById: ReadonlyMap<string, CatalogSpell>;
  /** Заклинания «Мастерской» по названию и кругу */
  workshopByName: ReadonlyMap<string, CatalogSpell>;
  /** Заклинания компендиума по названию и кругу (все кандидаты) */
  compendiumByName: ReadonlyMap<string, CatalogSpell[]>;
}

/**
 * Собирает ключ поиска по названию и кругу.
 *
 * @param name - название
 * @param level - круг
 * @returns ключ
 */
function nameLevelKey(name: string, level: number): string {
  return `${normalizeSpellName(name)}|${level}`;
}

/**
 * Строит индекс каталога.
 *
 * @param compendium - заклинания компендиума
 * @param workshop - заклинания «Мастерской»
 * @returns индекс для поиска
 */
export function buildSpellCatalogIndex(
  compendium: readonly CatalogSpell[],
  workshop: readonly CatalogSpell[],
): SpellCatalogIndex {
  const compendiumById = new Map<string, CatalogSpell>();
  const compendiumByName = new Map<string, CatalogSpell[]>();
  const workshopByName = new Map<string, CatalogSpell>();

  for (const spell of compendium) {
    if (!compendiumById.has(spell.id)) {
      compendiumById.set(spell.id, spell);
    }

    const key = nameLevelKey(spell.name, spell.level);

    compendiumByName.set(key, [...(compendiumByName.get(key) ?? []), spell]);
  }

  for (const spell of workshop) {
    const key = nameLevelKey(spell.name, spell.level);

    if (!workshopByName.has(key)) {
      workshopByName.set(key, spell);
    }
  }

  return { compendiumById, workshopByName, compendiumByName };
}

/**
 * Выбирает одну запись среди одноимённых записей компендиума.
 *
 * Одно и то же заклинание лежит в нескольких паках («Жуткий смех Таши» — с
 * ID `…-phb` и без хвоста). Предпочитается запись с хвостом источника: ровно
 * так оформлены ссылки сайта, это каноническая запись книги.
 *
 * @param candidates - одноимённые записи одного круга
 * @returns выбранная запись или undefined, если кандидатов нет
 */
function pickCompendiumCandidate(
  candidates: readonly CatalogSpell[] | undefined,
): CatalogSpell | undefined {
  if (!candidates || candidates.length === 0) {
    return undefined;
  }

  return (
    candidates.find((spell) => BOOK_ID_SUFFIX_REGEX.test(spell.id))
    ?? candidates[0]
  );
}

/**
 * Ищет заклинание листа в каталоге мира.
 *
 * @param spell - заклинание с листа
 * @param index - индекс каталога
 * @returns найденное заклинание или undefined — тогда его придётся завести
 */
export function findCatalogSpell(
  spell: SheetSpellRef,
  index: SpellCatalogIndex,
): CatalogSpell | undefined {
  if (spell.url && !isCustomSpellUrl(spell.url)) {
    const byId = index.compendiumById.get(spell.url);

    if (byId) {
      return byId;
    }
  }

  if (spell.level === undefined) {
    return undefined;
  }

  const key = nameLevelKey(spell.name, spell.level);

  return (
    index.workshopByName.get(key)
    ?? pickCompendiumCandidate(index.compendiumByName.get(key))
  );
}
