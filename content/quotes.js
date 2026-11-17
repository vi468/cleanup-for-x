// ============================================================================
//  МОДУЛЬ «ОТМЕНА ЦИТАТ» — свои твиты-комментарии к чужому посту
//
//  Репосты и цитаты ведутся раздельно, потому что это разные записи. Репост —
//  чужой текст без своего, снимается DeleteRetweet. Цитата — СВОЙ твит с
//  комментарием и вложенным чужим постом, удаляется обычным DeleteTweet.
//
//  Список берётся из архива X (data/tweets.js), поэтому достаёт и то, чего уже
//  нет в ленте профиля. Работу делает фон (background/queue.js, вид «quotes»):
//  вкладку можно закрыть, очередь продолжится, прогресс виден в попапе.
// ============================================================================
XC.модуль('quotes', () => {
  if (window.__цитаты) return null;

  const t = (ключ, данные) => XCI18n.t(ключ, данные);
  XCI18n.добавить({
    ru: {
      'quotes.title': 'Отмена цитат',
      'quotes.choose': 'Выбрать tweets.js',
      'quotes.action': 'Удалить цитаты',
      'quotes.describe': 'репостов {r} и обычных твитов {o} не трогаю',
      'quotes.errorNoArray': 'в файле нет массива твитов — нужен data/tweets.js из архива',
      'quotes.errorJson': 'внутри tweets.js не JSON — возможно, файл обрезан',
      'quotes.errorNotArray': 'ожидал массив твитов, а внутри не массив'
    },
    en: {
      'quotes.title': 'Delete quotes',
      'quotes.choose': 'Choose tweets.js',
      'quotes.action': 'Delete quotes',
      'quotes.describe': 'leaving {r} reposts and {o} regular tweets alone',
      'quotes.errorNoArray': 'no tweets array in the file — data/tweets.js from the archive is needed',
      'quotes.errorJson': 'tweets.js does not contain JSON — the file may be truncated',
      'quotes.errorNotArray': 'expected an array of tweets, got something else'
    }
  });
  if (!/(^|\.)x\.com$/.test(location.hostname) && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return console.log('❌ открой x.com и запусти скрипт там');
  }

  /** tweets.js → свои цитаты. Репосты и обычные твиты считаем, но не трогаем. */
  const разобрать = текст => {
    const body = String(текст || '');
    const начало = body.indexOf('[');
    if (начало < 0) throw new Error(t('quotes.errorNoArray'));

    let записи;
    try { записи = JSON.parse(body.slice(начало).replace(/;\s*$/, '')); }
    catch (e) { throw new Error(t('quotes.errorJson')); }
    if (!Array.isArray(записи)) throw new Error(t('quotes.errorNotArray'));

    const цитаты = [];
    let репостов = 0;
    let обычных = 0;

    for (const row of записи) {
      const t = row && (row.tweet || row);
      if (!t || !t.id_str) continue;
      // В архиве есть и full_text, и text; берём любой — иначе репост без
      // флага retweeted и с одним лишь «RT @» попадёт в обычные твиты.
      const текст = String(t.full_text || t.text || '');
      const репост = t.retweeted === true || /^RT @/.test(текст);
      if (репост) { репостов++; continue; }
      // Признак цитаты встречается в трёх видах, проверяем все.
      const цитата = t.is_quote_status === true ||
        !!t.quoted_status_id_str ||
        !!(t.quoted_status_permalink && t.quoted_status_permalink.url);
      if (цитата) { цитаты.push(String(t.id_str)); continue; }
      обычных++;
    }

    return { ids: [...new Set(цитаты)], репостов, обычных };
  };

  const панель = XJobPanel.создать({
    вид: 'quotes',
    заголовок: t('quotes.title'),
    ключАрхива: 'архив_цитаты',
    кнопкаФайла: t('quotes.choose'),
    действие: t('quotes.action'),
    разобрать,
    описать: разбор => t('quotes.describe', { r: разбор.репостов, o: разбор.обычных }),
    темп: 1500
  });

  window.__цитаты = {
    панель: панель.элемент,
    стоп: панель.стоп,
    сколько: панель.сколько
  };

  console.log('%c✅ панель отмены цитат внизу справа.', 'color:#c96442;font-weight:700');
  return window.__цитаты;
});
