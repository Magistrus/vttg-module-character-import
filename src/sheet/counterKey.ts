/**
 * Ключ счётчика ресурса в терминах листа TTG Club.
 *
 * Лист описывает один и тот же ресурс двумя способами: списком
 * `classResources` с составным идентификатором
 * (`feat:res:feat:lucky-phb:luck-points`) и полем `counters` внутри черты, где
 * лежит короткий ключ (`luck-points`). Свести их к одному ключу нужно и
 * сводке (чтобы не посчитать ресурс дважды), и конвертеру — поэтому правило
 * живёт отдельно.
 *
 * @module sheet/counterKey
 */

/** Разделитель составного идентификатора ресурса на листе */
const RESOURCE_ID_SEPARATOR = ':';

/**
 * Достаёт короткий ключ счётчика из идентификатора листа.
 *
 * @param id - идентификатор ресурса с листа
 * @returns последний сегмент идентификатора (`luck-points`)
 */
export function counterKeyFromId(id: string): string {
  const segments = id.split(RESOURCE_ID_SEPARATOR).filter(Boolean);

  return segments[segments.length - 1] ?? '';
}
