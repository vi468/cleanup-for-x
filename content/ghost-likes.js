// ---------------------------------------------------------------------------
//  Модуль «Зависшие лайки».
//
//  X иногда оставляет в «История → Нравится» (x.com/i/history/likes) посты,
//  у которых лайка уже нет: карточка висит с пустым сердцем. Если поставить
//  и сразу снять лайк вручную, запись исчезает. Модуль повторяет это для
//  всех найденных записей.
//
//  Id берутся только со страницы: другого способа перечислить «Нравится»
//  у расширения нет. Панель листает список, собирает карточки без лайка и
//  пачками отдаёт id в фон (background/queue.js, вид «ghostlikes»): фон
//  ставит лайк и снимает его по одному. После сбора вкладку можно закрыть,
//  очередь продолжит работать.
// ---------------------------------------------------------------------------
XC.модуль('ghostlikes', () => {
  if (window.__зависшие) return null;

  const t = (ключ, данные) => XCI18n.t(ключ, данные);
  XCI18n.добавить({
    ru: {
      'ghost.title': 'Зависшие лайки',
      'ghost.action': 'Найти и убрать',
      'ghost.collecting': 'собираю…',
      'ghost.start': 'Убираю лайки из «Нравится» по одному — листаю список.',
      'ghost.journal': 'Зависшие лайки: собираю со страницы «Нравится»',
      'ghost.end': 'Дошёл до конца списка.',
      'ghost.wrongPage': 'Открой «История → Нравится» (x.com/i/history/likes) и запусти снова.',
      'ghost.found': 'Нашёл {n}, отдал в фон {m}',
      'ghost.working': 'Убрал {n} — листаю дальше',
      'ghost.backgroundFailed': 'фон не смог убрать лайк — остановился',
      'ghost.summary': 'Убрано {n}. Обнови страницу, чтобы проверить.',
      'ghost.none': 'Постов в «Нравится» не видно: прокрути список и попробуй снова.',
      'ghost.stopped': 'остановлено вручную',
      'ghost.noTestId': 'В видимой части списка постов нет. Нажми «Найти и убрать» — она пролистает весь список.',
      'ghost.test200': 'Запрос прошёл (200): пара «поставить и снять» отработала. Обнови страницу — пост должен исчезнуть из «Нравится».',
      'ghost.note': 'Нужна страница «История → Нравится». Идёт по всем постам списка, вкладку держи открытой.',
      'ghost.details': 'Проверить на одной записи',
      'ghost.hintStart': 'Открой «История → Нравится» и нажми «Найти и убрать».'
    },
    en: {
      'ghost.title': 'Stuck likes',
      'ghost.action': 'Find and remove',
      'ghost.collecting': 'collecting…',
      'ghost.start': 'Removing likes from the list one by one — scrolling it.',
      'ghost.journal': 'Stuck likes: collecting from the Likes page',
      'ghost.end': 'Reached the end of the list.',
      'ghost.wrongPage': 'Open History → Likes (x.com/i/history/likes) and start again.',
      'ghost.found': 'Found {n}, sent {m} to the background',
      'ghost.working': '{n} removed — scrolling on',
      'ghost.backgroundFailed': 'the background could not remove the like — stopped',
      'ghost.summary': '{n} removed. Reload the page to check.',
      'ghost.none': 'No posts visible in Likes: scroll the list and try again.',
      'ghost.stopped': 'stopped by hand',
      'ghost.noTestId': 'No posts in the visible part. Press Find and remove — it will scroll the whole list.',
      'ghost.test200': 'The request succeeded (200): the like/unlike pair went through. Reload the page — the post should disappear from Likes.',
      'ghost.note': 'Needs the History → Likes page. Walks every post in the list; keep the tab open.',
      'ghost.details': 'Test on one record',
      'ghost.hintStart': 'Open History → Likes and press Find and remove.'
    }
  });

  if (!/(^|\.)x\.com$/.test(location.hostname) && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return null;
  }

  const sleep = мс => new Promise(готово => setTimeout(готово, мс));

  // «Нравится» у себя: и «История → Нравится», и старый адрес профиля.
  // Шаблон узкий (ники — латиница, цифры, подчёркивание), а служебные
  // разделы вроде /settings/likes отсекаем отдельно: это не профиль.
  const ЭТО_ЛАЙКИ = /^\/(?:i\/history\/likes|([A-Za-z0-9_]+)\/likes)\/?$/;
  const СЛУЖЕБНЫЕ = new Set([
    'i', 'settings', 'home', 'explore', 'search', 'notifications', 'messages',
    'compose', 'account', 'premium', 'jobs', 'communities', 'lists', 'bookmarks',
    'help', 'tos', 'privacy', 'login', 'logout', 'signup', 'about', 'download'
  ]);
  const наСтраницеЛайков = () => {
    const найдено = location.pathname.match(ЭТО_ЛАЙКИ);
    if (!найдено) return false;
    if (/^\/i\/history\/likes\/?$/.test(location.pathname)) return true;
    const ник = (найдено[1] || '').toLowerCase();
    return !!ник && !СЛУЖЕБНЫЕ.has(ник);
  };

  // Карточка поста: в старом клиенте X это article с data-testid="tweet",
  // в новом (x-web, 2026) — просто article без единого data-testid.
  const ТВИТ = 'article';

  /** Сердце в кнопке: по нему узнаём лайк в новом клиенте без data-testid. */
  const сердце = кнопка => !!кнопка.querySelector(
    'use[href*="icon-heart"], svg[data-icon*="icon-heart"]');

  /**
   * Кнопка лайка именно этой карточки. В старой разметке состояние живёт в
   * data-testid (like / unlike). В новой data-testid нет вовсе: кнопка — это
   * button с aria-pressed и сердцем внутри. Подпись локализована, поэтому
   * опираемся на сердце, а подпись — только запасной признак.
   */
  const кнопкаЛайка = article => {
    for (const кнопка of article.querySelectorAll('button, [role="button"]')) {
      if (кнопка.closest(ТВИТ) !== article) continue;
      const testid = кнопка.getAttribute('data-testid');
      if (testid === 'like' || testid === 'unlike') return кнопка;
      if (!кнопка.hasAttribute('aria-pressed')) continue;
      if (сердце(кнопка) || /нравится|likes?\b/i.test(кнопка.getAttribute('aria-label') || '')) return кнопка;
    }
    return null;
  };

  const idИзСсылки = href => ((href || '').match(/\/status\/(\d+)/) || [])[1] || '';
  const idИзОтвета = href => ((href || '').match(/[?&]in_reply_to=(\d+)/) || [])[1] || '';

  /**
   * Ссылка внутри карточки цитаты. Признаков несколько: старый data-testid,
   * роль-обёртка нового клиента и сама ссылка, внутри которой лежит автор или
   * текст цитаты (у метки времени основного поста этого нет).
   */
  const вЦитате = (ссылка, article) => {
    if (ссылка.closest('[data-testid="quoteTweet"], [data-testid="quoteTweetCard"]')) return true;
    const обёртка = ссылка.closest('[role="link"]');
    if (обёртка && обёртка !== article && обёртка.closest(ТВИТ) === article) return true;
    if (ссылка.querySelector('[data-testid="User-Name"], [data-testid="tweetText"], [data-testid="UserAvatar-Container"]')) return true;
    // Подпись цитаты заметно длиннее метки времени («14 нояб.»).
    return (ссылка.textContent || '').trim().length > 40;
  };

  /**
   * id твита этой карточки. В новом клиенте цитата — не вложенный article,
   * поэтому одной проверки closest мало:
   *   1) ссылка ответа «?in_reply_to=<id>» всегда ведёт на сам пост;
   *   2) ссылка с меткой времени (<time>) — это сам пост;
   *   3) ссылка на статус вне карточки цитаты;
   *   4) первая ссылка на статус — запасной вариант.
   */
  const idТвита = article => {
    const ответ = article.querySelector('a[href*="in_reply_to="]');
    if (ответ) {
      const id = idИзОтвета(ответ.getAttribute('href'));
      if (id) return id;
    }

    let первый = '';
    let сВременем = '';
    let сТекстом = '';
    for (const ссылка of article.querySelectorAll('a[href*="/status/"]')) {
      if (ссылка.closest(ТВИТ) !== article) continue;          // цитата в старом DOM
      const id = idИзСсылки(ссылка.getAttribute('href'));
      if (!id) continue;
      // Цитату отсекаем ДО метки времени: у неё внутри тоже бывает <time>.
      if (вЦитате(ссылка, article)) continue;
      if (!первый) первый = id;
      if (!сВременем && ссылка.querySelector('time')) сВременем = id;
      else if (!сТекстом && (ссылка.textContent || '').trim()) сТекстом = id;
    }
    return сВременем || сТекстом || первый;
  };

  /**
   * Карточка списка «Нравится», с которой можно работать: есть кнопка лайка
   * и id. Состояние не важно: у зависшей записи лайка нет, у оставшейся —
   * есть; в обоих случаях цель одна — снять лайк/убрать запись. Поэтому
   * проходим по всем карточкам, а не только по пустым сердцам.
   */
  const этоПост = article => {
    if (article.closest('[data-testid="placementTracking"]')) return false;   // реклама
    // В старом клиенте цитата — вложенный article со своей кнопкой лайка.
    // Это не отдельная запись «Нравится», её id в фон отправлять нельзя.
    if (article.parentElement && article.parentElement.closest(ТВИТ)) return false;
    if (!кнопкаЛайка(article)) return false;                                     // кнопки нет — не наша карточка
    return !!idТвита(article);
  };

  /** Уникальные id карточек, которые сейчас отрисованы. */
  const видимыеПосты = () => {
    const иды = [];
    const видели = new Set();
    for (const article of document.querySelectorAll(ТВИТ)) {
      if (!этоПост(article)) continue;
      const id = idТвита(article);
      if (!id || видели.has(id)) continue;
      видели.add(id);
      иды.push(id);
    }
    return иды;
  };

  /**
   * Прокрутка на шаг. X на этой странице может держать список во вложенном
   * контейнере (RNW), а не в окне: тогда window.scrollBy ничего не делает.
   * Поэтому двигаем и окно, и самый большой реально прокручиваемый div.
   */
  const прокрутить = шаг => {
    try { window.scrollBy(0, шаг); } catch (e) {}
    let лучший = null;
    let запас = 0;
    for (const el of document.querySelectorAll('div')) {
      const разница = el.scrollHeight - el.clientHeight;
      if (разница < 200 || разница <= запас) continue;
      let стиль;
      try { стиль = getComputedStyle(el); } catch (e) { continue; }
      if (!/(auto|scroll)/.test(стиль.overflowY)) continue;
      лучший = el;
      запас = разница;
    }
    if (!лучший) return;
    const шагКонтейнера = Math.max(300, Math.round((лучший.clientHeight || 500) * 0.8));
    лучший.scrollTop = Math.min(лучший.scrollTop + шагКонтейнера, лучший.scrollHeight);
  };

  const вНачало = () => {
    try { window.scrollTo(0, 0); } catch (e) {}
    for (const el of document.querySelectorAll('div')) {
      if (el.scrollHeight - el.clientHeight < 200) continue;
      let стиль;
      try { стиль = getComputedStyle(el); } catch (e) { continue; }
      if (/(auto|scroll)/.test(стиль.overflowY)) el.scrollTop = 0;
    }
  };

  /** Убирает строку из списка сразу после подтверждённого шага: видно, что
   *  запись ушла, а не «листает и листает» мимо неё. */
  const убратьИзСписка = id => {
    for (const article of document.querySelectorAll(ТВИТ)) {
      if (idТвита(article) === id) { article.remove(); return; }
    }
  };

  const первыйПостId = () => видимыеПосты()[0] || '';

  /** Ждёт, пока фон реально отработает отправленный id (как в репостах). */
  const дождатьсяШага = async ({ курсорДо, ошибокДо, статус, продолжать }) => {
    const быстро = !!window.__XC_ТЕСТ_БЫСТРО;
    // Ждём и долгую паузу по лимиту X (до 15 минут): иначе панель сдастся
    // раньше, чем очередь отпустит 429.
    const предел = Date.now() + (быстро ? 1500 : 16 * 60 * 1000);
    for (;;) {
      if (!продолжать()) return 'стоп';
      const с = await статус();
      if (!с || с.ошибка) return 'ошибка';
      if ((с.курсор || 0) > курсорДо) return 'готово';
      if ((с.ошибок || 0) > ошибокДо) return 'ошибка';

      const строка = String(с.статус || '');
      if (/^остановлен/.test(строка) || !с.запущено) return 'ошибка';
      // id отфильтрован историей — шага не будет, ждать пять минут незачем.
      if (/^жду прокрутки/.test(строка) && (с.курсор || 0) <= курсорДо) return 'пропуск';
      if (Date.now() > предел) return 'ошибка';
      await sleep(быстро ? 5 : 250);
    }
  };

  /**
   * Листает «Нравится» и убирает зависшие лайки ПО ОДНОМУ: лайк поставили,
   * сняли, дождались ответа фона — и только потом следующая карточка.
   * Никакого предварительного сбора: страница ведёт очередь сама.
   */
  const собрать = async ({ добавить, статус, продолжать, сообщить }) => {
    if (!наСтраницеЛайков()) throw new Error(t('ghost.wrongPage'));

    // Чистим историю модуля перед прогоном: строка, которая осталась висеть после
    // прошлой ошибки X, не должна пропускаться как «уже сделано». Видимые
    // строки и есть список того, что нужно повторить.
    try { await XHistory.очистить('ghostlikes'); } catch (e) {}

    const быстро = !!window.__XC_ТЕСТ_БЫСТРО;
    const пауза = быстро ? 5 : 250;
    const пустыхДо = быстро ? 2 : 5;
    const обработано = new Set();
    let сделано = 0;
    let пропущено = 0;
    let пусто = 0;

    // Начинаем с верха. Верх задаём первой карточкой: список может крутиться
    // не окном, а вложенным контейнером, и window.scrollTo его не слушается.
    вНачало();
    const первая = document.querySelector(ТВИТ);
    if (первая) { try { первая.scrollIntoView({ block: 'start' }); } catch (e) {} }
    await sleep(быстро ? 5 : 700);

    const предел = Date.now() + 2 * 60 * 60 * 1000;   // страховка от бесконечной ленты
    for (;;) {
      if (!продолжать()) throw new Error(t('ghost.stopped'));
      if (Date.now() > предел) break;

      const id = видимыеПосты().find(кандидат => !обработано.has(кандидат));
      if (id) {
        обработано.add(id);

        const до = await статус();
        const курсорДо = (до && до.курсор) || 0;
        const ошибокДо = (до && до.ошибок) || 0;

        await добавить([id]);
        const итог = await дождатьсяШага({ курсорДо, ошибокДо, статус, продолжать });
        if (итог === 'стоп') throw new Error(t('ghost.stopped'));
        if (итог === 'ошибка') throw new Error(t('ghost.backgroundFailed'));
        if (итог === 'пропуск') {
          убратьИзСписка(id);
          пропущено += 1;
          continue;
        }

        убратьИзСписка(id);
        сделано += 1;
        сообщить(t('ghost.working', { n: сделано }));
        await sleep(пауза);
        continue;
      }

      // Видимых необработанных нет — листаем дальше. Ориентир — последняя
      // карточка, а не пиксели окна: так работает при любом контейнере.
      const статьиДо = document.querySelectorAll(ТВИТ);
      const последняя = статьиДо[статьиДо.length - 1];
      const последнийId = последняя ? idТвита(последняя) : '';
      if (последняя) {
        try { последняя.scrollIntoView({ block: 'end' }); } catch (e) {}
      }
      прокрутить(Math.max(300, Math.round(window.innerHeight * 0.8)));
      await sleep(быстро ? 5 : 900);

      const статьиПосле = document.querySelectorAll(ТВИТ);
      const новаяПоследняя = статьиПосле[статьиПосле.length - 1];
      const новыйПоследнийId = новаяПоследняя ? idТвита(новаяПоследняя) : '';
      if (статьиПосле.length > статьиДо.length ||
          (новыйПоследнийId && новыйПоследнийId !== последнийId)) {
        пусто = 0;
      } else {
        пусто += 1;
        if (пусто >= пустыхДо) break;
      }
    }

    if (!сделано && !пропущено) throw new Error(t('ghost.none'));
    сообщить(t('ghost.summary', { n: сделано }));
  };

  const панель = XJobPanel.создать({
    вид: 'ghostlikes',
    заголовок: t('ghost.title'),
    ключАрхива: '',
    кнопкаФайла: '',
    действие: t('ghost.action'),
    безФайла: true,
    начальныйСтатус: t('ghost.hintStart'),
    подробнее: t('ghost.details'),
    тестовыйId: первыйПостId,
    нетДляТеста: t('ghost.noTestId'),
    тест200: t('ghost.test200'),
    безАрхива: {
      подпись: t('ghost.action'),
      собрать,
      готовность: наСтраницеЛайков,
      неГотово: t('ghost.wrongPage'),
      идёт: t('ghost.collecting'),
      старт: t('ghost.start'),
      журнал: t('ghost.journal'),
      конец: t('ghost.end')
    },
    // Пара запросов на один пост, поэтому шаг длиннее, чем у обычных лайков,
    // и раз в 500 шагов — длинная пауза: X считает частоту действий.
    темп: 1600,
    каждые: 500,
    пауза: 60000,
    подвал: t('ghost.note')
  });

  window.__зависшие = {
    панель: панель.элемент,
    стоп: панель.стоп,
    сколько: панель.сколько
  };

  console.log('%c✅ Cleanup for X: «Зависшие лайки» — открой «История → Нравится» и нажми «Найти и убрать».', 'color:#1d9bf0;font-weight:700');
  return window.__зависшие;
});
