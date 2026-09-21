/**
 * Словари и нормализация ключей: лист TTG Club → форма системы `dnd5e-2024`.
 *
 * Лист опознаёт контент URL-ами сайта (`dwarf-phb`, `item:greatsword-phb`), а
 * система — машинными ключами (`dwarf`, `fighter`). Сводим одно к другому
 * здесь, чтобы конвертеры не знали про формат ссылок сайта.
 *
 * @module convert/keys
 */

import type {
  DndAbility,
  DndCreatureSize,
  DndDamageType,
  DndProficiencyLevel,
  DndSkill,
} from '@/types/dnd5e';

/** Хвост URL с сокращением источника: `dwarf-phb` → `-phb` */
const SOURCE_SUFFIX_REGEX = /-([a-z][a-z0-9]{1,4})$/;

/** Префикс типа сущности в идентификаторе предмета: `item:`, `magic-item:` */
const ENTITY_PREFIX_REGEX = /^[a-z-]+:/;

/** Русские названия навыков листа → ключи навыков системы */
const SKILL_BY_LABEL: Record<string, DndSkill> = {
  'Акробатика': 'acrobatics',
  'Анализ': 'investigation',
  'Аркана': 'arcana',
  'Атлетика': 'athletics',
  'Внимательность': 'perception',
  'Выживание': 'survival',
  'Выступление': 'performance',
  'Запугивание': 'intimidation',
  'История': 'history',
  'Ловкость рук': 'sleightOfHand',
  'Медицина': 'medicine',
  'Обман': 'deception',
  'Природа': 'nature',
  'Проницательность': 'insight',
  'Религия': 'religion',
  'Скрытность': 'stealth',
  'Убеждение': 'persuasion',
  'Уход за животными': 'animalHandling',
};

/** Русские размеры листа → ключи размеров системы */
const SIZE_BY_LABEL: Record<string, DndCreatureSize> = {
  'Крошечный': 'tiny',
  'Маленький': 'small',
  'Средний': 'medium',
  'Большой': 'large',
  'Огромный': 'huge',
  'Громадный': 'gargantuan',
};

/** Ключи характеристик системы — для проверки значений листа */
const ABILITY_KEYS: ReadonlySet<string> = new Set<DndAbility>([
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
]);

/** Уровни владения навыком, которые понимает система */
const PROFICIENCY_LEVELS: ReadonlySet<string> = new Set<DndProficiencyLevel>([
  'none',
  'half',
  'proficient',
  'expertise',
]);

/** Типы урона системы — лист пишет их капсом (`SLASHING`) */
const DAMAGE_TYPES: ReadonlySet<string> = new Set<DndDamageType>([
  'slashing',
  'piercing',
  'bludgeoning',
  'fire',
  'cold',
  'lightning',
  'thunder',
  'acid',
  'poison',
  'necrotic',
  'radiant',
  'force',
  'psychic',
]);

/** Названия монет листа → ключи валюты системы */
export const CURRENCY_BY_COIN: Record<string, 'cp' | 'sp' | 'ep' | 'gp' | 'pp'> =
  {
    copper: 'cp',
    silver: 'sp',
    electrum: 'ep',
    gold: 'gp',
    platinum: 'pp',
  };

/**
 * Превращает URL сайта в машинный ключ системы.
 *
 * Отбрасывает префикс типа (`item:`), путь и параметры, затем снимает хвост
 * источника (`-phb`, `-xge`): именно так ключи выглядят в контенте системы
 * (`dwarf`, `fighter`, `soldier`).
 *
 * @param url - ссылка или идентификатор с листа
 * @returns машинный ключ или пустая строка
 */
export function urlToKey(url: string | null | undefined): string {
  if (!url) {
    return '';
  }

  const withoutPrefix = url.replace(ENTITY_PREFIX_REGEX, '');

  const [path = ''] = withoutPrefix.split('?');
  const segments = path.split('/').filter((segment) => segment.length > 0);
  const slug = segments[segments.length - 1] ?? '';

  return slug.replace(SOURCE_SUFFIX_REGEX, '');
}

/**
 * Достаёт из URL сокращение источника.
 *
 * @param url - ссылка или идентификатор с листа
 * @returns ключ источника (`phb`) или undefined, если его нет
 */
export function urlToSourceKey(url: string | null | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  const withoutPrefix = url.replace(ENTITY_PREFIX_REGEX, '');
  const [path = ''] = withoutPrefix.split('?');
  const segments = path.split('/').filter((segment) => segment.length > 0);
  const slug = segments[segments.length - 1] ?? '';

  return SOURCE_SUFFIX_REGEX.exec(slug)?.[1];
}

/**
 * Переводит русское название навыка в ключ системы.
 *
 * @param label - название навыка с листа
 * @returns ключ навыка или null, если навык незнаком
 */
export function skillKeyByLabel(label: string): DndSkill | null {
  return SKILL_BY_LABEL[label.trim()] ?? null;
}

/**
 * Переводит русский размер существа в ключ системы.
 *
 * @param label - размер с листа
 * @returns ключ размера; по умолчанию средний
 */
export function sizeByLabel(label: string | null | undefined): DndCreatureSize {
  if (!label) {
    return 'medium';
  }

  return SIZE_BY_LABEL[label.trim()] ?? 'medium';
}

/**
 * Проверяет, что строка — ключ характеристики.
 *
 * @param value - значение с листа
 * @returns true, если это характеристика системы
 */
export function isAbilityKey(value: string | null | undefined): value is DndAbility {
  return typeof value === 'string' && ABILITY_KEYS.has(value);
}

/**
 * Приводит уровень владения навыком к значению системы.
 *
 * @param value - уровень владения с листа
 * @returns уровень владения; незнакомый считается отсутствующим
 */
export function toProficiencyLevel(
  value: string | null | undefined,
): DndProficiencyLevel {
  if (typeof value === 'string' && PROFICIENCY_LEVELS.has(value)) {
    return value as DndProficiencyLevel;
  }

  return 'none';
}

/**
 * Приводит тип урона листа к ключу системы.
 *
 * @param value - тип урона с листа (`SLASHING`)
 * @returns тип урона или undefined, если он незнаком
 */
export function toDamageType(
  value: string | null | undefined,
): DndDamageType | undefined {
  if (!value) {
    return undefined;
  }

  const key = value.toLowerCase();

  return DAMAGE_TYPES.has(key) ? (key as DndDamageType) : undefined;
}
