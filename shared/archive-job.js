// ---------------------------------------------------------------------------
//  Общая панель для «архивных» заданий: лайки, репосты, цитаты.
//
//  Вкладка тут только выбирает файл и показывает прогресс: саму работу делает
//  фон (background/queue.js), поэтому страницу можно закрыть, а вкладку —
//  переключить. Раньше каждый модуль крутил свою очередь в странице, и при
//  закрытии вкладки проход пропадал.
//
//  Прогресс приходит подпиской на chrome.storage («задания», «история»), а не
//  только опросом: цифры меняются сразу, как только фон сделал шаг.
//
//  Опции:
//    вид          — 'likes' | 'reposts' | 'quotes' (совпадает с видом задания)
//    заголовок    — что написано в шапке панели
//    ключАрхива   — ключ chrome.storage.local, где лежит загруженный список
//    кнопкаФайла  — подпись кнопки выбора файла
//    действие     — подпись главной кнопки
//    разобрать    — текст файла → { ids, ... }, бросает при ошибке
//    описать      — { ids, ... } → короткая строка для статуса
//    подвал       — короткая приписка внизу (необязательно)
//    безАрхива    — { подпись, собрать } для работы по ходу страницы
//    темп/каждые/пауза — ритм фоновой очереди
// ---------------------------------------------------------------------------
(() => {
  const t = (ключ, данные) => XCI18n.t(ключ, данные);
  const ЧАСТОТА = 2500;             // страховочный опрос, подписка всё равно первая

  // Строки общей панели архивных заданий: лайки, репосты, цитаты.
  XCI18n.добавить({
    ru: {
      'archive.left': 'осталось',
      'archive.done': 'сделано',
      'archive.nothingRunning': 'ничего не запущено',
      'archive.chooseFile': 'Выбери файл из архива X — покажу, сколько записей нашёл.',
      'archive.nothingInArchive': 'в архиве пока ничего',
      'archive.more': 'Где взять файл и что ещё можно сделать',
      'archive.hint': 'В X: «Ещё» → «Настройки» → «Скачать архив данных». Придёт письмо со ссылкой на zip: внутри папка <b>data</b>, в ней нужный файл — он указан на кнопке выше.',
      'archive.reset': 'Сбросить загруженный список',
      'archive.testOne': 'Проверить на одной записи',
      'archive.testNote': '«Проверить» — это не примерка: одна запись будет реально обработана. Нужно, чтобы убедиться, что X отвечает 200, а не 404/429.',
      'archive.progress': '{done} из {total} · {percent}%',
      'archive.leftTime': ' · осталось ~{time}',
      'archive.finished': ' · завершено',
      'archive.stoppedSuffix': ' · остановлено',
      'archive.workInProgress': 'идёт работа…',
      'archive.listInfo': 'в списке {n}',
      'archive.fromTab': ' (из вкладки)',
      'archive.alreadyDone': ' · уже сделано {n}',
      'archive.loadedAt': ' · загружено {date}',
      'archive.reading': 'читаю архив…',
      'archive.fileParsed': 'в файле {n}, к работе {m}',
      'archive.fileParsedRemainder': ' ({n} уже сделаны ранее)',
      'archive.fileEmpty': 'В этом файле не нашлось подходящих записей. Проверь, что это файл из архива X.',
      'archive.fileError': 'Не разобрал файл: {error}',
      'archive.stopFirst': 'Сначала останови работу.',
      'archive.noList': 'Загруженного списка нет.',
      'archive.resetConfirm': 'Сбросить загруженный файл? История сделанного останется.',
      'archive.resetDone': 'Список сброшен — выбери файл заново.',
      'archive.collecting': 'снимаю по одному…',
      'archive.collectStart': 'Снимаю по одному: сняли — листаю дальше.',
      'archive.collectJournal': '{title}: листаю и отменяю',
      'archive.collectEnd': 'Дошёл до конца списка — фон доделывает остаток.',
      'archive.collectStop': 'Остановился: {error}',
      'archive.memory': 'Файл в памяти: {n}, к работе {m}.',
      'archive.freshQid': '{title}: нашёл свежий queryId, отдал фону',
      'archive.done': 'Готово: {done} из {total}',
      'archive.skipped': ', пропущено {n}',
      'archive.stopped': 'Остановлено: {status}. Уже сделанное не повторится — можно запустить снова.',
      'archive.qidChanged': ' X сменил адрес запроса: свежий нашёл и передал фону — запусти ещё раз.',
      'archive.journalResult': '{title}: {result} — {done} из {total}',
      'archive.journalDone': 'готово',
      'archive.journalStopped': 'остановлено',
      'archive.background': 'Фон: {error}',
      'archive.lastError': 'Работаю · {last}',
      'archive.workingCount': 'Работаю: {done} из {total}',
      'archive.workingBackground': 'Работаю в фоне: {done} из {total}.',
      'archive.startConfirm': 'Запустить: {n} шт.?\n\nРабота идёт в фоне: вкладку можно закрыть, очередь продолжится. Отменить сделанное нельзя.',
      'archive.starting': 'Передаю очередь в фон…',
      'archive.startFailed': 'Фон не принял очередь: {error}',
      'archive.startedBackground': 'Работаю в фоне — вкладку можно закрыть.',
      'archive.journalQueue': '{title}: очередь {n}',
      'archive.stopDone': 'Остановлено — уже сделанное не повторится.',
      'archive.testConfirm': 'Проверка сделает действие с одной записью по-настоящему.\n\nПродолжить?',
      'archive.testing': 'Проверяю один запрос в фоне…',
      'archive.testNoAnswer': 'Фон не ответил: {error}',
      'archive.test200': 'Запрос прошёл (200) — путь рабочий, одну запись уже сделал.',
      'archive.test429': '429 — лимит X. Подожди 15–20 минут.',
      'archive.test404': '404 — не тот маршрут или запись уже удалена. В историю не пишу.',
      'archive.testOther': 'Ответ {status} — смотри консоль фона.',
      'archive.journal429': '{title}: 429 — лимит X',
      'archive.journal404': '{title}: 404 — маршрут или запись уже удалена',
      'archive.noConnection': 'нет связи с фоном'
    },
    en: {
      'archive.left': 'left',
      'archive.done': 'done',
      'archive.nothingRunning': 'nothing is running',
      'archive.chooseFile': 'Pick a file from your X archive — I will show how many records were found.',
      'archive.nothingInArchive': 'nothing in the archive yet',
      'archive.more': 'Where to get the file and what else you can do',
      'archive.hint': 'In X: More → Settings → Download an archive of your data. You will get an email with a zip: inside there is a <b>data</b> folder with the file named on the button above.',
      'archive.reset': 'Reset the loaded list',
      'archive.testOne': 'Test on one record',
      'archive.testNote': '“Test” is not a dry run: one record will really be processed. It verifies that X answers 200 rather than 404/429.',
      'archive.progress': '{done} of {total} · {percent}%',
      'archive.leftTime': ' · ~{time} left',
      'archive.finished': ' · finished',
      'archive.stoppedSuffix': ' · stopped',
      'archive.workInProgress': 'work in progress…',
      'archive.listInfo': '{n} in the list',
      'archive.fromTab': ' (from tab)',
      'archive.alreadyDone': ' · already done {n}',
      'archive.loadedAt': ' · loaded {date}',
      'archive.reading': 'reading the archive…',
      'archive.fileParsed': '{n} in the file, {m} to process',
      'archive.fileParsedRemainder': ' ({n} already done earlier)',
      'archive.fileEmpty': 'No matching records were found in this file. Check that it is a file from your X archive.',
      'archive.fileError': 'Could not parse the file: {error}',
      'archive.stopFirst': 'Stop the current work first.',
      'archive.noList': 'No list is loaded.',
      'archive.resetConfirm': 'Reset the loaded file? The action history stays.',
      'archive.resetDone': 'List reset — choose the file again.',
      'archive.collecting': 'removing one by one…',
      'archive.collectStart': 'Removing one by one: once done, I scroll further.',
      'archive.collectJournal': '{title}: scrolling and undoing',
      'archive.collectEnd': 'Reached the end of the list — the background finishes the rest.',
      'archive.collectStop': 'Stopped: {error}',
      'archive.memory': 'File in memory: {n}, {m} to process.',
      'archive.freshQid': '{title}: found a fresh queryId and passed it to the background',
      'archive.done': 'Done: {done} of {total}',
      'archive.skipped': ', skipped {n}',
      'archive.stopped': 'Stopped: {status}. Finished work will not repeat — you can start again.',
      'archive.qidChanged': ' X changed the request address: a fresh one was found and passed to the background — start again.',
      'archive.journalResult': '{title}: {result} — {done} of {total}',
      'archive.journalDone': 'done',
      'archive.journalStopped': 'stopped',
      'archive.background': 'Background: {error}',
      'archive.lastError': 'Working · {last}',
      'archive.workingCount': 'Working: {done} of {total}',
      'archive.workingBackground': 'Working in the background: {done} of {total}.',
      'archive.startConfirm': 'Start: {n} records?\n\nWork runs in the background: you can close the tab and the queue continues. Finished actions cannot be undone.',
      'archive.starting': 'Passing the queue to the background…',
      'archive.startFailed': 'The background did not accept the queue: {error}',
      'archive.startedBackground': 'Working in the background — you can close the tab.',
      'archive.journalQueue': '{title}: queue {n}',
      'archive.stopDone': 'Stopped — finished work will not repeat.',
      'archive.testConfirm': 'The test will really process one record.\n\nContinue?',
      'archive.testing': 'Testing one request in the background…',
      'archive.testNoAnswer': 'The background did not answer: {error}',
      'archive.test200': 'Request succeeded (200) — the route works, one record was processed.',
      'archive.test429': '429 — X rate limit. Wait 15–20 minutes.',
      'archive.test404': '404 — wrong route or the record is already gone. Nothing is written to history.',
      'archive.testOther': 'Response {status} — see the background console.',
      'archive.journal429': '{title}: 429 — X rate limit',
      'archive.journal404': '{title}: 404 — wrong route or the record is already gone',
      'archive.noConnection': 'no connection to the background'
    }
  });

  const отправить = сообщение => new Promise(готово => {
    try {
      chrome.runtime.sendMessage(сообщение, ответ => готово(ответ || { ошибка: 'нет связи с фоном' }));
    } catch (e) {
      готово({ ошибка: String(e && e.message || e) });
    }
  });

  const сохранитьВХранилище = (ключ, значение) => new Promise(готово => {
    try { chrome.storage.local.set({ [ключ]: значение }, () => готово()); }
    catch (e) { готово(); }
  });

  const прочитатьИзХранилища = ключ => new Promise(готово => {
    try { chrome.storage.local.get(ключ, данные => готово((данные && данные[ключ]) || null)); }
    catch (e) { готово(null); }
  });

  const убратьИзХранилища = ключ => new Promise(готово => {
    try { chrome.storage.local.remove(ключ, () => готово()); }
    catch (e) { готово(); }
  });

  // Для «зависших лайков» нужны две операции: постановка и снятие. Список
  // операций на вид — массив, чтобы освежение qid не забыло вторую.
  const ОПЕРАЦИИ_X = {
    reposts: ['DeleteRetweet'],
    quotes: ['DeleteTweet'],
    likes: ['UnfavoriteTweet'],
    ghostlikes: ['FavoriteTweet', 'UnfavoriteTweet', 'likeButtonControlUnfavoriteMutation']
  };

  const создать = опции => {
    const { вид, заголовок, ключАрхива, кнопкаФайла, действие, разобрать, описать, безАрхива } = опции;
    // Панель без файла: у модуля нет архива, единственный вход — сбор со
    // страницы (например, «Зависшие лайки»). Кнопка файла и сброс прячутся,
    // а сбор становится главной кнопкой.
    const безФайла = !!опции.безФайла;
    // Модуль работает кликами по странице: фоновая очередь ему не нужна.
    const безОчереди = !!(безАрхива && безАрхива.безОчереди);
    const безТеста = !!опции.безТеста;

    let загруженные = [];    // id из файла
    let времяФайла = 0;
    let источник = '';      // '' — файл, 'вкладка' — собрано со страницы
    let история = new Set(); // id, которые уже сделаны в прошлых прогонах
    let состояние = {};      // то, что говорит фон
    let опрос = null;
    let было = false;        // очередь шла в прошлом тике

    const panel = document.createElement('div');
    panel.id = `__${вид}_панель`;
    panel.className = 'xc-panel';
    panel.innerHTML = `
      <div class="xc-head">
        <div class="xc-title">${заголовок}</div>
        <div class="xc-chip" data-режим>${t('mode.idle')}</div>
      </div>

      <div class="xc-cards">
        <div class="xc-card"><div class="xc-num" data-осталось>0</div><div class="xc-label">${t('archive.left')}</div></div>
        <div class="xc-card"><div class="xc-num" data-сделано>0</div><div class="xc-label">${t('archive.done')}</div></div>
      </div>

      <div class="xc-bar"><i data-бар></i></div>
      <div class="xc-meta"><span data-прогресс>${t('archive.nothingRunning')}</span></div>

      <div class="xc-status" data-статус role="status">${безФайла ? (опции.начальныйСтатус || '') : t('archive.chooseFile')}</div>

      <button class="xc-btn xc-btn--wide" data-файл${безФайла ? ' hidden' : ''}>${кнопкаФайла}</button>
      <div class="xc-note" data-низ>${t('archive.nothingInArchive')}</div>

      ${безАрхива ? `<button class="xc-btn xc-btn--wide${безФайла ? ' xc-btn--primary' : ''}" data-без-архива>${безАрхива.подпись}</button>` : ''}

      <div class="xc-row">
        <button class="xc-btn xc-btn--primary xc-btn--wide" data-старт${безФайла ? ' hidden' : ''} disabled>${действие}</button>
        <button class="xc-btn" data-стоп disabled>${t('common.stop')}</button>
      </div>

      <details class="xc-details"${безТеста ? ' hidden' : ''}>
        <summary>${опции.подробнее || t('archive.more')}</summary>
        <div class="xc-details-body">
          ${безФайла ? '' : `<p class="xc-note">${t('archive.hint')}</p>`}
          <button class="xc-btn xc-btn--quiet" data-сброс${безФайла ? ' hidden' : ''}>${t('archive.reset')}</button>
          <button class="xc-btn xc-btn--quiet" data-тест${безТеста ? ' hidden' : ''} disabled>${t('archive.testOne')}</button>
          <p class="xc-note">${t('archive.testNote')}</p>
        </div>
      </details>`;

    // Док раскладывает панели по вкладкам: одна рамка на все модули.
    if (window.XCDock) XCDock.регистрировать({ id: вид, титул: заголовок, элемент: panel });
    else document.body.appendChild(panel);

    const $ = сел => panel.querySelector(сел);
    const $режим = $('[data-режим]');
    const $осталось = $('[data-осталось]');
    const $сделано = $('[data-сделано]');
    const $бар = $('[data-бар]');
    const $прогресс = $('[data-прогресс]');
    const $статус = $('[data-статус]');
    const $низ = $('[data-низ]');
    const $файл = $('[data-файл]');
    const $тест = $('[data-тест]');
    const $старт = $('[data-старт]');
    const $стоп = $('[data-стоп]');
    const $сброс = $('[data-сброс]');

    const статус = текст => { $статус.textContent = текст; };
    let паузаЛимита = false;
    const очередь = () => загруженные.filter(id => !история.has(id));

    const минуты = сек => XCI18n.минуты(сек);

    const нарисовать = () => {
      const ждёт = очередь().length;
      const всего = состояние.всего || ждёт;
      const сделано = состояние.сделано || 0;
      const запущено = !!состояние.запущено;
      const остаток = Math.max(0, всего - сделано);
      panel.dataset.empty = (!загруженные.length && !всего && !запущено) ? '1' : '0';

      $осталось.textContent = String(остаток);
      $сделано.textContent = String(сделано);

      if (всего) {
        const доля = Math.min(100, Math.round(сделано / всего * 100));
        $бар.style.width = `${доля}%`;
        $бар.style.background = запущено
          ? 'var(--xc-accent)'
          : (сделано >= всего ? 'var(--xc-ok)' : '');
        let подпись = t('archive.progress', { done: XCI18n.число(сделано), total: XCI18n.число(всего), percent: доля });
        if (запущено && сделано >= 5 && состояние.старт) {
          const сек = (Date.now() - состояние.старт) / 1000;
          const наШтуку = Math.max(сек / сделано, 0.7);
          подпись += t('archive.leftTime', { time: минуты(наШтуку * (всего - сделано)) });
        } else if (!запущено) {
          подпись += сделано >= всего ? t('archive.finished') : t('archive.stoppedSuffix');
        }
        $прогресс.textContent = подпись;
      } else {
        $бар.style.width = '0%';
        $прогресс.textContent = t('archive.nothingRunning');
      }

      $режим.textContent = запущено
        ? (паузаЛимита ? t('mode.paused') : t('mode.working'))
        : (всего && сделано >= всего ? t('mode.done') : (состояние.статус === 'остановлено' ? t('mode.stopped') : t('mode.idle')));
      $режим.dataset.tone = запущено ? 'run' : (всего && сделано >= всего ? 'done' : '');

      $старт.disabled = запущено || !ждёт;
      $старт.textContent = запущено
        ? t('archive.workInProgress')
        : (ждёт ? `${действие} (${ждёт})` : действие);
      $тест.disabled = запущено || (безФайла ? false : !ждёт);
      $стоп.disabled = !запущено;
      $файл.disabled = запущено;
      $сброс.disabled = запущено || !загруженные.length;
      $старт.style.opacity = $старт.disabled ? '.45' : '1';
      $стоп.style.opacity = $стоп.disabled ? '.45' : '1';

      const когда = XCI18n.дата(времяФайла);
      if (безФайла) {
        // Архива тут нет: внизу — пояснение модуля и счётчики очереди.
        const вРаботе = всего ? ` · ${t('archive.progress', {
          done: XCI18n.число(сделано),
          total: XCI18n.число(всего),
          percent: Math.min(100, Math.round(сделано / всего * 100))
        })}` : '';
        $низ.textContent = (опции.подвал || '') + вРаботе;
      } else {
        $низ.textContent = загруженные.length
          ? t('archive.listInfo', { n: XCI18n.число(загруженные.length) }) + (источник === 'вкладка' ? t('archive.fromTab') : '') +
            (история.size ? t('archive.alreadyDone', { n: XCI18n.число(история.size) }) : '') +
            (когда ? t('archive.loadedAt', { date: когда }) : '')
          : t('archive.nothingInArchive');
        if (опции.подвал) $низ.textContent += ' · ' + опции.подвал;
      }
    };

    // --- история ---------------------------------------------------------
    const перечитатьИсторию = () => XHistory.прочитать(вид).then(ids => {
      история = new Set(ids.map(String));
      нарисовать();
    }).catch(() => {});

    // --- файл (у панели без файла его нет) -------------------------------
    if (!безФайла) {
    const вход = document.createElement('input');
    вход.type = 'file';
    вход.id = `__${вид}_инпут`;
    вход.accept = '.js,.json,text/javascript,application/json';
    вход.style.display = 'none';
    document.body.appendChild(вход);

    $файл.addEventListener('click', () => вход.click());

    вход.addEventListener('change', async () => {
      const файл = вход.files && вход.files[0];
      if (!файл) return;
      try {
        статус(t('archive.reading'));
        const разбор = разобрать(await файл.text());
        загруженные = разбор.ids;
        времяФайла = Date.now();
        источник = '';
        await сохранитьВХранилище(ключАрхива, { ids: разбор.ids, ts: времяФайла, источник: '' });
        состояние = {};
        нарисовать();
        статус(загруженные.length
          ? t('archive.fileParsed', { n: XCI18n.число(загруженные.length), m: XCI18n.число(очередь().length) }) +
            (загруженные.length - очередь().length ? t('archive.fileParsedRemainder', { n: загруженные.length - очередь().length }) : '') +
            (описать ? ` · ${описать(разбор)}` : '')
          : t('archive.fileEmpty'));
      } catch (e) {
        статус(t('archive.fileError', { error: (e && e.message || e) }));
        console.warn(e);
      }
    });
    }

    $сброс.addEventListener('click', async () => {
      if (состояние.запущено) { статус(t('archive.stopFirst')); return; }
      if (!загруженные.length) { статус(t('archive.noList')); return; }
      if (!confirm(t('archive.resetConfirm'))) return;
      загруженные = [];
      времяФайла = 0;
      источник = '';
      состояние = {};
      await убратьИзХранилища(ключАрхива);
      нарисовать();
      статус(t('archive.resetDone'));
    });

    // --- «отменять при листании»: страница подкидывает id в фоновую очередь --
    let собираю = false;
    let итогЛистания = '';
    const $собрать = panel.querySelector('[data-без-архива]');
    if ($собрать && безАрхива) {
      $собрать.addEventListener('click', async () => {
        if (собираю) return;
        // Модуль может заранее сказать, что страница не та: тогда не создаём
        // пустое живое задание и не шумим в очереди.
        if (безАрхива.готовность && !безАрхива.готовность()) {
          статус(безАрхива.неГотово || t('archive.noConnection'));
          return;
        }
        собираю = true;
        $собрать.disabled = true;
        $собрать.textContent = безАрхива.идёт || t('archive.collecting');

        if (!безОчереди) {
          // Очередь живёт в фоне и пополняется по ходу: ждать конца листания не надо.
          await отправить({ type: 'jobs-add', вид, ids: [], живой: true, темп: опции.темп || 1200, каждые: опции.каждые || 0, пауза: опции.пауза || 0 });
          было = true;
          следить();
        } else {
          состояние = { ...состояние, запущено: true, статус: 'работаю' };
          нарисовать();
        }
        статус(безАрхива.старт || t('archive.collectStart'));
        if (window.XCDock) XCDock.журнал(безАрхива.журнал || t('archive.collectJournal', { title: заголовок }));

        try {
          const итог = await безАрхива.собрать({
            добавить: (новые, параметры = {}) => отправить({ type: 'jobs-add', вид, ids: новые, сила: !!параметры.сила, темп: опции.темп || 1200, каждые: опции.каждые || 0, пауза: опции.пауза || 0 }),
            статус: () => отправить({ type: 'jobs-status', вид }),
            продолжать: () => собираю,
            сообщить: текст => { if (собираю) статус(текст); }
          });
          // Для кликовой панели сборщик сам пишет итог («Убрано N»), не затираем.
          if (!безОчереди) статус(безАрхива.конец || t('archive.collectEnd'));
          // Итог листания запомним и поставим в подпись уже после нарисовать():
          // иначе статус очереди и перерисовка панели его затрут.
          итогЛистания = typeof итог === 'string' ? итог : '';
        } catch (e) {
          статус(безАрхива.стоп || t('archive.collectStop', { error: (e && e.message || e) }));
        } finally {
          собираю = false;
          if (!безОчереди) await отправить({ type: 'jobs-finish', вид });
          else { состояние = { ...состояние, запущено: false, статус: 'готово' }; нарисовать(); }
          $собрать.disabled = false;
          $собрать.textContent = безАрхива.подпись;
          нарисовать();
          if (итогЛистания) {
            $низ.hidden = false;
            $низ.textContent = итогЛистания;
          }
        }
      });
    }

    const загрузитьСохранённое = async () => {
      if (безФайла) { нарисовать(); return; }
      const список = await прочитатьИзХранилища(ключАрхива);
      if (список && Array.isArray(список.ids) && список.ids.length) {
        загруженные = список.ids.map(String);
        времяФайла = список.ts || 0;
        источник = список.источник || '';
        статус(t('archive.memory', { n: XCI18n.число(загруженные.length), m: XCI18n.число(очередь().length) }));
      }
      нарисовать();
    };

    // --- работа ----------------------------------------------------------
    const применитьСостояние = свежее => {
      if (!свежее || свежее.ошибка) return;
      состояние = свежее;
      паузаЛимита = /пауза/.test(String(свежее.статус || ''));
      нарисовать();
    };

    // X сменил queryId — страница видит бандлы, воркер нет. Находим свежий id
    // здесь и отдаём фону, чтобы следующий запуск не упирался в тот же 404.
    const освежитьQid = async () => {
      const операции = [].concat(ОПЕРАЦИИ_X[вид] || []);
      if (!операции.length || !window.XQLookup) return false;
      let нашёл = false;
      for (const операция of операции) {
        const qid = await XQLookup.найти(операция).catch(() => null);
        if (!qid) continue;
        await отправить({ type: 'set-qid', операция, qid });
        нашёл = true;
      }
      if (нашёл && window.XCDock) XCDock.журнал(t('archive.freshQid', { title: заголовок }), 'ok');
      return нашёл;
    };

    const закончить = async ответ => {
      было = false;
      остановитьОпрос();
      await перечитатьИсторию();
      const готово = ответ.статус === 'готово';
      let текст = готово
        ? t('archive.done', { done: XCI18n.число(ответ.сделано || 0), total: XCI18n.число(ответ.всего || 0) }) +
          (ответ.пропущено ? t('archive.skipped', { n: ответ.пропущено }) : '')
        : t('archive.stopped', { status: XCI18n.статус(ответ.статус) });
      // 404 у любого вида — повод освежить queryId. У зависших лайков это
      // делаем и на любую ошибку: снятие могло отвалиться из-за смены адреса,
      // и следующий запуск должен взять свежий из бандлов страницы.
      const беда = !готово && (
        /404|маршрут/i.test(String(ответ.статус || '')) ||
        (вид === 'ghostlikes' && /остановлено:/.test(String(ответ.статус || '')))
      );
      if (беда && await освежитьQid()) {
        текст += t('archive.qidChanged');
      }
      статус(текст);
      if (window.XCDock) XCDock.журнал(
        t('archive.journalResult', {
          title: заголовок,
          result: готово ? t('archive.journalDone') : t('archive.journalStopped'),
          done: ответ.сделано || 0,
          total: ответ.всего || 0
        }),
        готово ? 'ok' : 'bad');
      нарисовать();
    };

    const тик = async () => {
      const ответ = await отправить({ type: 'jobs-status', вид });
      if (!ответ || ответ.ошибка) {
        статус(t('archive.background', { error: (ответ && ответ.ошибка) || t('archive.noConnection') }));
        остановитьОпрос();
        return;
      }
      применитьСостояние(ответ);
      if (ответ.запущено) {
        статус(ответ.последняя
          ? t('archive.lastError', { last: XCI18n.статус(ответ.последняя) })
          : t('archive.workingCount', { done: XCI18n.число(ответ.сделано || 0), total: XCI18n.число(ответ.всего || 0) }));
      } else if (было) {
        await закончить(ответ);
      }
    };

    const остановитьОпрос = () => {
      clearInterval(опрос);
      опрос = null;
    };

    const следить = () => {
      остановитьОпрос();
      опрос = setInterval(тик, ЧАСТОТА);
    };

    // --- старт -----------------------------------------------------------
    перечитатьИсторию().then(загрузитьСохранённое).then(() => нарисовать());
    нарисовать();

    // фон мог работать, пока панели не было — подхватываем прогресс
    if (!безОчереди) отправить({ type: 'jobs-status', вид }).then(ответ => {
      if (!ответ || ответ.ошибка) return;
      применитьСостояние(ответ);
      if (ответ.запущено) {
        было = true;
        нарисовать();
        следить();
        статус(t('archive.workingBackground', { done: XCI18n.число(ответ.сделано || 0), total: XCI18n.число(ответ.всего || 0) }));
      }
    });

    $старт.addEventListener('click', async () => {
      const ids = очередь();
      if (!ids.length) return;
      if (!confirm(t('archive.startConfirm', { n: ids.length }))) return;

      статус(t('archive.starting'));
      const ответ = await отправить({
        type: 'jobs-start', вид, ids,
        темп: опции.темп || 1500,
        каждые: опции.каждые || 0,
        пауза: опции.пауза || 0
      });
      if (!ответ || ответ.ошибка) {
        статус(t('archive.startFailed', { error: (ответ && ответ.ошибка) || t('archive.noConnection') }));
        return;
      }
      применитьСостояние(ответ);
      было = !!ответ.запущено;
      нарисовать();
      статус(t('archive.startedBackground'));
      if (window.XCDock) XCDock.журнал(t('archive.journalQueue', { title: заголовок, n: ids.length }));
      следить();
    });

    $стоп.addEventListener('click', async () => {
      собираю = false;
      if (!безОчереди) {
        const ответ = await отправить({ type: 'jobs-stop', вид });
        применитьСостояние(ответ || {});
      } else {
        состояние = { ...состояние, запущено: false, статус: 'остановлено' };
        нарисовать();
      }
      было = false;
      остановитьОпрос();
      нарисовать();
      статус(t('archive.stopDone'));
    });

    $тест.addEventListener('click', async () => {
      const id = опции.тестовыйId ? String(опции.тестовыйId() || '') : очередь()[0];
      if (!id) { статус(опции.нетДляТеста || t('archive.noList')); return; }
      if (!confirm(t('archive.testConfirm'))) return;
      $тест.disabled = true;
      статус(t('archive.testing'));
      const ответ = await отправить({ type: 'jobs-test', вид, id });
      $тест.disabled = false;
      if (!ответ || ответ.ошибка) { статус(t('archive.testNoAnswer', { error: (ответ && ответ.ошибка) || t('archive.noConnection') })); return; }
      if (ответ.status === 200) {
        история.add(String(id));
        await XHistory.добавить(вид, [id]).catch(() => {});
        нарисовать();
        статус(опции.тест200 || t('archive.test200'));
      } else if (ответ.status === 429) {
        if (window.XCDock) XCDock.журнал(t('archive.journal429', { title: заголовок }), 'bad');
        статус(t('archive.test429'));
      } else if (ответ.status === 404) {
        if (window.XCDock) XCDock.журнал(t('archive.journal404', { title: заголовок }), 'bad');
        статус(t('archive.test404'));
        if (await освежитьQid()) статус(t('archive.test404') + t('archive.qidChanged'));
      } else {
        статус(t('archive.testOther', { status: ответ.status }));
      }
      console.log(`тест ${вид}`, id, ответ);
    });

    // --- живые обновления ------------------------------------------------
    try {
      chrome.storage.onChanged.addListener((изменения, область) => {
        if (область !== 'local') return;
        if (изменения['задания']) {
          применитьСостояние((изменения['задания'].newValue || {})[вид] || {});
        }
        if (изменения['история']) перечитатьИсторию();
        if (ключАрхива && изменения[ключАрхива]) {
          const список = изменения[ключАрхива].newValue;
          if (список && Array.isArray(список.ids)) {
            загруженные = список.ids.map(String);
            времяФайла = список.ts || 0;
            источник = список.источник || '';
            нарисовать();
          }
        }
      });
    } catch (e) {}

    return {
      элемент: panel,
      стоп: async () => { await отправить({ type: 'jobs-stop', вид }); было = false; остановитьОпрос(); нарисовать(); },
      сколько: () => ({ ...состояние, вСписке: загруженные.length, осталось: очередь().length, история: история.size }),
      перечитать: перечитатьИсторию
    };
  };

  window.XJobPanel = { создать };
})();
