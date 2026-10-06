/**
 * Заклинание на листе актёра: запись каталога плюс отметки с листа сайта.
 *
 * Форма — как у самой системы, когда игрок добавляет заклинание из
 * компендиума (`addSpellsFromCompendium`): запись целиком, свой `id` и
 * отметка подготовки. Отметки здесь берутся с листа:
 *
 * - **выданное** (вид, черта, предыстория, «подготовлено всегда» у класса):
 *   `grantedByFeature` — кто выдал, `grantKind` — чем, `alwaysPrepared`. Такое
 *   не занимает мест в колонках класса и уходит вместе с источником;
 * - **заклинание книги**: заговор — `prepared: true` (у нового актёра
 *   `cantripsTracked`, и заговор без отметки считался бы невыученным: сайт же
 *   пишет у заговоров книги `prepared: false` просто потому, что их не
 *   готовят); заклинание 1+ круга — отметка листа, а если её нет — подготовлено
 *   (у колдуна выбранные заклинания и есть подготовленные).
 *
 * @module spells/actorSpell
 */

import type { SheetSpellRef } from '@/sheet/spells';

import { isAbilityKey } from '@/convert/keys';

/** Круг заговора */
const CANTRIP_LEVEL = 0;

/** Заклинание на листе актёра (форма системы `Spell`) */
export type ActorSpell = Record<string, unknown> & {
  /** ID записи на листе */
  id: string;
  /** Название */
  name: string;
};

/**
 * Решает отметку подготовки для заклинания книги.
 *
 * @param spell - заклинание с листа
 * @param level - круг заклинания
 * @returns подготовлено ли
 */
function resolveBookPrepared(spell: SheetSpellRef, level: number): boolean {
  if (level === CANTRIP_LEVEL) {
    return true;
  }

  return spell.prepared ?? true;
}

/**
 * Собирает заклинание листа актёра.
 *
 * @param record - запись заклинания (из компендиума, «Мастерской» или своя)
 * @param spell - заклинание с листа сайта — источник отметок
 * @param spellId - ID записи на листе
 * @returns заклинание для `actor.spells`
 */
export function buildActorSpell(
  record: Readonly<Record<string, unknown>>,
  spell: SheetSpellRef,
  spellId: string,
): ActorSpell {
  const level = typeof record.level === 'number' ? record.level : spell.level ?? 0;
  const ability = spell.spellcastingAbility;

  const marks = spell.grant
    ? {
        prepared: true,
        alwaysPrepared: true,
        grantedByFeature: spell.grant.source,
        grantKind: spell.grant.kind,
      }
    : { prepared: resolveBookPrepared(spell, level) };

  return {
    ...record,
    id: spellId,
    name: typeof record.name === 'string' ? record.name : spell.name,
    ...marks,
    ...(isAbilityKey(ability) ? { spellcastingAbility: ability } : {}),
  };
}
