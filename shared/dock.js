// ---------------------------------------------------------------------------
//  Один док на все модули вместо панелей, которые наезжали друг на друга.
//
//  Модуль отдаёт доку свою панель — док кладёт её во вкладку. На экране всегда
//  один блок: шапка, ряд вкладок по включённым модулям, тело активной вкладки,
//  журнал последних событий.
//
//  В шапке живёт строка состояния: даже свёрнутый док показывает, что прямо
//  сейчас идёт работа (её пишет фон в chrome.storage.local, ключ «задания»).
//  Словарь модулей (названия, иконки, порядок) — общий, shared/modules.js.
//
//  Тема берётся у X, а не у системы: у X свой Default / Dim / Lights out, и
//  панель не должна из него выпадать.
// ---------------------------------------------------------------------------
(() => {
  const t = (ключ, данные) => XCI18n.t(ключ, данные);

  // Строки дока: шапка, журнал и строка состояния.
  XCI18n.добавить({
    ru: {
      'dock.aria': 'Cleanup for X — инструменты чистки аккаунта X',
      'dock.jobsRunning': 'идут {n} задачи',
      'dock.stopped': '{name}: остановлено',
      'dock.allStopped': 'все очереди остановлены',
      'dock.workingTitle': 'Сейчас идёт фоновая работа',
      'dock.collapseAria': 'Свернуть панель',
      'dock.expandAria': 'Развернуть панель',
      'tab.tweets': 'Твиты',
      'tab.reposts': 'Репосты',
      'tab.quotes': 'Цитаты',
      'tab.likes': 'Лайки',
      'tab.ghostlikes': 'Зависшие',
      'tab.unfollow': 'Отписка',
      'tab.dms': 'ЛС'
    },
    en: {
      'dock.aria': 'Cleanup for X — cleanup tools for your X account',
      'dock.jobsRunning': '{n} jobs running',
      'dock.stopped': '{name}: stopped',
      'dock.allStopped': 'all queues stopped',
      'dock.workingTitle': 'Background work is in progress',
      'dock.collapseAria': 'Collapse panel',
      'dock.expandAria': 'Expand panel',
      'tab.tweets': 'Tweets',
      'tab.reposts': 'Reposts',
      'tab.quotes': 'Quotes',
      'tab.likes': 'Likes',
      'tab.ghostlikes': 'Stuck',
      'tab.unfollow': 'Unfollow',
      'tab.dms': 'DMs'
    }
  });

  const СЛОВАРЬ = window.XCModules;
  const ПОДПИСИ = {};
  const ПОРЯДОК = [];
  if (СЛОВАРЬ) {
    СЛОВАРЬ.иды.forEach(id => {
      ПОДПИСИ[id] = СЛОВАРЬ.название(id);
      ПОРЯДОК.push(id);
    });
  }

  const иконка = id => (СЛОВАРЬ && СЛОВАРЬ.получить(id) ? СЛОВАРЬ.получить(id).иконка : '');
  const ВИДЫ_ЗАДАНИЙ = (СЛОВАРЬ && СЛОВАРЬ.видыЗаданий) || {
    unfollow: 'Отписка', reposts: 'Репосты', quotes: 'Цитаты', likes: 'Лайки'
  };
  const названиеЗадания = вид => (
    СЛОВАРЬ && СЛОВАРЬ.названиеЗадания ? СЛОВАРЬ.названиеЗадания(вид) : String(ВИДЫ_ЗАДАНИЙ[вид] || вид)
  );

  let док = null;
  let вкладкиРяд = null;
  let тело = null;
  let журналБлок = null;
  let журналСписок = null;
  let журналСчёт = null;
  let строкаСостояния = null;
  let активная = null;

  const вкладки = new Map();       // id → { кнопка, элемент, титул }
  const записи = [];               // журнал: { время, текст, тон }

  // Фон может быть прозрачным или лежать не на body, а на html. Прозрачное
  // считаем отсутствием темы: пусть останется системная, а не «тёмная из нуля».
  const яркостьФона = элемент => {
    if (!элемент) return null;
    const фон = getComputedStyle(элемент).backgroundColor || '';
    const m = фон.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const части = m[1].split(',').map(значение => parseFloat(значение));
    if (части.length >= 4 && (части[3] === 0 || Number.isNaN(части[3]))) return null;
    const [к, з, с] = части;
    if ([к, з, с].some(Number.isNaN)) return null;
    return (0.2126 * к + 0.7152 * з + 0.0722 * с) / 255;
  };

  const темаСтраницы = () => {
    try {
      const яркость = яркостьФона(document.body) ?? яркостьФона(document.documentElement);
      if (яркость == null) return null;
      return яркость < 0.5 ? 'dark' : 'light';
    } catch (e) { return null; }
  };

  const подстроитьТему = () => {
    if (!док) return;
    const тема = темаСтраницы();
    if (тема && док.getAttribute('data-xc-theme') !== тема) док.setAttribute('data-xc-theme', тема);
  };

  // --- состояние работы в шапке -------------------------------------------
  const нарисоватьСостояниеРаботы = задания => {
    if (!строкаСостояния) return;
    const список = Object.entries(задания || {}).filter(([, состояние]) => состояние && состояние.запущено);
    if (список.length) {
      строкаСостояния.hidden = false;
      строкаСостояния.dataset.tone = 'run';
      строкаСостояния.title = t('dock.workingTitle');
      if (список.length === 1) {
        const [вид, состояние] = список[0];
        const подпись = названиеЗадания(вид);
        строкаСостояния.textContent = `${подпись}: ` + t('jobs.count', {
          done: XCI18n.число(состояние.сделано || 0),
          total: XCI18n.число(состояние.всего || 0)
        });
      } else {
        строкаСостояния.textContent = t('dock.jobsRunning', { n: список.length });
      }
      return;
    }

    // Остановка — тоже важная новость: её видно, даже если док свёрнут.
    const беда = Object.entries(задания || {}).find(([, состояние]) => состояние && состояние.старт &&
      !состояние.запущено && /остановлен|ошибк|лимит|маршрут|сеть/i.test(String(состояние.статус || '')) &&
      Date.now() - состояние.старт < 30 * 60 * 1000);
    if (беда) {
      строкаСостояния.hidden = false;
      строкаСостояния.dataset.tone = 'bad';
      строкаСостояния.textContent = t('dock.stopped', { name: названиеЗадания(беда[0]) });
      строкаСостояния.title = String(беда[1].статус || '');
      return;
    }

    строкаСостояния.hidden = true;
    строкаСостояния.textContent = '';
    строкаСостояния.title = '';
  };

  const подписатьсяНаРаботу = () => {
    try {
      chrome.storage.local.get('задания', данные => нарисоватьСостояниеРаботы((данные && данные['задания']) || {}));
    } catch (e) {}
    try {
      chrome.storage.onChanged.addListener((изменения, область) => {
        if (область !== 'local' || !изменения['задания']) return;
        нарисоватьСостояниеРаботы(изменения['задания'].newValue || {});
      });
    } catch (e) {}
  };

  const поднять = () => {
    if (док) return док;
    док = document.createElement('aside');
    док.id = 'xc-dock';
    док.className = 'xc-dock';
    док.setAttribute('aria-label', t('dock.aria'));
    док.innerHTML = `
      <div class="xc-dock-head">
        <span class="xc-dock-mark" aria-hidden="true">CX</span>
        <span class="xc-dock-title">Cleanup for X</span>
        <span class="xc-dock-status" data-tone="run" role="status" hidden></span>
        <span class="xc-dock-spacer"></span>
        <button class="xc-dock-btn" data-collapse type="button" aria-label="${t('dock.collapseAria')}" aria-expanded="true">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6.5 8 10.5l4.5-4"/></svg>
        </button>
      </div>
      <nav class="xc-dock-tabs" role="tablist" aria-label="${t('common.tools')}"></nav>
      <div class="xc-dock-body"></div>
      <details class="xc-dock-log" hidden>
        <summary>
          <span>${t('common.journal')}</span>
          <span class="xc-dock-log-right"><span data-count>0</span>
            <button class="xc-dock-link" data-stop-all type="button">${t('common.stopAll').toLowerCase()}</button>
          </span>
        </summary>
        <ul data-entries></ul>
      </details>`;

    document.body.appendChild(док);
    вкладкиРяд = док.querySelector('.xc-dock-tabs');
    тело = док.querySelector('.xc-dock-body');
    журналБлок = док.querySelector('.xc-dock-log');
    журналСписок = док.querySelector('[data-entries]');
    журналСчёт = док.querySelector('[data-count]');
    строкаСостояния = док.querySelector('.xc-dock-status');

    док.querySelector('[data-collapse]').addEventListener('click', () => {
      const свёрнут = док.classList.toggle('is-collapsed');
      док.querySelector('[data-collapse]').setAttribute('aria-expanded', String(!свёрнут));
      док.querySelector('[data-collapse]').setAttribute('aria-label', свёрнут ? t('dock.expandAria') : t('dock.collapseAria'));
    });

    док.querySelector('[data-stop-all]').addEventListener('click', () => {
      Object.keys(ВИДЫ_ЗАДАНИЙ).forEach(вид => {
        try { chrome.runtime.sendMessage({ type: 'jobs-stop', вид }); } catch (e) {}
      });
      журнал(t('dock.allStopped'));
    });

    подстроитьТему();
    setInterval(подстроитьТему, 2500);
    подписатьсяНаРаботу();
    return док;
  };

  const перестроитьВкладки = () => {
    const порядок = [...вкладки.keys()].sort((а, б) => {
      const иа = ПОРЯДОК.indexOf(а);
      const иб = ПОРЯДОК.indexOf(б);
      return (иа < 0 ? 99 : иа) - (иб < 0 ? 99 : иб);
    });
    порядок.forEach(id => вкладкиРяд.appendChild(вкладки.get(id).кнопка));
  };

  const показать = id => {
    if (!вкладки.has(id)) return;
    активная = id;
    вкладки.forEach((запись, ключ) => {
      const видно = ключ === id;
      запись.элемент.hidden = !видно;
      запись.кнопка.setAttribute('aria-selected', String(видно));
    });
  };

  const регистрировать = ({ id, титул, элемент }) => {
    if (!id || !элемент) return null;
    поднять();
    if (вкладки.has(id)) return вкладки.get(id);

    const ключ = 'tab.' + id;
    const подпись = (typeof XCI18n !== 'undefined' && XCI18n.есть(ключ))
      ? t(ключ)
      : (титул || ПОДПИСИ[id] || id);
    const кнопка = document.createElement('button');
    кнопка.type = 'button';
    кнопка.setAttribute('role', 'tab');
    кнопка.dataset.tab = id;
    кнопка.title = титул || подпись;
    кнопка.innerHTML = `${иконка(id)}<span>${подпись}</span>`;
    кнопка.addEventListener('click', () => показать(id));

    элемент.hidden = true;
    тело.appendChild(элемент);

    вкладки.set(id, { кнопка, элемент, титул: подпись });
    перестроитьВкладки();
    if (!активная) показать(id);
    подстроитьТему();
    return вкладки.get(id);
  };

  const журнал = (текст, тон) => {
    if (!текст) return;
    записи.push({
      время: new Date().toLocaleTimeString(XCI18n.локаль, { hour: '2-digit', minute: '2-digit' }),
      текст: String(текст),
      тон: тон || ''
    });
    while (записи.length > 40) записи.shift();
    if (!док) поднять();
    журналБлок.hidden = false;
    журналСчёт.textContent = String(записи.length);
    журналСписок.innerHTML = '';
    записи.slice(-6).reverse().forEach(запись => {
      const пункт = document.createElement('li');
      if (запись.тон) пункт.className = запись.тон;
      const время = document.createElement('time');
      время.textContent = запись.время;
      const текст = document.createElement('span');
      текст.textContent = запись.текст;
      пункт.append(время, текст);
      журналСписок.appendChild(пункт);
    });
  };

  window.XCDock = { регистрировать, показать, журнал, подстроитьТему };
})();
