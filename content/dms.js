// ============================================================================
//  КНОПКА «УДАЛИТЬ ПЕРЕПИСКИ» В X
//
//  Модуль расширения Cleanup for X. Открой x.com/i/chat. Справа снизу
//  появляется панель с кнопкой. Жмёшь — скрипт идёт по списку переписок и
//  удаляет их так же, как это делают руки: правый клик по переписке →
//  «Удалить переписку» (у группы — «Покинуть переписку») → подтверждение.
//
//  - личные переписки и заявки на сообщения удаляются у тебя из входящих;
//    у собеседника копия остаётся — X тут ничего не может сделать;
//  - группы по умолчанию НЕ трогаются: включи галочку, если хочешь выйти;
//  - скорость — примерно одна переписка в секунду, чтобы X не принял это
//    за спам; при трёх ошибках подряд скрипт останавливается сам;
//  - если X обновит вёрстку, панель останется, а удаление перестанет
//    находить меню — тогда просто перезагрузи страницу и скажи мне;
//  - ничего никуда не отправляет и не сохраняет: только клики по самой X.
//
//  Выключить: перезагрузить страницу. Или в консоли: __переписки.стоп()
// ============================================================================
XC.модуль('dms', () => {
  if (!/\/i\/chat|\/messages/.test(location.pathname)) return null;
  if (window.__переписки) return null;

  const t = (ключ, данные) => XCI18n.t(ключ, данные);
  XCI18n.добавить({
    ru: {
      'dms.title': 'Чистка переписок',
      'dms.initial': 'Удаляет диалоги у тебя. У собеседника копия остаётся.',
      'dms.groupsTitle': 'По умолчанию группы не трогаются',
      'dms.groups': 'выйти и из групп',
      'dms.start': 'Удалить переписки',
      'dms.foot': 'видно {visible} · удалено {done}',
      'dms.footLeft': ' · вышло из групп {n}',
      'dms.footSkipped': ' · групп пропущено {n}',
      'dms.footErrors': ' · ошибок {n}',
      'dms.noList': 'не вижу список переписок',
      'dms.leaving': 'выхожу из группы…',
      'dms.deleting': 'удаляю переписку…',
      'dms.menuNotOpened': 'меню не открылось',
      'dms.noDelete': 'в меню нет удаления',
      'dms.noConfirm': 'не нашёл кнопку подтверждения',
      'dms.stillInList': 'переписка осталась в списке',
      'dms.threeErrors': 'Три ошибки подряд — остановился. Перезагрузи страницу и попробуй ещё раз.',
      'dms.threeErrorsJournal': 'Переписки: остановлено после трёх ошибок',
      'dms.stopped': 'Остановлено: удалено {n}',
      'dms.stoppedGroups': ', вышел из групп {n}',
      'dms.done': 'Готово: удалено {n}',
      'dms.doneGroups': ', вышел из групп {n}',
      'dms.doneJournal': 'Переписки: готово — удалено {n}',
      'dms.noneVisible': 'переписок не видно — открой список слева',
      'dms.confirm': 'Удалить переписки из списка (видно {n})?{groups}\n\nУ тебя они исчезнут безвозвратно, у собеседника копия останется.',
      'dms.confirmGroups': '\nГруппы тоже: ты из них выйдешь.',
      'dms.confirmNoGroups': '\nГруппы не трогаю.',
      'dms.starting': 'Пошёл: удаляю по одной, примерно раз в секунду.',
      'dms.startedJournal': 'Переписки: начал, видно {n}',
      'dms.stopping': 'Останавливаюсь: текущая переписка доделается.',
      'dms.stoppedStatus': 'Остановлено.',
      'dms.errorJournal': 'Переписки: {reason}'
    },
    en: {
      'dms.title': 'Clean up DMs',
      'dms.initial': 'Deletes conversations for you. The other person keeps a copy.',
      'dms.groupsTitle': 'Groups are not touched by default',
      'dms.groups': 'also leave groups',
      'dms.start': 'Delete conversations',
      'dms.foot': 'visible {visible} · deleted {done}',
      'dms.footLeft': ' · left groups {n}',
      'dms.footSkipped': ' · groups skipped {n}',
      'dms.footErrors': ' · errors {n}',
      'dms.noList': 'I cannot see the conversation list',
      'dms.leaving': 'leaving the group…',
      'dms.deleting': 'deleting the conversation…',
      'dms.menuNotOpened': 'the menu did not open',
      'dms.noDelete': 'no delete item in the menu',
      'dms.noConfirm': 'no confirm button found',
      'dms.stillInList': 'the conversation is still in the list',
      'dms.threeErrors': 'Three errors in a row — stopped. Reload the page and try again.',
      'dms.threeErrorsJournal': 'DMs: stopped after three errors',
      'dms.stopped': 'Stopped: {n} deleted',
      'dms.stoppedGroups': ', left groups {n}',
      'dms.done': 'Done: {n} deleted',
      'dms.doneGroups': ', left groups {n}',
      'dms.doneJournal': 'DMs: done — {n} deleted',
      'dms.noneVisible': 'no conversations visible — open the list on the left',
      'dms.confirm': 'Delete conversations from the list ({n} visible)?{groups}\n\nThey disappear for you permanently; the other person keeps a copy.',
      'dms.confirmGroups': '\nGroups too: you will leave them.',
      'dms.confirmNoGroups': '\nGroups are not touched.',
      'dms.starting': 'Started: deleting one by one, about once a second.',
      'dms.startedJournal': 'DMs: started, {n} visible',
      'dms.stopping': 'Stopping: the current conversation will finish.',
      'dms.stoppedStatus': 'Stopped.',
      'dms.errorJournal': 'DMs: {reason}'
    }
  });
  if (!/(^|\.)x\.com$/.test(location.hostname) && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return console.log('❌ открой x.com/i/chat и запусти скрипт там');
  }

  // --------------------------------------------------------------------------
  //  Что считаем кнопками удаления. X показывает их на языке интерфейса,
  //  поэтому сверяем по тексту, а не по месту в меню.
  // --------------------------------------------------------------------------
  const УДАЛИТЬ_ПЕРЕПИСКУ = [
    'Delete conversation', 'Leave conversation',
    'Удалить переписку', 'Покинуть переписку',
    'Видалити розмову', 'Покинути розмову',
    'Konversation löschen', 'Konversatiom verlassen', 'Gespräch löschen',
    'Eliminar conversación', 'Salir de la conversación',
    'Supprimer la conversation', 'Quitter la conversation',
    'Excluir conversa', 'Sair da conversa',
    'Sohbeti sil', 'Sohbetten ayrıl',
    'Usuń rozmowę', 'Opuść rozmowę',
    'Elimina conversazione', 'Abbandona conversazione'
  ];
  const ПОДТВЕРДИТЬ = [
    'Confirm', 'Delete', 'Delete conversation', 'Leave conversation',
    'Подтвердить', 'Удалить', 'Удалить переписку', 'Покинуть переписку',
    'Підтвердити', 'Видалити',
    'Bestätigen', 'Löschen', 'Confirmar', 'Eliminar', 'Confirmer', 'Supprimer',
    'Onayla', 'Sil', 'Potwierdź', 'Usuń', 'Conferma', 'Elimina'
  ];
  const ОТМЕНА = ['Cancel', 'Отмена', 'Скасувати', 'Abbrechen', 'Cancelar', 'Annuler', 'İptal', 'Anuluj', 'Annulla'];

  const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const набор = list => new Set(list.map(norm));
  const УДАЛИТЬ_SET = набор(УДАЛИТЬ_ПЕРЕПИСКУ);
  const ПОДТВЕРДИТЬ_SET = набор(ПОДТВЕРДИТЬ);
  const ОТМЕНА_SET = набор(ОТМЕНА);

  // --------------------------------------------------------------------------
  //  Мелкие помощники: сон, поиск по документу и по открытым shadow root
  //  (X Chat живёт в теневом дереве, обычный querySelector его не видит).
  // --------------------------------------------------------------------------
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const пауза = () => sleep(500 + Math.random() * 700);

  let rootsCache = null;
  let rootsВремя = 0;
  const roots = () => {
    // Теневое дерево X Chat строится один раз; пересобираем его не чаще раза
    // в 2 секунды, иначе обход всего документа на каждом шаге съедает CPU.
    if (rootsCache && Date.now() - rootsВремя < 2000) return rootsCache;
    const out = [document];
    const walk = root => {
      root.querySelectorAll('*').forEach(el => {
        if (el.shadowRoot) { out.push(el.shadowRoot); walk(el.shadowRoot); }
      });
    };
    walk(document);
    rootsCache = out;
    rootsВремя = Date.now();
    return out;
  };
  const сброс = () => { rootsCache = null; };

  const qa = sel => {
    const out = [];
    for (const root of roots()) { try { out.push(...root.querySelectorAll(sel)); } catch (e) {} }
    return out;
  };

  const видно = el => {
    if (!el || !el.isConnected) return false;
    if (el.closest('[hidden],[aria-hidden="true"]')) return false;
    return el.getClientRects().length > 0;
  };
  const открыто = el => видно(el) &&
    el.getAttribute('data-state') !== 'closed' &&
    !el.hasAttribute('data-closed') && !el.hasAttribute('data-ending-style');

  const waitFor = async (fn, timeout = 2000, interval = 80) => {
    const end = Date.now() + timeout;
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() > end) return null;
      await sleep(interval);
    }
  };

  const click = el => {
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
    }
  };
  const правыйКлик = el => {
    el.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, view: window, button: 2, buttons: 2,
      clientX: Math.round(el.getBoundingClientRect().left + 40),
      clientY: Math.round(el.getBoundingClientRect().top + 20)
    }));
  };
  const Esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));

  // --------------------------------------------------------------------------
  //  Переписки в списке
  // --------------------------------------------------------------------------
  const СТРОКА = '[data-testid^="dm-conversation-item-"],[data-testid^="dm-message-request-item-"]';
  const СКРОЛЛЕР = '[data-testid="dm-conversation-scroller"],[data-testid="dm-message-requests-scroller"]';

  const idСтроки = el => {
    const m = (el.getAttribute('data-testid') || '').match(/^dm-(?:conversation|message-request)-item-(.+)$/);
    return m ? m[1] : null;
  };
  const строки = () => qa(СТРОКА).filter(видно);
  const группа = id => /^g\d/.test(id || '');
  const скроллер = () => qa(СКРОЛЛЕР).find(видно) || null;

  // --------------------------------------------------------------------------
  //  Меню и подтверждение
  // --------------------------------------------------------------------------
  const меню = () => qa('[role="menu"]').filter(открыто);
  const пункты = m => [...m.querySelectorAll('[role="menuitem"]')]
    .filter(i => видно(i) && i.getAttribute('aria-disabled') !== 'true' && !i.hasAttribute('data-disabled'));
  const диалоги = () => qa('[role="dialog"],[role="alertdialog"],[data-slot="xds-modal-surface"]').filter(открыто);

  const поТексту = (els, set) => els.find(el => set.has(norm(el.innerText || el.textContent))) || null;

  const закрытьВсё = async () => {
    for (let i = 0; i < 4 && (меню().length || диалоги().length); i++) { Esc(); await sleep(160); }
  };


  const открытьМеню = async row => {
    const до = new Set(меню());
    const новый = () => меню().find(m => !до.has(m) && пункты(m).length);
    // Ссылку не кликаем: синтетический клик по <a> уводит на переписку.
    const цель = row.querySelector('[data-inbox-row]') || row;

    // основной путь — правый клик: он есть и в старом, и в новом интерфейсе
    цель.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
    правыйКлик(цель);
    let m = await waitFor(новый, 1500);
    if (m) return m;

    // запасной путь — обычный клик (некоторые сборки открывают меню только так)
    click(цель);
    m = await waitFor(новый, 800);
    if (m) return m;

    цель.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2, buttons: 2, view: window }));
    цель.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 2, buttons: 2, view: window }));
    правыйКлик(цель);
    return waitFor(новый, 1500);
  };

  const подтвердить = async dlg => {
    const кнопки = [...dlg.querySelectorAll('button')].filter(видно);
    const вПодвале = кнопки.filter(b => b.closest('[data-slot="xds-modal-footer"]'));
    const пул = вПодвале.length ? вПодвале : кнопки;
    const кнопка =
      поТексту(пул, ПОДТВЕРДИТЬ_SET) ||
      пул.filter(b => !ОТМЕНА_SET.has(norm(b.innerText || b.textContent))).pop() ||
      null;
    if (!кнопка) return false;
    click(кнопка);
    await waitFor(() => !открыто(dlg), 3000);
    return true;
  };

  // --------------------------------------------------------------------------
  //  Удаление одной переписки
  // --------------------------------------------------------------------------
  const удалитьОдну = async (id, row) => {
    const m = await открытьМеню(row);
    if (!m) return { ok: false, почему: t('dms.menuNotOpened') };
    try {
      let пункт = null;
      for (let i = 0; i < 2; i++) {                 // пункт удаления появляется чуть позже остальных
        пункт = поТексту(пункты(m), УДАЛИТЬ_SET);
        if (пункт) break;
        await sleep(500);
      }
      if (!пункт) {
        const красные = пункты(m).filter(x => /destructive|text-red|fg-destructive/.test(x.className || ''));
        пункт = красные.length === 1 ? красные[0] : null;
      }
      if (!пункт) return { ok: false, почему: t('dms.noDelete') };

      const до = new Set(диалоги());
      click(пункт);
      const dlg = await waitFor(() => диалоги().find(d => !до.has(d)) || (диалоги().length === 1 ? диалоги()[0] : null), 2500);

      if (dlg) {
        const нажал = await подтвердить(dlg);
        if (!нажал) return { ok: false, почему: t('dms.noConfirm') };
      }

      const исчезла = await waitFor(() => !qa(СТРОКА).some(el => idСтроки(el) === id), 6000, 120);
      if (!исчезла) return { ok: false, почему: t('dms.stillInList') };
      return { ok: true };
    } finally {
      await закрытьВсё();
    }
  };

  // --------------------------------------------------------------------------
  //  Панель
  // --------------------------------------------------------------------------
  const stats = { удалено: 0, вышло: 0, пропущено: 0, ошибок: 0 };
  let running = false;
  let остановленоПользователем = false;

  const panel = document.createElement('div');
  panel.id = '__переписки_панель';
  // Вид берём из общего ui.css: своя палитра и своя рамка выбивались из стека
  // и не следовали теме (у панели был жёсткий тёмный фон).
  panel.className = 'xc-panel xc-panel--narrow';
  panel.innerHTML = `
    <div class="xc-head">
      <div class="xc-title">${t('dms.title')}</div>
      <div class="xc-chip" id="__переписки_режим">${t('mode.idle')}</div>
    </div>

    <div class="xc-status" id="__переписки_статус" role="status">${t('dms.initial')}</div>

    <label class="xc-toggle" style="margin-bottom:10px" title="${t('dms.groupsTitle')}">
      <input id="__переписки_группы" type="checkbox">
      <span>${t('dms.groups')}</span>
    </label>

    <div class="xc-row">
      <button class="xc-btn xc-btn--primary xc-btn--wide" id="__переписки_старт" type="button">${t('dms.start')}</button>
      <button class="xc-btn" id="__переписки_стоп" type="button" disabled>${t('common.stop')}</button>
    </div>

    <div class="xc-foot" id="__переписки_счёт">${t('dms.foot', { visible: 0, done: 0 })}</div>`;
  // Док раскладывает панели по вкладкам: одна рамка на все модули.
  if (window.XCDock) XCDock.регистрировать({ id: 'dms', титул: t('dms.title'), элемент: panel });
  else document.body.appendChild(panel);

  const $статус = panel.querySelector('#__переписки_статус');
  const $счёт = panel.querySelector('#__переписки_счёт');
  const $старт = panel.querySelector('#__переписки_старт');
  const $режим = panel.querySelector('#__переписки_режим');
  const режим = (т, тон) => { $режим.textContent = т; $режим.dataset.tone = тон || ''; };
  const $стоп = panel.querySelector('#__переписки_стоп');
  const $группы = panel.querySelector('#__переписки_группы');

  const статус = text => { $статус.textContent = text; };
  const счёт = () => {
    const видимых = строки().length;
    $счёт.textContent = t('dms.foot', { visible: видимых, done: stats.удалено }) +
      (stats.вышло ? t('dms.footLeft', { n: stats.вышло }) : '') +
      (stats.пропущено ? t('dms.footSkipped', { n: stats.пропущено }) : '') +
      (stats.ошибок ? t('dms.footErrors', { n: stats.ошибок }) : '');
  };

  // --------------------------------------------------------------------------
  //  Проход по списку
  // --------------------------------------------------------------------------
  const пройти = async () => {
    const пробовали = new Set();
    let пусто = 0;
    let подрядОшибок = 0;

    while (running) {
      const строки_ = строки().filter(el => !пробовали.has(idСтроки(el)));

      if (!строки_.length) {
        const sc = скроллер();
        if (!sc) { статус(t('dms.noList')); break; }
        const было = sc.scrollTop;
        sc.scrollTop = sc.scrollHeight;              // в самый низ: список догружает следующую порцию
        sc.dispatchEvent(new Event('scroll', { bubbles: true }));
        await sleep(1200);
        const сдвиг = Math.abs(sc.scrollTop - было) > 2;
        const появились = строки().some(el => !пробовали.has(idСтроки(el)));
        пусто = (сдвиг || появились) ? 0 : пусто + 1;
        if (пусто >= 4) break;                       // четыре пустых прокрутки подряд — дошли до конца
        continue;
      }

      пусто = 0;
      const row = строки_[0];
      const id = idСтроки(row);
      пробовали.add(id);

      if (группа(id) && !$группы.checked) {
        stats.пропущено++;
        счёт();
        continue;                                    // группу не трогаем, но и в цикле не застреваем
      }

      статус(группа(id) ? t('dms.leaving') : t('dms.deleting'));
      const r = await удалитьОдну(id, row);

      if (r.ok) {
        подрядОшибок = 0;
        if (группа(id)) stats.вышло++; else stats.удалено++;
        XHistory.добавить('dms', [id]).catch(() => {});
      } else {
        подрядОшибок++;
        stats.ошибок++;
        console.warn(`⚠️ ${id}: ${r.почему}`);
        if (window.XCDock && подрядОшибок === 1) {
          XCDock.журнал(t('dms.errorJournal', { reason: r.почему }), 'bad');
        }
        if (подрядОшибок >= 3) {
          статус(t('dms.threeErrors'));
          if (window.XCDock) XCDock.журнал(t('dms.threeErrorsJournal'), 'bad');
          break;
        }
      }
      счёт();
      await пауза();

      // если впереди осталось мало строк — подтягиваем следующую порцию списка
      if (строки().filter(el => !пробовали.has(idСтроки(el))).length < 3) {
        const sc = скроллер();
        if (sc) { sc.scrollTop = sc.scrollHeight; sc.dispatchEvent(new Event('scroll', { bubbles: true })); await sleep(600); }
      }
    }

    running = false;
    $старт.disabled = false;
    $стоп.disabled = true;
    if (остановленоПользователем) {
      статус(t('dms.stopped', { n: stats.удалено }) + (stats.вышло ? t('dms.stoppedGroups', { n: stats.вышло }) : '') + '.');
      режим(t('mode.stopped'), '');
    } else if (!/остановился|не вижу/.test($статус.textContent)) {
      статус(t('dms.done', { n: stats.удалено }) + (stats.вышло ? t('dms.doneGroups', { n: stats.вышло }) : '') + '.');
      режим(t('mode.done'), 'done');
      if (window.XCDock) XCDock.журнал(t('dms.doneJournal', { n: stats.удалено }), 'ok');
    }
    console.log('итог:', JSON.stringify(stats));
  };

  $старт.addEventListener('click', async () => {
    if (running) return;
    сброс();
    const сколько = строки().length;
    if (!сколько) { статус(t('dms.noneVisible')); return; }
    const include = $группы.checked;
    const вопрос = t('dms.confirm', {
      n: сколько,
      groups: include ? t('dms.confirmGroups') : t('dms.confirmNoGroups')
    });
    if (!confirm(вопрос)) return;

    running = true;
    остановленоПользователем = false;
    режим(t('mode.working'), 'run');
    $старт.disabled = true;
    $стоп.disabled = false;
    счёт();
    статус(t('dms.starting'));
    if (window.XCDock) XCDock.журнал(t('dms.startedJournal', { n: сколько }));
    await пройти();
  });

  $стоп.addEventListener('click', () => {
    running = false;
    остановленоПользователем = true;
    режим(t('mode.stopped'), '');
    статус(t('dms.stopping'));
  });

  window.__переписки = {
    стоп: () => { running = false; остановленоПользователем = true; статус(t('dms.stoppedStatus')); },
    сколько: () => ({ ...stats }),
    панель: panel
  };

  console.log('%c✅ панель удаления переписок внизу справа. Группы по умолчанию не трогаются.', 'color:#1d9bf0;font-weight:700');
  console.log('остановить из консоли: __переписки.стоп()  |  счёт: __переписки.сколько()');
  return window.__переписки;
});
