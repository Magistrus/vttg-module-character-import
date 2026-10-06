/**
 * Чтение файла листа персонажа и сводка по его содержимому.
 *
 * @module sheet/parse
 */

import type { CharacterSheet } from './schema';

import { counterKeyFromId } from './counterKey';
import { characterSheetSchema } from './schema';
import { collectSheetSpells } from './spells';

/** Расширения, которые модуль принимает как лист персонажа */
export const SHEET_EXTENSIONS = ['.json'];

/** Краткая сводка по листу — то, что показывается в мастере импорта */
export interface SheetSummary {
  /** Имя персонажа */
  name: string;
  /** Суммарный уровень */
  level: number;
  /** Классы строкой («Воин 1 / Плут 2») */
  classes: string;
  /** Вид персонажа */
  speciesName: string | null;
  /** Предыстория */
  backgroundName: string | null;
  /** Текущие хиты */
  hitPointsCurrent: number;
  /** Максимум хитов */
  hitPointsMax: number;
  /** Число черт и умений */
  featureCount: number;
  /** Число предметов инвентаря */
  itemCount: number;
  /** Число заклинаний на листе */
  spellCount: number;
  /** Число счётчиков ресурсов */
  counterCount: number;
  /** Число известных языков */
  languageCount: number;
  /** Уровень истощения */
  exhaustion: number;
  /** Есть ли аватар */
  hasAvatar: boolean;
}

/**
 * Проверяет, похоже ли имя файла на лист персонажа.
 *
 * @param fileName - имя файла
 * @returns true, если расширение известно модулю
 */
export function isSheetFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();

  return SHEET_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * Убирает из объектов свойства со значением `null`.
 *
 * Сайт пишет `null` в смысле «значения нет» где угодно: `avatarUrl`, ссылка
 * у владения (`{ name: 'Лира', url: null }`), подкласс, доспех у оружия,
 * настройки. Конвертер нигде не отличает `null` от отсутствия поля, а схема,
 * написанная под «поле может отсутствовать», отклоняла из-за одного `null`
 * весь лист — так не разбирались листы мага и колдуна. Одно правило на входе
 * закрывает этот класс отказов целиком, вместо `.nullable()` у каждого поля.
 *
 * Элементы массивов не трогаются: `null` в массиве — это позиция (ячейка
 * таблицы, слот), и выкидывать её значило бы сдвигать соседей.
 *
 * @param value - разобранный JSON листа (или его часть)
 * @returns то же значение без `null`-свойств в объектах
 */
export function dropNullProperties(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => dropNullProperties(entry));
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== null)
      .map(([key, entry]) => [key, dropNullProperties(entry)]),
  );
}

/**
 * Разбирает текст файла как лист персонажа.
 *
 * @param source - содержимое файла
 * @returns разобранный лист
 * @throws Error если это не JSON или не лист персонажа
 */
export function parseSheetText(source: string): CharacterSheet {
  let raw: unknown;

  try {
    raw = JSON.parse(source);
  } catch {
    throw new Error('Файл не читается как JSON — выберите файл экспорта листа');
  }

  const parsed = characterSheetSchema.safeParse(dropNullProperties(raw));

  if (!parsed.success) {
    const [first] = parsed.error.issues;

    const where = first?.path.join('.') ?? '';

    throw new Error(
      `Это не похоже на лист персонажа TTG Club${where ? ` (поле «${where}»)` : ''}: `
        + (first?.message ?? 'неизвестная ошибка разбора'),
    );
  }

  return parsed.data;
}

/**
 * Читает выбранный файл и разбирает его как лист персонажа.
 *
 * @param file - файл, выбранный пользователем
 * @returns разобранный лист
 */
export async function parseSheetFile(file: File): Promise<CharacterSheet> {
  return parseSheetText(await file.text());
}

/**
 * Собирает описание классов персонажа строкой.
 *
 * @param sheet - лист персонажа
 * @returns строка вида «Воин 1 / Плут 2» или пустая строка
 */
function describeClasses(sheet: CharacterSheet): string {
  const entries = [sheet.characterClass, ...(sheet.additionalClasses ?? [])];

  return entries
    .filter((entry) => Boolean(entry?.name))
    .map((entry) => `${entry?.name} ${entry?.level ?? 1}`)
    .join(' / ');
}

/**
 * Считает суммарный уровень персонажа.
 *
 * Поле `level` листа — источник истины; если его нет, уровень складывается
 * из классов.
 *
 * @param sheet - лист персонажа
 * @returns суммарный уровень (минимум 1)
 */
export function resolveTotalLevel(sheet: CharacterSheet): number {
  if (typeof sheet.level === 'number' && sheet.level > 0) {
    return sheet.level;
  }

  const fromClasses = [sheet.characterClass, ...(sheet.additionalClasses ?? [])]
    .filter((entry) => Boolean(entry))
    .reduce((sum, entry) => sum + (entry?.level ?? 0), 0);

  return Math.max(1, fromClasses);
}

/**
 * Считает число счётчиков ресурсов на листе.
 *
 * Счётчики живут в двух местах: отдельным списком `classResources` и внутри
 * черт (`features[].counters`). Считаем объединение по ключу, чтобы один и тот
 * же ресурс не учитывался дважды.
 *
 * @param sheet - лист персонажа
 * @returns число уникальных счётчиков
 */
export function countCounters(sheet: CharacterSheet): number {
  const keys = new Set<string>();

  for (const resource of sheet.classResources ?? []) {
    keys.add(counterKeyFromId(resource.id ?? '') || resource.name || '');
  }

  for (const feature of sheet.features ?? []) {
    for (const counter of feature.counters ?? []) {
      keys.add(counter.key);
    }
  }

  keys.delete('');

  return keys.size;
}

/**
 * Собирает сводку по листу для мастера импорта.
 *
 * @param sheet - разобранный лист персонажа
 * @returns сводка для показа пользователю
 */
export function summarizeSheet(sheet: CharacterSheet): SheetSummary {
  return {
    name: sheet.name,
    level: resolveTotalLevel(sheet),
    classes: describeClasses(sheet),
    speciesName: sheet.species?.name ?? null,
    backgroundName: sheet.characterBackground?.name ?? null,
    hitPointsCurrent: sheet.health?.current ?? 0,
    hitPointsMax: sheet.health?.max ?? 0,
    featureCount: sheet.features?.length ?? 0,
    itemCount: sheet.inventory?.length ?? 0,
    spellCount: collectSheetSpells(sheet, resolveTotalLevel(sheet)).length,
    counterCount: countCounters(sheet),
    languageCount: sheet.proficiencies?.languages?.length ?? 0,
    exhaustion: sheet.health?.exhaustion ?? 0,
    hasAvatar: Boolean(sheet.avatarUrl),
  };
}
