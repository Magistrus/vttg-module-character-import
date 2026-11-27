import { describe, expect, it } from 'vitest';

import { parseSheetText } from '@/sheet/parse';

import { buildActorEffects } from './effects';

/** Лист с эффектами умений — формы взяты из экспорта жреца TTG Club */
const sheet = parseSheetText(
  JSON.stringify({
    name: 'Жрец',
    abilities: {
      strength: 10,
      dexterity: 10,
      constitution: 11,
      intelligence: 11,
      wisdom: 11,
      charisma: 10,
    },
    features: [
      {
        id: 'class:cleric-phb:ulucsenie-harakteristik:4',
        name: 'Улучшение характеристик',
        activeEffects: [
          {
            id: 'asi-4',
            name: 'Улучшение характеристик (Мдр, 4 ур.)',
            icon: 'tabler:trending-up',
            disabled: false,
            origin: 'feature',
            transfer: false,
            duration: { type: 'permanent' },
            changes: [
              { key: 'ability.wisdom', mode: 'add', value: '2', priority: 20 },
            ],
            flags: [],
            effectTarget: 'self',
          },
        ],
      },
      {
        id: 'species:Тёмное зрение',
        name: 'Наследие фей',
        activeEffects: [
          {
            id: 'fey-ancestry',
            name: 'Наследие фей',
            description: 'Преимущество на спасброски против состояния Очарованный.',
            disabled: false,
            origin: 'feature',
            duration: { type: 'permanent' },
            changes: [],
            flags: ['save.advantage.vsCharmed', 'save.advantage.wisdom'],
          },
        ],
      },
      {
        id: 'species:Знание камня',
        name: 'Знание камня',
        activeEffects: [
          {
            id: 'stonecunning',
            name: 'Знание камня',
            disabled: true,
            origin: 'feature',
            duration: { type: 'minutes', value: 10 },
            changes: [
              { key: 'sense.tremorsense', mode: 'upgrade', value: '60', priority: 20 },
            ],
            flags: [],
            activation: { mode: 'use', counter: 'stonecunning' },
          },
        ],
      },
      {
        id: 'class:cleric-phb:bozhestvennyj-kanal',
        name: 'Божественный канал',
        activeEffects: [
          {
            id: 'turn-undead',
            name: 'Изгнание нежити',
            disabled: true,
            origin: 'feature',
            duration: { type: 'minutes', value: 1 },
            changes: [],
            flags: ['attack.disadvantage'],
            effectTarget: 'target',
            conditionKey: 'frightened',
          },
        ],
      },
    ],
    activeEffects: [
      {
        name: 'Благословение',
        origin: 'spell',
        duration: { type: 'rounds', value: 10 },
        changes: [{ key: 'attack.melee', mode: 'add', value: '1к4' }],
      },
    ],
  }),
);

describe('перенос эффектов', () => {
  const { effects, warnings } = buildActorEffects(sheet, true);

  it('эффект «на себя» ложится на актёра со ссылкой на умение', () => {
    expect(effects[0]).toEqual({
      id: 'asi-4',
      name: 'Улучшение характеристик (Мдр, 4 ур.)',
      description: '',
      icon: 'tabler:trending-up',
      disabled: false,
      origin: 'feature',
      originId: 'class:cleric-phb:ulucsenie-harakteristik:4',
      transfer: false,
      duration: { type: 'permanent' },
      changes: [{ key: 'ability.wisdom', mode: 'add', value: '2', priority: 20 }],
      flags: [],
    });
  });

  it('незнакомый флаг отбрасывается, знакомые остаются', () => {
    const fey = effects.find((effect) => effect.id === 'fey-ancestry');

    expect(fey?.flags).toEqual(['save.advantage.wisdom']);
    expect(warnings).toContain(
      '«Наследие фей»: перенесён без save.advantage.vsCharmed — этого система не знает.',
    );
  });

  it('эффект без понятных системе изменений не переносится', () => {
    expect(effects.some((effect) => effect.id === 'stonecunning')).toBe(false);
    expect(warnings).toContain(
      '«Знание камня»: система не знает sense.tremorsense — эффект не перенесён.',
    );
  });

  it('эффект на цель не переносится и называется в предупреждениях', () => {
    expect(effects.some((effect) => effect.id === 'turn-undead')).toBe(false);
    expect(
      warnings.some((warning) =>
        warning.startsWith('Эффекты на цель не переносятся')
        && warning.includes('«Изгнание нежити» (Божественный канал)'),
      ),
    ).toBe(true);
  });

  it('эффект самого персонажа переносится без ссылки на умение', () => {
    expect(effects.at(-1)).toEqual({
      id: 'sheet-effect-5',
      name: 'Благословение',
      description: '',
      disabled: false,
      origin: 'spell',
      transfer: false,
      duration: { type: 'rounds', value: 10 },
      changes: [{ key: 'attack.melee', mode: 'add', value: '1к4', priority: 20 }],
      flags: [],
    });
  });

  it('без переноса умений эффект на них не ссылается', () => {
    const unlinked = buildActorEffects(sheet, false).effects;

    expect(unlinked.every((effect) => effect.originId === undefined)).toBe(true);
  });
});
