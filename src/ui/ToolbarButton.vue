<script setup lang="ts">
  /**
   * Кнопка модуля в левом тулбаре сцены.
   *
   * Импорт персонажа доступен не только мастеру: сервер разрешает создание
   * актёров по праву мира `CREATE_ACTORS`, которое обычно есть и у игроков.
   * Поэтому кнопка видна всем — отказ, если права всё-таки нет, покажет сам
   * мастер импорта.
   *
   * Иконки хоста (`UIcon`) модулю недоступны, а классы Tailwind у него свои,
   * поэтому кнопка нарисована собственным CSS и inline-SVG.
   */

  const emit = defineEmits<{
    /** Пользователь нажал кнопку */
    open: [];
  }>();

  /** Обрабатывает клик по кнопке. */
  function handleClick(): void {
    emit('open');
  }
</script>

<template>
  <button
    class="ci-toolbar-button"
    type="button"
    title="Импорт персонажа с листа TTG Club"
    @click="handleClick"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M8 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0" />
      <path d="M14 19H6a2 2 0 0 1-2-2 4 4 0 0 1 4-4h4" />
      <path d="M16 19h6" />
      <path d="M19 16v6" />
    </svg>
  </button>
</template>

<style scoped>
  .ci-toolbar-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    color: var(--ui-text-muted, #a1a1aa);
    cursor: pointer;
    background: transparent;
    border: none;
    border-radius: 8px;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .ci-toolbar-button:hover {
    color: var(--ui-text, #e5e7eb);
    background-color: var(--ui-bg-elevated, rgb(255 255 255 / 8%));
  }

  .ci-toolbar-button svg {
    width: 20px;
    height: 20px;
  }
</style>
