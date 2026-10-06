/**
 * Своё заклинание из листа: для «Мастерской», когда в мире его нет.
 *
 * У заклинания, созданного на сайте (`custom:…`), механика лежит в листе
 * текстом: «Действие», «30 футов», «Вербальный, Соматический, Материальный
 * (пирог и перо)», «Концентрация, до 1 минуты». Здесь текст разбирается в
 * поля `Spell` системы. Что разобрать не удалось, не выдумывается молча:
 * поле получает значение по умолчанию системы (как у её `buildPseudoSpell`),
 * а исходный текст дописывается в описание — мастер увидит и поправит.
 *
 * Значения откалиброваны по записям компендиума: заклинание со спасброском
 * («Порча») — `deliveryType: 'none'` и характеристика в `saveType`, атака
 * заклинанием — `ranged`/`melee`, «на себя» — `rangeUnit: 'self'`.
 *
 * @module spells/homebrew
 */

import type { SheetSpellRef } from '@/sheet/spells';
import type {
  DndAbility,
  DndCastingTimeUnit,
  DndDurationUnit,
  DndHomebrewSpell,
  DndSpellComponents,
  DndSpellDelivery,
  DndSpellSchool,
} from '@/types/dnd5e';

import { richTextToMarkdown } from '@/sheet/richText';

/** Русские названия школ на листе → ключи системы */
const SCHOOL_BY_LABEL: Record<string, DndSpellSchool> = {
  'ограждение': 'abjuration',
  'вызов': 'conjuration',
  'прорицание': 'divination',
  'очарование': 'enchantment',
  'воплощение': 'evocation',
  'иллюзия': 'illusion',
  'некромантия': 'necromancy',
  'преобразование': 'transmutation',
};

/** Характеристика спасброска в родительном падеже → ключ системы */
const SAVE_ABILITY_BY_GENITIVE: Record<string, DndAbility> = {
  'силы': 'strength',
  'ловкости': 'dexterity',
  'телосложения': 'constitution',
  'интеллекта': 'intelligence',
  'мудрости': 'wisdom',
  'харизмы': 'charisma',
};

/** Спасбросок в описании: «спасбросок Мудрости», «спасброски Харизмы» */
const SAVE_REGEX = /спасброс\S*\s+(силы|ловкости|телосложения|интеллекта|мудрости|харизмы)/i;

/** Атака заклинанием в описании: «бросок дальнобойной атаки заклинанием» */
const ATTACK_REGEX = /(дальнобойн|рукопашн)\S*\s+атак\S*\s+заклинани/i;

/** Значение по умолчанию системы для того, что не разобралось */
const FALLBACK_SCHOOL: DndSpellSchool = 'evocation';

/** Концентрация в тексте длительности («Концентрация, вплоть до 1 минуты») */
const CONCENTRATION_REGEX = /концентрац/i;

/** Время сотворения после разбора */
interface ParsedCastingTime {
  /** Число единиц */
  value: number;
  /** Единица */
  unit: DndCastingTimeUnit;
}

/** Дистанция после разбора */
interface ParsedRange {
  /** Дистанция */
  range: number;
  /** Единица */
  unit: DndHomebrewSpell['rangeUnit'];
  /** Особая дистанция */
  special?: string;
  /** Как доходит до цели (у касания и «на себя» — по самой дистанции) */
  delivery?: DndSpellDelivery;
}

/** Длительность после разбора */
interface ParsedDuration {
  /** Число единиц */
  value: number;
  /** Единица */
  unit: DndDurationUnit;
}

/**
 * Достаёт первое число из текста.
 *
 * @param text - текст поля
 * @returns число или 1, если числа нет («Действие», «Час»)
 */
function leadingNumber(text: string): number {
  const match = /(\d+)/.exec(text);

  return match?.[1] ? Number.parseInt(match[1], 10) : 1;
}

/**
 * Разбирает время сотворения: «Действие», «Бонусное действие», «Реакция…»,
 * «10 минут», «1 час».
 *
 * @param text - время сотворения с листа
 * @returns разобранное время или null, если текст незнаком
 */
export function parseCastingTime(text: string): ParsedCastingTime | null {
  const lower = text.toLowerCase();

  if (lower.includes('бонусн')) {
    return { value: 1, unit: 'bonus-action' };
  }

  if (lower.includes('реакц')) {
    return { value: 1, unit: 'reaction' };
  }

  if (lower.includes('действ')) {
    return { value: 1, unit: 'action' };
  }

  if (lower.includes('мин')) {
    return { value: leadingNumber(lower), unit: 'minute' };
  }

  if (lower.includes('час')) {
    return { value: leadingNumber(lower), unit: 'hour' };
  }

  return null;
}

/**
 * Разбирает дистанцию: «30 футов», «Касание», «На себя», «1 миля».
 *
 * @param text - дистанция с листа
 * @returns разобранная дистанция или null, если текст незнаком
 */
export function parseRange(text: string): ParsedRange | null {
  const lower = text.trim().toLowerCase();

  if (lower.startsWith('касани')) {
    return { range: 0, unit: 'ft', special: 'касание', delivery: 'touch' };
  }

  if (lower.startsWith('на себя')) {
    return { range: 0, unit: 'self', special: 'на себя', delivery: 'self' };
  }

  if (/\d/.test(lower) && lower.includes('фут')) {
    return { range: leadingNumber(lower), unit: 'ft' };
  }

  if (/\d/.test(lower) && lower.includes('мил')) {
    return { range: leadingNumber(lower), unit: 'mi' };
  }

  return null;
}

/**
 * Разбирает компоненты: «Вербальный, Соматический, Материальный (пирог и
 * перо)» или сокращённо «В, С, М (…)».
 *
 * @param text - компоненты с листа
 * @returns компоненты
 */
export function parseComponents(text: string): DndSpellComponents {
  const lower = text.toLowerCase();
  const [beforeMaterial = ''] = lower.split('(');
  const tokens = beforeMaterial.split(/[\s,]+/).filter(Boolean);
  const material = lower.includes('материал') || tokens.includes('м');
  const materialDescription = /\(([^)]+)\)/.exec(text)?.[1]?.trim();

  return {
    verbal: lower.includes('вербал') || tokens.includes('в'),
    somatic: lower.includes('соматич') || tokens.includes('с'),
    material,
    ...(material && materialDescription ? { materialDescription } : {}),
  };
}

/**
 * Разбирает длительность: «Мгновенная», «Концентрация, до 1 минуты»,
 * «1 час», «Пока не рассеется».
 *
 * @param text - длительность с листа
 * @returns разобранная длительность или null, если текст незнаком
 */
export function parseDuration(text: string): ParsedDuration | null {
  const lower = text.toLowerCase();

  if (lower.includes('мгновен')) {
    return { value: 0, unit: 'instantaneous' };
  }

  if (lower.includes('рассе')) {
    return { value: 0, unit: 'until-dispelled' };
  }

  if (lower.includes('раунд')) {
    return { value: leadingNumber(lower), unit: 'round' };
  }

  if (lower.includes('мин')) {
    return { value: leadingNumber(lower), unit: 'minute' };
  }

  if (lower.includes('час')) {
    return { value: leadingNumber(lower), unit: 'hour' };
  }

  if (lower.includes('дн') || lower.includes('день')) {
    return { value: leadingNumber(lower), unit: 'day' };
  }

  if (lower.includes('особ')) {
    return { value: 0, unit: 'special' };
  }

  return null;
}

/**
 * Читает строковое поле записи листа.
 *
 * @param raw - запись заклинания с листа
 * @param key - имя поля
 * @returns строка или пустая строка
 */
function readText(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];

  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Собирает своё заклинание из записи листа.
 *
 * @param spell - заклинание с листа
 * @param spellId - ID записи заклинания
 * @returns заклинание в форме системы
 */
export function buildHomebrewSpell(
  spell: SheetSpellRef,
  spellId: string,
): DndHomebrewSpell {
  const { raw } = spell;
  const castingTimeText = readText(raw, 'castingTime');
  const rangeText = readText(raw, 'range');
  const durationText = readText(raw, 'duration');
  const componentsText = readText(raw, 'components');
  const schoolText = readText(raw, 'school').toLowerCase();

  const descriptionSource = Array.isArray(raw.description) ? raw.description : [];
  const description = richTextToMarkdown(descriptionSource);

  const castingTime = castingTimeText ? parseCastingTime(castingTimeText) : null;
  const range = rangeText ? parseRange(rangeText) : null;
  const duration = durationText ? parseDuration(durationText) : null;
  const school = SCHOOL_BY_LABEL[schoolText];

  const saveMatch = SAVE_REGEX.exec(description)?.[1]?.toLowerCase();
  const saveType = saveMatch ? SAVE_ABILITY_BY_GENITIVE[saveMatch] : undefined;
  const attackMatch = ATTACK_REGEX.exec(description)?.[1]?.toLowerCase();

  const attackDelivery: DndSpellDelivery | undefined = attackMatch
    ? attackMatch.startsWith('дальн') ? 'ranged' : 'melee'
    : undefined;

  // Что не разобралось, остаётся видимым: исходный текст листа — в описании
  const unparsed: string[] = [
    ...(castingTimeText && !castingTime ? [`Время накладывания: ${castingTimeText}`] : []),
    ...(rangeText && !range ? [`Дистанция: ${rangeText}`] : []),
    ...(durationText && !duration ? [`Длительность: ${durationText}`] : []),
    ...(schoolText && !school ? [`Школа: ${readText(raw, 'school')}`] : []),
  ];

  const note = unparsed.length > 0
    ? `\n\n**С листа TTG Club (проверьте поля):** ${unparsed.join('; ')}.`
    : '';

  return {
    id: spellId,
    type: 'spell',
    name: spell.name,
    level: spell.level ?? 0,
    school: school ?? FALLBACK_SCHOOL,
    castingTimeValue: castingTime?.value ?? 1,
    castingTimeUnit: castingTime?.unit ?? 'action',
    components: componentsText
      ? parseComponents(componentsText)
      : { verbal: false, somatic: false, material: false },
    range: range?.range ?? 0,
    rangeUnit: range?.unit ?? 'ft',
    ...(range?.special ? { rangeSpecial: range.special } : {}),
    durationValue: duration?.value ?? 0,
    durationUnit: duration?.unit ?? 'instantaneous',
    concentration:
      raw.concentration === true || CONCENTRATION_REGEX.test(durationText),
    ritual: raw.ritual === true,
    targetType: range?.delivery === 'self' ? 'self' : 'creature',
    deliveryType: range?.delivery ?? attackDelivery ?? 'none',
    saveType: saveType ?? 'none',
    description: `${description}${note}`.trim(),
    sourceKey: 'hb',
  };
}
