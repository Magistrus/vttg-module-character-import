/**
 * Активные эффекты листа → эффекты актёра системы `dnd5e-2024`.
 *
 * На листе TTG Club эффекты живут у черт и умений («Улучшение характеристик»
 * даёт Мудрость +2, «Наследие фей» — преимущество на спасброски) и у самого
 * персонажа (наложенные вручную). Система хранит эффекты только у актёра и у
 * предметов, поэтому:
 *
 * - эффект «на себя» ложится на актёра с отметкой, от какого он умения;
 * - эффект «на цель» (Божественный канал, «Предупреждающая вспышка») система
 *   держит у предмета или заклинания, но не у умения — переносить его некуда,
 *   он попадает в предупреждения;
 * - изменения и флаги, которых система не знает (у сайта словарь шире:
 *   `sense.tremorsense`, `save.advantage.vsPoisoned`), отбрасываются и
 *   называются в предупреждениях; эффект, у которого после этого ничего не
 *   осталось, не переносится — пустой эффект на листе только сбивал бы с толку.
 *
 * Действия по использованию (`activation`, `triggers`, урон и спасбросок
 * наложения) система у эффекта актёра не исполняет — они не переносятся.
 *
 * Словари ключей сверены с `src/engine/activeEffectTypes.ts` системы.
 *
 * @module convert/effects
 */

import type { CharacterSheet } from '@/sheet/schema';
import type {
  DndActorActiveEffect,
  DndEffectChange,
  DndEffectDuration,
} from '@/types/dnd5e';

import { z } from 'zod';

import { resolveFeatureId } from './features';

/** Приоритет изменения по умолчанию (как у системы) */
const DEFAULT_PRIORITY = 20;

/** Предел эффектов у актёра (`MAX_EFFECTS_PER_ACTOR` системы) */
export const MAX_ACTOR_EFFECTS = 50;

/** Предел изменений в эффекте (`MAX_CHANGES_PER_EFFECT` системы) */
const MAX_EFFECT_CHANGES = 40;

const ABILITIES = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
] as const;

const SKILLS = [
  'acrobatics',
  'animalHandling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleightOfHand',
  'stealth',
  'survival',
] as const;

const MOVEMENTS = ['walk', 'burrow', 'climb', 'fly', 'swim'] as const;

const DEFENSIBLE_DAMAGE_TYPES = [
  'slashing',
  'piercing',
  'bludgeoning',
  'fire',
  'cold',
  'lightning',
  'thunder',
  'poison',
  'acid',
  'necrotic',
  'radiant',
  'force',
  'psychic',
] as const;

/** Ключи числовых изменений системы (`EffectTargetKey`) */
const CHANGE_KEYS: ReadonlySet<string> = new Set([
  ...ABILITIES.map((ability) => `ability.${ability}`),
  ...ABILITIES.map((ability) => `save.${ability}`),
  ...SKILLS.map((skill) => `skill.${skill}`),
  ...MOVEMENTS.map((movement) => `movement.${movement}`),
  'attack.melee',
  'attack.ranged',
  'attack.spell',
  'damage.melee',
  'damage.ranged',
  'damage.spell',
  'armorClass',
  'hitPoints.max',
  'hitPoints.temp',
  'initiative',
  'proficiencyBonus',
  'spellSaveDC',
]);

/** Флаги системы (`EffectFlagKey`) */
const FLAG_KEYS: ReadonlySet<string> = new Set([
  'attack.advantage',
  'attack.disadvantage',
  'attack.melee.advantage',
  'attack.melee.disadvantage',
  'attack.ranged.advantage',
  'attack.ranged.disadvantage',
  'attack.spell.advantage',
  'attack.spell.disadvantage',
  'attacksAgainst.advantage',
  'attacksAgainst.disadvantage',
  'abilityCheck.advantage',
  'abilityCheck.disadvantage',
  ...ABILITIES.map((ability) => `abilityCheck.advantage.${ability}`),
  ...ABILITIES.map((ability) => `abilityCheck.disadvantage.${ability}`),
  'skill.stealth.disadvantage',
  'save.advantage',
  'save.disadvantage',
  ...ABILITIES.map((ability) => `save.advantage.${ability}`),
  ...ABILITIES.map((ability) => `save.disadvantage.${ability}`),
  ...ABILITIES.map((ability) => `save.autoFail.${ability}`),
  'speed.zero',
  'incapacitated',
  'initiative.advantage',
  'initiative.disadvantage',
  'vision.blinded',
  'vision.invisible',
  'defense.critImmunity',
  ...DEFENSIBLE_DAMAGE_TYPES.flatMap((type) => [
    `resistance.${type}`,
    `immunity.${type}`,
    `vulnerability.${type}`,
  ]),
]);

/** Режимы изменений системы (`EffectChangeMode`) */
const CHANGE_MODES: ReadonlySet<string> = new Set([
  'add',
  'multiply',
  'override',
  'upgrade',
  'downgrade',
  'custom',
]);

/** Состояния системы (`ConditionKey`) */
const CONDITION_KEYS: ReadonlySet<string> = new Set([
  'blinded',
  'charmed',
  'deafened',
  'exhaustion',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
]);

/** Виды длительности системы */
const DURATION_TYPES: ReadonlyArray<DndEffectDuration['type']> = [
  'permanent',
  'rounds',
  'minutes',
  'hours',
  'days',
  'turn',
  'special',
];

/** Источники эффекта, которые система принимает у актёра */
const ACTOR_ORIGINS: ReadonlyArray<DndActorActiveEffect['origin']> = [
  'feature',
  'manual',
  'condition',
  'spell',
  'item',
];

/**
 * Проверяет вид длительности.
 *
 * @param value - вид с листа
 * @returns true, если система его знает
 */
function isDurationType(value: string): value is DndEffectDuration['type'] {
  return DURATION_TYPES.some((type) => type === value);
}

/**
 * Проверяет источник эффекта.
 *
 * @param value - источник с листа
 * @returns true, если система принимает его у актёра
 */
function isActorOrigin(
  value: string | undefined,
): value is DndActorActiveEffect['origin'] {
  return ACTOR_ORIGINS.some((origin) => origin === value);
}

/** Эффект на листе: поля, которые читает модуль */
const sheetEffectSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1),
    description: z.string().optional(),
    icon: z.string().optional(),
    disabled: z.boolean().optional(),
    origin: z.string().optional(),
    effectTarget: z.string().optional(),
    duration: z
      .object({
        type: z.string(),
        value: z.number().optional(),
        turnAnchor: z.enum(['carrier', 'source']).optional(),
        turnTiming: z.enum(['start', 'end']).optional(),
      })
      .passthrough()
      .optional(),
    changes: z
      .array(
        z
          .object({
            key: z.string(),
            mode: z.string().optional(),
            value: z.union([z.string(), z.number()]),
            priority: z.number().optional(),
          })
          .passthrough(),
      )
      .optional(),
    flags: z.array(z.string()).optional(),
    conditionKey: z.string().optional(),
  })
  .passthrough();

type SheetEffect = z.infer<typeof sheetEffectSchema>;

/** Эффект с листа вместе с тем, откуда он */
interface SheetEffectSource {
  /** Эффект с листа (ещё не разобранный) */
  entry: unknown;
  /** Название умения (нет — эффект самого персонажа) */
  featureName?: string;
  /** ID особенности на листе актёра */
  featureId?: string;
}

/** Что накопилось при переносе эффектов */
interface EffectReport {
  /** Предупреждения об отдельных эффектах */
  warnings: string[];
  /** Подписи эффектов «на цель» — о них одно общее предупреждение */
  targetLabels: string[];
}

/** Итог переноса эффектов */
export interface EffectImportResult {
  /** Эффекты для `actor.activeEffects` */
  effects: DndActorActiveEffect[];
  /** Что перенести не удалось — для мастера импорта */
  warnings: string[];
}

/**
 * Переводит длительность эффекта в форму системы.
 *
 * @param duration - длительность с листа
 * @returns длительность системы; незнакомая — «особая»
 */
function toDuration(duration: SheetEffect['duration']): DndEffectDuration {
  if (!duration) {
    return { type: 'permanent' };
  }

  const { type } = duration;

  if (!isDurationType(type)) {
    return { type: 'special' };
  }

  const value =
    duration.value !== undefined
    && Number.isInteger(duration.value)
    && duration.value >= 0
      ? duration.value
      : undefined;

  return {
    type,
    ...(value !== undefined ? { value } : {}),
    ...(duration.turnAnchor ? { turnAnchor: duration.turnAnchor } : {}),
    ...(duration.turnTiming ? { turnTiming: duration.turnTiming } : {}),
  };
}

/**
 * Отбирает изменения, которые система умеет применять.
 *
 * @param changes - изменения с листа
 * @param dropped - сюда складываются ключи отброшенных изменений
 * @returns изменения в форме системы
 */
function toChanges(
  changes: SheetEffect['changes'],
  dropped: string[],
): DndEffectChange[] {
  return (changes ?? []).flatMap((change): DndEffectChange[] => {
    const value = String(change.value).trim();
    const mode = change.mode ?? 'add';

    if (!CHANGE_KEYS.has(change.key) || !CHANGE_MODES.has(mode) || !value) {
      dropped.push(change.key);

      return [];
    }

    const priority =
      change.priority !== undefined
      && Number.isInteger(change.priority)
      && change.priority >= 0
      && change.priority <= 100
        ? change.priority
        : DEFAULT_PRIORITY;

    return [{ key: change.key, mode, value, priority }];
  });
}

/**
 * Подпись эффекта в предупреждении: «Знание камня» или «Эффект (Умение)».
 *
 * @param effect - эффект с листа
 * @param featureName - умение-источник
 * @returns подпись
 */
function describeEffect(effect: SheetEffect, featureName?: string): string {
  return featureName && featureName !== effect.name
    ? `«${effect.name}» (${featureName})`
    : `«${effect.name}»`;
}

/**
 * Переносит один эффект.
 *
 * @param source - эффект и его умение
 * @param index - номер эффекта на листе (для ID без своего)
 * @param report - сюда складываются предупреждения и эффекты «на цель»
 * @returns эффект актёра или null, если переносить нечего
 */
function toActorEffect(
  source: SheetEffectSource,
  index: number,
  report: EffectReport,
): DndActorActiveEffect | null {
  const { warnings } = report;
  const parsed = sheetEffectSchema.safeParse(source.entry);

  if (!parsed.success) {
    return null;
  }

  const effect = parsed.data;
  const label = describeEffect(effect, source.featureName);

  if (effect.effectTarget === 'target') {
    report.targetLabels.push(label);

    return null;
  }

  const dropped: string[] = [];
  const changes = toChanges(effect.changes, dropped).slice(0, MAX_EFFECT_CHANGES);

  const flags = (effect.flags ?? []).filter((flag) => {
    const known = FLAG_KEYS.has(flag);

    if (!known) {
      dropped.push(flag);
    }

    return known;
  });

  const conditionKey =
    effect.conditionKey && CONDITION_KEYS.has(effect.conditionKey)
      ? effect.conditionKey
      : undefined;

  if (changes.length === 0 && flags.length === 0 && !conditionKey) {
    warnings.push(
      dropped.length > 0
        ? `${label}: система не знает ${dropped.join(', ')} — эффект не перенесён.`
        : `${label}: у эффекта нет изменений, которые система применяет, — `
          + 'он не перенесён.',
    );

    return null;
  }

  if (dropped.length > 0) {
    warnings.push(
      `${label}: перенесён без ${dropped.join(', ')} — этого система не знает.`,
    );
  }

  const fallbackOrigin: DndActorActiveEffect['origin'] = source.featureId
    ? 'feature'
    : 'manual';

  const origin = isActorOrigin(effect.origin) ? effect.origin : fallbackOrigin;

  return {
    id: effect.id ?? `sheet-effect-${index + 1}`,
    name: effect.name,
    description: effect.description ?? '',
    ...(effect.icon ? { icon: effect.icon } : {}),
    disabled: effect.disabled ?? false,
    origin,
    ...(source.featureId ? { originId: source.featureId } : {}),
    transfer: false,
    duration: toDuration(effect.duration),
    changes,
    flags,
    ...(conditionKey ? { conditionKey } : {}),
  };
}

/**
 * Делает ID эффектов уникальными: два умения могут принести эффект с одним ID.
 *
 * @param effects - эффекты актёра
 * @returns те же эффекты с неповторяющимися ID
 */
function withUniqueIds(effects: DndActorActiveEffect[]): DndActorActiveEffect[] {
  const seen = new Map<string, number>();

  return effects.map((effect) => {
    const count = seen.get(effect.id) ?? 0;

    seen.set(effect.id, count + 1);

    return count === 0 ? effect : { ...effect, id: `${effect.id}-${count + 1}` };
  });
}

/**
 * Переносит эффекты умений и самого персонажа на актёра.
 *
 * @param sheet - лист персонажа
 * @param linkFeatures - переносятся ли умения: тогда эффект ссылается на своё
 * @returns эффекты актёра и предупреждения о том, что не перенесено
 */
export function buildActorEffects(
  sheet: CharacterSheet,
  linkFeatures: boolean,
): EffectImportResult {
  const sources: SheetEffectSource[] = [
    ...(sheet.features ?? []).flatMap((feature, index) =>
      (feature.activeEffects ?? []).map(
        (entry): SheetEffectSource => ({
          entry,
          featureName: feature.name,
          ...(linkFeatures ? { featureId: resolveFeatureId(feature, index) } : {}),
        }),
      ),
    ),
    ...(sheet.activeEffects ?? []).map((entry): SheetEffectSource => ({ entry })),
  ];

  const report: EffectReport = { warnings: [], targetLabels: [] };

  const effects = withUniqueIds(
    sources
      .map((source, index) => toActorEffect(source, index, report))
      .filter((effect): effect is DndActorActiveEffect => effect !== null),
  );

  const { warnings, targetLabels } = report;

  if (targetLabels.length > 0) {
    warnings.push(
      'Эффекты на цель не переносятся — система хранит их у предмета или '
        + `заклинания, а не у умения; накладывайте их на сцене: ${targetLabels.join(', ')}.`,
    );
  }

  if (effects.length > MAX_ACTOR_EFFECTS) {
    warnings.push(
      `Эффектов ${effects.length}, а система держит у актёра не больше `
        + `${MAX_ACTOR_EFFECTS} — перенесены первые ${MAX_ACTOR_EFFECTS}.`,
    );
  }

  return { effects: effects.slice(0, MAX_ACTOR_EFFECTS), warnings };
}
