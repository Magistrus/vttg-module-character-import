/**
 * Zod-схема листа персонажа TTG Club (кнопка «Экспорт» на сайте).
 *
 * Схема НАМЕРЕННО мягкая: лист развивается вместе с сайтом, и незнакомое поле
 * не повод отказать в импорте. Обязательны только имя и характеристики — без
 * них актёра не собрать; всё остальное опционально и имеет значение по
 * умолчанию. Неизвестные поля схема пропускает как есть.
 *
 * @module sheet/schema
 */

import { z } from 'zod';

/**
 * Узел форматированного текста: либо готовая строка (часто с разметкой вида
 * `{@glossary текст|url:ключ}`), либо узел редактора с детьми.
 */
export const richNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), richObjectSchema, z.array(richNodeSchema)]),
);

/** Узел-объект редактора: тип, атрибуты, вложенное содержимое */
const richObjectSchema = z
  .object({
    type: z.string().optional(),
    text: z.string().optional(),
    attrs: z.record(z.unknown()).optional(),
    content: z.array(richNodeSchema).optional(),
  })
  .passthrough();

/**
 * Одно владение на листе. Обычно это строка («Всё простое оружие»), но сайт
 * отдаёт и ссылку на справочник — `{ name, url }` (так приходят инструменты:
 * «Инструменты каллиграфа» со ссылкой на предмет). Принимаем обе формы:
 * строгая схема на одну из них отклоняла бы весь лист целиком.
 */
const proficiencyEntrySchema = z.union([
  z.string(),
  z.object({ name: z.string(), url: z.string().optional() }).passthrough(),
]);

/** Значения характеристик листа */
const abilitiesSchema = z.object({
  strength: z.number(),
  dexterity: z.number(),
  constitution: z.number(),
  intelligence: z.number(),
  wisdom: z.number(),
  charisma: z.number(),
});

/** Счётчик ресурса, объявленный внутри черты */
const featureCounterSchema = z
  .object({
    key: z.string(),
    name: z.string().optional(),
    shortName: z.string().optional(),
    min: z.number().optional(),
    recovery: z.string().optional(),
  })
  .passthrough();

/** Черта, умение вида/класса или особенность предыстории */
const featureSchema = z
  .object({
    id: z.string().optional(),
    name: z.string(),
    description: z.array(richNodeSchema).optional(),
    origin: z.string().optional(),
    originName: z.string().optional(),
    level: z.number().nullable().optional(),
    counters: z.array(featureCounterSchema).optional(),
    // Форму элементов разбирает `sheet/spells`: одно непонятное заклинание
    // не должно отклонять весь лист.
    spells: z.array(z.unknown()).nullable().optional(),
    activeEffects: z.array(z.unknown()).optional(),
    // Сделанный выбор: `choice` — строка («Убеждение»), `choiceAnswers` —
    // ответы по ключам. Читаются в `convert/features` с проверкой формы.
    choice: z.unknown().optional(),
    choiceAnswers: z.unknown().optional(),
  })
  .passthrough();

/** Класс персонажа (основной или из мультикласса) */
const characterClassSchema = z
  .object({
    url: z.string().optional(),
    name: z.string().optional(),
    level: z.number().optional(),
    subclassUrl: z.string().nullable().optional(),
    subclassName: z.string().nullable().optional(),
    casterType: z.string().nullable().optional(),
    hitDie: z.number().optional(),
    spellcastingAbility: z.string().nullable().optional(),
  })
  .passthrough();

/** Вид персонажа */
const speciesSchema = z
  .object({
    url: z.string().optional(),
    name: z.string().optional(),
    lineageUrl: z.string().nullable().optional(),
    lineageName: z.string().nullable().optional(),
    innateSpells: z
      .array(
        z
          .object({
            spell: z.unknown(),
            requiredLevel: z.number().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

/** Предыстория персонажа */
const backgroundSchema = z
  .object({
    url: z.string().optional(),
    name: z.string().optional(),
    featUrl: z.string().nullable().optional(),
    abilityBonuses: z.record(z.number()).optional(),
  })
  .passthrough();

/** Навык листа: русское название, характеристика и уровень владения */
const skillSchema = z
  .object({
    name: z.string(),
    ability: z.string().optional(),
    proficiency: z.string().optional(),
  })
  .passthrough();

/** Спасбросок листа */
const savingThrowSchema = z
  .object({
    key: z.string().optional(),
    ability: z.string().optional(),
    proficient: z.boolean().optional(),
  })
  .passthrough();

/** Кость хитов одного размера */
const hitDiceSchema = z
  .object({
    die: z.number(),
    current: z.number().optional(),
    max: z.number().optional(),
  })
  .passthrough();

/** Счётчик ресурса на листе (очки удачи, ярость и т.д.) */
const classResourceSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    shortLabel: z.string().optional(),
    current: z.number().optional(),
    max: z.number().optional(),
    shortRest: z.object({ mode: z.string().optional() }).passthrough().optional(),
    longRest: z.object({ mode: z.string().optional() }).passthrough().optional(),
  })
  .passthrough();

/** Боевые характеристики оружия */
const weaponSchema = z
  .object({
    category: z.string().optional(),
    ranged: z.boolean().optional(),
    finesse: z.boolean().optional(),
    heavy: z.boolean().optional(),
    attackBonus: z.number().optional(),
    damage: z
      .object({
        diceCount: z.number().optional(),
        diceFaces: z.number().optional(),
        bonus: z.number().optional(),
        type: z.string().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    versatileDamage: z
      .object({
        diceCount: z.number().optional(),
        diceFaces: z.number().optional(),
        bonus: z.number().optional(),
        type: z.string().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

/** Характеристики доспеха */
const armorSchema = z
  .object({
    baseArmorClass: z.number().optional(),
    dexterityMod: z.string().optional(),
    shield: z.boolean().optional(),
    stealthDisadvantage: z.boolean().optional(),
  })
  .passthrough();

/** Числовой бонус предмета (магическое свойство) */
const itemBonusSchema = z
  .object({
    id: z.string().optional(),
    kind: z.string().optional(),
    key: z.string().optional(),
    value: z.union([z.number(), z.string()]).optional(),
    mode: z.string().optional(),
    priority: z.number().optional(),
  })
  .passthrough();

/** Предмет инвентаря */
const inventoryItemSchema = z
  .object({
    id: z.string().optional(),
    url: z.string().optional(),
    name: z.string(),
    category: z.string().optional(),
    typesLabel: z.string().optional(),
    cost: z.string().optional(),
    weight: z.number().optional(),
    quantity: z.number().optional(),
    armor: armorSchema.nullable().optional(),
    armorClassBonus: z.number().optional(),
    weapon: weaponSchema.nullable().optional(),
    equipped: z.boolean().optional(),
    twoHanded: z.boolean().optional(),
    requiresAttunement: z.boolean().optional(),
    attuned: z.boolean().optional(),
    passiveNote: z.string().optional(),
    // Своё описание есть у предметов, созданных на сайте (`custom:…`)
    description: z.array(richNodeSchema).optional(),
    bonuses: z.array(itemBonusSchema).optional(),
  })
  .passthrough();

/**
 * Ручная настройка лимита на листе: своё значение вместо расчётного и
 * прибавка к расчёту. Так устроены и подготовленные заклинания, и заговоры.
 */
const limitSettingsSchema = z
  .object({
    custom: z.number().nullable().optional(),
    bonus: z.number().optional(),
  })
  .passthrough();

/** Настройки грузоподъёмности на листе */
const carryingCapacitySchema = z
  .object({
    size: z.string().nullable().optional(),
    custom: z.number().nullable().optional(),
    bonus: z.number().optional(),
  })
  .passthrough();

/** Лист персонажа целиком */
export const characterSheetSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1, 'В листе нет имени персонажа'),
    avatarUrl: z.string().nullable().optional(),
    species: speciesSchema.nullable().optional(),
    size: z.string().nullable().optional(),
    features: z.array(featureSchema).optional(),
    spells: z.array(z.unknown()).optional(),
    spellSlots: z.array(z.unknown()).optional(),
    spellcasting: z
      .object({
        prepared: limitSettingsSchema.nullable().optional(),
        preparedCantrips: limitSettingsSchema.nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    carryingCapacity: carryingCapacitySchema.nullable().optional(),
    characterClass: characterClassSchema.nullable().optional(),
    additionalClasses: z.array(characterClassSchema).optional(),
    characterBackground: backgroundSchema.nullable().optional(),
    level: z.number().optional(),
    experience: z
      .object({ current: z.number().optional() })
      .passthrough()
      .nullable()
      .optional(),
    inspiration: z.boolean().optional(),
    armorClass: z
      .object({
        base: z.number().optional(),
        natural: z.boolean().optional(),
        custom: z.boolean().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    speed: z
      .object({
        values: z.record(z.number()).optional(),
        hover: z.boolean().optional(),
        unit: z.string().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    vision: z.record(z.union([z.number(), z.string()])).nullable().optional(),
    abilities: abilitiesSchema,
    skills: z.array(skillSchema).optional(),
    savingThrows: z.array(savingThrowSchema).optional(),
    health: z
      .object({
        current: z.number().optional(),
        max: z.number().optional(),
        temporary: z.number().optional(),
        exhaustion: z.number().optional(),
        levelGains: z
          .array(
            z
              .object({
                level: z.number().optional(),
                amount: z.number().optional(),
                classUrl: z.string().nullable().optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    hitDice: z.array(hitDiceSchema).optional(),
    classResources: z.array(classResourceSchema).optional(),
    proficiencies: z
      .object({
        armor: z.array(proficiencyEntrySchema).optional(),
        weapons: z.array(proficiencyEntrySchema).optional(),
        weaponMasteries: z.array(proficiencyEntrySchema).optional(),
        tools: z.array(proficiencyEntrySchema).optional(),
        languages: z.array(proficiencyEntrySchema).optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    currency: z.record(z.number()).nullable().optional(),
    inventory: z.array(inventoryItemSchema).optional(),
    notes: z.array(z.unknown()).optional(),
    settings: z
      .object({
        initiativeAbility: z.string().nullable().optional(),
        weaponAttackAbility: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    personality: z
      .object({
        alignment: z.string().optional(),
        age: z.string().optional(),
        height: z.string().optional(),
        weight: z.string().optional(),
        eyes: z.string().optional(),
        hair: z.string().optional(),
        skin: z.string().optional(),
        description: z.string().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

/** Лист персонажа TTG Club после разбора */
export type CharacterSheet = z.infer<typeof characterSheetSchema>;

/** Черта листа */
export type SheetFeature = z.infer<typeof featureSchema>;

/** Предмет инвентаря листа */
export type SheetInventoryItem = z.infer<typeof inventoryItemSchema>;

/** Класс листа */
export type SheetCharacterClass = z.infer<typeof characterClassSchema>;

/** Счётчик ресурса листа */
export type SheetClassResource = z.infer<typeof classResourceSchema>;
