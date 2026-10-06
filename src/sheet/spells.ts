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
 * Здесь же решается, КАК заклинание принадлежит персонажу — от этого зависят
 * отметки на листе системы:
 * - заклинание книги (выбрал игрок): верхний `spells` и заклинания умений
 *   класса без отметки «подготовлено всегда»;
 * - выданное (`grant`): вид, черта, предыстория, а у класса — только то, что
 *   подготовлено всегда (домен жреца). Такое не занимает мест в колонках
 *   класса и уходит вместе со своим источником.
 *
 * `spellList` черты — это список, ИЗ которого можно выбирать, а не то, что
 * персонаж знает, поэтому он не учитывается.
 *
 * @module sheet/spells
 */

import type { CharacterSheet, SheetFeature } from './schema';

import { z } from 'zod';

/** Чем выдано заклинание — те же виды, что у системы (`SpellGrantKind`) */
export type SpellGrantKind = 'class' | 'species' | 'background' | 'feat';

/** Происхождение черты на листе → чем она выдаёт заклинания */
const GRANT_KIND_BY_ORIGIN: Record<string, SpellGrantKind> = {
  class: 'class',
  subclass: 'class',
  species: 'species',
  lineage: 'species',
  background: 'background',
  feat: 'feat',
};

/** Заклинание в одном из мест листа: опознавательные поля и отметки */
const sheetSpellRefSchema = z
  .object({
    url: z.string().optional(),
    name: z.string().min(1),
    level: z.number().optional(),
    requiredLevel: z.number().optional(),
    prepared: z.boolean().optional(),
    alwaysPrepared: z.boolean().optional(),
    spellcastingAbility: z.string().optional(),
  })
  .passthrough();

/** Выдача заклинания: чем и кем */
export interface SpellGrant {
  /** Чем выдано */
  kind: SpellGrantKind;
  /** Кто выдал — название черты, умения или вида */
  source: string;
}

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
  /** Подготовлено ли (как отмечено на листе) */
  prepared?: boolean;
  /** Подготовлено всегда */
  alwaysPrepared?: boolean;
  /** Заклинательная характеристика, заданная источником */
  spellcastingAbility?: string;
  /** Выдача; нет — заклинание книги */
  grant?: SpellGrant;
  /** Запись с листа целиком — из неё собирается своё заклинание */
  raw: Record<string, unknown>;
}

/**
 * Разбирает один элемент списка заклинаний.
 *
 * @param entry - элемент списка с листа
 * @param grant - выдача, если весь список выдан источником
 * @returns заклинание или null, если элемент не похож на заклинание
 */
function toSpellRef(
  entry: unknown,
  grant: SpellGrant | undefined,
): SheetSpellRef | null {
  const parsed = sheetSpellRefSchema.safeParse(entry);

  if (!parsed.success) {
    return null;
  }

  const { url, name, level, requiredLevel, prepared, alwaysPrepared } =
    parsed.data;

  return {
    name,
    raw: parsed.data,
    ...(url !== undefined ? { url } : {}),
    ...(level !== undefined ? { level } : {}),
    ...(requiredLevel !== undefined ? { requiredLevel } : {}),
    ...(prepared !== undefined ? { prepared } : {}),
    ...(alwaysPrepared !== undefined ? { alwaysPrepared } : {}),
    ...(parsed.data.spellcastingAbility !== undefined
      ? { spellcastingAbility: parsed.data.spellcastingAbility }
      : {}),
    ...(grant ? { grant } : {}),
  };
}

/**
 * Разбирает заклинания черты: выданы ли они ей или это книга.
 *
 * У умения класса список — книга, кроме заклинаний «подготовлено всегда»
 * (домен, круг): их выдаёт само умение. У вида, черты и предыстории весь
 * список выдан источником.
 *
 * @param feature - черта с листа
 * @returns заклинания черты
 */
function collectFeatureSpells(feature: SheetFeature): SheetSpellRef[] {
  if (!Array.isArray(feature.spells)) {
    return [];
  }

  const kind = feature.origin ? GRANT_KIND_BY_ORIGIN[feature.origin] : undefined;

  return feature.spells
    .map((entry): SheetSpellRef | null => {
      const spell = toSpellRef(entry, undefined);

      if (!spell || !kind) {
        return spell;
      }

      const granted = kind !== 'class' || spell.alwaysPrepared === true;

      return granted
        ? { ...spell, grant: { kind, source: feature.name } }
        : spell;
    })
    .filter((spell): spell is SheetSpellRef => spell !== null);
}

/**
 * Разбирает врождённые заклинания вида.
 *
 * @param sheet - лист персонажа
 * @returns заклинания, выданные видом
 */
function collectInnateSpells(sheet: CharacterSheet): SheetSpellRef[] {
  const speciesName = sheet.species?.name ?? 'Вид';
  const grant: SpellGrant = { kind: 'species', source: speciesName };

  return (sheet.species?.innateSpells ?? [])
    .map((entry): SheetSpellRef | null => {
      const spell = toSpellRef(entry.spell, grant);

      if (!spell) {
        return null;
      }

      return {
        ...spell,
        alwaysPrepared: true,
        ...(entry.requiredLevel !== undefined
          ? { requiredLevel: entry.requiredLevel }
          : {}),
      };
    })
    .filter((spell): spell is SheetSpellRef => spell !== null);
}

/**
 * Собирает заклинания, которые персонаж знает на своём текущем уровне.
 *
 * Заклинание с `requiredLevel` выше уровня персонажа (у «Метки письма»
 * «Волшебные уста» открываются на 3 уровне) не учитывается: у персонажа его
 * ещё нет. Повторы (одно заклинание из двух источников) сворачиваются по
 * ссылке, а без ссылки — по названию; первым остаётся выданное источником,
 * иначе книга заняла бы место, которое выдача не занимает.
 *
 * @param sheet - лист персонажа
 * @param characterLevel - текущий уровень персонажа
 * @returns заклинания персонажа без повторов
 */
export function collectSheetSpells(
  sheet: CharacterSheet,
  characterLevel: number,
): SheetSpellRef[] {
  const candidates = [
    ...(sheet.features ?? []).flatMap((feature) => collectFeatureSpells(feature)),
    ...collectInnateSpells(sheet),
    ...(sheet.spells ?? [])
      .map((entry) => toSpellRef(entry, undefined))
      .filter((spell): spell is SheetSpellRef => spell !== null),
  ];

  const ordered = [
    ...candidates.filter((spell) => spell.grant),
    ...candidates.filter((spell) => !spell.grant),
  ];

  const seen = new Set<string>();
  const spells: SheetSpellRef[] = [];

  for (const spell of ordered) {
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
