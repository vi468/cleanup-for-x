// ============================================================================
//  МОДУЛЬ «ОТМЕНА РЕПОСТОВ» — x.com, любая страница
//
//  Берёшь из скачанного архива X файл data/tweets.js — скрипт отбирает из него
//  ЧИСТО РЕПОСТЫ: записи, сделанные одной кнопкой, без своего текста.
//
//  - цитаты (свой комментарий + чужой твит) НЕ трогаются — они в отдельном
//    модуле «Отмена цитат»;
//  - свои обычные твиты и ответы тоже не трогаются;
//  - архив не обязателен: «Отменять при листании» — открываешь свой профиль,
//    вкладку «Репосты» и просто листаешь: каждая карточка репоста сразу уходит
//    в фоновую очередь и снимается, не дожидаясь конца списка (но берётся только
//    то, что X успел отрисовать — обычно до ~3200; полный список даёт архив);
//  - каждый репост снимается точечным запросом DeleteRetweet по id;
//  - работу делает фон (background/queue.js, вид «reposts»), поэтому вкладку
//    можно закрыть, а очередь продолжится с того же места.
// ============================================================================
XC.модуль('reposts', () => {
  if (window.__репосты) return null;

  const t = (ключ, данные) => XCI18n.t(ключ, данные);
  const журнал = (имя, данные) => { try { if (window.XCDebug) window.XCDebug.событие(имя, { вид: 'reposts', ...данные }); } catch (e) {} };
  XCI18n.добавить({
    ru: {
      'reposts.title': 'Отмена репостов',
      'reposts.choose': 'Выбрать tweets.js',
      'reposts.action': 'Отменить',
      'reposts.describe': 'цитат не трогаю: {n} — они в модуле «Отмена цитат»',
      'reposts.describeProtected': ' · из списка защиты: {n}',
      'reposts.protected': 'этот аккаунт в списке «кого не трогать»: пропустил {n}',
      'reposts.scrollLabel': 'Отменять при листании',
      'reposts.errorNoArray': 'в файле нет массива твитов — нужен data/tweets.js',
      'reposts.errorJson': 'внутри tweets.js не JSON — возможно, файл обрезан',
      'reposts.errorNotArray': 'ожидал массив твитов, а внутри не массив',
      'reposts.skipped': 'уже снято ранее: пропустил {n}',
      'reposts.stopped': 'остановлено',
      'reposts.backgroundFailed': 'фон не смог снять этот репост — остановился',
      'reposts.undoing': 'отменяю по одному: снято {n}',
      'reposts.summary': 'снято {n}, уже снято ранее {m} — обнови вкладку, карточки в кэше',
      'reposts.none': 'не вижу твоих репостов — открой свой профиль, вкладку «Репосты»'
    },
    en: {
      'reposts.title': 'Undo reposts',
      'reposts.choose': 'Choose tweets.js',
      'reposts.action': 'Undo',
      'reposts.describe': 'not touching {n} quotes — they are in the Quotes module',
      'reposts.describeProtected': ' · protected accounts: {n}',
      'reposts.protected': 'this account is on the protect list: skipped {n}',
      'reposts.scrollLabel': 'Undo while scrolling',
      'reposts.errorNoArray': 'no tweets array in the file — data/tweets.js is needed',
      'reposts.errorJson': 'tweets.js does not contain JSON — the file may be truncated',
      'reposts.errorNotArray': 'expected an array of tweets, got something else',
      'reposts.skipped': 'already undone earlier: skipped {n}',
      'reposts.stopped': 'stopped',
      'reposts.backgroundFailed': 'the background could not undo this repost — stopped',
      'reposts.undoing': 'undoing one by one: {n} undone',
      'reposts.summary': '{n} undone, {m} already undone — reload the tab, cards are cached',
      'reposts.none': 'I cannot see your reposts — open your profile’s Reposts tab'
    }
  });
  if (!/(^|\.)x\.com$/.test(location.hostname) && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return console.log('❌ открой x.com и запусти скрипт там');
  }

  /** tweets.js → чистые репосты. Цитаты считаем, но не отдаём в работу. */
  const разобрать = текст => {
    let body = String(текст || '').trim();
    const начало = body.indexOf('[');
    if (начало < 0) throw new Error(t('reposts.errorNoArray'));

    let данные;
    try { данные = JSON.parse(body.slice(начало).replace(/;\s*$/, '')); }
    catch (e) { throw new Error(t('reposts.errorJson')); }
    if (!Array.isArray(данные)) throw new Error(t('reposts.errorNotArray'));

    const ids = [];
    const видели = new Set();
    let цитат = 0;
    let обычных = 0;
    let защищено = 0;

    for (const item of данные) {
      const t = item && (item.tweet || item);
      if (!t || !t.id_str) continue;
      const текст = String(t.full_text || t.text || '');
      const репост = t.retweeted === true || /^RT @/.test(текст);
      if (!репост) {
        const цитата = t.is_quote_status === true || !!t.quoted_status_id_str ||
          !!(t.quoted_status_permalink && t.quoted_status_permalink.url);
        if (цитата) цитат++;
        else обычных++;
        continue;
      }
      // Репост защищённого аккаунта не снимаем: список «кого не трогать»
      // по умолчанию действует во всех модулях.
      const автор = t.retweeted_status && t.retweeted_status.user;
      if (window.XProtect && XProtect.защищён({
        ник: автор && автор.screen_name,
        id: автор && (автор.id_str || автор.id)
      })) { защищено++; continue; }

      // Один и тот же репост встречается в архивных частях дважды — id уникален.
      if (видели.has(t.id_str)) continue;
      видели.add(t.id_str);
      ids.push(String(t.id_str));
    }
    return { ids, цитат, обычных, защищено };
  };

  // ------------------------------------------------------------------------
  //  Сбор репостов прямо со страницы, без файла архива.
  //
  //  На профиле репост рисуется как оригинальный твит с контекстом
  //  «You reposted» и ссылкой на тебя; в отдельной вкладке «Репосты» контекста
  //  нет, и там репостами считаются все записи. Id берём из ссылки на оригинал —
  //  это и есть source_tweet_id для DeleteRetweet.
  // ------------------------------------------------------------------------
  const sleep = мс => new Promise(готово => setTimeout(готово, мс));

  const свойНик = () => {
    const link = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
    return link ? String(link.getAttribute('href') || '').replace(/^\//, '').toLowerCase() : '';
  };

  const idТвита = article => {
    const время = article.querySelector('a[href*="/status/"] time');
    const ссылка = время && время.closest('a');
    const m = (ссылка && ссылка.getAttribute('href') || '').match(/\/status\/(\d+)/);
    return m ? m[1] : '';
  };

  // Какой раздел профиля открыт: в «Репостах» каждая карточка — репост,
  // и никакого контекста «вы сделали репост» там может не быть вовсе.
  const активныйРаздел = () => {
    // Только вкладки самой страницы: у дока свои role="tab" на модули,
    // и его «Отмена репостов» иначе выдаёт себя за раздел профиля.
    const табы = [...document.querySelectorAll('[role="tablist"]')]
      .filter(список => !список.closest('#xc-dock'))
      .flatMap(список => [...список.querySelectorAll('[role="tab"][aria-selected="true"]')]);

    for (const таб of табы) {
      const текст = (таб.textContent || '').trim().toLowerCase();
      if (/репост|repost|retweet/.test(текст)) return 'репосты';
    }
    return /\/reposts?\/?$/.test(location.pathname) ? 'репосты' : '';
  };

  // Репост ли это. В разделе «Репосты» — да по определению. Иначе смотрим
  // контекст: ссылка на себя внутри него — точный признак, подпись — запасной.
  // Русские подписи X («Вы сделали репост») нельзя проверять через \b: граница
  // слова в JS считается по ASCII, и после кириллицы её просто нет — старый
  // шаблон из-за этого не находил ни одного русского репоста.
  const этоРепост = (article, свой, раздел) => {
    if (раздел === 'репосты') return true;

    const контекст = article.querySelector('[data-testid="socialContext"]');

    // Точный путь: в контексте «You reposted» есть ссылка на мой профиль.
    // Сравниваем по префиксу пути: бывает и «/я», и «/я/».
    if (свой && контекст) {
      for (const a of контекст.querySelectorAll('a[href]')) {
        const href = String(a.getAttribute('href') || '');
        if (href === '/' + свой || href.startsWith('/' + свой + '/')) return true;
      }
    }

    const текст = ((контекст || article).textContent || '').slice(0, 200).trim();
    const подписьРепоста = /repost|репост|ретвит|retweet|подел/i;

    if (контекст) {
      // Обязательно «ты/вы/you» отдельным словом, иначе «Friend reposted»
      // посчитается моим репостом.
      const своё = /(?:^|[\s([«"'])(?:вы|ваш[аи]?|ты|you)(?=[\s.,:!?)\]»"'])/i.test(текст);
      return своё && подписьРепоста.test(текст);
    }

    // Контекста нет вовсе — тогда подпись может быть только в начале карточки:
    // иначе случайные слова в тексте чужого твита выдадут его за репост.
    return /^(?:вы|ваш[аи]?|ты|you)\s/i.test(текст) && подписьРепоста.test(текст.slice(0, 80));
  };

  // Автор оригинала — из ссылки на пост внутри карточки.
  const авторОригинала = article => {
    for (const ссылка of article.querySelectorAll('a[href*="/status/"]')) {
      const m = String(ссылка.getAttribute('href') || '').match(/^\/([A-Za-z0-9_]{1,15})\/status\//);
      if (m) return m[1];
    }
    return '';
  };

  const первыйНовыйРепост = (свой, раздел, обработано) => {
    for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
      if (!этоРепост(article, свой, раздел)) continue;
      const id = idТвита(article);
      if (!id || обработано.has(id)) continue;
      return { id, article };
    }
    return null;
  };

  /** Ждёт, пока фон реально отработает отправленный id. */
  const дождатьсяШага = async ({ курсорДо, ошибокДо, статус, продолжать }) => {
    const предел = Date.now() + (window.__XC_ТЕСТ_БЫСТРО ? 1500 : 5 * 60 * 1000);
    for (;;) {
      if (!продолжать()) return 'стоп';
      const с = await статус();
      if (!с || с.ошибка) return 'ошибка';
      if ((с.курсор || 0) > курсорДо) return 'готово';
      if ((с.ошибок || 0) > ошибокДо) return 'ошибка';

      const статусСтрокой = String(с.статус || '');
      // Фон встал (лимит, 5 ошибок, 401) — ждать пять минут незачем.
      if (/^остановлен/.test(статусСтрокой) || !с.запущено) return 'ошибка';
      // «Жду прокрутки» при неподвижном курсоре означает, что id в очередь не
      // попал (фон отфильтровал его как уже сделанный). Это не ошибка, но и
      // шага не будет — выходим сразу, а не через пять минут.
      if (/^жду прокрутки/.test(статусСтрокой) && (с.курсор || 0) <= курсорДо) return 'пропуск';

      if (Date.now() > предел) return 'ошибка';
      await sleep(window.__XC_ТЕСТ_БЫСТРО ? 5 : 250);
    }
  };

  /**
   * Листает и отменяет ПО ОДНОМУ: следующий id уходит в фон только после того,
   * как предыдущий отработан. Прокрутка — лишь когда на экране не осталось
   * необработанных репостов. Так очередь не убегает вперёд паровоза.
   */
  const отменятьПриЛистании = async ({ добавить, статус, продолжать, сообщить }) => {
    журнал('листание', { страница: location.pathname });
    const свой = свойНик();
    const обработано = new Set();
    // Что уже снято в прошлых прогонах (в том числе фоновых). Такой id фон
    // отфильтрует по истории, курсор не сдвинется — и страница ждала бы шага
    // до пяти минут. Поэтому историю проверяем сами, до отправки.
    const сделано = new Set();
    try {
      (await XHistory.прочитать('reposts')).forEach(id => сделано.add(String(id)));
    } catch (e) {}
    const пауза = window.__XC_ТЕСТ_БЫСТРО ? 5 : 300;
    const пустыхДо = window.__XC_ТЕСТ_БЫСТРО ? 2 : 5;
    const предел = Date.now() + 30 * 60 * 1000;
    let пусто = 0;
    let снято = 0;
    let пропущено = 0;
    let защищено = 0;

    for (;;) {
      if (!продолжать()) throw new Error(t('reposts.stopped'));
      if (Date.now() > предел) break;

      const найдено = первыйНовыйРепост(свой, активныйРаздел(), обработано);
      const id = найдено ? найдено.id : '';

      if (!id) {
        // Снимать нечего — значит дальше по списку. Пока не появится новая карточка.
        const было = window.scrollY;
        window.scrollBy(0, window.innerHeight * 0.8);
        await sleep(пауза + (window.__XC_ТЕСТ_БЫСТРО ? 0 : 250));
        if (Math.abs(window.scrollY - было) > 2) { пусто = 0; continue; }
        пусто++;
        if (пусто >= пустыхДо) break;
        continue;
      }

      обработано.add(id);

      // Оригинал защищённого аккаунта не трогаем.
      if (window.XProtect && XProtect.защищён({ ник: авторОригинала(найдено.article) })) {
        защищено++;
        сообщить(t('reposts.protected', { n: защищено }));
        continue;
      }

      // Карточка на экране, а id в истории — доверять истории нельзя: в неё
      // когда-то мог попасть чужой id, а X мог не убрать карточку из кэша.
      // Такой id отправляем в фон с пометкой «сила» и смотрим ответ сервера.
      const вИстории = сделано.has(id);
      журнал('карточка', { id, вИстории });

      const до = await статус();
      const курсорДо = (до && до.курсор) || 0;
      const ошибокДо = (до && до.ошибок) || 0;
      const пропущеноДо = (до && до.пропущено) || 0;

      await добавить([id], { сила: вИстории });

      const итог = await дождатьсяШага({ курсорДо, ошибокДо, статус, продолжать });
      журнал('шаг', { id, итог });
      if (итог === 'стоп') throw new Error(t('reposts.stopped'));
      if (итог === 'пропуск') {
        // Фон отказался брать id: считаем, что записи уже нет.
        сделано.add(id);
        пропущено++;
        сообщить(t('reposts.skipped', { n: пропущено }));
        continue;
      }
      if (итог === 'ошибка') throw new Error(t('reposts.backgroundFailed'));

      const после = await статус();
      if (((после && после.пропущено) || 0) > пропущеноДо) {
        сделано.add(id);
        пропущено++;
        сообщить(t('reposts.skipped', { n: пропущено }));
      } else {
        сделано.add(id);
        снято++;
        сообщить(t('reposts.undoing', { n: снято }));
      }
      await sleep(пауза);
    }

    журнал('итог', { удалено: снято, пропущено, защищено });
    if (снято || пропущено || защищено) {
      return t('reposts.summary', { n: снято, m: пропущено }) +
        (защищено ? t('reposts.describeProtected', { n: защищено }) : '');
    }
    throw new Error(t('reposts.none'));
  };

  const панель = XJobPanel.создать({
    вид: 'reposts',
    заголовок: t('reposts.title'),
    ключАрхива: 'архив_репосты',
    кнопкаФайла: t('reposts.choose'),
    действие: t('reposts.action'),
    разобрать,
    описать: разбор => t('reposts.describe', { n: разбор.цитат }) +
      (разбор.защищено ? t('reposts.describeProtected', { n: разбор.защищено }) : ''),
    безАрхива: { подпись: t('reposts.scrollLabel'), собрать: отменятьПриЛистании },
    темп: 1200
  });

  window.__репосты = {
    панель: панель.элемент,
    стоп: панель.стоп,
    сколько: панель.сколько
  };

  console.log('%c✅ панель отмены репостов: файл data/tweets.js из архива или сбор со вкладки «Репосты».', 'color:#1d9bf0;font-weight:700');
  return window.__репосты;
});
