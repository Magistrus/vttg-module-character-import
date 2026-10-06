/**
 * Локальные листы персонажей для тестов конвертера.
 *
 * Тесты сверяют перенос с настоящими экспортами листов TTG Club из
 * `fixtures/`. Это чужие листы, поэтому в репозиторий они не входят
 * (`.gitignore`) и лежат только у того, кто тестирует локально. Без листа
 * тесты, которым он нужен, пропускаются (`describe.skipIf`), а не падают: на
 * чистом клоне `pnpm test` и `pnpm type-check` остаются зелёными.
 *
 * Листы читаются во время выполнения, а не `import ... from '*.json'`:
 * статический импорт отсутствующего файла ронял бы проверку типов.
 *
 * Листы:
 * - `dwarf-fighter.json` — дварф-воин 1 уровня с магическим предметом;
 * - `khoravar-wizard.json` — хоравар-волшебник 1 уровня: заклинания внутри
 *   черт и вида, владение инструментом ссылкой `{ name, url }`, таблица в
 *   описании черты, эффект черты.
 *
 * @module testing/localSheet
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Заглушка вместо листа: минимально разбираемый лист, чтобы тела `describe`
 * собрались без настоящего файла. Сами тесты при этом пропускаются, так что
 * значения здесь ни с чем не сверяются.
 */
const PLACEHOLDER_SHEET: Record<string, unknown> = {
  name: 'Лист не найден',
  abilities: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  },
};

/** Локальный лист: есть ли он у разработчика и сам лист (или заглушка) */
export interface LocalSheet {
  /** Есть ли файл листа на диске */
  available: boolean;
  /** Разобранный JSON листа или заглушка */
  sheet: Record<string, unknown>;
}

/**
 * Читает локальный лист персонажа из `fixtures/`.
 *
 * @param fileName - имя файла в `fixtures/`
 * @returns признак наличия и лист (или заглушка, если листа нет)
 */
export function loadLocalSheet(fileName: string): LocalSheet {
  const sheetPath = fileURLToPath(
    new URL(`../../fixtures/${fileName}`, import.meta.url),
  );

  if (!existsSync(sheetPath)) {
    return { available: false, sheet: PLACEHOLDER_SHEET };
  }

  const parsed: unknown = JSON.parse(readFileSync(sheetPath, 'utf8'));

  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? { available: true, sheet: { ...parsed } }
    : { available: false, sheet: PLACEHOLDER_SHEET };
}

/** Основной лист тестов — дварф-воин */
const fighter = loadLocalSheet('dwarf-fighter.json');

/** Есть ли у разработчика основной лист персонажа */
export const hasLocalSheet: boolean = fighter.available;

/** Основной лист как объект — настоящий или заглушка */
export const localSheet: Record<string, unknown> = fighter.sheet;
