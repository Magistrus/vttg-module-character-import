/**
 * Перевод форматированного текста листа TTG Club в markdown.
 *
 * На листе описание черты — массив, в котором перемешаны два представления:
 * готовые строки с разметкой сайта (`{@glossary текст|url:ключ}`) и узлы
 * редактора (`{ type: 'list', content: [...] }`). Лист персонажа VTTG хранит
 * описание особенности ОДНОЙ строкой markdown, поэтому оба представления
 * сводятся сюда.
 *
 * Ссылки на справочник сайта не переносятся: в мире их некуда вести — остаётся
 * только текст ссылки.
 *
 * @module sheet/richText
 */

/** Разметка сайта вида `{@tag текст|url:ключ}` (без вложенных фигурных скобок) */
const SITE_TAG_REGEX = /\{@(\w+)([^{}]*)\}/g;

/** Уровни заголовков markdown, которые мы готовы выдать */
const MIN_HEADING_LEVEL = 1;

/** Максимальный уровень заголовка markdown */
const MAX_HEADING_LEVEL = 6;

/** Типы узлов, которые дают отдельный блок, а не кусок строки */
const BLOCK_NODE_TYPES = new Set([
  'paragraph',
  'heading',
  'list',
  'orderedList',
  'bulletList',
  'quote',
  'blockquote',
  'table',
]);

/** Узел редактора после разбора схемой */
interface RichNode {
  /** Тип узла */
  type?: string;
  /** Текст (для `type: 'text'`) */
  text?: string;
  /** Атрибуты узла (уровень заголовка, url ссылки) */
  attrs?: Record<string, unknown>;
  /** Дети узла */
  content?: unknown[];
}

/**
 * Проверяет, что значение — узел редактора.
 *
 * @param value - произвольное значение из описания
 * @returns true, если это объект-узел
 */
function isRichNode(value: unknown): value is RichNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Разворачивает разметку сайта в markdown.
 *
 * `{@b текст}` становится жирным, `{@br}` — переносом строки, у остальных тегов
 * остаётся только видимый текст: подпись до `|url:…` (или до конца тега).
 *
 * Пробелы по краям НЕ срезаются: куски текста внутри одного абзаца разделены
 * именно ими, а лишние пробелы снимает уже сборка блоков.
 *
 * @param source - строка описания с разметкой сайта
 * @returns строка markdown
 */
export function unwrapSiteMarkup(source: string): string {
  return source
    .replace(SITE_TAG_REGEX, (_match, tag: string, rest: string) => {
      const [label = ''] = rest.split('|');
      const text = label.trim();

      if (tag === 'br') {
        return '\n';
      }

      if (tag === 'b' && text) {
        return `**${text}**`;
      }

      if (tag === 'i' && text) {
        return `*${text}*`;
      }

      return text;
    })
    .replace(/[ \t]+\n/g, '\n');
}

/**
 * Собирает уровень заголовка из атрибутов узла.
 *
 * @param attrs - атрибуты узла заголовка
 * @returns уровень от 1 до 6
 */
function resolveHeadingLevel(attrs: Record<string, unknown> | undefined): number {
  const raw = attrs?.level;
  const level = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw;

  if (typeof level !== 'number' || Number.isNaN(level)) {
    return 4;
  }

  return Math.min(MAX_HEADING_LEVEL, Math.max(MIN_HEADING_LEVEL, level));
}

/**
 * Собирает узел в строку без разбиения на блоки (жирный, курсив, ссылки).
 *
 * @param node - узел, строка или массив узлов
 * @returns строка markdown в одну «линию»
 */
function renderInline(node: unknown): string {
  if (typeof node === 'string') {
    return unwrapSiteMarkup(node);
  }

  if (typeof node === 'number' || typeof node === 'boolean') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => renderInline(child)).join('');
  }

  if (!isRichNode(node)) {
    return '';
  }

  const children = renderInline(node.content ?? []);
  const own = typeof node.text === 'string' ? unwrapSiteMarkup(node.text) : '';
  const inner = `${own}${children}`;

  if (!inner) {
    return '';
  }

  switch (node.type) {
    case 'bold':
    case 'strong':
      return `**${inner}**`;
    case 'italic':
    case 'em':
      return `*${inner}*`;
    default:
      return inner;
  }
}

/**
 * Собирает узел в набор markdown-блоков.
 *
 * @param node - узел, строка или массив узлов
 * @returns блоки markdown (абзацы, пункты списка, заголовки)
 */
function renderBlocks(node: unknown): string[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => renderBlocks(child));
  }

  if (typeof node === 'string') {
    const text = unwrapSiteMarkup(node).trim();

    return text ? [text] : [];
  }

  if (!isRichNode(node)) {
    const inline = renderInline(node);

    return inline ? [inline] : [];
  }

  if (!node.type || !BLOCK_NODE_TYPES.has(node.type)) {
    const inline = renderInline(node);

    return inline ? [inline] : [];
  }

  switch (node.type) {
    case 'heading': {
      const text = renderInline(node.content ?? []);

      return text
        ? [`${'#'.repeat(resolveHeadingLevel(node.attrs))} ${text}`]
        : [];
    }

    case 'list':
    case 'bulletList':
    case 'orderedList': {
      const items = (node.content ?? [])
        .map((child) => renderInline(isRichNode(child) ? child.content ?? [] : child))
        .filter((item) => item.length > 0)
        .map((item) => `- ${item}`);

      return items.length > 0 ? [items.join('\n')] : [];
    }

    case 'quote':
    case 'blockquote': {
      const inner = renderBlocks(node.content ?? []);

      return inner.map((block) =>
        block
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n'),
      );
    }

    default: {
      const inner = renderBlocks(node.content ?? []);

      return inner;
    }
  }
}

/**
 * Переводит описание с листа персонажа в markdown.
 *
 * @param description - массив строк и узлов редактора из листа
 * @returns описание одной markdown-строкой (блоки разделены пустой строкой)
 */
export function richTextToMarkdown(
  description: readonly unknown[] | undefined,
): string {
  if (!description || description.length === 0) {
    return '';
  }

  return renderBlocks([...description])
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .join('\n\n');
}
