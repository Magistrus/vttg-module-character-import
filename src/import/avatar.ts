/**
 * Картинка персонажа: ссылка с сайта → файл мира.
 *
 * Лист отдаёт аватар ссылкой на сайт. Оставить её как есть можно — клиент
 * абсолютные URL показывает, — но тогда токен живёт ровно столько, сколько
 * доступен сайт. Поэтому картинку пытаемся перенести в файлы мира и только при
 * неудаче откатываемся на ссылку: пустой токен хуже внешней ссылки.
 *
 * @module import/avatar
 */

import type { VttgModuleApi } from '@/types/vttg';

/** Папка внутри мира, куда складываются портреты импортированных персонажей */
const AVATAR_FOLDER = 'avatars';

/** Имя файла, если из ссылки ничего вменяемого не достать */
const FALLBACK_FILE_NAME = 'avatar.png';

/** Итог переноса картинки */
export interface AvatarResult {
  /** Что класть в актёра: путь файла мира или исходная ссылка */
  path: string | null;
  /** Что сказать пользователю, если перенести не вышло */
  warning?: string;
}

/**
 * Придумывает имя файла для картинки.
 *
 * @param source - ссылка на картинку
 * @param actorName - имя персонажа (запасной источник имени)
 * @returns имя файла с расширением
 */
export function buildAvatarFileName(source: string, actorName: string): string {
  const [withoutQuery = ''] = source.split('?');
  const segments = withoutQuery.split('/').filter((segment) => segment.length > 0);
  const last = segments[segments.length - 1] ?? '';

  if (/\.[a-z0-9]{2,5}$/i.test(last)) {
    return last;
  }

  const slug = actorName
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '');

  return slug ? `${slug}.png` : FALLBACK_FILE_NAME;
}

/**
 * Переносит картинку персонажа в файлы мира.
 *
 * Провал не срывает импорт: возвращается исходная ссылка и предупреждение —
 * причин отказа хватает (сайт не отдал файл из-за CORS, у игрока нет права
 * писать в мир, сервер отверг тип файла).
 *
 * @param api - API модуля от хоста
 * @param source - ссылка на картинку с листа (null — картинки нет)
 * @param actorName - имя персонажа, нужно для имени файла
 * @returns путь к картинке и, при неудаче, объяснение
 */
export async function importAvatar(
  api: VttgModuleApi,
  source: string | null | undefined,
  actorName: string,
): Promise<AvatarResult> {
  if (!source) {
    return { path: null };
  }

  const assets = api.assets;

  if (!assets) {
    return {
      path: source,
      warning:
        'Картинка осталась ссылкой на сайт: приложение не дало модулю доступ '
        + 'к файлам мира (разрешение assets).',
    };
  }

  try {
    const response = await fetch(source);

    if (!response.ok) {
      throw new Error(`сайт ответил ${response.status}`);
    }

    const blob = await response.blob();

    const uploaded = await assets.upload(
      AVATAR_FOLDER,
      buildAvatarFileName(source, actorName),
      blob,
    );

    return {
      path: uploaded.relativePath,
      ...(uploaded.warning ? { warning: uploaded.warning } : {}),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return {
      path: source,
      warning:
        `Картинку не удалось положить в файлы мира (${reason}) — токен ссылается `
        + 'на сайт и пропадёт, если тот станет недоступен.',
    };
  }
}
