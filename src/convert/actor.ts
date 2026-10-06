/**
 * Сборка актёра VTTG из листа персонажа TTG Club.
 *
 * Здесь собирается всё вместе: нейтральная часть (имя, аватар, токен) — по
 * контракту ядра, системная (`system` + корневые коллекции) — по форме
 * системы `dnd5e-2024`. Всё, что перенести не удалось, возвращается списком
 * предупреждений: мастер импорта показывает их до создания актёра.
 *
 * @module convert/actor
 */

import type { CharacterSheet } from '@/sheet/schema';
import type {
  DndActorSystem,
  DndArmorClass,
  DndCurrency,
  DndFeature,
  DndGameItem,
  DndMovement,
} from '@/types/dnd5e';
import type { SpellImportResult } from '@/import/spells';
import type { ActorSpell } from '@/spells/actorSpell';
import type { VttgActorCreateInput } from '@/types/vttg';

import { resolveTotalLevel } from '@/sheet/parse';
import { collectSheetSpells } from '@/sheet/spells';
import { isCustomSpellUrl } from '@/spells/match';

import { buildBackground, buildClasses, buildSpecies } from './classes';
import { buildCounters } from './counters';
import { buildFeatures } from './features';
import { buildInventory, collectUnmappedBonusItems } from './inventory';
import { CURRENCY_BY_COIN, isAbilityKey, sizeByLabel } from './keys';
import { buildCarryingCapacity, buildPreparedLimit } from './limits';
import { buildProficiencies } from './proficiencies';
import { buildUsedSpellSlots } from './slots';

/** Базовый КД без доспеха */
const DEFAULT_ARMOR_CLASS = 10;

/** ID прибавки к лимиту подготовленных заклинаний, перенесённой с листа */
const PREPARED_SPELLS_BONUS_ID = 'sheet-prepared-spells';

/** ID прибавки к лимиту заговоров, перенесённой с листа */
const PREPARED_CANTRIPS_BONUS_ID = 'sheet-prepared-cantrips';

/**
 * Отношение фишки импортированного персонажа. Лист сайта — это всегда персонаж
 * игрока, а новый актёр системы получает именно «дружелюбный».
 */
const PLAYER_CHARACTER_DISPOSITION = 'friendly';

/**
 * Рамка токена нового персонажа — та же, что ставит система `dnd5e-2024`
 * своему новому актёру (`DEFAULT_ACTOR.token.frameUrl`). Модуль собирает
 * `token` целиком сам, поэтому без этой строки рамка терялась, и у
 * импортированного персонажа путь к картинке токена оставался пустым.
 */
const DEFAULT_TOKEN_FRAME_URL = 'assets/token-frames/0.png';

/** Единица расстояния листа → единица системы */
const DISTANCE_UNITS: Record<string, DndMovement['units']> = {
  feet: 'ft',
  ft: 'ft',
  meters: 'm',
  m: 'm',
};

/** Настройки импорта, которыми управляет пользователь */
export interface ImportOptions {
  /** Имя актёра (по умолчанию — имя с листа) */
  name: string;
  /** Переносить черты и умения */
  importFeatures: boolean;
  /** Переносить инвентарь */
  importInventory: boolean;
  /** Переносить внешность и характер в описание */
  importPersonality: boolean;
  /** Сделать импортировавшего владельцем актёра */
  assignOwner: boolean;
  /** Виден ли актёр остальным игрокам */
  isPublic: boolean;
}

/**
 * Черновик актёра с уточнённой системной частью.
 *
 * Ядро принимает `system` и корневые коллекции как непрозрачные данные;
 * модулю же важно собрать их по форме D&D 5e — отсюда сужение.
 */
export interface CharacterActorInput extends VttgActorCreateInput {
  /** Системные данные D&D 5e */
  system: DndActorSystem;
  /** Черты и умения */
  features: DndFeature[];
  /** Снаряжение */
  equipment: DndGameItem[];
  /** Заклинания (из каталога мира или «Мастерской») */
  spells: ActorSpell[];
  /** Активные эффекты актёра (эффекты предметов живут на предметах) */
  activeEffects: never[];
  /** Заметки */
  notes: string;
}

/** Готовый черновик актёра вместе с тем, что не поехало */
export interface ActorDraft {
  /** Черновик для `api.actors.create` */
  actor: CharacterActorInput;
  /** Что осталось за бортом импорта */
  warnings: string[];
}

/**
 * Собирает передвижение персонажа.
 *
 * @param sheet - лист персонажа
 * @returns передвижение для `system.movement`
 */
function buildMovement(sheet: CharacterSheet): DndMovement {
  const values = sheet.speed?.values ?? {};
  const unit = sheet.speed?.unit ?? 'feet';

  return {
    walk: values.walk ?? 30,
    swim: values.swim ?? 0,
    fly: values.fly ?? 0,
    climb: values.climb ?? 0,
    burrow: values.burrow ?? 0,
    hover: sheet.speed?.hover ?? false,
    units: DISTANCE_UNITS[unit] ?? 'ft',
  };
}

/**
 * Собирает класс доспеха.
 *
 * По умолчанию КД считает сама система — по надетому доспеху и Ловкости.
 * Ручное значение с листа переносится только там, где лист сам отказался от
 * расчёта: «природный» доспех и полностью ручной КД.
 *
 * @param sheet - лист персонажа
 * @returns класс доспеха для `system.armorClass`
 */
function buildArmorClass(sheet: CharacterSheet): DndArmorClass {
  const base = sheet.armorClass?.base ?? DEFAULT_ARMOR_CLASS;

  if (sheet.armorClass?.custom) {
    return { value: base, calculation: 'flat', formula: '', flat: base };
  }

  if (sheet.armorClass?.natural) {
    return { value: base, calculation: 'natural', formula: '', flat: null };
  }

  return {
    value: DEFAULT_ARMOR_CLASS,
    calculation: 'default',
    formula: '',
    flat: null,
  };
}

/**
 * Собирает деньги персонажа.
 *
 * @param sheet - лист персонажа
 * @returns валюта для `system.currency`
 */
function buildCurrency(sheet: CharacterSheet): DndCurrency {
  const currency: DndCurrency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

  for (const [coin, amount] of Object.entries(sheet.currency ?? {})) {
    const key = CURRENCY_BY_COIN[coin];

    if (key) {
      currency[key] = amount;
    }
  }

  return currency;
}

/**
 * Собирает описание персонажа из блока внешности и характера.
 *
 * @param sheet - лист персонажа
 * @returns описание в markdown (пустая строка, если блока нет)
 */
export function buildDescription(sheet: CharacterSheet): string {
  const personality = sheet.personality;

  if (!personality) {
    return '';
  }

  const traits: Array<[string, string | undefined]> = [
    ['Мировоззрение', personality.alignment],
    ['Возраст', personality.age],
    ['Рост', personality.height],
    ['Вес', personality.weight],
    ['Глаза', personality.eyes],
    ['Волосы', personality.hair],
    ['Кожа', personality.skin],
  ];

  const lines = traits
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `**${label}:** ${value}`);

  const description = personality.description?.trim();

  if (description) {
    lines.push('', description);
  }

  return lines.join('\n');
}

/**
 * Собирает характеристику для расчёта инициативы.
 *
 * @param sheet - лист персонажа
 * @returns характеристика инициативы
 */
function resolveInitiativeAbility(
  sheet: CharacterSheet,
): DndActorSystem['initiativeAbility'] {
  const ability = sheet.settings?.initiativeAbility;

  return isAbilityKey(ability) ? ability : 'dexterity';
}

/**
 * Что известно о переносе заклинаний к моменту предупреждений:
 * - `unsupported` — приложение не даёт модулю компендиум, переносить нечем;
 * - `pending` — перенос будет (предупреждение до импорта);
 * - итог переноса — после импорта.
 */
export type SpellNotice = 'unsupported' | 'pending' | SpellImportResult;

/**
 * Предупреждения о заклинаниях, когда перенести их нечем.
 *
 * @param sheet - лист персонажа
 * @returns предупреждения
 */
function collectUnsupportedSpellWarnings(sheet: CharacterSheet): string[] {
  const spells = collectSheetSpells(sheet, resolveTotalLevel(sheet));
  const bookSpells = spells.filter((spell) => !isCustomSpellUrl(spell.url));
  const customSpells = spells.filter((spell) => isCustomSpellUrl(spell.url));
  const warnings: string[] = [];

  if (bookSpells.length > 0) {
    warnings.push(
      `Заклинания (${bookSpells.length}) не переносятся: это приложение не даёт `
        + 'модулю компендиум мира — добавьте их персонажу из компендиума после '
        + `импорта: ${bookSpells.map((spell) => spell.name).join(', ')}.`,
    );
  }

  if (customSpells.length > 0) {
    warnings.push(
      `Заклинания-копии с сайта (${customSpells.length}) не переносятся: у них `
        + 'нет книжной ссылки — поищите их в компендиуме по названию: '
        + `${customSpells.map((spell) => spell.name).join(', ')}.`,
    );
  }

  return warnings;
}

/**
 * Предупреждения о заклинаниях по итогу переноса.
 *
 * @param result - итог переноса
 * @returns предупреждения
 */
function collectSpellResultWarnings(result: SpellImportResult): string[] {
  const warnings: string[] = [];

  if (result.createdInWorkshop.length > 0) {
    warnings.push(
      `Заклинания, которых нет в мире, заведены в «Мастерской» (`
        + `${result.createdInWorkshop.length}) — проверьте их поля: `
        + `${result.createdInWorkshop.join(', ')}.`,
    );
  }

  for (const failed of result.failed) {
    warnings.push(`Заклинание «${failed.name}» не перенесено: ${failed.reason}.`);
  }

  return warnings;
}

/**
 * Предупреждения о заклинаниях листа.
 *
 * @param sheet - лист персонажа
 * @param notice - что известно о переносе заклинаний
 * @returns предупреждения
 */
function collectSpellWarnings(
  sheet: CharacterSheet,
  notice: SpellNotice,
): string[] {
  if (notice === 'unsupported') {
    return collectUnsupportedSpellWarnings(sheet);
  }

  if (notice === 'pending') {
    const count = collectSheetSpells(sheet, resolveTotalLevel(sheet)).length;

    return count > 0
      ? [
          `Заклинания (${count}) переносятся из компендиума мира; которых в `
            + 'мире нет, будут заведены в «Мастерской».',
        ]
      : [];
  }

  return collectSpellResultWarnings(notice);
}

/**
 * Собирает предупреждения о том, что лист несёт, а импорт не переносит.
 *
 * @param sheet - лист персонажа
 * @param spellNotice - что известно о переносе заклинаний
 * @returns список предупреждений для мастера импорта
 */
export function collectWarnings(
  sheet: CharacterSheet,
  spellNotice: SpellNotice = 'unsupported',
): string[] {
  const warnings = collectSpellWarnings(sheet, spellNotice);

  const featuresWithEffects = (sheet.features ?? []).filter(
    (feature) => (feature.activeEffects?.length ?? 0) > 0,
  );

  if (featuresWithEffects.length > 0) {
    warnings.push(
      'Эффекты черт не переносятся автоматически — описание черты перенесено, '
        + 'а сам эффект наложите на листе: '
        + `${featuresWithEffects.map((feature) => feature.name).join(', ')}.`,
    );
  }

  const exhaustion = sheet.health?.exhaustion ?? 0;

  if (exhaustion > 0) {
    warnings.push(
      `Истощение ${exhaustion} ур. не переносится — это состояние, наложите его на сцене.`,
    );
  }

  if (sheet.species?.lineageName) {
    warnings.push(
      `Происхождение «${sheet.species.lineageName}» переносится только названием вида — `
        + 'выборы вида проверьте в мастере вида на листе.',
    );
  }

  const unmappedBonusItems = collectUnmappedBonusItems(sheet);

  if (unmappedBonusItems.length > 0) {
    warnings.push(
      `Часть бонусов предметов не переведена в эффекты: ${unmappedBonusItems.join(', ')}.`,
    );
  }

  const notesCount = sheet.notes?.length ?? 0;

  if (notesCount > 0) {
    warnings.push(
      `Заметки листа (${notesCount}) не переносятся — форма заметок на сайте своя.`,
    );
  }

  return warnings;
}

/**
 * Собирает системные данные актёра D&D 5e.
 *
 * @param sheet - лист персонажа
 * @returns объект `actor.system`
 */
function buildActorSystem(sheet: CharacterSheet): DndActorSystem {
  const classes = buildClasses(sheet);
  const primaryClassKey = classes[0]?.classKey ?? '';
  const maxHitPoints = sheet.health?.max ?? 1;

  return {
    species: buildSpecies(sheet),
    background: buildBackground(sheet),
    classes,
    experience: sheet.experience?.current ?? 0,
    inspiration: sheet.inspiration ?? false,
    size: sizeByLabel(sheet.size),
    abilities: { ...sheet.abilities },
    movement: buildMovement(sheet),
    armorClass: buildArmorClass(sheet),
    hitPoints: {
      current: Math.min(maxHitPoints, sheet.health?.current ?? maxHitPoints),
      max: maxHitPoints,
      temp: sheet.health?.temporary ?? 0,
    },
    initiativeBonus: 0,
    initiativeAbility: resolveInitiativeAbility(sheet),
    proficiencies: buildProficiencies(sheet),
    currency: buildCurrency(sheet),
    carryingCapacity: buildCarryingCapacity(sheet),
    preparedSpells: buildPreparedLimit(
      sheet.spellcasting?.prepared,
      PREPARED_SPELLS_BONUS_ID,
    ),
    preparedCantrips: buildPreparedLimit(
      sheet.spellcasting?.preparedCantrips,
      PREPARED_CANTRIPS_BONUS_ID,
    ),
    cantripsTracked: true,
    ...buildUsedSpellSlots(sheet),
    classCounters: buildCounters(sheet, primaryClassKey),
  };
}

/**
 * Собирает настройки токена: картинка и зрение персонажа с листа.
 *
 * Картинка кладётся ИМЕННО в `token.imageUrl`: фишку на сцене рисует только
 * это поле, на `avatar` актёра сцена не смотрит — с одним лишь аватаром токен
 * остался бы пустым.
 *
 * @param sheet - лист персонажа
 * @param avatar - путь или ссылка на картинку (null — картинки нет)
 * @returns настройки токена актёра
 */
function buildToken(
  sheet: CharacterSheet,
  avatar: string | null,
): VttgActorCreateInput['token'] {
  const vision = sheet.vision ?? {};
  const darkvision = Number(vision.darkvision ?? 0);
  const normal = Number(vision.normal ?? 0);

  return {
    frameUrl: DEFAULT_TOKEN_FRAME_URL,
    showName: false,
    disposition: PLAYER_CHARACTER_DISPOSITION,
    ...(avatar ? { imageUrl: avatar } : {}),
    vision: {
      enabled: true,
      range: Number.isFinite(normal) ? normal : 0,
      darkvision: Number.isFinite(darkvision) ? darkvision : 0,
      angle: 360,
    },
  };
}

/** Что сборке черновика приносит сценарий импорта */
export interface DraftContext {
  /** ID пользователя, который импортирует (нет — неизвестен) */
  ownerId?: string | null;
  /**
   * Готовый путь к картинке: файл мира, если её удалось перенести, иначе
   * ссылка с листа. `undefined` — брать ссылку с листа как есть, `null` —
   * картинки нет.
   */
  avatar?: string | null;
  /** Итог переноса заклинаний (нет — приложение переносить их не умеет) */
  spellImport?: SpellImportResult;
}

/**
 * Собирает черновик актёра из листа персонажа.
 *
 * @param sheet - разобранный лист персонажа
 * @param options - настройки импорта
 * @param context - что принёс сценарий импорта: владелец, картинка, заклинания
 * @returns черновик актёра и список предупреждений
 */
export function buildActorDraft(
  sheet: CharacterSheet,
  options: ImportOptions,
  context: DraftContext = {},
): ActorDraft {
  const { ownerId = null, avatar, spellImport } = context;
  const description = options.importPersonality ? buildDescription(sheet) : '';
  const picture = avatar === undefined ? sheet.avatarUrl ?? null : avatar;

  const actor: CharacterActorInput = {
    name: options.name.trim() || sheet.name,
    ...(picture ? { avatar: picture } : {}),
    ...(description ? { description } : {}),
    token: buildToken(sheet, picture),
    isPublic: options.isPublic,
    ...(options.assignOwner && ownerId ? { ownerIds: [ownerId] } : {}),
    system: buildActorSystem(sheet),
    features: options.importFeatures ? buildFeatures(sheet) : [],
    equipment: options.importInventory ? buildInventory(sheet) : [],
    spells: spellImport?.spells ?? [],
    activeEffects: [],
    notes: '',
  };

  return {
    actor,
    warnings: collectWarnings(sheet, spellImport ?? 'unsupported'),
  };
}
