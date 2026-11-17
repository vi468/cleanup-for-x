// ---------------------------------------------------------------------------
//  Один маленький словарь на всё расширение: интерфейс, попап, док, панели.
//
//  Язык определяется один раз при загрузке: сначала параметр ?lang=ru|en
//  (нужен для предпросмотра и скриншотов), потом язык браузера/Chrome.
//  По умолчанию — английский; русский включается, если язык начинается с "ru".
//
//  Строки живут рядом с тем местом, где используются: модуль вызывает
//  XCI18n.добавить({ ru: {...}, en: {...} }) и дальше XCI18n.t('ключ').
//  Общие строки (кнопки, статусы очереди, время) — здесь, в ядре.
//
//  Подстановки: {name}, {n}. Склонения: XCI18n.числоСлово(n, 'plural.tab'),
//  где ключ хранит массив форм: ru — [1, 2, 5], en — [1, many].
// ---------------------------------------------------------------------------
(() => {
  const изАдреса = (() => {
    try {
      const найдено = /[?&]lang=(ru|en)\b/.exec(location.search || '');
      return найдено ? найдено[1] : '';
    } catch (e) { return ''; }
  })();

  const языкБраузера = () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage) {
        const изChrome = chrome.i18n.getUILanguage();
        if (изChrome) return String(изChrome);
      }
    } catch (e) {}
    try { return String((typeof navigator !== 'undefined' && navigator.language) || 'en'); }
    catch (e) { return 'en'; }
  };

  let язык = изАдреса || (языкБраузера().toLowerCase().startsWith('ru') ? 'ru' : 'en');
  const словари = { ru: {}, en: {} };

  const добавить = набор => {
    if (!набор) return;
    for (const код of ['ru', 'en']) Object.assign(словари[код], набор[код] || {});
  };

  const взять = ключ => {
    const словарь = словари[язык] || словари.en;
    if (словарь[ключ] !== undefined) return словарь[ключ];
    if (словари.en[ключ] !== undefined) return словари.en[ключ];
    return словари.ru[ключ] !== undefined ? словари.ru[ключ] : ключ;
  };

  /** Перевод с подстановками: t('jobs.count', { done: 3, total: 9 }). */
  const t = (ключ, данные) => {
    let строка = взять(ключ);
    if (Array.isArray(строка)) строка = строка[0];
    if (!данные) return String(строка);
    return String(строка).replace(/\{(\w+)\}/g, (целое, имя) => (
      данные[имя] === undefined ? целое : String(данные[имя])
    ));
  };

  /** Выбор из объекта { ru, en } — для словаря модулей. */
  const выбрать = объект => {
    if (!объект) return '';
    if (typeof объект === 'string') return объект;
    return объект[язык] !== undefined ? объект[язык]
      : (объект.en !== undefined ? объект.en : (объект.ru || ''));
  };

  /** Склонение по числу для ключа-массива форм. */
  const числоСлово = (n, ключ) => {
    const формы = взять(ключ);
    const число = Math.abs(Number(n) || 0);
    if (!Array.isArray(формы)) return String(формы);
    if (язык === 'ru') {
      const сто = число % 100;
      if (сто >= 11 && сто <= 14) return формы[2] || формы[1] || формы[0];
      const десяток = сто % 10;
      if (десяток === 1) return формы[0];
      if (десяток >= 2 && десяток <= 4) return формы[1] || формы[0];
      return формы[2] || формы[1] || формы[0];
    }
    return число === 1 ? формы[0] : (формы[1] || формы[0]);
  };

  const локаль = () => (язык === 'ru' ? 'ru-RU' : 'en-GB');

  /** Число с разделителями: 12 345 / 12,345. */
  const число = n => {
    try { return Number(n || 0).toLocaleString(локаль()); }
    catch (e) { return String(n || 0); }
  };

  /** Дата и время загруженного архива: 14.11, 06:44 / 14 Nov, 06:44. */
  const дата = миллисекунды => {
    if (!миллисекунды) return '';
    try {
      return new Date(миллисекунды).toLocaleString(локаль(), {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return ''; }
  };

  const минуты = сек => {
    if (!isFinite(сек) || сек <= 0) return t('time.lessMinute');
    if (сек < 60) return t('time.seconds', { n: Math.max(1, Math.round(сек)) });
    const м = Math.round(сек / 60);
    if (м < 60) return t('time.minutes', { n: м });
    return t('time.hours', { h: Math.floor(м / 60), m: м % 60 });
  };

  // Статусы фоновой очереди пишутся в хранилище по-русски (это внутренний
  // контракт воркера). Для английского интерфейса переводим их на лету.
  const статусы = [
    [/^работаю$/, () => t('status.working')],
    [/^готово$/, () => t('status.done')],
    [/^простой$/, () => t('status.idle')],
    [/^остановлено$/, () => t('status.stopped')],
    [/^жду прокрутки$/, () => t('status.waitingScroll')],
    [/^пауза — лимит X$/, () => t('status.ratePaused')],
    [/^пауза (\d+) с после (\d+)$/, м => t('status.pauseAfter', { s: м[1], n: м[2] })],
    [/^остановлено: лимит X не отпускает$/, () => t('status.limitStuck')],
    [/^остановлено: маршрут не тот \(404\)$/, () => t('status.route404')],
    [/^остановлено: 5 ошибок подряд$/, () => t('status.fiveErrors')],
    [/^остановлено: (401|403|404)$/, м => t('status.httpStopped', { code: м[1] })],
    [/^остановлено: сеть$/, () => t('status.networkStopped')],
    [/^остановлено: (.+)$/, м => t('status.stoppedReason', { reason: м[1] })],
    [/^(\S+): 429, пауза (\d+) с$/, м => t('status.item429', { id: м[1], s: м[2] })],
    [/^(\S+): 404 без тела.*$/, м => t('status.item404', { id: м[1] })],
    [/^(\S+): (\d+) (.+)$/, м => t('status.itemHttp', { id: м[1], code: м[2], body: м[3] })]
  ];

  const статус = строка => {
    const текст = String(строка || '');
    if (!текст) return '';
    if (язык === 'ru') return текст;
    for (const [шаблон, перевод] of статусы) {
      const найдено = текст.match(шаблон);
      if (найдено) return перевод(найдено);
    }
    return текст;
  };

  const есть = ключ => словари[язык][ключ] !== undefined || словари.en[ключ] !== undefined;

  const установить = код => {
    if (код === 'ru' || код === 'en') язык = код;
    return язык;
  };

  добавить({
    ru: {
      'app.subtitle': 'чистка аккаунта X',
      'app.openX': 'Открыть x.com',
      'page.open': 'X открыт · {n} {word} · можно чистить',
      'page.closed': 'X не открыт: кнопки появятся, когда откроешь x.com',
      'plural.tab': ['вкладка', 'вкладки', 'вкладок'],
      'common.stop': 'Стоп',
      'common.stopAll': 'Стоп всё',
      'common.clear': 'очистить',
      'common.exactly': 'точно?',
      'common.hide': 'скрыть',
      'common.open': 'Открыть',
      'common.list': 'список',
      'common.collapse': 'свернуть',
      'common.expand': 'развернуть',
      'common.tools': 'Инструменты',
      'common.journal': 'Журнал',
      'common.back': 'Назад',
      'mode.background': 'в фоне',
      'mode.tab': 'во вкладке',
      'mode.working': 'работаю',
      'mode.paused': 'пауза',
      'mode.done': 'готово',
      'mode.stopped': 'остановлено',
      'mode.idle': 'не запущено',
      'toast.enabled': '{name}: включено',
      'toast.disabled': '{name}: выключено',
      'jobs.title': 'Сейчас идёт',
      'jobs.stopAll': 'Стоп всё',
      'jobs.stop': 'стоп',
      'jobs.count': '{done} из {total}',
      'jobs.percent': '{percent}% · ~{time}',
      'jobs.nothing': 'Сейчас ничего не идёт',
      'jobs.allStopped': 'Все очереди остановлены',
      'jobs.stoppedToast': '{name}: остановлено',
      'jobs.notice': '{name}: {status}. Уже сделанное не повторится — можно запустить снова.',
      'notice.hide': 'скрыть',
      'time.lessMinute': 'меньше минуты',
      'time.seconds': '{n} с',
      'time.minutes': '{n} мин',
      'time.hours': '{h} ч {m} мин',
      'status.working': 'работаю',
      'status.done': 'готово',
      'status.idle': 'простой',
      'status.stopped': 'остановлено',
      'status.waitingScroll': 'жду прокрутки',
      'status.ratePaused': 'пауза — лимит X',
      'status.pauseAfter': 'пауза {s} с после {n}',
      'status.limitStuck': 'остановлено: лимит X не отпускает',
      'status.route404': 'остановлено: маршрут не тот (404)',
      'status.fiveErrors': 'остановлено: 5 ошибок подряд',
      'status.httpStopped': 'остановлено: {code}',
      'status.networkStopped': 'остановлено: сеть',
      'status.stoppedReason': 'остановлено: {reason}',
      'status.item429': '{id}: 429, пауза {s} с',
      'status.item404': '{id}: 404 без тела — похоже, сменился queryId',
      'status.itemHttp': '{id}: {code} {body}'
    },
    en: {
      'app.subtitle': 'tools for your X account',
      'app.openX': 'Open x.com',
      'page.open': 'X is open · {n} {word} · ready to clean',
      'page.closed': 'X is not open: buttons will appear when you open x.com',
      'plural.tab': ['tab', 'tabs'],
      'common.stop': 'Stop',
      'common.stopAll': 'Stop all',
      'common.clear': 'clear',
      'common.exactly': 'sure?',
      'common.hide': 'hide',
      'common.open': 'Open',
      'common.list': 'list',
      'common.collapse': 'collapse',
      'common.expand': 'expand',
      'common.tools': 'Tools',
      'common.journal': 'Log',
      'common.back': 'Back',
      'mode.background': 'in background',
      'mode.tab': 'keep tab open',
      'mode.working': 'working',
      'mode.paused': 'paused',
      'mode.done': 'done',
      'mode.stopped': 'stopped',
      'mode.idle': 'not started',
      'toast.enabled': '{name}: on',
      'toast.disabled': '{name}: off',
      'jobs.title': 'In progress',
      'jobs.stopAll': 'Stop all',
      'jobs.stop': 'stop',
      'jobs.count': '{done} of {total}',
      'jobs.percent': '{percent}% · ~{time} left',
      'jobs.nothing': 'Nothing is running right now',
      'jobs.allStopped': 'All queues stopped',
      'jobs.stoppedToast': '{name}: stopped',
      'jobs.notice': '{name}: {status}. Finished work will not repeat — you can start again.',
      'notice.hide': 'hide',
      'time.lessMinute': 'less than a minute',
      'time.seconds': '{n} s',
      'time.minutes': '{n} min',
      'time.hours': '{h} h {m} min',
      'status.working': 'working',
      'status.done': 'done',
      'status.idle': 'idle',
      'status.stopped': 'stopped',
      'status.waitingScroll': 'waiting for scroll',
      'status.ratePaused': 'paused — X rate limit',
      'status.pauseAfter': 'pause {s} s after {n}',
      'status.limitStuck': 'stopped: X rate limit does not ease',
      'status.route404': 'stopped: wrong route (404)',
      'status.fiveErrors': 'stopped: 5 errors in a row',
      'status.httpStopped': 'stopped: {code}',
      'status.networkStopped': 'stopped: network',
      'status.stoppedReason': 'stopped: {reason}',
      'status.item429': '{id}: 429, pause {s} s',
      'status.item404': '{id}: 404 without body — queryId probably changed',
      'status.itemHttp': '{id}: {code} {body}'
    }
  });

  window.XCI18n = {
    get язык() { return язык; },
    get локаль() { return локаль(); },
    t,
    выбрать,
    числоСлово,
    число,
    дата,
    минуты,
    статус,
    есть,
    ключи: код => Object.keys(словари[код] || {}),
    добавить,
    установить
  };
})();
