/**
 * Форма актёра игровой системы `dnd5e-2024` — цель конвертации.
 *
 * Хост про эти поля ничего не знает: он передаёт `system` и корневые
 * коллекции на сервер как есть. Источник правды — исходники системы
 * (`src/engine/types.ts`, `classTypes.ts`, `speciesTypes.ts`,
 * `backgroundTypes.ts`, `dndEntities.ts`); здесь описано ровно то, что
 * модуль заполняет. Поля, которых модуль не касается, опущены — система
 * достраивает их сама значениями по умолчанию.
 *
 * @module types/dnd5e
 */

/** Характеристика D&D 5e */
export type DndAbility =
  | 'strength'
  | 'dexterity'
  | 'constitution'
  | 'intelligence'
  | 'wisdom'
  | 'charisma';

/** Навык D&D 5e */
export type DndSkill =
  | 'acrobatics'
  | 'animalHandling'
  | 'arcana'
  | 'athletics'
  | 'deception'
  | 'history'
  | 'insight'
  | 'intimidation'
  | 'investigation'
  | 'medicine'
  | 'nature'
  | 'perception'
  | 'performance'
  | 'persuasion'
  | 'religion'
  | 'sleightOfHand'
  | 'stealth'
  | 'survival';

/** Уровень владения навыком */
export type DndProficiencyLevel = 'none' | 'half' | 'proficient' | 'expertise';

/** Размер существа */
export type DndCreatureSize =
  | 'tiny'
  | 'small'
  | 'medium'
  | 'large'
  | 'huge'
  | 'gargantuan';

/** Кость хитов */
export type DndHitDie = 6 | 8 | 10 | 12;

/** Тип заклинателя */
export type DndCasterType = 'full' | 'half' | 'third' | 'pact' | 'none';

/** Способ получения хитов на уровне */
export type DndHitPointMethod = 'roll' | 'average' | 'max' | 'custom';

/** Тип восстановления счётчика ресурса */
export type DndCounterRecovery = 'short' | 'long';

/** Тип урона */
export type DndDamageType =
  | 'slashing'
  | 'piercing'
  | 'bludgeoning'
  | 'fire'
  | 'cold'
  | 'lightning'
  | 'thunder'
  | 'acid'
  | 'poison'
  | 'necrotic'
  | 'radiant'
  | 'force'
  | 'psychic';

/** Категория оружия */
export type DndWeaponCategory =
  | 'simple'
  | 'martial'
  | 'improvised'
  | 'natural';

/** Категория снаряжения (доспехи и прочее) */
export type DndEquipmentCategory =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'shield'
  | 'clothing'
  | 'ring'
  | 'wand'
  | 'trinket'
  | 'other';

/** Тип предмета */
export type DndItemType = 'weapon' | 'equipment' | 'tool' | 'feat';

/** Редкость предмета */
export type DndItemRarity =
  | 'none'
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'very-rare'
  | 'legendary'
  | 'artifact';

/** Передвижение персонажа */
export interface DndMovement {
  /** Скорость ходьбы */
  walk: number;
  /** Скорость плавания */
  swim: number;
  /** Скорость полёта */
  fly: number;
  /** Скорость лазания */
  climb: number;
  /** Скорость копания */
  burrow: number;
  /** Парит ли существо */
  hover: boolean;
  /** Единица измерения */
  units: 'ft' | 'm';
}

/** Класс доспеха */
export interface DndArmorClass {
  /** Итоговое значение (для `flat`/`natural`) */
  value: number;
  /** Способ расчёта */
  calculation: 'default' | 'natural' | 'flat' | 'custom';
  /** Формула (для `custom`) */
  formula: string;
  /** Фиксированное значение (для `flat`) */
  flat: number | null;
}

/** Хиты персонажа */
export interface DndHitPoints {
  /** Текущие хиты */
  current: number;
  /** Максимум хитов */
  max: number;
  /** Временные хиты */
  temp: number;
}

/** Владения персонажа */
export interface DndProficiencies {
  /** Доспехи */
  armor: string[];
  /** Оружие */
  weapons: string[];
  /** Оружейные приёмы */
  weaponMasteries: string[];
  /** Инструменты */
  tools: string[];
  /** Языки */
  languages: string[];
  /** Спасброски */
  savingThrows: DndAbility[];
  /** Навыки */
  skills: Partial<Record<DndSkill, DndProficiencyLevel>>;
}

/** Валюта персонажа */
export interface DndCurrency {
  /** Медь */
  cp: number;
  /** Серебро */
  sp: number;
  /** Электрум */
  ep: number;
  /** Золото */
  gp: number;
  /** Платина */
  pp: number;
}

/** Хиты, полученные на конкретном уровне */
export interface DndHitPointGain {
  /** Уровень */
  level: number;
  /** Способ получения */
  method: DndHitPointMethod;
  /** Значение без модификатора Телосложения */
  rolled: number;
}

/** Класс, принятый персонажем */
export interface DndClassEntry {
  /** Ключ класса (`fighter`) */
  classKey: string;
  /** Название класса */
  className: string;
  /** Уровень в этом классе */
  level: number;
  /** Ключ подкласса (null — не выбран) */
  subclassKey: string | null;
  /** Кость хитов */
  hitDie: DndHitDie;
  /** Потрачено костей хитов */
  hitDiceUsed: number;
  /** История получения хитов по уровням */
  hitPointsGained: DndHitPointGain[];
  /** Навыки, выбранные при получении класса */
  chosenSkills: DndSkill[];
  /** Выбранные варианты особенностей */
  featureChoices: Record<string, string>;
  /** Характеристика заклинателя */
  spellcastingAbility?: DndAbility;
  /** Тип заклинателя */
  casterType?: DndCasterType;
}

/** Вид персонажа */
export interface DndSpeciesEntry {
  /** Ключ вида (`dwarf`) */
  speciesKey: string;
  /** Название вида */
  speciesName: string;
  /** Тип существа */
  creatureType: string;
  /** Размер */
  size: DndCreatureSize;
  /** Выбранные варианты особенностей */
  featureChoices: Record<string, string>;
  /** Выборы даров по уровням */
  grantChoices: Record<number, string[]>;
}

/** Предыстория персонажа */
export interface DndBackgroundEntry {
  /** Ключ предыстории (`soldier`) */
  backgroundKey: string;
  /** Название предыстории */
  backgroundName: string;
  /** Повышения характеристик */
  abilityChoices: Partial<Record<DndAbility, number>>;
  /** Навыки от предыстории */
  skillChoices: DndSkill[];
  /** Инструменты от предыстории */
  toolChoices: string[];
  /** Название черты происхождения */
  grantedFeatName?: string;
}

/**
 * Прибавка к лимиту подготовленных заклинаний (или заговоров). Система хранит
 * их списком, чтобы у каждой был свой источник; лист сайта даёт одно число,
 * поэтому из листа получается не больше одной записи.
 */
export interface DndLimitBonus {
  /** Идентификатор записи */
  id: string;
  /** Вид прибавки: плоское число */
  kind: 'flat';
  /** Характеристика (для плоской прибавки система её не читает) */
  ability: DndAbility;
  /** Величина прибавки */
  value: number;
  /** Подпись источника на листе */
  label: string;
}

/** Ручная настройка лимита подготовленных заклинаний или заговоров */
export interface DndPreparedLimit {
  /** Своё значение вместо расчётного (null — считать по классу) */
  custom: number | null;
  /** Прибавки к расчётному значению */
  bonuses: DndLimitBonus[];
}

/** Настройки грузоподъёмности */
export interface DndCarryingCapacity {
  /** Размер для расчёта (null — размер существа) */
  size: DndCreatureSize | null;
  /** Своё значение вместо расчётного (null — считать по Силе) */
  custom: number | null;
  /** Прибавка к расчётному значению */
  bonus: number;
}

/** Состояние счётчика ресурса на актёре */
export interface DndCounterState {
  /** Ключ счётчика */
  counterKey: string;
  /** Ключ класса-владельца */
  classKey: string;
  /** Название счётчика */
  name?: string;
  /** Краткое название */
  shortName?: string;
  /** Тип восстановления */
  recovery?: DndCounterRecovery;
  /** Текущее значение */
  current: number;
  /** Максимум */
  max: number;
}

/** Особенность актёра (черта, умение вида/класса) */
export interface DndFeature {
  /** Идентификатор */
  id: string;
  /** Название */
  name: string;
  /** Описание (markdown) */
  description: string;
  /** Уровень получения */
  level?: number;
  /** Тип особенности */
  featureType?: 'species' | 'class' | 'subclass' | 'feat' | 'background' | 'custom';
  /** Кто выдал особенность (имя класса/вида) */
  grantedBy?: string;
}

/** Часть урона оружия */
export interface DndDamagePart {
  /** Формула урона (`2к6+@mod.str`) */
  formula: string;
  /** Тип урона */
  type?: DndDamageType;
  /** Альтернативная формула для двуручного хвата */
  versatileFormula?: string;
}

/** Числовое изменение, которое даёт активный эффект */
export interface DndEffectChange {
  /** Что меняем (`ability.strength`, `armorClass`) */
  key: string;
  /** Как меняем (`add`, `upgrade`, `override`) */
  mode: string;
  /** Значение или формула */
  value: string;
  /** Приоритет применения */
  priority: number;
}

/**
 * Активный эффект предмета.
 *
 * С `transfer: true` система переносит его на носителя при экипировке — ровно
 * как на листе сайта, где бонус работает у надетого предмета.
 */
export interface DndItemActiveEffect {
  /** Идентификатор эффекта */
  id: string;
  /** Название (видно на листе) */
  name: string;
  /** Описание эффекта */
  description: string;
  /** Отключён ли эффект */
  disabled: boolean;
  /** Источник эффекта */
  origin: 'item';
  /** ID предмета-источника */
  originId: string;
  /** Переносится ли на носителя при экипировке */
  transfer: boolean;
  /** Длительность */
  duration: { type: 'permanent' };
  /** Числовые изменения */
  changes: DndEffectChange[];
  /** Булевые флаги (модуль их не выставляет) */
  flags: string[];
}

/** Предмет инвентаря актёра */
export interface DndGameItem {
  /** Идентификатор */
  id: string;
  /** Название */
  name: string;
  /** Описание */
  description: string;
  /** Тип предмета */
  type: DndItemType;
  /** Подпись типа для UI */
  typeLabel?: string;
  /** Количество */
  quantity: number;
  /** Вес в фунтах */
  weight: number;
  /** Стоимость */
  cost: string;
  /** Редкость */
  rarity: DndItemRarity;
  /** Экипирован ли */
  equipped: boolean;
  /** Только для чтения */
  isReadOnly: boolean;
  /** Активные эффекты предмета (переносятся на носителя при экипировке) */
  activeEffects?: DndItemActiveEffect[];
  /** Магический ли предмет */
  isMagical?: boolean;
  /** Требуется ли настройка */
  magicAttunement?: 'none' | 'required' | 'optional';
  /** Настроен ли */
  isAttuned?: boolean;
  // --- Оружие ---
  /** Категория оружия */
  weaponCategory?: DndWeaponCategory;
  /** Тип дальности */
  rangeType?: 'melee' | 'ranged';
  /** Части урона */
  damageParts?: DndDamagePart[];
  /** Свойства оружия */
  weaponProperties?: string[];
  /** Дополнительный бонус к атаке */
  attackBonus?: number;
  // --- Доспех ---
  /** Категория снаряжения */
  equipmentCategory?: DndEquipmentCategory;
  /** Базовый КД доспеха (для щита — бонус) */
  baseArmorAC?: number;
  /** Максимальный бонус Ловкости (null — без ограничения) */
  maxDexBonus?: number | null;
  /** Помеха на Скрытность */
  stealthDisadvantage?: boolean;
}

/**
 * Системные данные актёра D&D 5e (`actor.system`).
 *
 * Псевдоним типа, а не интерфейс: ядро принимает `system` как
 * `Record<string, unknown>`, а интерфейс без индексной сигнатуры туда не
 * присваивается.
 */
export type DndActorSystem = {
  /** Вид */
  species: DndSpeciesEntry | null;
  /** Предыстория */
  background: DndBackgroundEntry | null;
  /** Классы (мультикласс — несколько записей) */
  classes: DndClassEntry[];
  /** Опыт */
  experience: number;
  /** Вдохновение */
  inspiration: boolean;
  /** Размер */
  size: DndCreatureSize;
  /** Характеристики */
  abilities: Record<DndAbility, number>;
  /** Передвижение */
  movement: DndMovement;
  /** Класс доспеха */
  armorClass: DndArmorClass;
  /** Хиты */
  hitPoints: DndHitPoints;
  /** Дополнительный бонус инициативы */
  initiativeBonus: number;
  /** Характеристика инициативы */
  initiativeAbility: DndAbility;
  /** Владения */
  proficiencies: DndProficiencies;
  /** Деньги */
  currency: DndCurrency;
  /** Настройки грузоподъёмности */
  carryingCapacity: DndCarryingCapacity;
  /** Настройка лимита подготовленных заклинаний */
  preparedSpells: DndPreparedLimit;
  /** Настройка лимита заговоров */
  preparedCantrips: DndPreparedLimit;
  /** Считать ли заговоры против лимита (так ведёт себя новый актёр системы) */
  cantripsTracked: boolean;
  /** Потраченные ячейки заклинаний (индекс 0 — 1-й круг) */
  spellSlotsUsed: number[];
  /** Потраченные ячейки договора (колдун) */
  pactSlotsUsed: number;
  /** Счётчики ресурсов */
  classCounters: DndCounterState[];
};
