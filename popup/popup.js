// ---------------------------------------------------------------------------
//  Попап: что включено, что идёт прямо сейчас и что уже сделано.
//
//  Главное правило этого файла: попап не «фотографирует» состояние при
//  открытии, а подписывается на изменения chrome.storage (и на вкладки X).
//  Пока окно открыто, а фоновая очередь работает, цифры обновляются сами:
//  история, защита, прогресс и тумблеры приходят подпиской, а не по таймеру.
//
//  Второе правило: всё, что видит человек, сказано простыми словами. Названия
//  и описания модулей живут в shared/modules.js — один словарь на попап и док.
// ---------------------------------------------------------------------------
(() => {
  const МОДУЛИ = window.XCModules;
  if (!МОДУЛИ) return;

  const $ = sel => document.querySelector(sel);
  const эл = (тег, класс, текст) => {
    const узел = document.createElement(тег);
    if (класс) узел.className = класс;
    if (текст != null) узел.textContent = текст;
    return узел;
  };
  const t = (ключ, данные) => XCI18n.t(ключ, данные);
  const чисел = n => XCI18n.число(n);

  // Строки попапа: общие кнопки и статусы очереди лежат в shared/i18n.js,
  // здесь — только то, что встречается в этом окне.
  XCI18n.добавить({
    ru: {
      'module.switchTitle': 'Включить или выключить: {name}',
      'module.openAria': 'Открыть: {name}',
      'module.opening': 'Открываю нужную страницу в X',
      'module.modeBackgroundTitle': 'Работает в фоне: вкладку можно закрыть',
      'module.modeTabTitle': 'Работает, пока открыта вкладка X',
      'jobs.aria': 'Идёт работа',
      'jobs.stopThisTitle': 'Остановить это задание',
      'jobs.noticeBody': '{status}. Уже сделанное не повторится — можно запустить снова.',
      'protect.title': 'Кого не трогать',
      'protect.subtitle': 'этих аккаунтов не коснётся отписка',
      'protect.textAria': 'Текст со ссылками, никами или id',
      'protect.placeholder': 'Вставь любой текст: ссылки, @ники, ники или id — вытащу аккаунты',
      'protect.addText': 'Добавить из текста',
      'protect.clearAll': 'Очистить всё',
      'protect.oneAria': 'Ник, ссылка или id',
      'protect.onePlaceholder': '@ник, ссылка или id',
      'protect.add': 'Добавить',
      'protect.removeTitle': 'Убрать из списка',
      'protect.removeAria': 'Убрать {name}',
      'protect.removed': 'Убрано: {name}',
      'protect.cleared': 'Список «кого не трогать» очищен',
      'protect.empty': 'Вставь текст со ссылками или никами',
      'protect.found': 'Нашёл {found}, новых {added}',
      'protect.added': 'Добавлено в «кого не трогать»',
      'protect.duplicate': 'Уже в списке или не распознал',
      'history.title': 'Что уже сделано',
      'history.export': 'Выгрузить в файл',
      'history.import': 'Загрузить из файла',
      'history.note': 'Очистка истории не возвращает удалённое — расширение просто перестаёт помнить эти записи. Файл данных переносит историю и списки на другой браузер.',
      'history.cleared': 'История «{name}» очищена',
      'help.title': 'Как это работает',
      'help.step1': 'Включи нужные модули — они появятся на открытых вкладках X сами.',
      'help.step2': 'Открой страницу X, где будешь чистить: ленту, «Подписки» или сообщения.',
      'help.step3': 'Внизу справа появится панель: там запуск, прогресс, «Стоп» и журнал.',
      'help.privacy': '<b>Данные остаются в браузере.</b> Список «кого не трогать» и история сделанного лежат в хранилище расширения, запросы уходят только на x.com. Серверов, токенов и аналитики нет.',
      'help.limits': '<b>Массовые действия упираются в лимиты X.</b> 50–100 отписок за подход спокойно, тысячи за день — временная блокировка действий. Всё удалённое необратимо.',
      'footer.privacy': 'без серверов · данные не покидают браузер',
      'data.fileAria': 'Файл данных Cleanup for X',
      'data.exported': 'Данные выгружены в файл',
      'data.badFile': 'это не файл Cleanup for X',
      'data.loaded': 'Загружено: защита +{protect}, история +{history}',
      'data.loadedLists': ', списков +{n}',
      'data.failed': 'Не получилось: {error}'
    },
    en: {
      'module.switchTitle': 'Turn {name} on or off',
      'module.openAria': 'Open: {name}',
      'module.opening': 'Opening the page on X',
      'module.modeBackgroundTitle': 'Runs in the background: you can close the tab',
      'module.modeTabTitle': 'Works while the X tab is open',
      'jobs.aria': 'In progress',
      'jobs.stopThisTitle': 'Stop this job',
      'jobs.noticeBody': '{status}. Finished work will not repeat — you can start again.',
      'protect.title': 'Who to leave alone',
      'protect.subtitle': 'these accounts will not be unfollowed',
      'protect.textAria': 'Text with links, handles or ids',
      'protect.placeholder': 'Paste any text: links, @handles, names or ids — accounts will be extracted',
      'protect.addText': 'Add from text',
      'protect.clearAll': 'Clear all',
      'protect.oneAria': 'Handle, link or id',
      'protect.onePlaceholder': '@handle, link or id',
      'protect.add': 'Add',
      'protect.removeTitle': 'Remove from list',
      'protect.removeAria': 'Remove {name}',
      'protect.removed': 'Removed: {name}',
      'protect.cleared': 'Protect list cleared',
      'protect.empty': 'Paste text with links or handles',
      'protect.found': 'Found {found}, new {added}',
      'protect.added': 'Added to the protect list',
      'protect.duplicate': 'Already in the list or not recognised',
      'history.title': 'What has been done',
      'history.export': 'Export to file',
      'history.import': 'Import from file',
      'history.note': 'Clearing history does not bring anything back — the extension just stops remembering those records. The data file moves history and lists to another browser.',
      'history.cleared': 'History for “{name}” cleared',
      'help.title': 'How it works',
      'help.step1': 'Turn on the modules you need — they will appear on open X tabs by themselves.',
      'help.step2': 'Open the X page you want to clean: timeline, Following or messages.',
      'help.step3': 'A panel appears in the bottom right corner: start, progress, Stop and the log live there.',
      'help.privacy': '<b>Data stays in your browser.</b> The protect list and action history are kept in the extension storage, and requests go only to x.com. There are no servers, tokens or analytics.',
      'help.limits': '<b>Mass actions hit X limits.</b> 50–100 unfollows per run is fine, thousands a day means a temporary block. Everything deleted is permanent.',
      'footer.privacy': 'no servers · data never leaves the browser',
      'data.fileAria': 'Cleanup for X data file',
      'data.exported': 'Data exported to a file',
      'data.badFile': 'this is not an Cleanup for X file',
      'data.loaded': 'Loaded: protect +{protect}, history +{history}',
      'data.loadedLists': ', lists +{n}',
      'data.failed': 'Failed: {error}'
    }
  });

  // Подписи в разметке: data-i18n, data-i18n-placeholder, data-i18n-aria.
  const локализоватьСтатику = () => {
    document.documentElement.lang = XCI18n.язык;
    document.querySelectorAll('[data-i18n]').forEach(узел => {
      узел.textContent = t(узел.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(узел => {
      узел.innerHTML = t(узел.dataset.i18nHtml);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(узел => {
      узел.placeholder = t(узел.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(узел => {
      узел.title = t(узел.dataset.i18nTitle);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(узел => {
      узел.setAttribute('aria-label', t(узел.dataset.i18nAria));
    });
  };

  // Служебные первые сегменты пути x.com — это не ник.
  const СЛУЖЕБНЫЕ_ПУТИ = new Set([
    'home', 'explore', 'notifications', 'messages', 'i', 'settings', 'search', 'following',
    'followers', 'compose', 'bookmarks', 'jobs', 'communities', 'premium', 'lists', 'account',
    'login', 'logout', 'signup', 'tos', 'privacy', 'hashtag', 'intent', 'share', 'about',
    'download', 'connect_people', 'verified', 'oauth', 'flow'
  ]);

  // =========================================================================
  //  Среда: настоящее расширение или предпросмотр без chrome.*
  // =========================================================================
  const естьChrome = typeof chrome !== 'undefined' && !!(chrome && chrome.storage && chrome.storage.sync);

  const настоящее = {
    syncGet: () => new Promise(готово => chrome.storage.sync.get(null, данные => готово(данные || {}))),
    localGet: ключи => new Promise(готово => chrome.storage.local.get(ключи, данные => готово(данные || {}))),
    syncSet: объект => new Promise(готово => chrome.storage.sync.set(объект, () => готово())),
    localSet: объект => new Promise(готово => chrome.storage.local.set(объект, () => готово())),
    вкладки: () => new Promise(готово => {
      try { chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, вкладки => готово(вкладки || [])); }
      catch (e) { готово([]); }
    }),
    открыть: адрес => {
      // Если нужная страница X уже открыта — переключаемся на неё, а не плодим
      // вкладки. Без разрешения tabs адреса чужих вкладок не видны, но X-вкладки
      // видны по host_permissions.
      try {
        chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, вкладки => {
          const цель = new URL(адрес);
          const готовая = (вкладки || []).find(вкладка => {
            try {
              // пока вкладка грузится, url ещё пуст — сравниваем pendingUrl
              const адресВкладки = new URL(вкладка.url || вкладка.pendingUrl);
              return адресВкладки.hostname === цель.hostname &&
                адресВкладки.pathname.replace(/\/$/, '') === цель.pathname.replace(/\/$/, '');
            } catch (e) { return false; }
          });
          if (готовая) {
            chrome.tabs.update(готовая.id, { active: true });
            if (typeof готовая.windowId === 'number') chrome.windows.update(готовая.windowId, { focused: true });
          } else {
            chrome.tabs.create({ url: адрес });
          }
        });
      } catch (e) { window.open(адрес, '_blank'); }
    },
    стоп: вид => { try { chrome.runtime.sendMessage({ type: 'jobs-stop', вид }); } catch (e) {} },
    перезагрузитьВкладки: () => { try { chrome.runtime.sendMessage({ type: 'reload-x-tabs' }); } catch (e) {} },
    версия: () => { try { return chrome.runtime.getManifest().version; } catch (e) { return ''; } },
    подписаться: обработчик => {
      const наХранилище = (изменения, область) => обработчик({ тип: 'storage', область, изменения });
      const наВкладки = () => обработчик({ тип: 'вкладки' });
      try { chrome.storage.onChanged.addListener(наХранилище); } catch (e) {}
      ['onCreated', 'onRemoved', 'onUpdated', 'onActivated'].forEach(событие => {
        try { chrome.tabs[событие].addListener(наВкладки); } catch (e) {}
      });
      return () => {
        try { chrome.storage.onChanged.removeListener(наХранилище); } catch (e) {}
        ['onCreated', 'onRemoved', 'onUpdated', 'onActivated'].forEach(событие => {
          try { chrome.tabs[событие].removeListener(наВкладки); } catch (e) {}
        });
      };
    }
  };

  // Демо-данные для design/popup-preview.html: страница открывается без
  // chrome.*, но рисует ровно тот же интерфейс с правдоподобными числами.
  const демонстрация = () => {
    const пачка = (сколько, сдвиг) => Array.from({ length: сколько }, (_, и) => String(1000000000 + сдвиг + и));
    const данные = {
      sync: { tweets: true, reposts: true, quotes: true, replies: true, likes: true, dms: true, unfollow: true },
      local: {
        'история': {
          unfollow: { ids: пачка(248, 1000) },
          reposts: { ids: пачка(1320, 2000) },
          quotes: { ids: пачка(57, 4000) },
          replies: { ids: пачка(64, 4500) },
          likes: { ids: пачка(430, 5000) },
          tweets: { ids: пачка(12, 7000) },
          dms: { ids: пачка(9, 8000) }
        },
        'защита': { ники: ['openai', 'github', 'nasa'], id: ['1234567890'] },
        'задания': {
          unfollow: {
            вид: 'unfollow', всего: 900, сделано: 412, пропущено: 3, ошибок: 0,
            запущено: true, статус: 'работаю', последняя: '', темп: 2000,
            старт: Date.now() - 8 * 60 * 1000
          },
          reposts: {
            вид: 'reposts', всего: 1320, сделано: 1320, пропущено: 0, ошибок: 0,
            запущено: false, статус: 'готово', последняя: '', темп: 1200,
            старт: Date.now() - 3 * 60 * 60 * 1000
          }
        }
      }
    };
    const вкладки = [{ id: 1, url: 'https://x.com/example' }, { id: 2, url: 'https://x.com/home' }];
    const слушатели = new Set();
    const послать = событие => слушатели.forEach(обработчик => {
      try { обработчик(событие); } catch (e) {}
    });
    const превратить = (объект, старое) => Object.fromEntries(
      Object.entries(объект).map(([ключ, значение]) => [ключ, { oldValue: старое[ключ], newValue: значение }])
    );
    let тик = null;

    return {
      syncGet: async () => ({ ...данные.sync }),
      localGet: async ключи => {
        const итог = {};
        (Array.isArray(ключи) ? ключи : [ключи]).forEach(ключ => {
          if (данные.local[ключ] !== undefined) итог[ключ] = данные.local[ключ];
        });
        return итог;
      },
      syncSet: async объект => {
        const старое = { ...данные.sync };
        Object.assign(данные.sync, объект);
        послать({ тип: 'storage', область: 'sync', изменения: превратить(объект, старое) });
      },
      localSet: async объект => {
        const старое = { ...данные.local };
        Object.assign(данные.local, объект);
        послать({ тип: 'storage', область: 'local', изменения: превратить(объект, старое) });
      },
      вкладки: async () => вкладки.slice(),
      открыть: адрес => { try { window.open(адрес, '_blank'); } catch (e) {} },
      стоп: вид => {
        const состояние = данные.local['задания'][вид];
        if (!состояние) return;
        состояние.запущено = false;
        состояние.статус = 'остановлено';
        послать({ тип: 'storage', область: 'local', изменения: { 'задания': { newValue: данные.local['задания'] } } });
      },
      перезагрузитьВкладки: () => {},
      версия: () => '1.12.1',
      подписаться: обработчик => {
        слушатели.add(обработчик);
        if (!тик) {
          тик = setInterval(() => {
            const задание = данные.local['задания'].unfollow;
            if (!задание || !задание.запущено) return;
            задание.сделано = Math.min(задание.всего, (задание.сделано || 0) + 1);
            if (задание.сделано >= задание.всего) { задание.запущено = false; задание.статус = 'готово'; }
            послать({ тип: 'storage', область: 'local', изменения: { 'задания': { newValue: данные.local['задания'] } } });
          }, 2600);
        }
        return () => слушатели.delete(обработчик);
      }
    };
  };

  const бэкенд = естьChrome ? настоящее : демонстрация();

  // =========================================================================
  //  Состояние и живая подписка
  // =========================================================================
  const состояние = {
    настройки: {},
    история: {},
    защита: { ники: [], id: [] },
    задания: {},
    вкладки: [],
    ник: ''
  };

  const карточки = new Map();
  let предупреждениеСкрыто = false;
  let таймерОпроса = null;
  let таймерВкладок = null;

  const какСписок = значение => {
    if (Array.isArray(значение)) return значение;
    if (typeof значение === 'string' && значение.trim()) return [значение];
    return [];
  };

  // Данные защиты могли остаться от старых версий (массив или строка вместо
  // объекта) — показываем их, а не пустой список.
  const нормЗащиту = список => {
    if (Array.isArray(список) || typeof список === 'string') {
      return { ники: [...new Set(какСписок(список).map(значение => String(значение).toLowerCase()))].filter(Boolean), id: [] };
    }
    return {
      ники: [...new Set(какСписок(список && список.ники).map(значение => String(значение).toLowerCase()))].filter(Boolean),
      id: [...new Set(какСписок(список && список.id).map(значение => String(значение)))].filter(Boolean)
    };
  };

  const никИзВкладок = вкладки => {
    for (const вкладка of вкладки) {
      try {
        const адрес = new URL(вкладка.url);
        if (!/(^|\.)x\.com$/.test(адрес.hostname) && !/(^|\.)twitter\.com$/.test(адрес.hostname)) continue;
        const первый = (адрес.pathname.split('/').filter(Boolean)[0] || '').toLowerCase();
        if (!первый || СЛУЖЕБНЫЕ_ПУТИ.has(первый)) continue;
        if (!/^[a-z0-9_]{1,15}$/.test(первый)) continue;
        return первый;
      } catch (e) {}
    }
    return '';
  };

  // =========================================================================
  //  Сообщение внизу
  // =========================================================================
  let таймерСообщения = null;
  const сообщить = (текст, плохо) => {
    const узел = $('#toast');
    if (!узел) return;
    узел.textContent = текст;
    узел.classList.toggle('is-bad', !!плохо);
    узел.classList.add('is-on');
    clearTimeout(таймерСообщения);
    таймерСообщения = setTimeout(() => узел.classList.remove('is-on'), 2400);
  };

  // =========================================================================
  //  Карточки модулей
  // =========================================================================
  const собратьМодули = () => {
    const контейнер = $('#modules');
    контейнер.innerHTML = '';
    МОДУЛИ.группы.forEach(группа => {
      const секция = эл('section', 'group');
      секция.appendChild(эл('h2', '', XCI18n.выбрать(группа.название)));
      const тело = эл('div', 'group-body');
      группа.иды.forEach(id => {
        const карточка = собратьКарточку(id);
        if (карточка) { тело.appendChild(карточка); карточки.set(id, карточка); }
      });
      секция.appendChild(тело);
      контейнер.appendChild(секция);
    });
  };

  const собратьКарточку = id => {
    const мета = МОДУЛИ.получить(id);
    if (!мета) return null;

    const карточка = эл('article', 'module');
    карточка.dataset.id = id;

    const иконка = эл('span', 'module-icon');
    иконка.innerHTML = мета.иконка;                 // наш собственный svg, не данные извне
    иконка.setAttribute('aria-hidden', 'true');

    const текст = эл('div', 'module-text');
    const заголовок = эл('div', 'module-title');
    заголовок.appendChild(эл('b', '', МОДУЛИ.название(id)));
    текст.appendChild(заголовок);
    текст.appendChild(эл('p', 'module-short', МОДУЛИ.кратко(id)));

    const строка = эл('div', 'module-meta');
    строка.appendChild(эл('span', 'where', МОДУЛИ.где(id)));
    const режим = эл('span', 'chip', мета.режим === 'фон' ? t('mode.background') : t('mode.tab'));
    режим.dataset.mode = мета.режим;
    режим.title = мета.режим === 'фон'
      ? t('module.modeBackgroundTitle')
      : t('module.modeTabTitle');
    строка.appendChild(режим);

    const открыть = эл('button', 'open-link');
    открыть.type = 'button';
    открыть.setAttribute('aria-label', t('module.openAria', { name: МОДУЛИ.кнопка(id) }));
    открыть.title = МОДУЛИ.кнопка(id);
    открыть.innerHTML = `${t('common.open')} <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.2 3.2H13v6.8"/><path d="M13 3.2 7.6 8.6"/><path d="M11.2 9.6v3.2H3.2V4.8h3.2"/></svg>`;
    открыть.addEventListener('click', () => {
      бэкенд.открыть(мета.страница(состояние.ник));
      сообщить(t('module.opening'));
    });
    строка.appendChild(открыть);
    текст.appendChild(строка);

    const бок = эл('div', 'module-side');
    const переключатель = эл('label', 'switch');
    переключатель.title = t('module.switchTitle', { name: МОДУЛИ.название(id) });
    const вход = document.createElement('input');
    вход.type = 'checkbox';
    вход.setAttribute('role', 'switch');
    вход.dataset.id = id;
    вход.setAttribute('aria-label', МОДУЛИ.название(id));
    const дорожка = эл('span', 'switch-track');
    дорожка.appendChild(эл('span', 'switch-thumb'));
    переключатель.append(вход, дорожка);

    вход.addEventListener('change', () => переключитьМодуль(id, вход.checked));

    бок.append(переключатель);
    карточка.append(иконка, текст, бок);
    return карточка;
  };

  const обновитьКарточку = id => {
    const карточка = карточки.get(id);
    if (!карточка) return;
    const включён = состояние.настройки[id] !== false;
    карточка.dataset.on = String(включён);
    const вход = карточка.querySelector('input[data-id]');
    if (вход) вход.checked = включён;
  };

  const обновитьПереключатели = () => карточки.forEach((_, id) => обновитьКарточку(id));

  const переключитьМодуль = async (id, значение) => {
    состояние.настройки[id] = значение;
    обновитьКарточку(id);
    const название = МОДУЛИ.название(id);
    сообщить(t(значение ? 'toast.enabled' : 'toast.disabled', { name: название }));
    await бэкенд.syncSet({ [id]: значение });
    бэкенд.перезагрузитьВкладки();
  };

  // =========================================================================
  //  Состояние страницы X
  // =========================================================================
  const нарисоватьСостояние = () => {
    const блок = $('#page-state');
    const текст = $('#page-state-text');
    const кнопка = $('#open-x');
    if (!блок || !текст) return;
    const количество = состояние.вкладки.length;
    if (количество) {
      блок.dataset.tone = 'ok';
      текст.textContent = t('page.open', {
        n: количество,
        word: XCI18n.числоСлово(количество, 'plural.tab')
      });
      if (кнопка) кнопка.textContent = t('app.openX');
    } else {
      блок.dataset.tone = 'wait';
      текст.textContent = t('page.closed');
      if (кнопка) кнопка.textContent = t('app.openX');
    }
  };

  const обновитьВкладки = async () => {
    состояние.вкладки = await бэкенд.вкладки();
    состояние.ник = никИзВкладок(состояние.вкладки);
    нарисоватьСостояние();
  };

  // =========================================================================
  //  Идущие задания
  // =========================================================================
  const нарисоватьРаботу = () => {
    const блок = $('#jobs');
    const список = $('#jobs-list');
    if (!блок || !список) return;
    const идущие = Object.keys(МОДУЛИ.видыЗаданий)
      .filter(вид => состояние.задания[вид] && состояние.задания[вид].запущено);

    список.innerHTML = '';
    блок.hidden = !идущие.length;
    if (идущие.length) предупреждениеСкрыто = false;
    идущие.forEach(вид => список.appendChild(строкаЗадания(вид, состояние.задания[вид])));

    нарисоватьПредупреждение();
    следитьЗаРаботой(идущие.length > 0);
  };

  const строкаЗадания = (вид, задание) => {
    const всего = Number(задание.всего) || 0;
    const сделано = Number(задание.сделано) || 0;
    const остаток = Math.max(0, всего - сделано);
    const доля = всего ? Math.min(100, Math.round(сделано / всего * 100)) : 0;

    const строка = эл('div', 'job');
    const верх = эл('div', 'job-top');
    верх.appendChild(эл('b', '', МОДУЛИ.названиеЗадания(вид)));
    верх.appendChild(эл('span', 'job-num', t('jobs.count', {
      done: XCI18n.число(сделано), total: XCI18n.число(всего)
    })));

    let подпись = `${доля}%`;
    if (задание.старт && сделано >= 3) {
      const прошло = (Date.now() - задание.старт) / 1000;
      const наШтуку = Math.max(прошло / сделано, 0.7);
      подпись = t('jobs.percent', { percent: доля, time: XCI18n.минуты(наШтуку * остаток) });
    }
    верх.appendChild(эл('span', 'job-pct', подпись));

    const стоп = эл('button', 'job-stop', t('jobs.stop'));
    стоп.type = 'button';
    стоп.title = t('jobs.stopThisTitle');
    стоп.addEventListener('click', () => остановитьЗадание(вид));
    верх.appendChild(стоп);

    const полоса = эл('div', 'bar');
    const заливка = document.createElement('i');
    заливка.style.width = `${доля}%`;
    if (доля >= 100) заливка.className = 'ok';
    полоса.appendChild(заливка);

    строка.append(верх, полоса);
    const сырое = String(задание.последняя || '') || (задание.статус && задание.статус !== 'работаю' ? String(задание.статус) : '');
    const примечание = XCI18n.статус(сырое);
    if (примечание) строка.appendChild(эл('div', 'job-note', примечание.slice(0, 80)));
    return строка;
  };

  const остановитьЗадание = вид => {
    состояние.задания[вид] = { ...(состояние.задания[вид] || {}), запущено: false, статус: 'остановлено' };
    нарисоватьРаботу();
    бэкенд.стоп(вид);
    сообщить(t('jobs.stoppedToast', { name: МОДУЛИ.названиеЗадания(вид) }));
  };

  const нарисоватьПредупреждение = () => {
    const блок = $('#notice');
    if (!блок) return;
    if (предупреждениеСкрыто) { блок.hidden = true; return; }
    const беда = Object.entries(состояние.задания).find(([, задание]) => {
      if (!задание || задание.запущено || !задание.старт) return false;
      if (Date.now() - задание.старт > 30 * 60 * 1000) return false;
      return /остановлен|ошибк|лимит|не отпускает|маршрут|сеть/i.test(String(задание.статус || ''));
    });
    if (!беда) { блок.hidden = true; return; }
    const [вид, задание] = беда;
    блок.hidden = false;
    блок.textContent = '';
    блок.appendChild(эл('b', '', `${МОДУЛИ.названиеЗадания(вид)}: `));
    блок.appendChild(document.createTextNode(t('jobs.noticeBody', { status: XCI18n.статус(задание.статус) })));
    const скрыть = эл('button', 'link-btn', t('notice.hide'));
    скрыть.type = 'button';
    скрыть.addEventListener('click', () => { предупреждениеСкрыто = true; нарисоватьПредупреждение(); });
    блок.appendChild(скрыть);
  };

  // Пока очередь идёт, раз в 3 секунды перечитываем состояние: страховка на
  // случай, если вкладка проспала событие storage. Подписка всё равно первая.
  const следитьЗаРаботой = надо => {
    if (надо && !таймерОпроса) {
      таймерОпроса = setInterval(async () => {
        const данные = await бэкенд.localGet(['задания']);
        состояние.задания = данные['задания'] || {};
        нарисоватьРаботу();
      }, 3000);
    } else if (!надо && таймерОпроса) {
      clearInterval(таймерОпроса);
      таймерОпроса = null;
    }
  };

  $('#jobs-stop-all').addEventListener('click', () => {
    const идущие = Object.keys(МОДУЛИ.видыЗаданий).filter(вид => состояние.задания[вид] && состояние.задания[вид].запущено);
    if (!идущие.length) { сообщить(t('jobs.nothing')); return; }
    идущие.forEach(вид => {
      состояние.задания[вид] = { ...состояние.задания[вид], запущено: false, статус: 'остановлено' };
      бэкенд.стоп(вид);
    });
    нарисоватьРаботу();
    сообщить(t('jobs.allStopped'));
  });

  // =========================================================================
  //  История: что уже сделано
  // =========================================================================
  const дваШага = (кнопка, подтверждение, действие) => {
    if (кнопка.dataset.confirm === '1') {
      кнопка.dataset.confirm = '';
      кнопка.textContent = кнопка.dataset.подпись || '';
      действие();
      return;
    }
    кнопка.dataset.подпись = кнопка.textContent;
    кнопка.dataset.confirm = '1';
    кнопка.textContent = подтверждение;
    clearTimeout(кнопка._таймер);
    кнопка._таймер = setTimeout(() => {
      кнопка.dataset.confirm = '';
      кнопка.textContent = кнопка.dataset.подпись || '';
    }, 3500);
  };

  const нарисоватьИсторию = () => {
    const список = $('#hist-list');
    if (!список) return;
    список.innerHTML = '';
    let всего = 0;

    МОДУЛИ.иды.forEach(id => {
      const запись = состояние.история[id];
      const записей = Array.isArray(запись && запись.ids) ? запись.ids.length : 0;
      всего += записей;

      const строка = эл('div', 'hist-row');
      строка.appendChild(эл('span', '', МОДУЛИ.название(id)));
      const число = эл('b', записей ? '' : 'zero', чисел(записей));
      число.id = 'hist-' + id;
      строка.appendChild(число);

      const очистить = эл('button', '', t('common.clear'));
      очистить.type = 'button';
      очистить.dataset.clear = id;
      очистить.addEventListener('click', () => дваШага(очистить, t('common.exactly'), async () => {
        await очиститьИсторию(id);
      }));
      строка.appendChild(очистить);
      список.appendChild(строка);
    });

    const итог = $('#hist-total');
    if (итог) итог.textContent = чисел(всего);
  };

  const очиститьИсторию = async id => {
    const было = состояние.история[id] || {};
    delete состояние.история[id];
    нарисоватьИсторию();
    сообщить(t('history.cleared', { name: МОДУЛИ.название(id) }));
    if (естьChrome) await XHistory.очистить(id);
    else if (было.ids) { /* в демо просто убрали из памяти */ }
  };

  // =========================================================================
  //  Кого не трогать
  // =========================================================================
  const нарисоватьЗащиту = () => {
    const счётчик = $('#protect-count');
    const список = $('#protect-list');
    if (!счётчик || !список) return;
    const ники = состояние.защита.ники;
    const иды = состояние.защита.id;
    счётчик.textContent = чисел(ники.length + иды.length);

    список.innerHTML = '';
    const записи = [
      ...ники.map(значение => ({ подпись: '@' + значение, значение })),
      ...иды.map(значение => ({ подпись: 'id ' + значение, значение }))
    ].sort((а, б) => а.подпись.localeCompare(б.подпись));

    записи.forEach(({ подпись, значение }) => {
      const чип = эл('span', 'chip-item');
      чип.appendChild(эл('span', '', подпись));
      const убрать = эл('button', '', '×');
      убрать.type = 'button';
      убрать.title = t('protect.removeTitle');
      убрать.setAttribute('aria-label', t('protect.removeAria', { name: подпись }));
      убрать.addEventListener('click', () => убратьИзЗащиты(значение, подпись));
      чип.appendChild(убрать);
      список.appendChild(чип);
    });
  };

  const добавитьВЗащиту = async текст => {
    const найдено = XProtect.разобратьТекст(текст);
    if (естьChrome) {
      const итог = await XProtect.добавитьИзТекста(текст);
      состояние.защита = нормЗащиту(итог.состояние);
      нарисоватьЗащиту();
      return итог;
    }
    const было = new Set([...состояние.защита.ники, ...состояние.защита.id]);
    состояние.защита = нормЗащиту({
      ники: [...состояние.защита.ники, ...найдено.ники],
      id: [...состояние.защита.id, ...найдено.id]
    });
    нарисоватьЗащиту();
    return {
      состояние: состояние.защита,
      добавлено: [...найдено.ники, ...найдено.id].filter(значение => !было.has(значение)).length,
      найдено: найдено.ники.length + найдено.id.length
    };
  };

  const убратьИзЗащиты = async (значение, подпись) => {
    if (естьChrome) состояние.защита = нормЗащиту(await XProtect.удалить(значение));
    else {
      состояние.защита = нормЗащиту({
        ники: состояние.защита.ники.filter(ник => '@' + ник !== подпись && ник !== подпись),
        id: состояние.защита.id.filter(ид => 'id ' + ид !== подпись && ид !== подпись)
      });
    }
    нарисоватьЗащиту();
    сообщить(t('protect.removed', { name: подпись }));
  };

  const очиститьЗащиту = async () => {
    if (естьChrome) состояние.защита = нормЗащиту(await XProtect.очистить());
    else состояние.защита = { ники: [], id: [] };
    нарисоватьЗащиту();
    сообщить(t('protect.cleared'));
  };

  $('#protect-toggle').addEventListener('click', () => {
    const тело = $('#protect-body');
    const кнопка = $('#protect-toggle');
    тело.hidden = !тело.hidden;
    кнопка.textContent = тело.hidden ? t('common.list') : t('common.collapse');
    кнопка.setAttribute('aria-expanded', String(!тело.hidden));
  });

  $('#protect-add-text').addEventListener('click', async () => {
    const поле = $('#protect-text');
    const текст = поле.value.trim();
    if (!текст) { сообщить(t('protect.empty'), true); return; }
    const итог = await добавитьВЗащиту(текст);
    поле.value = '';
    сообщить(t('protect.found', { found: итог.найдено, added: итог.добавлено }));
  });

  $('#protect-one').addEventListener('keydown', событие => {
    if (событие.key === 'Enter') { событие.preventDefault(); $('#protect-add-one').click(); }
  });

  $('#protect-add-one').addEventListener('click', async () => {
    const поле = $('#protect-one');
    const текст = поле.value.trim();
    if (!текст) return;
    const итог = await добавитьВЗащиту(текст);
    поле.value = '';
    сообщить(t(итог.добавлено ? 'protect.added' : 'protect.duplicate'));
  });

  $('#protect-clear').addEventListener('click', () => {
    дваШага($('#protect-clear'), t('common.exactly'), очиститьЗащиту);
  });

  // =========================================================================
  //  Данные: выгрузка и загрузка одним файлом
  // =========================================================================
  const ЛИМИТ_ИСТОРИИ = 20000;
  const КЛЮЧИ_АРХИВОВ = ['архив_списки', 'архив_репосты', 'архив_цитаты', 'архив_ответы', 'архив_лайки'];
  const КЛЮЧИ_ДАННЫХ = ['история', 'защита', ...КЛЮЧИ_АРХИВОВ];

  const объединить = (было, стало) => {
    const набор = new Set((было || []).map(String));
    let добавлено = 0;
    (стало || []).forEach(значение => {
      const строка = String(значение);
      if (!набор.has(строка)) { набор.add(строка); добавлено++; }
    });
    return { список: [...набор], добавлено };
  };

  /** Слияние снимка с текущими данными: ничего не затираем, только дополняем. */
  const слитьДанные = (текущие, снимок) => {
    const итог = { ...(текущие || {}) };
    const вход = (снимок && снимок.данные) || {};
    let защитаДобавлено = 0;
    let историяДобавлено = 0;
    let архивовДобавлено = 0;

    if (вход['защита']) {
      const было = нормЗащиту(текущие['защита']);
      const пришла = нормЗащиту(вход['защита']);
      const ники = объединить(было.ники, пришла.ники);
      const иды = объединить(было.id, пришла.id);
      итог['защита'] = { ники: ники.список, id: иды.список };
      защитаДобавлено = ники.добавлено + иды.добавлено;
    }

    if (вход['история'] && typeof вход['история'] === 'object') {
      const было = текущие['история'] || {};
      const новое = { ...было };
      Object.keys(вход['история']).forEach(модуль => {
        const объединено = объединить(((было[модуль] || {}).ids) || [], ((вход['история'][модуль] || {}).ids) || []);
        историяДобавлено += объединено.добавлено;
        новое[модуль] = {
          ids: объединено.список.length > ЛИМИТ_ИСТОРИИ ? объединено.список.slice(-ЛИМИТ_ИСТОРИИ) : объединено.список,
          ts: Date.now()
        };
      });
      итог['история'] = новое;
    }

    if (вход['архив_списки']) {
      const было = текущие['архив_списки'] || {};
      const подписки = объединить(было.подписки || [], вход['архив_списки'].подписки || []);
      const подписчики = объединить(было.подписчики || [], вход['архив_списки'].подписчики || []);
      if (подписки.добавлено || подписчики.добавлено) архивовДобавлено++;
      итог['архив_списки'] = {
        подписки: подписки.список,
        подписчики: подписчики.список,
        ts: Math.max(Number(было.ts) || 0, Number(вход['архив_списки'].ts) || 0, Date.now())
      };
    }

    ['архив_репосты', 'архив_цитаты', 'архив_ответы', 'архив_лайки'].forEach(ключ => {
      if (!вход[ключ]) return;
      const было = текущие[ключ] || {};
      const ids = объединить(было.ids || [], вход[ключ].ids || []);
      const свежее = (Number(вход[ключ].ts) || 0) >= (Number(было.ts) || 0);
      if (ids.добавлено) архивовДобавлено++;
      итог[ключ] = {
        ids: ids.список,
        ts: свежее ? (Number(вход[ключ].ts) || Date.now()) : было.ts,
        источник: свежее ? (вход[ключ].источник || '') : (было.источник || '')
      };
    });

    return { итог, защитаДобавлено, историяДобавлено, архивовДобавлено };
  };

  $('#data-export').addEventListener('click', async () => {
    const данные = await бэкенд.localGet(КЛЮЧИ_ДАННЫХ);
    const снимок = {
      приложение: 'Cleanup for X',
      версия: 2,
      когда: new Date().toISOString(),
      данные
    };
    const капля = new Blob([JSON.stringify(снимок, null, 2)], { type: 'application/json' });
    const ссылка = document.createElement('a');
    ссылка.href = URL.createObjectURL(капля);
    ссылка.download = 'cleanup-for-x-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(ссылка);
    ссылка.click();
    ссылка.remove();
    setTimeout(() => URL.revokeObjectURL(ссылка.href), 2000);
    сообщить(t('data.exported'));
  });

  $('#data-import').addEventListener('click', () => $('#data-file').click());

  $('#data-file').addEventListener('change', async () => {
    const файл = $('#data-file').files && $('#data-file').files[0];
    if (!файл) return;
    try {
      const снимок = JSON.parse(await файл.text());
      if (!снимок || снимок.приложение !== 'Cleanup for X' || !снимок.данные) {
        throw new Error(t('data.badFile'));
      }
      const текущие = await бэкенд.localGet(КЛЮЧИ_ДАННЫХ);
      const слито = слитьДанные(текущие, снимок);
      await бэкенд.localSet(слито.итог);
      состояние.история = слито.итог['история'] || {};
      состояние.защита = нормЗащиту(слито.итог['защита']);
      нарисоватьИсторию();
      нарисоватьЗащиту();
      сообщить(t('data.loaded', {
        protect: слито.защитаДобавлено, history: слито.историяДобавлено
      }) + (слито.архивовДобавлено ? t('data.loadedLists', { n: слито.архивовДобавлено }) : ''));
    } catch (e) {
      сообщить(t('data.failed', { error: (e && e.message || e) }), true);
    }
    $('#data-file').value = '';
  });

  // =========================================================================
  //  Живые события
  // =========================================================================
  const наСобытие = событие => {
    if (!событие) return;
    if (событие.тип === 'вкладки') {
      clearTimeout(таймерВкладок);
      таймерВкладок = setTimeout(обновитьВкладки, 120);
      return;
    }
    const изменения = событие.изменения || {};
    if (событие.область === 'sync') {
      let изменились = false;
      Object.entries(изменения).forEach(([ключ, изменение]) => {
        if (!МОДУЛИ.получить(ключ)) return;
        состояние.настройки[ключ] = изменение.newValue !== false;
        изменились = true;
      });
      if (изменились) обновитьПереключатели();
      return;
    }
    if (событие.область !== 'local') return;
    if (изменения['история']) {
      состояние.история = изменения['история'].newValue || {};
      нарисоватьИсторию();
    }
    if (изменения['защита']) {
      состояние.защита = нормЗащиту(изменения['защита'].newValue);
      нарисоватьЗащиту();
    }
    if (изменения['задания']) {
      состояние.задания = изменения['задания'].newValue || {};
      нарисоватьРаботу();
    }
  };

  // =========================================================================
  //  Старт
  // =========================================================================
  const запуск = async () => {
    локализоватьСтатику();
    собратьМодули();
    нарисоватьИсторию();
    нарисоватьЗащиту();
    нарисоватьРаботу();

    const [настройки, локальные, вкладки] = await Promise.all([
      бэкенд.syncGet(),
      бэкенд.localGet(['история', 'защита', 'задания']),
      бэкенд.вкладки()
    ]);

    состояние.настройки = настройки || {};
    состояние.история = локальные['история'] || {};
    состояние.защита = нормЗащиту(локальные['защита']);
    состояние.задания = локальные['задания'] || {};
    состояние.вкладки = вкладки || [];
    состояние.ник = никИзВкладок(состояние.вкладки);

    // первый запуск: фиксируем явные значения, чтобы фон и вкладки видели одно
    const неЗаданы = МОДУЛИ.иды.filter(id => состояние.настройки[id] === undefined);
    if (неЗаданы.length) {
      неЗаданы.forEach(id => { состояние.настройки[id] = МОДУЛИ.поУмолчанию; });
      if (естьChrome) бэкенд.syncSet(Object.fromEntries(неЗаданы.map(id => [id, МОДУЛИ.поУмолчанию])));
    }

    обновитьПереключатели();
    нарисоватьИсторию();
    нарисоватьЗащиту();
    нарисоватьСостояние();
    нарисоватьРаботу();

    const версия = $('#version');
    if (версия) версия.textContent = 'v' + (бэкенд.версия() || '1.11.0');
    локализоватьСтатику();

    бэкенд.подписаться(наСобытие);
  };

  $('#open-x').addEventListener('click', () => бэкенд.открыть('https://x.com/home'));

  // Для тестов: чистая функция слияния файлов данных.
  window.__XCleaner = { слитьДанные, состояние };

  запуск();
})();
