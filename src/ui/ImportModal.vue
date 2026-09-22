<script setup lang="ts">
  /**
   * Мастер импорта персонажа: выбор файла → сводка → настройки → импорт.
   *
   * Окно рисуется внутри `UDraggableModal` хоста, поэтому здесь только
   * содержимое: ни заголовка, ни кнопки закрытия.
   */

  import type { ImportOptions } from '@/convert/actor';
  import type { ImportResult } from '@/import/runImport';
  import type { SheetSummary } from '@/sheet/parse';
  import type { CharacterSheet } from '@/sheet/schema';
  import type { VttgModuleApi } from '@/types/vttg';

  import { computed, onMounted, ref } from 'vue';

  import { collectWarnings } from '@/convert/actor';
  import {
    HOST_TOO_OLD_MESSAGE,
    isActorWriteSupported,
    runImport,
    TARGET_SYSTEM_ID,
  } from '@/import/runImport';
  import { isSheetFileName, parseSheetFile, summarizeSheet } from '@/sheet/parse';

  const props = defineProps<{
    /** API модуля, выданное хостом */
    api: VttgModuleApi;
    /** ID модуля (подставляет хост) */
    moduleId?: string;
  }>();

  /** ID модуля по умолчанию — если хост не передал его пропсом */
  const FALLBACK_MODULE_ID = 'character-import';

  /** Ключ, под которым в БД мира лежат последние настройки импорта */
  const SETTINGS_KEY = 'import-defaults';

  const sheet = ref<CharacterSheet | null>(null);
  const summary = ref<SheetSummary | null>(null);
  const sourceFileName = ref('');
  const parseError = ref<string | null>(null);
  const importError = ref<string | null>(null);
  const isDragging = ref(false);
  const isImporting = ref(false);
  const result = ref<ImportResult | null>(null);

  const options = ref<ImportOptions>({
    name: '',
    importFeatures: true,
    importInventory: true,
    importPersonality: true,
    assignOwner: true,
    isPublic: false,
  });

  /** ID модуля для обращений к настройкам */
  const moduleId = computed(() => props.moduleId ?? FALLBACK_MODULE_ID);

  /** Совпадает ли система мира с той, под которую собран лист */
  const isSystemMatching = computed(
    () => props.api.system.getActiveSystemId() === TARGET_SYSTEM_ID,
  );

  /** Умеет ли приложение создавать актёров из модуля */
  const isHostSupported = computed(() => isActorWriteSupported(props.api));

  /** Что лист несёт, а импорт не переносит */
  const warnings = computed(() =>
    sheet.value ? collectWarnings(sheet.value) : [],
  );

  const canImport = computed(
    () =>
      Boolean(sheet.value)
      && isHostSupported.value
      && !isImporting.value
      && !result.value,
  );

  onMounted(async () => {
    try {
      const stored = await props.api.settings.get(moduleId.value, SETTINGS_KEY);

      if (stored && typeof stored === 'object') {
        options.value = { ...options.value, ...stored };
        // Имя не переносим между импортами: оно всегда своё у персонажа.
        options.value.name = '';
      }
    } catch {
      // Настроек ещё нет или их не отдали — работаем со значениями по умолчанию.
    }
  });

  /**
   * Разбирает выбранный файл листа персонажа.
   *
   * @param file - файл экспорта листа (`.json`)
   */
  async function loadSheetFile(file: File): Promise<void> {
    parseError.value = null;
    importError.value = null;
    result.value = null;

    try {
      const parsed = await parseSheetFile(file);

      sheet.value = parsed;
      summary.value = summarizeSheet(parsed);
      sourceFileName.value = file.name;
      options.value.name = parsed.name;
    } catch (error) {
      sheet.value = null;
      summary.value = null;

      parseError.value =
        error instanceof Error ? error.message : 'Не удалось разобрать файл';
    }
  }

  /**
   * Берёт из набора файлов первый подходящий лист.
   *
   * @param files - файлы из input или drop
   */
  async function handleFiles(files: FileList | null): Promise<void> {
    if (!files) {
      return;
    }

    const file = Array.from(files).find((entry) => isSheetFileName(entry.name));

    if (!file) {
      parseError.value = 'Нужен файл .json — экспорт листа персонажа с сайта';

      return;
    }

    await loadSheetFile(file);
  }

  /**
   * Обрабатывает выбор файла через системный диалог.
   *
   * @param event - событие input[type=file]
   */
  function handleFileInput(event: Event): void {
    const input = event.target;

    if (input instanceof HTMLInputElement) {
      void handleFiles(input.files);
      input.value = '';
    }
  }

  /**
   * Обрабатывает перетаскивание файла в окно.
   *
   * @param event - событие drop
   */
  function handleDrop(event: DragEvent): void {
    isDragging.value = false;
    void handleFiles(event.dataTransfer?.files ?? null);
  }

  /** Запускает импорт с текущими настройками. */
  async function startImport(): Promise<void> {
    const parsedSheet = sheet.value;

    if (!parsedSheet || !canImport.value) {
      return;
    }

    isImporting.value = true;
    importError.value = null;

    try {
      const imported = await runImport(props.api, parsedSheet, options.value);

      result.value = imported;

      props.api.notifications.success(
        'Персонаж импортирован',
        `${imported.actorName}: черт — ${imported.featureCount}, `
          + `предметов — ${imported.itemCount}`,
      );

      void props.api.settings.set(moduleId.value, SETTINGS_KEY, {
        ...options.value,
        name: '',
      });
    } catch (error) {
      importError.value =
        error instanceof Error ? error.message : 'Импорт не удался';

      props.api.notifications.error('Импорт не удался', importError.value);
    } finally {
      isImporting.value = false;
    }
  }
</script>

<template>
  <div class="ci-root">
    <p
      v-if="!isHostSupported"
      class="ci-alert ci-alert--error"
    >
      {{ HOST_TOO_OLD_MESSAGE }}
    </p>

    <p
      v-if="!isSystemMatching"
      class="ci-alert ci-alert--warning"
    >
      Лист собран для системы «{{ TARGET_SYSTEM_ID }}», а мир запущен на другой.
      Импортированный персонаж может открыться неполным.
    </p>

    <!-- Приём файла -->
    <label
      class="ci-drop"
      :class="{ 'ci-drop--active': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <input
        class="ci-drop__input"
        type="file"
        accept=".json,application/json"
        @change="handleFileInput"
      >

      <span class="ci-drop__title">
        Перетащите лист персонажа или нажмите, чтобы выбрать
      </span>

      <span class="ci-drop__hint">
        Файл .json — кнопка «Экспорт» на листе персонажа TTG Club
      </span>
    </label>

    <p
      v-if="parseError"
      class="ci-alert ci-alert--error"
    >
      {{ parseError }}
    </p>

    <!-- Сводка по листу -->
    <div
      v-if="summary"
      class="ci-summary"
    >
      <div class="ci-summary__row">
        <span class="ci-summary__key">Файл</span>
        <span class="ci-summary__value">{{ sourceFileName }}</span>
      </div>

      <div class="ci-summary__row">
        <span class="ci-summary__key">Персонаж</span>

        <span class="ci-summary__value">
          {{ summary.name }}, {{ summary.level }} ур.
          <template v-if="summary.classes">— {{ summary.classes }}</template>
        </span>
      </div>

      <div class="ci-summary__row">
        <span class="ci-summary__key">Вид и предыстория</span>

        <span class="ci-summary__value">
          {{ summary.speciesName ?? 'вид не указан' }},
          {{ summary.backgroundName ?? 'предыстория не указана' }}
        </span>
      </div>

      <div class="ci-summary__row">
        <span class="ci-summary__key">Хиты</span>

        <span class="ci-summary__value">
          {{ summary.hitPointsCurrent }} / {{ summary.hitPointsMax }}
        </span>
      </div>

      <div class="ci-summary__row">
        <span class="ci-summary__key">Картинка</span>

        <span class="ci-summary__value">
          {{ summary.hasAvatar
            ? 'есть — станет токеном'
            : 'в файле нет — задайте аватар на сайте и экспортируйте лист заново' }}
        </span>
      </div>

      <div class="ci-summary__row">
        <span class="ci-summary__key">Найдено</span>

        <span class="ci-summary__value">
          черт: {{ summary.featureCount }},
          предметов: {{ summary.itemCount }},
          счётчиков: {{ summary.counterCount }},
          языков: {{ summary.languageCount }}
        </span>
      </div>
    </div>

    <!-- Настройки импорта -->
    <div
      v-if="summary"
      class="ci-form"
    >
      <label class="ci-field">
        <span class="ci-field__label">Имя актёра</span>

        <input
          v-model="options.name"
          class="ci-input"
          type="text"
          placeholder="Имя персонажа"
        >
      </label>

      <label class="ci-check">
        <input
          v-model="options.importFeatures"
          type="checkbox"
        >
        <span>Черты и умения ({{ summary.featureCount }})</span>
      </label>

      <label class="ci-check">
        <input
          v-model="options.importInventory"
          type="checkbox"
        >
        <span>Инвентарь ({{ summary.itemCount }})</span>
      </label>

      <label class="ci-check">
        <input
          v-model="options.importPersonality"
          type="checkbox"
        >
        <span>Внешность и характер — в описание актёра</span>
      </label>

      <label class="ci-check">
        <input
          v-model="options.assignOwner"
          type="checkbox"
        >
        <span>Сделать меня владельцем персонажа</span>
      </label>

      <label class="ci-check">
        <input
          v-model="options.isPublic"
          type="checkbox"
        >
        <span>Виден остальным игрокам</span>
      </label>
    </div>

    <!-- Что не поедет -->
    <div
      v-if="warnings.length > 0"
      class="ci-alert ci-alert--info"
    >
      <p class="ci-alert__title">Перенесётся не всё:</p>

      <ul class="ci-list">
        <li
          v-for="warning in warnings"
          :key="warning"
        >
          {{ warning }}
        </li>
      </ul>
    </div>

    <p
      v-if="importError"
      class="ci-alert ci-alert--error"
    >
      {{ importError }}
    </p>

    <div
      v-if="result"
      class="ci-alert ci-alert--success"
    >
      Персонаж «{{ result.actorName }}» создан: черт — {{ result.featureCount }},
      предметов — {{ result.itemCount }}. Он уже в списке персонажей мира.

      <ul
        v-if="result.warnings.length > 0"
        class="ci-list"
      >
        <li
          v-for="warning in result.warnings"
          :key="warning"
        >
          {{ warning }}
        </li>
      </ul>
    </div>

    <div class="ci-actions">
      <button
        class="ci-button ci-button--primary"
        type="button"
        :disabled="!canImport"
        @click="startImport"
      >
        {{ isImporting ? 'Импорт…' : 'Импортировать' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
  .ci-root {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 420px;
    max-width: 560px;
    font-size: 14px;
    color: var(--ui-text, #e5e7eb);
  }

  .ci-drop {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 18px;
    text-align: center;
    cursor: pointer;
    border: 1px dashed var(--ui-border-accented, #52525b);
    border-radius: 10px;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .ci-drop:hover,
  .ci-drop--active {
    border-color: var(--ui-primary, #3b82f6);
    background-color: var(--ui-bg-elevated, rgb(255 255 255 / 4%));
  }

  .ci-drop__input {
    display: none;
  }

  .ci-drop__title {
    font-weight: 600;
  }

  .ci-drop__hint {
    font-size: 12px;
    color: var(--ui-text-muted, #a1a1aa);
  }

  .ci-summary {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    background-color: var(--ui-bg-elevated, rgb(255 255 255 / 4%));
    border-radius: 10px;
  }

  .ci-summary__row {
    display: flex;
    gap: 8px;
    align-items: baseline;
    justify-content: space-between;
  }

  .ci-summary__key {
    color: var(--ui-text-muted, #a1a1aa);
    white-space: nowrap;
  }

  .ci-summary__value {
    text-align: right;
  }

  .ci-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .ci-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ci-field__label {
    font-size: 12px;
    color: var(--ui-text-muted, #a1a1aa);
  }

  .ci-input {
    padding: 6px 10px;
    color: inherit;
    background-color: var(--ui-bg, rgb(0 0 0 / 20%));
    border: 1px solid var(--ui-border-accented, #52525b);
    border-radius: 8px;
  }

  .ci-check {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    cursor: pointer;
  }

  .ci-alert {
    padding: 8px 10px;
    font-size: 13px;
    border-radius: 8px;
  }

  .ci-alert__title {
    margin-bottom: 4px;
    font-weight: 600;
  }

  .ci-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-left: 18px;
    list-style: disc;
  }

  .ci-alert--error {
    color: #fecaca;
    background-color: rgb(239 68 68 / 15%);
  }

  .ci-alert--warning {
    color: #fde68a;
    background-color: rgb(245 158 11 / 15%);
  }

  .ci-alert--info {
    color: #bfdbfe;
    background-color: rgb(59 130 246 / 15%);
  }

  .ci-alert--success {
    color: #bbf7d0;
    background-color: rgb(34 197 94 / 15%);
  }

  .ci-actions {
    display: flex;
    justify-content: flex-end;
  }

  .ci-button {
    padding: 7px 16px;
    font-weight: 600;
    color: inherit;
    cursor: pointer;
    background-color: var(--ui-bg-elevated, rgb(255 255 255 / 8%));
    border: none;
    border-radius: 8px;
  }

  .ci-button--primary {
    color: #fff;
    background-color: var(--ui-primary, #3b82f6);
  }

  .ci-button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
</style>
