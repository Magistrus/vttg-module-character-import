/**
 * Типы хостового API VTTG, которыми пользуется модуль.
 *
 * Хост (репозиторий `vttg`) не публикует пакет с типами для авторов модулей,
 * поэтому здесь описана ровно та часть `ClientModuleAPI`, которую модуль
 * действительно вызывает. Источник правды — `docs/MODULES.md` хоста; при
 * расхождении верить документации хоста, а не этому файлу.
 *
 * @module types/vttg
 */

import type { Component } from 'vue';

/** Настройки токена актёра (подмножество `TokenSettings` хоста). */
export interface VttgTokenSettings {
  /** Путь или URL картинки токена */
  imageUrl?: string;
  /** Путь к рамке токена */
  frameUrl?: string;
  /** Показывать ли имя токена на сцене */
  showName?: boolean;
  /** Зрение токена */
  vision?: {
    /** Включено ли зрение */
    enabled: boolean;
    /** Дальность обычного зрения в футах (0 — безграничное) */
    range: number;
    /** Дальность тёмного зрения в футах */
    darkvision: number;
    /** Угол обзора в градусах (360 — круговое) */
    angle: number;
  };
}

/**
 * Черновик актёра для `api.actors.create`.
 *
 * Ядро знает об актёре только нейтральные поля; всё системное лежит в `system`
 * и в КОРНЕВЫХ полях, которыми владеет игровая система мира (у D&D 5e это
 * `features`, `equipment`, `spells`, `notes`). Поэтому индексная сигнатура —
 * часть контракта, а не поблажка типизации.
 */
export interface VttgActorCreateInput {
  /** Имя актёра */
  name: string;
  /** Путь или URL аватара */
  avatar?: string;
  /** Описание (внешность, характер) */
  description?: string;
  /** Настройки токена */
  token?: VttgTokenSettings;
  /** Пользователи, управляющие актёром */
  ownerIds?: string[];
  /** Виден ли актёр всем */
  isPublic?: boolean;
  /** Системные данные — форму задаёт игровая система мира */
  system: Record<string, unknown>;
  /** Системные корневые коллекции (features/equipment/spells/notes у D&D 5e) */
  [key: string]: unknown;
}

/** Актёр в том виде, в каком его возвращает хост (нейтральная часть). */
export interface VttgActor {
  /** Идентификатор актёра */
  id: string;
  /** Имя актёра */
  name: string;
}

/** Часть `ClientModuleAPI`, которой пользуется модуль. */
export interface VttgModuleApi {
  /** Актёры: запись */
  actors: {
    /** Создаёт актёра и ждёт подтверждения сервера */
    create: (input: VttgActorCreateInput) => Promise<VttgActor>;
    /** Обновляет актёра: патч сливается с текущим состоянием */
    update: (actorId: string, patch: Record<string, unknown>) => void;
  };

  /** Сцена и мир: чтение */
  scene: {
    /** Является ли текущий пользователь мастером */
    isGM: () => boolean;
    /** ID текущего пользователя (null — не авторизован) */
    getLoggedUserId: () => string | null;
  };

  /** Модальные окна модуля */
  modals: {
    /** Открывает окно; возвращает его ID */
    open: (options: {
      moduleId: string;
      component: Component;
      title?: string;
      props?: Record<string, unknown>;
    }) => string;
    /** Закрывает окно по ID */
    close: (modalId: string) => void;
    /** Закрывает все окна модуля */
    closeAll: (moduleId: string) => void;
  };

  /** Тост-уведомления */
  notifications: {
    /** Информационное уведомление */
    info: (title: string, description?: string) => void;
    /** Предупреждение */
    warning: (title: string, description?: string) => void;
    /** Ошибка */
    error: (title: string, description?: string) => void;
    /** Успех */
    success: (title: string, description?: string) => void;
  };

  /** Персистентные настройки модуля (хранятся в БД мира) */
  settings: {
    /** Читает значение настройки */
    get: (moduleId: string, key: string) => Promise<unknown>;
    /** Сохраняет значение настройки */
    set: (moduleId: string, key: string, value: unknown) => Promise<void>;
  };

  /** UI-расширения (слоты хоста) */
  extensions: {
    /** Регистрирует компонент в слоте */
    register: (registration: {
      moduleId: string;
      slotName: string;
      component: Component;
      order?: number;
      label?: string;
    }) => void;
    /** Снимает регистрацию компонента */
    unregister: (moduleId: string, slotName: string) => void;
  };

  /** Активная игровая система мира */
  system: {
    /** ID активной системы (`dnd5e-2024`), null — системы нет */
    getActiveSystemId: () => string | null;
  };
}

declare global {
  /** Точка регистрации модулей, которую создаёт хост */
  // eslint-disable-next-line vars-on-top, no-var
  var VTTModules: {
    /** Регистрирует модуль по его ID */
    register: (
      moduleId: string,
      initFn: (api: VttgModuleApi) => void | Promise<void>,
    ) => void;
  };
}
