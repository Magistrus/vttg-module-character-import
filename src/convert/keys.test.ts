import { describe, expect, it } from 'vitest';

import {
  isAbilityKey,
  sizeByLabel,
  skillKeyByLabel,
  toCreatureSizeOrNull,
  toDamageType,
  toProficiencyLevel,
  urlToKey,
  urlToSourceKey,
} from './keys';

describe('urlToKey', () => {
  it('снимает хвост источника', () => {
    expect(urlToKey('dwarf-phb')).toBe('dwarf');
    expect(urlToKey('fighter-phb')).toBe('fighter');
    expect(urlToKey('soldier-phb')).toBe('soldier');
  });

  it('снимает префикс типа сущности', () => {
    expect(urlToKey('item:greatsword-phb')).toBe('greatsword');
    expect(urlToKey('magic-item:gauntlets-of-ogre-power-dmg')).toBe(
      'gauntlets-of-ogre-power',
    );
  });

  it('берёт последний сегмент пути и отбрасывает параметры', () => {
    expect(urlToKey('/species/dwarf-phb?tab=traits')).toBe('dwarf');
  });

  it('возвращает пустую строку, если ссылки нет', () => {
    expect(urlToKey(null)).toBe('');
    expect(urlToKey(undefined)).toBe('');
  });
});

describe('urlToSourceKey', () => {
  it('возвращает сокращение источника', () => {
    expect(urlToSourceKey('dwarf-phb')).toBe('phb');
    expect(urlToSourceKey('item:gauntlets-of-ogre-power-dmg')).toBe('dmg');
  });

  it('возвращает undefined, если источника в ссылке нет', () => {
    expect(urlToSourceKey('homebrew')).toBeUndefined();
  });
});

describe('skillKeyByLabel', () => {
  it('переводит русские названия навыков в ключи системы', () => {
    expect(skillKeyByLabel('Анализ')).toBe('investigation');
    expect(skillKeyByLabel('Уход за животными')).toBe('animalHandling');
    expect(skillKeyByLabel('Ловкость рук')).toBe('sleightOfHand');
  });

  it('возвращает null для незнакомого навыка', () => {
    expect(skillKeyByLabel('Пилотирование')).toBeNull();
  });
});

describe('вспомогательные словари', () => {
  it('переводит размер существа', () => {
    expect(sizeByLabel('Средний')).toBe('medium');
    expect(sizeByLabel('Маленький')).toBe('small');
    expect(sizeByLabel(null)).toBe('medium');
  });

  it('опознаёт размер и ключом, и подписью, а незнакомый не подменяет', () => {
    expect(toCreatureSizeOrNull('large')).toBe('large');
    expect(toCreatureSizeOrNull('Большой')).toBe('large');
    expect(toCreatureSizeOrNull('Колоссальный')).toBeNull();
    expect(toCreatureSizeOrNull(null)).toBeNull();
  });

  it('проверяет ключ характеристики', () => {
    expect(isAbilityKey('strength')).toBe(true);
    expect(isAbilityKey('luck')).toBe(false);
  });

  it('приводит уровень владения', () => {
    expect(toProficiencyLevel('proficient')).toBe('proficient');
    expect(toProficiencyLevel('unknown')).toBe('none');
  });

  it('приводит тип урона листа к ключу системы', () => {
    expect(toDamageType('SLASHING')).toBe('slashing');
    expect(toDamageType('SONIC')).toBeUndefined();
  });
});
