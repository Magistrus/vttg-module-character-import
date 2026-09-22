import type { VttgModuleApi } from '@/types/vttg';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildAvatarFileName, importAvatar } from './avatar';

/**
 * Собирает заглушку API с файлами мира.
 *
 * @param upload - реализация загрузки файла
 * @returns заглушка API, достаточная для `importAvatar`
 */
function createApi(upload?: VttgModuleApi['assets']): VttgModuleApi {
  const api: VttgModuleApi = {
    scene: { isGM: () => true, getLoggedUserId: () => 'user-1' },
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
  };

  if (upload) {
    api.assets = upload;
  }

  return api;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildAvatarFileName', () => {
  it('берёт имя файла из ссылки', () => {
    expect(
      buildAvatarFileName('https://ttg.club/media/gogi-portrait.webp', 'Гоги'),
    ).toBe('gogi-portrait.webp');
  });

  it('отбрасывает параметры запроса', () => {
    expect(buildAvatarFileName('https://ttg.club/a/b.png?v=2', 'Гоги')).toBe(
      'b.png',
    );
  });

  it('собирает имя из персонажа, если в ссылке расширения нет', () => {
    expect(buildAvatarFileName('https://ttg.club/avatars/42', 'Гоги Дварф')).toBe(
      'гоги-дварф.png',
    );
  });
});

describe('importAvatar', () => {
  it('ничего не делает, когда картинки на листе нет', async () => {
    expect(await importAvatar(createApi(), null, 'Гоги')).toEqual({
      path: null,
    });
  });

  it('кладёт картинку в файлы мира и возвращает путь оттуда', async () => {
    const upload = vi.fn(async () => ({
      url: 'http://localhost:30001/assets/avatars/gogi.webp',
      relativePath: 'avatars/gogi.webp',
    }));

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob(['картинка']), { status: 200 })),
    );

    const result = await importAvatar(
      createApi({ upload, resolveUrl: vi.fn() }),
      'https://ttg.club/media/gogi.png',
      'Гоги',
    );

    expect(upload).toHaveBeenCalledWith('avatars', 'gogi.png', expect.anything());
    expect(result).toEqual({ path: 'avatars/gogi.webp' });
  });

  it('оставляет ссылку и объясняет, если сайт не отдал картинку', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 403 })),
    );

    const result = await importAvatar(
      createApi({ upload: vi.fn(), resolveUrl: vi.fn() }),
      'https://ttg.club/media/gogi.png',
      'Гоги',
    );

    expect(result.path).toBe('https://ttg.club/media/gogi.png');
    expect(result.warning).toMatch(/403/);
  });

  it('оставляет ссылку, если доступа к файлам мира нет вовсе', async () => {
    const result = await importAvatar(
      createApi(),
      'https://ttg.club/media/gogi.png',
      'Гоги',
    );

    expect(result.path).toBe('https://ttg.club/media/gogi.png');
    expect(result.warning).toMatch(/assets/);
  });
});
