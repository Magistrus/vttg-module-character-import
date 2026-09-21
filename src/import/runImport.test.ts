import type { VttgActorCreateInput, VttgModuleApi } from '@/types/vttg';

import { describe, expect, it, vi } from 'vitest';

import fixture from '../../fixtures/dwarf-fighter.json';
import { parseSheetText } from '@/sheet/parse';

import { runImport } from './runImport';

/** Лист-эталон из `fixtures/` */
const sheet = parseSheetText(JSON.stringify(fixture));

/** Настройки импорта «перенести всё» */
const options = {
  name: 'Гоги Импортированный',
  importFeatures: true,
  importInventory: true,
  importPersonality: true,
  assignOwner: true,
  isPublic: true,
};

/**
 * Собирает заглушку хостового API: запоминает, что модуль отправил на создание.
 *
 * @returns заглушка API и шпион на создании актёра
 */
function createApiStub(): {
  api: VttgModuleApi;
  create: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn(async (input: VttgActorCreateInput) => ({
    id: 'actor-42',
    name: input.name,
  }));

  const api = {
    actors: { create, update: vi.fn() },
    scene: { isGM: () => true, getLoggedUserId: () => 'user-7' },
    modals: { open: vi.fn(), close: vi.fn(), closeAll: vi.fn() },
    notifications: {
      info: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
    },
    settings: { get: vi.fn(), set: vi.fn() },
    extensions: { register: vi.fn(), unregister: vi.fn() },
    system: { getActiveSystemId: () => 'dnd5e-2024' },
  } satisfies VttgModuleApi;


  return { api, create };
}

describe('runImport', () => {
  it('отправляет хосту собранного актёра и возвращает итог', async () => {
    const { api, create } = createApiStub();

    const result = await runImport(api, sheet, options);

    expect(create).toHaveBeenCalledTimes(1);

    const [input] = create.mock.calls[0] as [VttgActorCreateInput];

    expect(input.name).toBe('Гоги Импортированный');
    expect(input.ownerIds).toEqual(['user-7']);
    expect(input.isPublic).toBe(true);

    expect(result).toEqual({
      actorId: 'actor-42',
      actorName: 'Гоги Импортированный',
      featureCount: 9,
      itemCount: 13,
      warnings: [],
    });
  });

  it('не проглатывает отказ сервера', async () => {
    const { api } = createApiStub();

    api.actors.create = vi.fn(async () => {
      throw new Error('Сервер не подтвердил создание актёра');
    });

    await expect(runImport(api, sheet, options)).rejects.toThrowError(
      /не подтвердил создание/,
    );
  });
});
