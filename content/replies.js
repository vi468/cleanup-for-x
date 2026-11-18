// ============================================================================
//  МОДУЛЬ «УДАЛЕНИЕ ОТВЕТОВ» — свои твиты, написанные в ответ кому-то
//
//  Ответ — это СВОЙ твит с полем in_reply_to_*. В ленте он выглядит как обычный
//  пост, отличается только подписью «В ответ @ник», поэтому в архивных записях
//  смотрим на in_reply_to_status_id_str и родственные поля.
//
//  Два пути:
//   - файл data/tweets.js из архива X: полный список за всё время, удаляется в
//     фоне (вид «replies»), вкладку можно закрыть;
//   - без архива: открыть свой профиль на вкладке «Ответы» и листать — каждая
//     карточка уходит в фоновую очередь и удаляется по одной, не дожидаясь
//     конца списка. Так видно только то, что X успел отрисовать; полный список
//     даёт архив.
//
//  Репосты и обычные твиты не трогаются: у них нет in_reply_to.
// ============================================================================
XC.модуль('replies', () => {
  if (window.__ответы) return null;

  const t = (ключ, данные) => XCI18n.t(ключ, данные);
  const журнал = (имя, данные) => { try { if (window.XCDebug) window.XCDebug.событие(имя, { вид: 'replies', ...данные }); } catch (e) {} };
  XCI18n.добавить({
    ru: {
      'replies.title': 'Удаление ответов',
      'replies.choose': 'Выбрать tweets.js',
      'replies.action': 'Удалить ответы',
      'replies.describe': 'обычных твитов {o} и репостов {r} не трогаю',
      'replies.describeProtected': ' · из списка защиты: {n}',
      'replies.protected': 'этот аккаунт в списке «кого не трогать»: пропустил {n}',
      'replies.scrollLabel': 'Удалять при листании',
      'replies.errorNoArray': 'в файле нет массива твитов — нужен data/tweets.js из архива',
      'replies.errorJson': 'внутри tweets.js не JSON — возможно, файл обрезан',
      'replies.errorNotArray': 'ожидал массив твитов, а внутри не массив',
      'replies.skipped': 'уже удалено: пропустил {n}',
      'replies.stopped': 'остановлено',
      'replies.backgroundFailed': 'фон не смог удалить этот ответ — остановился',
      'replies.working': 'удаляю по одному: удалено {n}',
      'replies.summary': 'удалено {n}, уже удалено ранее {m} — обнови вкладку, карточки в кэше',
      'replies.none': 'не вижу твоих ответов — открой свой профиль, вкладку «Ответы»'
    },
    en: {
      'replies.title': 'Delete replies',
      'replies.choose': 'Choose tweets.js',
      'replies.action': 'Delete replies',
      'replies.describe': 'leaving {o} regular tweets and {r} reposts alone',
      'replies.describeProtected': ' · protected accounts: {n}',
      'replies.protected': 'this account is on the protect list: skipped {n}',
      'replies.scrollLabel': 'Delete while scrolling',
      'replies.errorNoArray': 'no tweets array in the file — data/tweets.js from the archive is needed',
      'replies.errorJson': 'tweets.js does not contain JSON — the file may be truncated',
      'replies.errorNotArray': 'expected an array of tweets, got something else',
      'replies.skipped': 'already deleted: skipped {n}',
      'replies.stopped': 'stopped',
      'replies.backgroundFailed': 'the background could not delete this reply — stopped',
      'replies.working': 'deleting one by one: {n} deleted',
      'replies.summary': '{n} deleted, {m} already gone — reload the tab, cards are cached',
      'replies.none': 'I cannot see your replies — open your profile’s Replies tab'
    }
  });
  if (!/(^|\.)x\.com$/.test(location.hostname) && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return console.log('❌ открой x.com и запусти скрипт там');
  }

  /** tweets.js → свои ответы. Всё остальное считаем, но не отдаём в работу. */
  const разобрать = текст => {
    const body = String(текст || '');
    const начало = body.indexOf('[');
    if (начало < 0) throw new Error(t('replies.errorNoArray'));

    let записи;
    try { записи = JSON.parse(body.slice(начало).replace(/;\s*$/, '')); }
    catch (e) { throw new Error(t('replies.errorJson')); }
    if (!Array.isArray(записи)) throw new Error(t('replies.errorNotArray'));

    const ids = [];
    const видели = new Set();
    let обычных = 0;
    let репостов = 0;
    let защищено = 0;

    for (const row of записи) {
      const твит = row && (row.tweet || row);
      if (!твит || !твит.id_str) continue;

      const текст = String(твит.full_text || твит.text || '');
      const репост = твит.retweeted === true || /^RT @/.test(текст);
      if (репост) { репостов++; continue; }

      // Ответ — запись с любым признаком in_reply_to. В разных версиях архива
      // встречаются id, ник и user_id, поэтому проверяем все три.
      const ответ = !!твит.in_reply_to_status_id_str ||
        !!твит.in_reply_to_user_id_str ||
        !!твит.in_reply_to_screen_name;
      if (!ответ) { обычных++; continue; }

      // Ответ защищённому аккаунту не удаляем: список «кого не трогать»
      // по умолчанию действует во всех модулях.
      if (window.XProtect && XProtect.защищён({
        ник: твит.in_reply_to_screen_name,
        id: твит.in_reply_to_user_id_str
      }, 'replies')) { защищено++; continue; }

      // Один и тот же твит встречается в архивных частях дважды — id уникален.
      if (видели.has(твит.id_str)) continue;
      видели.add(твит.id_str);
      ids.push(String(твит.id_str));
    }

    return { ids, обычных, репостов, защищено };
  };

  // ------------------------------------------------------------------------
  //  Сбор ответов прямо со страницы, без файла архива.
  //
  //  Работает на вкладке «Ответы» в своём профиле: там каждая карточка — ответ.
  //  Id берём из ссылки на сам пост, дальше фон удаляет его как обычный твит.
  // ------------------------------------------------------------------------
  const sleep = мс => new Promise(готово => setTimeout(готово, мс));

  const свойНик = () => {
    const link = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
    return link ? String(link.getAttribute('href') || '').replace(/^\//, '').toLowerCase() : '';
  };

  // В карточке ответа может быть вложенный чужой пост (цитата), и его ссылка
  // стоит в разметке раньше своей. Берём ссылку на свой ник, а чужую — только
  // если своей нет: иначе DeleteTweet уходил на чужой пост, получал 404 и
  // запоминал этот id в истории, а видимая карточка оставалась.
  const idТвита = (article, ник) => {
    const ссылки = [...article.querySelectorAll('a[href*="/status/"]')];
    const своя = ник && ссылки.find(a =>
      String(a.getAttribute('href') || '').toLowerCase().startsWith('/' + ник + '/'));
    // Карточка без ссылки на свой пост — это контекст чужого треда, который
    // X показывает над ответом. Раньше здесь бралась первая попавшаяся ссылка,
    // и DeleteTweet уходил на чужой твит: 200 с ошибкой 183, а ответ оставался.
    if (!своя || !своя.querySelector('time')) return '';
    const m = String(своя.getAttribute('href') || '').match(/\/status\/(\d+)/);
    return m ? m[1] : '';
  };

  // Вкладка «Ответы» — единственное место, где карточка гарантированно ответ.
  const разделОтветов = () => {
    if (/\/with_replies\/?$/.test(location.pathname)) return true;
    // Только вкладки самой страницы: у дока свои role="tab" на модули.
    const табы = [...document.querySelectorAll('[role="tablist"]')]
      .filter(список => !список.closest('#xc-dock'))
      .flatMap(список => [...список.querySelectorAll('[role="tab"][aria-selected="true"]')]);
    return табы.some(таб => /ответ|repl/i.test((таб.textContent || '').trim()));
  };

  // Кому отвечает карточка: «В ответ @ник» / «Replying to @nick».
  const комуОтвечает = article => {
    const текст = String(article.textContent || '').slice(0, 400);
    const m = текст.match(/(?:В ответ|Replying to)\s+@([A-Za-z0-9_]{1,15})/i);
    return m ? m[1] : '';
  };

  const первыйНовыйОтвет = (обработано, толькоответы, ник) => {
    for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
      // Вне вкладки «Ответы» карточки не считаем ответами: в обычном профиле
      // там лежат и твиты, и репосты, и удалять их этот модуль не должен.
      if (!толькоответы) continue;
      const id = idТвита(article, ник);
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
   * Листает и удаляет ПО ОДНОМУ: следующий id уходит в фон только после того,
   * как предыдущий отработан. Прокрутка — лишь когда на экране не осталось
   * необработанных ответов. Так очередь не убегает вперёд паровоза.
   */
  const удалятьПриЛистании = async ({ добавить, статус, продолжать, сообщить }) => {
    журнал('листание', { страница: location.pathname });
    const обработано = new Set();
    const толькоответы = разделОтветов();
    const ник = свойНик();
    if (!толькоответы) throw new Error(t('replies.none'));

    // Что уже удалено в прошлых прогонах. Такой id фон отфильтрует по истории,
    // курсор не сдвинется — и страница ждала бы шага до пяти минут. Поэтому
    // историю проверяем сами, до отправки.
    const сделано = new Set();
    try {
      (await XHistory.прочитать('replies')).forEach(id => сделано.add(String(id)));
    } catch (e) {}
    const пауза = window.__XC_ТЕСТ_БЫСТРО ? 5 : 300;
    const пустыхДо = window.__XC_ТЕСТ_БЫСТРО ? 2 : 5;
    const предел = Date.now() + 30 * 60 * 1000;
    let пусто = 0;
    let удалено = 0;
    let пропущено = 0;
    let защищено = 0;

    for (;;) {
      if (!продолжать()) throw new Error(t('replies.stopped'));
      if (Date.now() > предел) break;

      const найдено = первыйНовыйОтвет(обработано, толькоответы, ник);
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

      // Ответ защищённому аккаунту не трогаем — и не отправляем в фон.
      if (window.XProtect && XProtect.защищён({ ник: комуОтвечает(найдено.article) }, 'replies')) {
        защищено++;
        сообщить(t('replies.protected', { n: защищено }));
        continue;
      }

      // Карточка на экране, а id в истории — доверять истории нельзя: в неё
      // когда-то мог попасть чужой id, а X мог не убрать карточку из кэша.
      // Поэтому такой id отправляем в фон с пометкой «сила» и смотрим ответ.
      const вИстории = сделано.has(id);
      журнал('карточка', { id, вИстории, свояСсылка: true, кому: комуОтвечает(найдено.article) });

      const до = await статус();
      const курсорДо = (до && до.курсор) || 0;
      const ошибокДо = (до && до.ошибок) || 0;
      const пропущеноДо = (до && до.пропущено) || 0;

      await добавить([id], { сила: вИстории });

      const итог = await дождатьсяШага({ курсорДо, ошибокДо, статус, продолжать });
      журнал('шаг', { id, итог });
      if (итог === 'стоп') throw new Error(t('replies.stopped'));
      if (итог === 'пропуск') {
        // Фон отказался брать id: считаем, что записи уже нет.
        сделано.add(id);
        пропущено++;
        сообщить(t('replies.skipped', { n: пропущено }));
        continue;
      }
      if (итог === 'ошибка') throw new Error(t('replies.backgroundFailed'));

      const после = await статус();
      if (((после && после.пропущено) || 0) > пропущеноДо) {
        // Сервер ответил 404 с телом: записи правда нет.
        сделано.add(id);
        пропущено++;
        сообщить(t('replies.skipped', { n: пропущено }));
      } else {
        сделано.add(id);
        удалено++;
        сообщить(t('replies.working', { n: удалено }));
      }
      await sleep(пауза);
    }

    журнал('итог', { удалено, пропущено, защищено });
    if (удалено || пропущено || защищено) {
      return t('replies.summary', { n: удалено, m: пропущено }) +
        (защищено ? t('replies.describeProtected', { n: защищено }) : '');
    }
    throw new Error(t('replies.none'));
  };

  const панель = XJobPanel.создать({
    вид: 'replies',
    заголовок: t('replies.title'),
    ключАрхива: 'архив_ответы',
    кнопкаФайла: t('replies.choose'),
    действие: t('replies.action'),
    разобрать,
    описать: разбор => t('replies.describe', { o: разбор.обычных, r: разбор.репостов }) +
      (разбор.защищено ? t('replies.describeProtected', { n: разбор.защищено }) : ''),
    безАрхива: { подпись: t('replies.scrollLabel'), собрать: удалятьПриЛистании },
    темп: 1500
  });

  window.__ответы = {
    панель: панель.элемент,
    стоп: панель.стоп,
    сколько: панель.сколько
  };

  console.log('%c✅ панель удаления ответов: файл data/tweets.js или вкладка «Ответы».', 'color:#1d9bf0;font-weight:700');
  return window.__ответы;
});
