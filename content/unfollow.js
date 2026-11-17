// ============================================================================
//  ОТПИСКА ОТ ТЕХ, КТО НА ТЕБЯ НЕ ПОДПИСАН — x.com/<ты>/following
//
//  Модуль расширения Cleanup for X. Открой страницу «Подписки». Справа снизу появляется панель,
//  а у каждой строки — кружок для выбора. Кружок есть только у тех, кто на тебя
//  НЕ подписан; у взаимных подписок вместо кружка прочерк, их выделить нельзя.
//
//  Как выбирать:
//   - клик по кружку — выбрал/снял одну строку;
//   - Shift+клик — выделяет отрезок от прошлого клика до этого (внутри отрезка
//     попадут только те, кто на тебя не подписан);
//   - «Выбрать видимых» — все не взаимные в том, что сейчас на экране;
//   - «Снять» — очистить выбор;
//   - «×» рядом с кружком — отписаться от этой одной строки сразу.
//
//  Выбор живёт, пока страница не перезагружена: можно прокрутить, добрать ещё,
//  вернуться и спокойно нажать «Отписаться (N)».
//
//  - отписка идёт кликами по самой кнопке X с подтверждением, как руками;
//  - темп ~2 секунды, после 5 неудач подряд скрипт останавливается;
//  - X ограничивает массовые отписки: 50–100 за подход — нормально, тысячи за
//    день — почти наверняка временная блокировка действий;
//  - ничего не отправляет и не сохраняет, кроме кликов по x.com.
//
//  Выключить: перезагрузить страницу. Или в консоли: __отписка.стоп()
// ============================================================================
XC.модуль('unfollow', () => {
  if (!/\/following/.test(location.pathname)) return null;

  const t = (ключ, данные) => XCI18n.t(ключ, данные);
  XCI18n.добавить({
    ru: {
      'unf.title': 'Отписка',
      'unf.left': 'осталось',
      'unf.done': 'отписано',
      'unf.initial': 'выбери строки кружками или загрузи архив',
      'unf.start': 'Отписаться',
      'unf.archiveSummary': 'Полный список из архива (без прокрутки)',
      'unf.archiveChoose': 'Выбрать following.js + follower.js',
      'unf.archiveEmpty': 'файлы не загружены',
      'unf.archiveReset': 'Сбросить архивные списки',
      'unf.archiveStart': 'Отписаться по архиву',
      'unf.visible': 'Выбрать видимых',
      'unf.clearSelection': 'Снять выбор',
      'unf.all': 'Пройти весь список без выбора',
      'unf.backgroundToggle': 'продолжать в фоне, даже если закрыть вкладку',
      'unf.backgroundTest': 'Проверить фоновый режим (один аккаунт)',
      'unf.protection': 'Защита: {n} — правится в попапе',
      'unf.counterVisible': 'видно {n}',
      'unf.counterArchive': 'архив: подписок {subs} · подписчиков {fans}',
      'unf.counterNoFollowBack': 'видно {n} · без ответной подписки {m}',
      'unf.counterErrors': ' · ошибок {n}',
      'unf.startRunning': 'идёт отписка…',
      'unf.startCount': 'Отписаться ({n})',
      'unf.modeArchiveBackground': 'архив · в фоне',
      'unf.modeBackground': 'в фоне',
      'unf.modeArchive': 'архив',
      'unf.modeWorking': 'работаю',
      'unf.markProtected': 'В списке защиты — не отписываем',
      'unf.markMutual': 'Подписан на тебя — выделить нельзя',
      'unf.markSelect': 'Выбрать (Shift — отрезок, Alt — отписаться сразу)',
      'unf.unfollowing': 'отписываюсь от @{name}…',
      'unf.doneShort': 'готово',
      'unf.failedShort': 'не вышло — смотри консоль',
      'unf.unfollowNow': 'Отписаться от этого сразу',
      'unf.archiveResetDone': 'архивные списки сброшены — загрузи following.js и follower.js заново',
      'unf.archiveInfo': 'в подписках {subs} · читают меня {fans} · к отписке {candidates}',
      'unf.archiveAlready': ' · уже снято {n}',
      'unf.archiveLoadedAt': ' · загружено {date}',
      'unf.archiveFilesNeeded': 'нужны оба файла: following.js и follower.js',
      'unf.archiveStartCount': 'Отписаться по архиву ({n})',
      'unf.noArchiveLists': 'архивных списков нет',
      'unf.archiveResetConfirm': 'Сбросить загруженные списки подписок и подписчиков? Файлы придётся выбрать заново.',
      'unf.archiveParsed': 'архив: подписки {subs}, подписчики {fans}',
      'unf.archiveBadFiles': 'не разобрал файлы — нужны following.js и follower.js из архива',
      'unf.archiveConfirm': 'Отписаться от {n} аккаунтов по архиву?\n\nОчередь пойдёт в фоне: вкладку можно закрыть.',
      'unf.backgroundFailed': 'фон не запустился: {error}',
      'unf.archiveStarted': 'идёт отписка по архиву в фоне — вкладку можно закрыть',
      'unf.allConfirm': 'Пройти по всему списку и отписаться от всех, кто не в защите и не подписан на тебя?\n\nЭто необратимо.',
      'unf.fiveFails': 'пять неудач подряд — остановился',
      'unf.fiveMisses': 'пять промахов подряд — остановился',
      'unf.doneTotal': 'готово — отписано {n}',
      'unf.checkNone': 'некого проверять — выдели строку',
      'unf.checkConfirm': 'Проверка фонового режима отпишет от @{name} по-настоящему.\n\nПродолжить?',
      'unf.checkCancelled': 'проверка отменена — никого не трогал',
      'unf.checking': 'проверяю фоновый запрос…',
      'unf.checkAnswered': 'фон ответил {status}',
      'unf.checkNoAnswer': 'фон не ответил',
      'unf.backgroundMsg': 'фон: {error}',
      'unf.backgroundWorking': 'работает в фоне — вкладку можно закрыть',
      'unf.backgroundForeground': 'идёт отписка — не закрывай вкладку',
      'unf.backgroundDone': 'готово — отписано {done} из {total}',
      'unf.backgroundStopped': 'остановлено: {status}. Продолжишь — уже снятые не повторятся.',
      'unf.stopping': 'останавливаюсь…',
      'unf.backgroundStartConfirm': 'Отписаться в фоне от {n} аккаунтов?\n\nОчередь живёт в расширении: можно уйти на другую вкладку или закрыть страницу X.',
      'unf.backgroundStarted': 'запущено в фоне — вкладку можно закрыть',
      'unf.startConfirm': 'Отписаться от {n} аккаунтов?\n\nКнопка «Подписаться» вернётся только вручную.',
      'unf.stopStatus': 'остановлено'
    },
    en: {
      'unf.title': 'Unfollow',
      'unf.left': 'left',
      'unf.done': 'unfollowed',
      'unf.initial': 'select rows with the circles or load the archive',
      'unf.start': 'Unfollow',
      'unf.archiveSummary': 'Full list from the archive (no scrolling)',
      'unf.archiveChoose': 'Choose following.js + follower.js',
      'unf.archiveEmpty': 'files are not loaded',
      'unf.archiveReset': 'Reset archive lists',
      'unf.archiveStart': 'Unfollow from archive',
      'unf.visible': 'Select visible',
      'unf.clearSelection': 'Clear selection',
      'unf.all': 'Go through the whole list without selecting',
      'unf.backgroundToggle': 'keep going in the background even if the tab is closed',
      'unf.backgroundTest': 'Test background mode (one account)',
      'unf.protection': 'Protect: {n} — edit in the popup',
      'unf.counterVisible': 'visible {n}',
      'unf.counterArchive': 'archive: {subs} following · {fans} followers',
      'unf.counterNoFollowBack': 'visible {n} · not following back {m}',
      'unf.counterErrors': ' · errors {n}',
      'unf.startRunning': 'unfollowing…',
      'unf.startCount': 'Unfollow ({n})',
      'unf.modeArchiveBackground': 'archive · background',
      'unf.modeBackground': 'background',
      'unf.modeArchive': 'archive',
      'unf.modeWorking': 'working',
      'unf.markProtected': 'In the protect list — not unfollowing',
      'unf.markMutual': 'Follows you — cannot be selected',
      'unf.markSelect': 'Select (Shift — range, Alt — unfollow now)',
      'unf.unfollowing': 'unfollowing @{name}…',
      'unf.doneShort': 'done',
      'unf.failedShort': 'failed — see the console',
      'unf.unfollowNow': 'Unfollow this one now',
      'unf.archiveResetDone': 'archive lists reset — load following.js and follower.js again',
      'unf.archiveInfo': 'following {subs} · followers {fans} · to unfollow {candidates}',
      'unf.archiveAlready': ' · already undone {n}',
      'unf.archiveLoadedAt': ' · loaded {date}',
      'unf.archiveFilesNeeded': 'both files are needed: following.js and follower.js',
      'unf.archiveStartCount': 'Unfollow from archive ({n})',
      'unf.noArchiveLists': 'no archive lists',
      'unf.archiveResetConfirm': 'Reset the loaded following and follower lists? You will need to choose the files again.',
      'unf.archiveParsed': 'archive: {subs} following, {fans} followers',
      'unf.archiveBadFiles': 'could not parse the files — following.js and follower.js from the archive are needed',
      'unf.archiveConfirm': 'Unfollow {n} accounts from the archive?\n\nThe queue runs in the background: you can close the tab.',
      'unf.backgroundFailed': 'the background did not start: {error}',
      'unf.archiveStarted': 'unfollowing from the archive in the background — you can close the tab',
      'unf.allConfirm': 'Go through the whole list and unfollow everyone who is not protected and does not follow you back?\n\nThis is permanent.',
      'unf.fiveFails': 'five failures in a row — stopped',
      'unf.fiveMisses': 'five misses in a row — stopped',
      'unf.doneTotal': 'done — {n} unfollowed',
      'unf.checkNone': 'nobody to check — select a row',
      'unf.checkConfirm': 'The background test will really unfollow @{name}.\n\nContinue?',
      'unf.checkCancelled': 'test cancelled — nobody was touched',
      'unf.checking': 'testing a background request…',
      'unf.checkAnswered': 'the background answered {status}',
      'unf.checkNoAnswer': 'the background did not answer',
      'unf.backgroundMsg': 'background: {error}',
      'unf.backgroundWorking': 'working in the background — you can close the tab',
      'unf.backgroundForeground': 'unfollowing — do not close the tab',
      'unf.backgroundDone': 'done — {done} of {total} unfollowed',
      'unf.backgroundStopped': 'stopped: {status}. If you continue, already undone accounts will not repeat.',
      'unf.stopping': 'stopping…',
      'unf.backgroundStartConfirm': 'Unfollow {n} accounts in the background?\n\nThe queue lives in the extension: you can switch tabs or close the X page.',
      'unf.backgroundStarted': 'started in the background — you can close the tab',
      'unf.startConfirm': 'Unfollow {n} accounts?\n\nThe Follow button will only come back manually.',
      'unf.stopStatus': 'stopped'
    }
  });
  if (window.__отписка) return null;
  if (!/(^|\.)x\.com$/.test(location.hostname) && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return console.log('❌ открой x.com/<твой ник>/following и запусти скрипт там');
  }

  const СТРОКА = '[data-testid="UserCell"]';
  const КНОПКА = '[data-testid$="-unfollow"]';
  const ПОДТВЕРЖДЕНИЕ = '[data-testid="confirmationSheetConfirm"]';
  const ВЗАИМНЫЙ = '[data-testid="userFollowIndicator"]';

  // Односегментные служебные пути X (/i, /home, /search…): если взять их за ник,
  // строка получит защиту и метку «@i» вместо настоящего имени.
  const СЛУЖЕБНЫЕ_ПУТИ = new Set([
    'i', 'home', 'explore', 'search', 'notifications', 'messages', 'settings',
    'compose', 'intent', 'hashtag', 'login', 'logout', 'signup', 'tos', 'privacy',
    'following', 'followers', 'reposts', 'likes', 'lists', 'bookmarks', 'premium'
  ]);

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const пауза = () => sleep(1500 + Math.random() * 1200);

  const видно = el => el && el.isConnected && el.getClientRects().length > 0;

  const idИзКнопки = btn => {
    const m = (btn.getAttribute('data-testid') || '').match(/^(\d+)-unfollow$/);
    return m ? m[1] : null;
  };

  const никИзСтроки = cell => {
    for (const a of cell.querySelectorAll('a[href]')) {
      const href = String(a.getAttribute('href') || '');
      // Ссылки бывают и относительными, и полными — берём только путь.
      const путь = href.replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com/i, '');
      const m = путь.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
      if (m && !СЛУЖЕБНЫЕ_ПУТИ.has(m[1].toLowerCase())) return m[1];
    }
    return '';
  };

  // --------------------------------------------------------------------------
  //  Что уже выбрано
  // --------------------------------------------------------------------------
  // Кого не трогать: список живёт в хранилище расширения и правится в попапе
  // («Неприкасаемые»): вставка любого текста, ручное добавление и удаление.
  const белый = { ники: new Set(), id: new Set() };
  const применитьСписок = список => {
    белый.ники = new Set(((список && список.ники) || []).map(x => String(x).toLowerCase()));
    белый.id = new Set(((список && список.id) || []).map(x => String(x)));
    сброситьКэшКандидатов();
  };
  const вБелом = (id, ник) => белый.id.has(String(id)) || белый.ники.has(String(ник || '').toLowerCase());

  // Кого уже отписали в прошлых прогонах (в том числе фоновых) — не трогаем повторно.
  const историяОтписок = new Set();
  const перечитатьИсторию = () => XHistory.прочитать('unfollow').then(ids => {
    историяОтписок.clear();
    ids.forEach(id => историяОтписок.add(String(id)));
    сброситьКэшКандидатов();
  }).catch(() => {});

  // Перебор архивных списков (тысячи id) на каждый скан заставляет прокрутку
  // дёргаться. Считаем кандидатов один раз и пересчитываем только после
  // осмысленного изменения: архив, история, список защиты, известные ники.
  let версияСписков = 0;
  let кэшКандидатов = { версия: -1, ids: [] };
  function сброситьКэшКандидатов() { версияСписков++; }

  const выбрано = new Set();
  const известно = new Map();      // id → { ник, взаимный }
  let якорь = null;                // от какой строки тянуть отрезок по Shift

  const строки = () => [...document.querySelectorAll(СТРОКА)].filter(видно);
  const кнопкаВ = cell => cell ? cell.querySelector(КНОПКА) : null;
  const idСтроки = cell => {
    const b = кнопкаВ(cell);
    return b ? idИзКнопки(b) : null;
  };
  const взаимный = cell => !!cell.querySelector(ВЗАИМНЫЙ);

  // --------------------------------------------------------------------------
  //  Панель
  // --------------------------------------------------------------------------
  const stats = { отписал: 0, ошибок: 0 };
  let running = false;

  const panel = document.createElement('div');
  panel.id = '__отписка_панель';
  panel.className = 'xc-panel';
  panel.innerHTML = `
    <div class="xc-head">
      <div class="xc-title">${t('unf.title')}</div>
      <div class="xc-chip" id="__отписка_режим">${t('mode.idle')}</div>
    </div>

    <div class="xc-cards">
      <div class="xc-card"><div class="xc-num" id="__отписка_число_к">0</div><div class="xc-label">${t('unf.left')}</div></div>
      <div class="xc-card"><div class="xc-num" id="__отписка_число_сделано">0</div><div class="xc-label">${t('unf.done')}</div></div>
    </div>

    <div class="xc-bar"><i id="__отписка_бар"></i></div>
    <div class="xc-meta"><span id="__отписка_прогресс">${t('archive.nothingRunning')}</span></div>

    <div class="xc-status" id="__отписка_статус">${t('unf.initial')}</div>

    <div class="xc-row">
      <button class="xc-btn xc-btn--primary xc-btn--wide" id="__отписка_старт" disabled>${t('unf.start')}</button>
      <button class="xc-btn" id="__отписка_стоп" disabled>${t('common.stop')}</button>
    </div>

    <details class="xc-details" id="__отписка_архив_блок">
      <summary>${t('unf.archiveSummary')}</summary>
      <div class="xc-details-body">
        <button class="xc-btn" id="__отписка_архив">${t('unf.archiveChoose')}</button>
        <div class="xc-note" id="__отписка_архив_итог">${t('unf.archiveEmpty')}</div>
        <button class="xc-btn xc-btn--quiet" id="__отписка_архив_сброс">${t('unf.archiveReset')}</button>
        <button class="xc-btn xc-btn--primary" id="__отписка_архив_старт" disabled>${t('unf.archiveStart')}</button>
      </div>
    </details>

    <div class="xc-row">
      <button class="xc-btn xc-btn--wide" id="__отписка_видимые">${t('unf.visible')}</button>
      <button class="xc-btn" id="__отписка_снять">${t('unf.clearSelection')}</button>
    </div>

    <button class="xc-btn xc-btn--wide" id="__отписка_всех" style="margin-bottom:9px">${t('unf.all')}</button>

    <label class="xc-toggle" style="margin-bottom:8px">
      <input id="__отписка_фон" type="checkbox">
      <span>${t('unf.backgroundToggle')}</span>
    </label>

    <button class="xc-btn xc-btn--quiet" id="__отписка_фон_тест" style="width:100%">${t('unf.backgroundTest')}</button>

    <div class="xc-foot">
      <div id="__отписка_защита_итог">${t('unf.protection', { n: 0 })}</div>
      <div id="__отписка_счёт" style="margin-top:2px">${t('unf.counterVisible', { n: 0 })}</div>
    </div>`;
  // Док раскладывает панели по вкладкам: одна рамка на все модули.
  if (window.XCDock) XCDock.регистрировать({ id: 'unfollow', титул: t('unf.title'), элемент: panel });
  else document.body.appendChild(panel);

  const $статус = panel.querySelector('#__отписка_статус');
  const $счёт = panel.querySelector('#__отписка_счёт');
  const $старт = panel.querySelector('#__отписка_старт');
  const $стоп = panel.querySelector('#__отписка_стоп');
  const $видимые = panel.querySelector('#__отписка_видимые');
  const $снять = panel.querySelector('#__отписка_снять');
  const $всех = panel.querySelector('#__отписка_всех');
  const $фон = panel.querySelector('#__отписка_фон');
  const $фонТест = panel.querySelector('#__отписка_фон_тест');
  const $архив = panel.querySelector('#__отписка_архив');
  const $архивИтог = panel.querySelector('#__отписка_архив_итог');
  const $архивСтарт = panel.querySelector('#__отписка_архив_старт');
  const $архивСброс = panel.querySelector('#__отписка_архив_сброс');
  const $режим = panel.querySelector('#__отписка_режим');
  const $числоК = panel.querySelector('#__отписка_число_к');
  const $числоСделано = panel.querySelector('#__отписка_число_сделано');
  const $бар = panel.querySelector('#__отписка_бар');
  const $прогресс = panel.querySelector('#__отписка_прогресс');
  const $защитаИтог = panel.querySelector('#__отписка_защита_итог');

  const статус = текст => { $статус.textContent = текст; };
  const прогресс = { всего: 0, начало: 0 };
  let работаВФоне = false;
  let режимАрхив = false;      // работаем по файлам архива, а не по строкам на странице

  const минуты = сек => XCI18n.минуты(сек);

  const счёт = () => {
    // Строки спрашиваем один раз: счёт зовётся на каждый скан, а каждый
    // querySelectorAll по живому списку — это обход DOM.
    const сейчас = строки();
    const вСписке = сейчас.length;
    const безПодписки = сейчас.filter(c => idСтроки(c) && !взаимный(c)).length;
    let поArchive = 0;
    try { поArchive = кандидатыПоАрхиву().length; } catch (e) {}

    const всего = прогресс.всего || 0;
    const сделано = stats.отписал;
    const осталось = всего ? Math.max(0, всего - сделано) : (выбрано.size || поArchive || 0);

    $числоК.textContent = String(осталось);
    $числоСделано.textContent = String(сделано);

    // полоска и подпись: одно место, где видно, сколько идёт и сколько ждать
    if (всего) {
      const доля = Math.min(100, Math.round(сделано / всего * 100));
      $бар.style.width = `${доля}%`;
      $бар.style.background = running ? 'var(--xc-accent)' : (сделано >= всего ? 'var(--xc-ok)' : '');
      let подпись = t('archive.progress', { done: XCI18n.число(сделано), total: XCI18n.число(всего), percent: доля });
      if (running && сделано >= 5) {
        const прошло = (Date.now() - прогресс.начало) / 1000;
        const наШтуку = Math.max(прошло / сделано, 1.5);   // темп не может быть быстрее паузы движка
        подпись += t('archive.leftTime', { time: минуты(наШтуку * (всего - сделано)) });
      } else if (!running) {
        подпись += сделано >= всего ? t('archive.finished') : t('archive.stoppedSuffix');
      }
      $прогресс.textContent = подпись;
    } else {
      $бар.style.width = '0%';
      $бар.style.background = 'var(--xc-accent)';
      $прогресс.textContent = t('archive.nothingRunning');
    }

    $счёт.textContent = архив.подписки.size
      ? t('unf.counterArchive', { subs: XCI18n.число(архив.подписки.size), fans: XCI18n.число(архив.подписчики.size) })
      : t('unf.counterNoFollowBack', { n: XCI18n.число(вСписке), m: XCI18n.число(безПодписки) });
    if (stats.ошибок) $счёт.textContent += t('unf.counterErrors', { n: stats.ошибок });

    $старт.textContent = running ? t('unf.startRunning') : (выбрано.size ? t('unf.startCount', { n: выбрано.size }) : t('unf.start'));
    $старт.disabled = !выбрано.size || running;
    $старт.style.opacity = $старт.disabled ? '.45' : '1';
    $стоп.style.opacity = $стоп.disabled ? '.45' : '1';
    if ($архивСтарт) $архивСтарт.style.opacity = $архивСтарт.disabled ? '.45' : '1';

    const архивЗагружен = архив.подписки.size > 0;
    $режим.textContent = running
      ? (работаВФоне ? (режимАрхив ? t('unf.modeArchiveBackground') : t('unf.modeBackground')) : (режимАрхив ? t('unf.modeArchive') : t('unf.modeWorking')))
      : (всего && сделано >= всего ? t('mode.done') : (архивЗагружен ? t('unf.modeArchive') : t('mode.idle')));
    $режим.dataset.tone = running ? 'run' : (всего && сделано >= всего ? 'done' : '');

  };

  // --------------------------------------------------------------------------
  //  Кружок и «×» в каждой строке
  // --------------------------------------------------------------------------
  // Вставка не должна двигать строку: метка лежит поверх аватара (position:absolute),
  // поэтому вёрстка X не пересчитывается ни при появлении, ни при наведении.
  // Вставка не должна ни двигать строку, ни наезжать на аватар: один раз добавляем
  // строке отступ слева, и метка живёт в этом отступе. Отступ ставится правилом CSS,
  // поэтому и уже нарисованные, и новые строки получают его сразу, без прыжка.
  const стили = document.createElement('style');
  стили.textContent = `
    [data-testid="UserCell"]{padding-left:46px !important}
    [data-наша-отметка]{position:absolute;left:7px;top:50%;transform:translateY(-50%);z-index:6;
      width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;
      cursor:pointer;background:#d97757;box-shadow:0 0 0 2px rgba(242,238,230,.6);
      color:#241a16;font:700 15px/1 system-ui;user-select:none;opacity:.55;transition:opacity .12s,background .12s}
    [data-наша-отметка]:hover{opacity:1}
    [data-наша-отметка][data-выбран]{opacity:1}
    [data-наша-отметка][data-взаимный]{background:#4a463f;opacity:.35;box-shadow:none;cursor:default}
    [data-наша-отметка][data-взащите]{background:#e0b06a;color:#241a16;opacity:.85;box-shadow:none;cursor:default;font-size:13px}
    [data-квест]{position:absolute;right:6px;top:6px;z-index:6;width:22px;height:22px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;background:rgba(217,119,87,.95);color:#241a16;
      font:700 15px/1 system-ui;cursor:pointer;opacity:0;transition:opacity .12s}
    [data-testid="UserCell"]:hover [data-квест]{opacity:1}
    @media (prefers-color-scheme: light) {
      [data-наша-отметка]{background:#c96442;box-shadow:0 0 0 2px rgba(255,255,255,.9);color:#fffdf8}
      [data-наша-отметка][data-взаимный]{background:#d5caba;color:#726b5f}
      [data-наша-отметка][data-взащите]{background:#94651f;color:#fffdf8}
      [data-квест]{background:rgba(201,100,66,.95);color:#fffdf8}
    }
  `;
  document.head.appendChild(стили);

  const отметить = cell => {
    const btn = кнопкаВ(cell);
    const id = btn && idИзКнопки(btn);

    // кнопки «Отслеживается» больше нет: отписались или X перерисовал строку
    if (!id) {
      if (cell.dataset.отметка) {
        cell.querySelectorAll('[data-наша-отметка]').forEach(el => el.remove());
        delete cell.dataset.отметка;
      }
      return;
    }

    // Строки в виртуальном списке переиспользуются: если id сменился — пересобираем
    if (cell.dataset.отметка === id) {
      const м = cell.querySelector('[data-наша-отметка]');
      if (м) {
        const круг = м.querySelector('[data-кружок]');
        if (круг) {
          const выб = выбрано.has(id);
          круг.dataset.выбран = выб ? '1' : '0';
          круг.textContent = выб ? '✓' : '';
          круг.toggleAttribute('data-выбран', выб);
        }
        return;
      }
      delete cell.dataset.отметка;      // React перерисовал строку и снёс нашу метку
    }
    cell.querySelectorAll('[data-наша-отметка]').forEach(el => el.remove());
    cell.dataset.отметка = id;
    if (getComputedStyle(cell).position === 'static') cell.style.position = 'relative';

    const ник = никИзСтроки(cell);
    const взаим = взаимный(cell);
    if (!известно.has(id)) сброситьКэшКандидатов();   // появился новый ник: защита по нику могла сработать
    известно.set(id, { ник, взаим });

    const круг = document.createElement('span');
    круг.setAttribute('data-наша-отметка', '1');
    круг.setAttribute('data-кружок', '1');

    if (вБелом(id, ник)) {
      круг.setAttribute('data-взащите', '1');
      круг.textContent = '🛡';
      круг.title = t('unf.markProtected');
    } else if (взаим) {
      круг.setAttribute('data-взаимный', '1');
      круг.textContent = '—';
      круг.title = t('unf.markMutual');
    } else {
      круг.title = t('unf.markSelect');
      if (выбрано.has(id)) { круг.textContent = '✓'; круг.toggleAttribute('data-выбран', true); }
      круг.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
      круг.addEventListener('click', async e => {
        e.preventDefault();
        e.stopPropagation();

        if (e.altKey) {                       // одиночная отписка без панели
          if (running) return;
          статус(t('unf.unfollowing', { name: известно.get(id)?.ник || id }));
          const ok = await отписатьсяОдин(cell, id);
          if (ok) {
            stats.отписал++;
            выбрано.delete(id);
            // Одиночная отписка тоже состоялась — пишем в историю, иначе
            // архивный проход попробует снять её повторно.
            историяОтписок.add(String(id));
            сброситьКэшКандидатов();
            XHistory.добавить('unfollow', [id]).catch(() => {});
          } else stats.ошибок++;
          счёт();
          статус(ok ? t('unf.doneShort') : t('unf.failedShort'));
          return;
        }

        if (e.shiftKey && якорь != null && якорь !== id) выделитьОтрезок(якорь, id);
        else if (выбрано.has(id)) выбрано.delete(id); else выбрано.add(id);
        якорь = id;
        перекрасить();
        счёт();

        круг.textContent = выбрано.has(id) ? '✓' : '';
        круг.toggleAttribute('data-выбран', выбрано.has(id));
      });
    }

    cell.appendChild(круг);

    if (!взаим) {
      const крестик = document.createElement('span');
      крестик.setAttribute('data-квест', '1');
      крестик.textContent = '×';
      крестик.title = t('unf.unfollowNow');
      крестик.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
      крестик.addEventListener('click', async e => {
        e.preventDefault();
        e.stopPropagation();
        if (running) return;
        статус(t('unf.unfollowing', { name: известно.get(id)?.ник || id }));
        const ok = await отписатьсяОдин(cell, id);
        if (ok) {
          stats.отписал++;
          выбрано.delete(id);
          // Одиночная отписка тоже состоялась — пишем в историю, иначе
          // архивный проход попробует снять её повторно.
          историяОтписок.add(String(id));
          сброситьКэшКандидатов();
          XHistory.добавить('unfollow', [id]).catch(() => {});
        } else stats.ошибок++;
        счёт();
        статус(ok ? 'готово' : 'не вышло — смотри консоль');
      });
      cell.appendChild(крестик);
    }
  };

  const перекрасить = () => {
    строки().forEach(cell => {
      const id = idСтроки(cell);
      const м = cell.querySelector('[data-кружок]');
      if (!id || !м || м.hasAttribute('data-взаимный') || м.hasAttribute('data-взащите')) return;
      м.dataset.выбран = выбрано.has(id) ? '1' : '0';
      м.textContent = выбрано.has(id) ? '✓' : '';
      м.toggleAttribute('data-выбран', выбрано.has(id));
    });
  };

  const выделитьОтрезок = (отId, доИд) => {
    // Строки собираем один раз и раскладываем по id: иначе на каждой строке
    // отрезка шёл бы полный querySelectorAll — квадрат на длинном списке.
    const клетки = new Map();
    строки().forEach(cell => {
      const id = idСтроки(cell);
      if (id && !клетки.has(id)) клетки.set(id, cell);
    });
    const порядок = [...клетки.keys()];
    const a = порядок.indexOf(отId);
    const b = порядок.indexOf(доИд);
    if (a < 0 || b < 0) { выбрано.add(доИд); return; }
    const [с, по] = a < b ? [a, b] : [b, a];
    for (let i = с; i <= по; i++) {
      const id = порядок[i];
      const cell = клетки.get(id);
      if (!id || !cell || взаимный(cell)) continue;                       // взаимных не трогаем
      if (вБелом(id, известно.get(id)?.ник)) continue;                    // и тех, кто в защите
      выбрано.add(id);
    }
  };

  // --------------------------------------------------------------------------
  //  Отписка
  // --------------------------------------------------------------------------
  const найтиСтроку = async id => {
    const сразу = строки().find(c => idСтроки(c) === id);
    if (сразу) return сразу;

    // Строки уходят из DOM при прокрутке — ищем вверх/вниз по странице.
    // Раньше это было 40 шагов в каждую сторону по 350 мс: до 28 секунд на один
    // промах, и страница уезжала далеко от того места, где её оставил человек.
    // Теперь шагов меньше, шаг останавливается, если страница не двигается,
    // а после неудачи список возвращается на исходное место.
    const исходно = window.scrollY;
    const шагПауза = window.__XC_ТЕСТ_БЫСТРО ? 5 : 250;
    const шагов = window.__XC_ТЕСТ_БЫСТРО ? 2 : 12;
    for (const шаг of [-1, 1]) {
      for (let i = 0; i < шагов; i++) {
        const было = window.scrollY;
        window.scrollBy(0, шаг * window.innerHeight * 0.9);
        await sleep(шагПауза);
        const нашлась = строки().find(c => idСтроки(c) === id);
        if (нашлась) return нашлась;
        if (Math.abs(window.scrollY - было) <= 2) break;   // дальше двигаться некуда
      }
    }
    try { window.scrollTo(0, исходно); } catch (e) {}     // не нашли — на место
    return null;
  };

  const отписатьсяОдин = async (cell, id) => {
    const btn = кнопкаВ(cell);
    if (!btn) return false;
    cell.scrollIntoView({ block: 'center' });
    await sleep(150);

    btn.click();
    const подтв = await (async () => {
      for (let i = 0; i < 20; i++) {
        const b = document.querySelector(ПОДТВЕРЖДЕНИЕ);
        if (видно(b)) return b;
        await sleep(100);
      }
      return null;
    })();

    if (подтв) {
      подтв.click();
      // подтверждение исчезло, а кнопка «Отслеживается» сменилась на «Подписаться»
      for (let i = 0; i < 25; i++) {
        await sleep(120);
        if (!document.contains(btn) || !кнопкаВ(cell)) return true;
        if (!cell.querySelector(КНОПКА)) return true;
      }
      return !cell.querySelector(КНОПКА);
    }
    // у некоторых аккаунтов подтверждения нет — считаем успехом, если кнопка пропала
    await sleep(600);
    return !document.contains(btn) || !cell.querySelector(КНОПКА);
  };

  // --------------------------------------------------------------------------
  //  Список защиты: показать, сохранить, очистить
  // --------------------------------------------------------------------------
  const обновитьЗащиту = () => {
    const всего = белый.ники.size + белый.id.size;
    $защитаИтог.textContent = t('unf.protection', { n: всего });
  };

  // --------------------------------------------------------------------------
  //  Архив: following.js (кого читаю) + follower.js (кто читает меня)
  //
  //  В архиве только числовые id, без ников: взаимность считается пересечением
  //  двух списков. Защита по id работает всегда, защита по нику — только для
  //  тех строк, которые уже видели на странице (id → ник).
  // --------------------------------------------------------------------------
  const архив = { подписки: new Set(), подписчики: new Set(), время: 0 };
  const АРХИВ_КЛЮЧ = 'архив_списки';
  const архивЗагружен = () => архив.подписки.size > 0;

  const разобратьФайлСписка = текст => {
    const начало = String(текст || '').indexOf('[');
    if (начало < 0) return null;
    let данные;
    // Хвостовую «;» снимаем: файлы архива приходят и с ней, а JSON.parse на ней
    // падает — раньше из-за этого весь архив молча «не разбирался».
    try { данные = JSON.parse(String(текст).slice(начало).replace(/;\s*$/, '')); } catch (e) { return null; }
    if (!Array.isArray(данные) || !данные.length) return null;
    const первый = данные[0] || {};
    const тип = первый.follower ? 'подписчики' : первый.following ? 'подписки' : null;
    if (!тип) return null;
    const ids = данные
      .map(запись => (запись.follower || запись.following || {}).accountId)
      .filter(Boolean)
      .map(String);
    return { тип, ids };
  };

  const кандидатыПоАрхиву = () => {
    if (!архив.подписки.size) return [];
    if (кэшКандидатов.версия === версияСписков) return кэшКандидатов.ids;

    const ids = [...архив.подписки].filter(id => {
      if (архив.подписчики.has(id)) return false;              // подписан на меня
      if (белый.id.has(id)) return false;                      // защита по id
      if (историяОтписок.has(id)) return false;                // уже снят ранее
      const ник = известно.get(id)?.ник;
      if (ник && белый.ники.has(ник)) return false;            // защита по нику, если ник известен
      return true;
    });
    кэшКандидатов = { версия: версияСписков, ids };
    return ids;
  };

  const сохранитьАрхивныеСписки = () => {
    архив.время = Date.now();
    try {
      chrome.storage.local.set({
        [АРХИВ_КЛЮЧ]: {
          подписки: [...архив.подписки],
          подписчики: [...архив.подписчики],
          ts: Date.now()
        }
      });
    } catch (e) {}
  };

  const загрузитьАрхивныеСписки = () => new Promise(resolve => {
    try {
      chrome.storage.local.get(АРХИВ_КЛЮЧ, данные => {
        const списки = данные && данные[АРХИВ_КЛЮЧ];
        if (списки) {
          (списки.подписки || []).forEach(id => архив.подписки.add(String(id)));
          (списки.подписчики || []).forEach(id => архив.подписчики.add(String(id)));
          архив.время = списки.ts || 0;
          режимАрхив = архив.подписки.size > 0;
          сброситьКэшКандидатов();
        }
        resolve();
      });
    } catch (e) { resolve(); }
  });

  const сброситьАрхивныеСписки = () => {
    архив.подписки.clear();
    архив.подписчики.clear();
    архив.время = 0;
    режимАрхив = false;
    сброситьКэшКандидатов();
    try { chrome.storage.local.remove(АРХИВ_КЛЮЧ); } catch (e) {}
    обновитьАрхив();
    счёт();
    статус(t('unf.archiveResetDone'));
  };

  const обновитьАрхив = () => {
    const кандидаты = кандидатыПоАрхиву().length;
    const ужеСнято = [...архив.подписки].filter(id => историяОтписок.has(id)).length;
    const когда = XCI18n.дата(архив.время);
    $архивИтог.textContent = архив.подписки.size
      ? t('unf.archiveInfo', { subs: XCI18n.число(архив.подписки.size), fans: XCI18n.число(архив.подписчики.size), candidates: XCI18n.число(кандидаты) }) +
        (ужеСнято ? t('unf.archiveAlready', { n: ужеСнято }) : '') +
        (когда ? t('unf.archiveLoadedAt', { date: когда }) : '')
      : t('unf.archiveFilesNeeded');
    $архивСтарт.disabled = !кандидаты || running;
    $архивСтарт.textContent = кандидаты ? t('unf.archiveStartCount', { n: кандидаты }) : t('unf.archiveStart');
  };

  const входАрхив = document.createElement('input');
  входАрхив.type = 'file';
  входАрхив.multiple = true;
  входАрхив.accept = '.js,.txt,text/javascript';
  входАрхив.style.display = 'none';
  document.body.appendChild(входАрхив);

  $архив.addEventListener('click', () => входАрхив.click());

  $архивСброс.addEventListener('click', () => {
    if (!архив.подписки.size) { статус(t('unf.noArchiveLists')); return; }
    if (!confirm(t('unf.archiveResetConfirm'))) return;
    сброситьАрхивныеСписки();
  });

  входАрхив.addEventListener('change', async () => {
    архив.подписки.clear();
    архив.подписчики.clear();
    let файлов = 0;
    for (const файл of входАрхив.files || []) {
      const разбор = разобратьФайлСписка(await файл.text());
      if (!разбор) continue;
      файлов++;
      const цель = разбор.тип === 'подписки' ? архив.подписки : архив.подписчики;
      разбор.ids.forEach(id => цель.add(id));
    }
    режимАрхив = файлов > 0;
    сброситьКэшКандидатов();
    if (файлов) {
      panel.querySelector('#__отписка_архив_блок').setAttribute('open', '');
      сохранитьАрхивныеСписки();
    }
    обновитьАрхив();
    счёт();
    статус(файлов
      ? t('unf.archiveParsed', { subs: архив.подписки.size, fans: архив.подписчики.size })
      : t('unf.archiveBadFiles'));
  });

  $архивСтарт.addEventListener('click', async () => {
    if (running) return;
    const ids = кандидатыПоАрхиву();
    if (!ids.length) return;
    if (!confirm(t('unf.archiveConfirm', { n: ids.length }))) return;

    running = true;
    работаВФоне = true;
    // Галочку «продолжать в фоне» здесь не ставим сами: архивный запуск и так
    // идёт через фон (это написано в подтверждении), а трогать чужой выбор
    // пользователя без спроса — сюрприз. Галочка остаётся как её оставили.
    $старт.disabled = true;
    $архивСтарт.disabled = true;
    $стоп.disabled = false;
    const ответ = await фонСообщение({ type: 'bg-unfollow-start', ids, delayMs: 2000 });
    if (!ответ || ответ.ошибка) {
      статус(t('unf.backgroundFailed', { error: (ответ && ответ.ошибка) || t('archive.noConnection') }));
      running = false; $старт.disabled = false; $стоп.disabled = true; обновитьАрхив();
      return;
    }
    прогресс.всего = ids.length;
    прогресс.начало = Date.now();
    статус(t('unf.archiveStarted'));
    счёт();
    следитьЗаФоном();
  });

  // --------------------------------------------------------------------------
  //  «Отписаться от всех лишних»: без выбора, но с защитой и взаимными
  // --------------------------------------------------------------------------
  const пройтиЛишних = async () => {
    if (running) return;
    if (!confirm(t('unf.allConfirm'))) return;

    running = true;
    работаВФоне = false;
    $старт.disabled = true;
    $всех.disabled = true;
    $стоп.disabled = false;
    const пробовали = new Set();
    let пусто = 0, подряд = 0;

    while (running) {
      const кандидаты = строки().filter(cell => {
        const id = idСтроки(cell);
        if (!id || пробовали.has(id) || взаимный(cell)) return false;
        return !вБелом(id, известно.get(id)?.ник);
      });

      if (!кандидаты.length) {
        const до = window.scrollY;
        window.scrollBy(0, window.innerHeight * 0.9);
        await sleep(900);
        const сдвиг = Math.abs(window.scrollY - до) > 2;
        пусто = сдвиг ? 0 : пусто + 1;
        if (пусто >= 4) break;                     // четыре пустых прокрутки — список кончился
        continue;
      }

      пусто = 0;
      const cell = кандидаты[0];
      const id = idСтроки(cell);
      пробовали.add(id);
      статус(t('unf.unfollowing', { name: известно.get(id)?.ник || id }));

      const ok = await отписатьсяОдин(cell, id);
      if (ok) {
        stats.отписал++;
        подряд = 0;
        выбрано.delete(id);
        историяОтписок.add(String(id));
        сброситьКэшКандидатов();
        XHistory.добавить('unfollow', [id]).catch(() => {});
      } else {
        stats.ошибок++;
        подряд++;
        console.warn('не вышло отписаться', id);
        if (подряд >= 5) { статус(t('unf.fiveFails')); break; }
      }
      счёт();
      await пауза();
    }

    running = false;
    $всех.disabled = false;
    $стоп.disabled = true;
    счёт();
    if (!/остановился/.test($статус.textContent)) статус(t('unf.doneTotal', { n: stats.отписал }));
    console.log('итог:', JSON.stringify(stats));
  };

  $фонТест.addEventListener('click', async () => {
    const годные = строки()
      .filter(cell => !взаимный(cell))
      .map(cell => idСтроки(cell))
      .filter(id => id && !вБелом(id, известно.get(id)?.ник));
    const id = [...выбрано][0] || годные[0];
    if (!id) { статус(t('unf.checkNone')); return; }
    // Это не примерка: тест делает настоящий запрос на отписку. Спрашиваем
    // явно и называем аккаунт, чтобы не отписаться от него случайно.
    const кого = известно.get(id)?.ник;
    if (!confirm(t('unf.checkConfirm', { name: кого || id }))) {
      статус(t('unf.checkCancelled'));
      return;
    }
    статус(t('unf.checking'));
    const ответ = await фонСообщение({ type: 'bg-unfollow-test', id });
    if (ответ && ответ.status === 200) {
      stats.отписал++;
      выбрано.delete(id);
      историяОтписок.add(String(id));
      сброситьКэшКандидатов();
      XHistory.добавить('unfollow', [id]).catch(() => {});
      счёт();
    }
    console.log('фон-тест', id, ответ);
    статус(ответ && ответ.status ? t('unf.checkAnswered', { status: ответ.status }) : t('unf.checkNoAnswer'));
  });

  $всех.addEventListener('click', пройтиЛишних);

  $видимые.addEventListener('click', () => {
    строки().forEach(cell => {
      const id = idСтроки(cell);
      if (id && !взаимный(cell) && !вБелом(id, известно.get(id)?.ник)) выбрано.add(id);
    });
    перекрасить();
    счёт();
  });

  $снять.addEventListener('click', () => {
    выбрано.clear();
    перекрасить();
    счёт();
  });

  // --------------------------------------------------------------------------
  //  Фоновый режим: очередь уходит в service worker и работает без вкладки
  // --------------------------------------------------------------------------
  const фонСообщение = msg => new Promise(resolve => {
    try {
      chrome.runtime.sendMessage(msg, r => resolve(r || { ok: false }));
    } catch (e) {
      resolve({ ok: false, ошибка: String(e && e.message || e) });
    }
  });

  let опросФона = null;
  const следитьЗаФоном = () => {
    clearInterval(опросФона);
    опросФона = setInterval(async () => {
      const st = await фонСообщение({ type: 'bg-unfollow-status' });
      if (!st || st.ошибка) {
        статус(t('unf.backgroundMsg', { error: (st && st.ошибка) || t('archive.noConnection') }));
        clearInterval(опросФона); опросФона = null;
        return;
      }
      stats.отписал = st.отписал || 0;
      stats.ошибок = st.ошибок || 0;
      if (st.всего) { прогресс.всего = st.всего; if (!прогресс.начало) прогресс.начало = Date.now(); }
      счёт();
      статус(работаВФоне ? t('unf.backgroundWorking') : t('unf.backgroundForeground'));
      if (!st.запущено) {
        clearInterval(опросФона); опросФона = null;
        running = false;
        $старт.disabled = false;
        $стоп.disabled = true;
        if (st.статус === 'готово') { выбрано.clear(); перекрасить(); }
        статус(st.статус === 'готово'
          ? t('unf.backgroundDone', { done: st.отписал, total: st.всего })
          : t('unf.backgroundStopped', { status: XCI18n.статус(st.статус) }));
        перечитатьИсторию().then(() => { счёт(); обновитьАрхив(); });
      }
    }, 1500);
  };

  $стоп.addEventListener('click', async () => {
    running = false;
    if ($фон.checked) await фонСообщение({ type: 'bg-unfollow-stop' });
    статус(t('unf.stopping'));
  });

  $старт.addEventListener('click', async () => {
    if (running || !выбрано.size) return;

    if ($фон.checked) {
      if (!confirm(t('unf.backgroundStartConfirm', { n: выбрано.size }))) return;
      running = true;
      работаВФоне = true;
      $фон.checked = true;
      $старт.disabled = true;
      $стоп.disabled = false;
      const ответ = await фонСообщение({ type: 'bg-unfollow-start', ids: [...выбрано], delayMs: 2000 });
      if (!ответ || ответ.ошибка) {
        статус(t('unf.backgroundFailed', { error: (ответ && ответ.ошибка) || t('archive.noConnection') }));
        running = false; $старт.disabled = false; $стоп.disabled = true;
        return;
      }
      прогресс.всего = выбрано.size;
      прогресс.начало = Date.now();
      статус(t('unf.backgroundStarted'));
      счёт();
      следитьЗаФоном();
      return;
    }

    if (!confirm(t('unf.startConfirm', { n: выбрано.size }))) return;

    running = true;
    работаВФоне = false;
    режимАрхив = false;
    прогресс.всего = выбрано.size;
    прогресс.начало = Date.now();
    счёт();
    $стоп.disabled = false;
    let подряд = 0;

    for (const id of [...выбрано]) {
      if (!running) break;
      const cell = await найтиСтроку(id);
      if (!cell) {
        stats.ошибок++; подряд++;
        console.warn('не нашёл строку', id, известно.get(id));
        if (подряд >= 5) { статус(t('unf.fiveMisses')); break; }
        continue;
      }
      статус(t('unf.unfollowing', { name: известно.get(id)?.ник || id }));
      const ok = await отписатьсяОдин(cell, id);
      if (ok) {
        stats.отписал++;
        подряд = 0;
        выбрано.delete(id);
        историяОтписок.add(String(id));
        сброситьКэшКандидатов();
        XHistory.добавить('unfollow', [id]).catch(() => {});
      } else {
        stats.ошибок++; подряд++;
        console.warn('не вышло отписаться', id);
        if (подряд >= 5) { статус(t('unf.fiveFails')); break; }
      }
      счёт();
      await пауза();
    }

    running = false;
    $стоп.disabled = true;
    счёт();
    if (!/остановился/.test($статус.textContent)) статус(t('unf.doneTotal', { n: stats.отписал }));
    console.log('итог:', JSON.stringify(stats));
  });

  // --------------------------------------------------------------------------
  //  Слежение за списком: строки подгружаются и переиспользуются
  // --------------------------------------------------------------------------
  let запланировано = false;
  const просканировать = () => {
    запланировано = false;
    строки().forEach(отметить);
    счёт();
  };
  const план = () => {
    if (запланировано) return;
    запланировано = true;
    setTimeout(просканировать, 150);
  };

  const наблюдатель = new MutationObserver(план);
  наблюдатель.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('scroll', план, { passive: true });

  // Список неприкасаемых берём из хранилища расширения: пока он не пришёл,
  // кружки не рисуем, чтобы защищённые строки не мигнули доступными.
  перечитатьИсторию();
  загрузитьАрхивныеСписки().then(() => {
    if (архивЗагружен()) {
      $архивИтог.parentElement?.parentElement?.setAttribute('open', '');
      обновитьАрхив();
      счёт();
    }
  });
  XProtect.прочитать().then(список => {
    применитьСписок(список);
    обновитьЗащиту();
    строки().forEach(c => delete c.dataset.отметка);   // метки могли нарисоваться до списка
    просканировать();
    счёт();
    обновитьАрхив();
  }).catch(() => {
    обновитьЗащиту();
    просканировать();
    обновитьАрхив();
  });

  // Список правится в попапе — подхватываем изменения без перезагрузки страницы.
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes['защита']) return;
      применитьСписок(changes['защита'].newValue);
      // кто стал неприкасаемым — снимаем с выбора
      [...выбрано].forEach(id => {
        if (вБелом(id, известно.get(id)?.ник)) выбрано.delete(id);
      });
      обновитьЗащиту();
      строки().forEach(c => delete c.dataset.отметка);
      просканировать();
      перекрасить();
      счёт();
      обновитьАрхив();
    });
  } catch (e) {}

  window.__отписка = {
    стоп: () => { running = false; статус(t('unf.stopStatus')); },
    сколько: () => ({ ...stats, выбрано: выбрано.size, вЗащите: белый.ники.size + белый.id.size }),
    выбратьВидимых: () => $видимые.click(),
    отписатьсяОтЛишних: () => $всех.click(),
    защита: () => ({ ники: [...белый.ники], id: [...белый.id] }),
    снять: () => $снять.click(),
    панель: panel
  };

  console.log('%c✅ панель отписки внизу справа. Кружок — выбор, Shift — отрезок, × — отписаться сразу.', 'color:#1d9bf0;font-weight:700');
  console.log('остановить: __отписка.стоп()  |  счёт: __отписка.сколько()');
  return window.__отписка;
});
