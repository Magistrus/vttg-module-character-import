/**
 * Локальный лист персонажа для тестов конвертера.
 *
 * Тесты сверяют перенос с настоящим экспортом листа TTG Club
 * (`fixtures/dwarf-fighter.json`). Это чужой лист, поэтому в репозиторий он не
 * входит (`.gitignore`) и лежит только у того, кто тестирует локально. Без
 * него тесты, которым нужен лист, пропускаются (`describe.skipIf`), а не
 * падают: на чистом клоне `pnpm test` и `pnpm type-check` остаются зелёными.
 *
 * Лист читается во время выполнения, а не `import ... from '*.json'`:
 * статический импорт отсутствующего файла ронял бы проверку типов.
 *
 * @module testing/localSheet
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Где лежит локальный лист персонажа */
const LOCAL_SHEET_PATH = fileURLToPath(
  new URL('../../fixtures/dwarf-fighter.json', import.meta.url),
);

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

/** Есть ли у разработчика локальный лист персонажа */
export const hasLocalSheet: boolean = existsSync(LOCAL_SHEET_PATH);

/**
 * Читает локальный лист персонажа.
 *
 * @returns разобранный JSON листа или заглушка, если листа нет
 */
function readLocalSheet(): Record<string, unknown> {
  if (!hasLocalSheet) {
    return PLACEHOLDER_SHEET;
  }

  const parsed: unknown = JSON.parse(readFileSync(LOCAL_SHEET_PATH, 'utf8'));

  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? { ...parsed }
    : PLACEHOLDER_SHEET;
}

/** Лист персонажа как объект — настоящий или заглушка */
export const localSheet: Record<string, unknown> = readLocalSheet();
