/**
 * Перенос заклинаний листа: каталог мира → лист актёра, иначе «Мастерская».
 *
 * Для каждого заклинания листа:
 * 1. ищем его в каталоге мира (компендиум по ссылке, затем «Мастерская» и
 *    компендиум по названию и кругу — см. `spells/match`);
 * 2. нашли — кладём на лист запись каталога с отметками листа;
 * 3. не нашли — собираем своё заклинание из полей листа, заводим его в
 *    «Мастерской» мира и кладём на лист его же.
 *
 * Если завести не вышло (нет разрешения или права мира, сервер отказал),
 * заклинание не теряется молча: оно попадает в итог с причиной. Импорт
 * персонажа от этого не срывается.
 *
 * @module import/spells
 */

import type { CharacterSheet } from '@/sheet/schema';
import type { SheetSpellRef } from '@/sheet/spells';
import type { ActorSpell } from '@/spells/actorSpell';
import type { CatalogSpell } from '@/spells/catalog';
import type { SpellCatalogIndex } from '@/spells/match';
import type { VttgItemsApi, VttgModuleApi } from '@/types/vttg';

import { resolveTotalLevel } from '@/sheet/parse';
import { collectSheetSpells } from '@/sheet/spells';
import { buildActorSpell } from '@/spells/actorSpell';
import { readCompendiumSpells, readWorkshopSpells } from '@/spells/catalog';
import { buildHomebrewSpell } from '@/spells/homebrew';
import { buildSpellCatalogIndex, findCatalogSpell } from '@/spells/match';

/** Вид записей компендиума с заклинаниями */
const SPELL_DATA_KIND = 'spell';

/** Причина, когда заводить свои заклинания модулю нечем */
const NO_WORKSHOP_REASON =
  'в мире его нет, а завести его в «Мастерской» модулю не дали (нужно '
  + 'приложение с api.items и разрешение item-write)';

/** Заклинание, которое не удалось перенести */
export interface FailedSpell {
  /** Название */
  name: string;
  /** Почему */
  reason: string;
}

/** Итог переноса заклинаний */
export interface SpellImportResult {
  /** Заклинания для `actor.spells` */
  spells: ActorSpell[];
  /** Сколько нашлось в каталоге мира */
  matchedCount: number;
  /** Названия заклинаний, заведённых в «Мастерской» */
  createdInWorkshop: string[];
  /** Заклинания, которые перенести не вышло */
  failed: FailedSpell[];
}

/**
 * Проверяет, может ли приложение переносить заклинания: без чтения
 * компендиума найти их негде.
 *
 * @param api - API модуля от хоста
 * @returns true, если в API есть чтение компендиума
 */
export function isSpellTransferSupported(api: VttgModuleApi): boolean {
  return typeof api.compendium?.getEntries === 'function';
}

/**
 * Чеканит ID записи заклинания.
 *
 * @returns новый уникальный ID
 */
function createSpellId(): string {
  return `spell_${crypto.randomUUID()}`;
}

/**
 * Читает «Мастерскую»; сбой чтения не срывает импорт — только повышает
 * риск завести заклинание повторно.
 *
 * @param items - секция «Мастерской» хоста (если есть)
 * @returns заклинания «Мастерской»
 */
async function loadWorkshopSpells(
  items: VttgItemsApi | undefined,
): Promise<CatalogSpell[]> {
  if (!items) {
    return [];
  }

  try {
    return readWorkshopSpells(await items.list());
  } catch {
    return [];
  }
}

/**
 * Заводит своё заклинание в «Мастерской».
 *
 * @param items - секция «Мастерской» хоста
 * @param spell - заклинание с листа
 * @returns запись заклинания для листа
 * @throws Error если сервер отказал (с его причиной)
 */
async function createWorkshopSpell(
  items: VttgItemsApi,
  spell: SheetSpellRef,
): Promise<Record<string, unknown>> {
  const homebrew = buildHomebrewSpell(spell, createSpellId());

  await items.create({
    name: homebrew.name,
    type: 'spell',
    description: homebrew.description,
    quantity: 1,
    weight: 0,
    cost: '',
    rarity: 'common',
    equipped: false,
    sourceKey: homebrew.sourceKey,
    spellData: homebrew,
  });

  return { ...homebrew };
}

/**
 * Находит или заводит одно заклинание.
 *
 * @param api - API модуля от хоста
 * @param spell - заклинание с листа
 * @param index - индекс каталога мира
 * @param result - накапливаемый итог
 */
async function resolveSpell(
  api: VttgModuleApi,
  spell: SheetSpellRef,
  index: SpellCatalogIndex,
  result: SpellImportResult,
): Promise<void> {
  const found = findCatalogSpell(spell, index);

  if (found) {
    result.spells.push(buildActorSpell(found.record, spell, createSpellId()));
    result.matchedCount += 1;

    return;
  }

  const items = api.items;

  if (!items) {
    result.failed.push({ name: spell.name, reason: NO_WORKSHOP_REASON });

    return;
  }

  try {
    const record = await createWorkshopSpell(items, spell);

    result.spells.push(buildActorSpell(record, spell, createSpellId()));
    result.createdInWorkshop.push(spell.name);
  } catch (error) {
    result.failed.push({
      name: spell.name,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Переносит заклинания листа.
 *
 * @param api - API модуля от хоста
 * @param sheet - лист персонажа
 * @returns итог переноса или null, если приложение переносить их не умеет
 */
export async function importSpells(
  api: VttgModuleApi,
  sheet: CharacterSheet,
): Promise<SpellImportResult | null> {
  const compendium = api.compendium;

  if (!compendium) {
    return null;
  }

  const sheetSpells = collectSheetSpells(sheet, resolveTotalLevel(sheet));

  const result: SpellImportResult = {
    spells: [],
    matchedCount: 0,
    createdInWorkshop: [],
    failed: [],
  };

  if (sheetSpells.length === 0) {
    return result;
  }

  const [compendiumEntries, workshopSpells] = await Promise.all([
    compendium.getEntries(SPELL_DATA_KIND),
    loadWorkshopSpells(api.items),
  ]);

  const index = buildSpellCatalogIndex(
    readCompendiumSpells(compendiumEntries),
    workshopSpells,
  );

  // По одному: заклинания «Мастерской» создаются запросами к серверу, и
  // порядок на листе должен остаться порядком листа.
  for (const spell of sheetSpells) {
    await resolveSpell(api, spell, index, result);
  }

  return result;
}
