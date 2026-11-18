// ---------------------------------------------------------------------------
//  Модуль «Удаление твитов».
//
//  К каждому СВОЕМУ твиту в ленте, профиле и поиске добавляется кнопка
//  «Удалить» рядом с иконками ответа и репоста. Чужие твиты не трогаются,
//  у репоста удаляется репост, а не чужой текст.
//
//  Удаление идёт через тот же запрос, что и у кнопки X: DeleteTweet.
//  Кнопка живёт на странице и работает, пока вкладка открыта.
// ---------------------------------------------------------------------------
XC.модуль('tweets', () => {
  if (window.__удаление) return null;

  const t = (ключ, данные) => XCI18n.t(ключ, данные);
  XCI18n.добавить({
    ru: {
      'tweets.delete': 'Удалить',
      'tweets.deleteTitle': 'Удалить этот твит',
      'tweets.confirm': 'Удалить этот твит?\n\n{preview}',
      'tweets.noText': '(без текста)',
      'tweets.deleted': 'удалён',
      'tweets.tab': 'Твиты',
      'tweets.panelTitle': 'Удаление твитов',
      'tweets.active': 'работает',
      'tweets.panelStatus': 'Кнопка «Удалить» стоит у каждого твоего твита в ленте, профиле и поиске. У чужих и у репостов её нет.',
      'tweets.foot': 'твоих твитов с кнопкой на странице: {n}',
      'tweets.protectScope': 'учитывать список «кого не трогать»',
    },
    en: {
      'tweets.delete': 'Delete',
      'tweets.deleteTitle': 'Delete this tweet',
      'tweets.confirm': 'Delete this tweet?\n\n{preview}',
      'tweets.noText': '(no text)',
      'tweets.deleted': 'deleted',
      'tweets.tab': 'Tweets',
      'tweets.panelTitle': 'Delete tweets',
      'tweets.active': 'active',
      'tweets.panelStatus': 'The Delete button appears on each of your tweets in the timeline, profile and search. Other people’s tweets and reposts do not get one.',
      'tweets.foot': 'your tweets with a button on this page: {n}'
    }
  });

  // DeleteTweet: id операции меняется при сборках X, поэтому первый — свежий
  // (по docs/api-notes.md, снят с живой сессии 2026-11-05), второй — старый,
  // оставлен на случай отката X, а рабочий можно заново спросить у бандлов
  // страницы (shared/xqid.js) — так кнопка не отваливается целиком после
  // очередной сборки.
  const QID_ЗАПАСНЫЕ = ['nxpZCY2K-I6QoFHAHeojFQ', 'VaenaVgh5q5ih7kvyVjgtg'];
  let QID = QID_ЗАПАСНЫЕ[0];
  const адрес = () => `https://${location.hostname}/i/api/graphql/${QID}/DeleteTweet`;
  const ASK = false;            // true — перед удалением спрашивать и показывать текст твита
  const ЗАЩИТА_МС = 400;        // клик раньше этого срока от появления кнопки не считается

  // Найденный в бандлах queryId страница сообщает фону (background/queue.js):
  // там своя очередь на цитаты, и без свежего id она бы упиралась в 404.
  const сообщитьQid = qid => {
    if (!qid) return;
    try { chrome.runtime.sendMessage({ type: 'set-qid', операция: 'DeleteTweet', qid }, () => {}); }
    catch (e) {}
  };

  const АЛФАВИТ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const транзакция = () => (window.XQLookup && window.XQLookup.транзакция
    ? window.XQLookup.транзакция()
    : [...crypto.getRandomValues(new Uint8Array(95))]
      .map(x => АЛФАВИТ[x % АЛФАВИТ.length]).join(''));

  // --- имя владельца аккаунта ----------------------------------------------
  // Ссылка в панели X надёжнее __INITIAL_STATE__: его в разметке может не быть
  // вовсе. Если ни того, ни другого ещё нет — модуль ждёт и запускается позже,
  // а не умирает до перезагрузки страницы.
  const свойНик = () => {
    const link = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
    if (link) {
      const ник = String(link.getAttribute('href') || '').replace(/^\//, '').toLowerCase();
      if (ник) return ник;
    }
    const state = window.__INITIAL_STATE__;
    if (state && state.session) {
      const uid = state.session.user_id;
      const users = state.entities && state.entities.users && state.entities.users.entities;
      const u = users && users[uid];
      if (u && u.screen_name) return String(u.screen_name).toLowerCase();
    }
    return '';
  };

  const запустить = own => {
    const auth = (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.config &&
                  window.__INITIAL_STATE__.config.authToken) ||
      'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
    const ct0 = (document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/) || [])[1];
    if (!ct0) {
      console.log('❌ Cleanup for X: нет cookie ct0 — ты не вошёл в x.com');
      return;
    }

    const послать = async id => {
      const r = await fetch(адрес(), {
        method: 'POST',
        credentials: 'include',
        headers: {
          authorization: auth,
          'content-type': 'application/json',
          'x-csrf-token': ct0,
          'x-client-transaction-id': транзакция(),
          'x-twitter-active-user': 'yes',
          'x-twitter-auth-type': 'OAuth2Session'
        },
        body: JSON.stringify({ variables: { tweet_id: id, dark_request: false }, queryId: QID })
      });
      return { status: r.status, body: (await r.text()).slice(0, 200) };
    };

    // 404 — это либо «твита уже нет», либо «queryId сменился». Пробуем свежий id
    // и отдаём наверх уже окончательный ответ; рабочий путь не меняется.
    // Свежий id из бандлов важнее старого запасного: он и есть текущий маршрут.
    const deleteTweet = async id => {
      let r = await послать(id);
      if (r.status === 404) {
        const изБандлов = window.XQLookup ? await window.XQLookup.найти('DeleteTweet') : null;
        if (изБандлов) сообщитьQid(изБандлов);          // фону тоже пригодится
        const ещё = [...new Set([изБандлов, ...QID_ЗАПАСНЫЕ].filter(Boolean))].find(x => x !== QID);
        if (ещё) {
          QID = ещё;
          r = await послать(id);
          if (r.status === 200) сообщитьQid(QID);        // запомнили рабочий — поделимся
        }
      }
      return r;
    };

    // --- какой твит перед нами ----------------------------------------------
    const infoOf = art => {
      const t = art.querySelector('a[href*="/status/"] time');
      const a = t && t.closest('a');
      if (!a) return null;
      const m = (a.getAttribute('href') || '').match(/^\/([^\/]+)\/status\/(\d+)/);
      return m ? { handle: m[1].toLowerCase(), id: m[2] } : null;
    };

    let added = 0;
    let обновитьСчёт = () => {};     // панель в доке появляется чуть позже

    // Кому отвечает твит: «В ответ @ник» / «Replying to @nick».
    const комуОтвечает = art => {
      const текст = String(art.textContent || '').slice(0, 400);
      const m = текст.match(/(?:В ответ|Replying to)\s+@([A-Za-z0-9_]{1,15})/i);
      return m ? m[1] : '';
    };

    const decorate = art => {
      if (art.hasAttribute('data-my-delete')) return;
      const info = infoOf(art);
      if (!info || info.handle !== own) return;          // чужое не трогаем
      // Ответ аккаунту из списка «кого не трогать» кнопку не получает.
      if (window.XProtect && XProtect.защищён({ ник: комуОтвечает(art) }, 'tweets')) {
        art.setAttribute('data-my-delete', '1');
        return;
      }
      const bar = art.querySelector('div[role="group"]');
      if (!bar) return;
      art.setAttribute('data-my-delete', '1');
      added++;
      обновитьСчёт();

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = t('tweets.delete');
      btn.title = t('tweets.deleteTitle');
      btn.style = 'margin-left:12px;padding:2px 8px;border:1px solid #e58a8a;border-radius:999px;' +
                  'background:transparent;color:#e58a8a;font:600 12px/1.6 system-ui;cursor:pointer';
      btn.addEventListener('mouseenter', () => { btn.style.background = '#e58a8a'; btn.style.color = '#fff'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; btn.style.color = '#e58a8a'; });

      const born = Date.now();

      btn.addEventListener('click', async ev => {
        ev.preventDefault();
        ev.stopPropagation();
        if (Date.now() - born < ЗАЩИТА_МС) return;
        if (ASK) {
          const text = art.querySelector('[data-testid="tweetText"]');
          const preview = ((text && (text.innerText || text.textContent)) || t('tweets.noText')).slice(0, 150);
          if (!confirm(t('tweets.confirm', { preview }))) return;
        }
        btn.disabled = true;
        btn.textContent = '…';
        try {
          const res = await deleteTweet(info.id);
          if (res.status === 200) {
            btn.textContent = t('tweets.deleted');
            btn.style.opacity = '.5';
            art.style.opacity = '.35';
            XHistory.добавить('tweets', [info.id]).catch(() => {});
            console.log(`✅ удалён ${info.id}`);
          } else {
            btn.disabled = false;
            btn.textContent = t('tweets.delete');
            console.warn(`❌ ${info.id} → ${res.status}`, res.body);
          }
        } catch (e) {
          btn.disabled = false;
          btn.textContent = t('tweets.delete');
          console.warn('ошибка сети', e);
        }
      });

      bar.appendChild(btn);
    };

    const scan = root => {
      const arts = root.querySelectorAll ? root.querySelectorAll('article[data-testid="tweet"]') : [];
      arts.forEach(decorate);
      if (root.matches && root.matches('article[data-testid="tweet"]')) decorate(root);
    };

    scan(document);

    const queue = [];
    let planned = false;
    const observer = new MutationObserver(muts => {
      for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) queue.push(n);
      if (planned) return;
      planned = true;
      setTimeout(() => {
        planned = false;
        queue.splice(0).forEach(scan);
      }, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.__удаление = {
      стоп: () => { observer.disconnect(); console.log('Cleanup for X: кнопки удаления остановлены'); },
      сколько: () => added
    };

    // В доке у модуля есть вкладка: видно, что он жив и сколько твитов на странице.
    if (window.XCDock) {
      const панель = document.createElement('div');
      панель.className = 'xc-panel';
      панель.innerHTML = `
        <div class="xc-head">
          <div class="xc-title">${t('tweets.panelTitle')}</div>
          <div class="xc-chip" data-tone="done">${t('tweets.active')}</div>
        </div>
        <div class="xc-status">${t('tweets.panelStatus')}</div>
        <label class="xc-toggle" style="margin-top:8px" title="${t('tweets.protectScope')}">
          <input type="checkbox" data-защита-модуля>
          <span>${t('tweets.protectScope')}</span>
        </label>
        <div class="xc-foot" data-счёт></div>`;
      const счёт = панель.querySelector('[data-счёт]');
      обновитьСчёт = () => { счёт.textContent = t('tweets.foot', { n: added }); };
      обновитьСчёт();
      const $защита = панель.querySelector('[data-защита-модуля]');
      if ($защита && window.XProtect) {
        $защита.checked = XProtect.дляМодуля('tweets');
        $защита.disabled = !XProtect.включеноВезде();
        $защита.addEventListener('change', () => {
          XProtect.включитьДля('tweets', $защита.checked);
          // Пересобрать кнопки: у ответов защищённым аккаунтам они появляются
          // или исчезают сразу, без перезагрузки страницы.
          for (const art of document.querySelectorAll('article[data-my-delete]')) {
            art.removeAttribute('data-my-delete');
          }
          scan(document.body);
        });
      }
      XCDock.регистрировать({ id: 'tweets', титул: t('tweets.tab'), элемент: панель });
    }

    console.log(`✅ Cleanup for X: кнопка «Удалить» на ${added} своих твит(ах), ник ${own}.`);
  };

  const own = свойНик();
  if (own) { запустить(own); return window.__удаление; }

  // Панель X может дорисоваться позже (медленная загрузка, страница чата).
  // Ждём ссылку на профиль до 20 секунд и только потом сдаёмся.
  console.log('Cleanup for X: жду ссылку на профиль, чтобы понять свой ник…');
  const ожидание = new MutationObserver(() => {
    const ник = свойНик();
    if (!ник) return;
    ожидание.disconnect();
    clearTimeout(сдаться);
    запустить(ник);
  });
  const сдаться = setTimeout(() => {
    ожидание.disconnect();
    console.log('❌ Cleanup for X: не смог определить твой ник — обнови страницу x.com');
  }, 20000);
  ожидание.observe(document.body, { childList: true, subtree: true });

  return null;
});
