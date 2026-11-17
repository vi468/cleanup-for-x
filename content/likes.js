// ---------------------------------------------------------------------------
//  Модуль «Удаление лайков».
//
//  Берёт `data/like.js` из архива X (там все лайки: `{"like":{"tweetId":…}}`)
//  и снимает их точечными запросами UnfavoriteTweet — по одному id.
//
//  Работу делает фон (background/queue.js, вид «likes»): очередь живёт в
//  расширении, поэтому вкладку можно закрыть, а прогресс виден в попапе.
//  Панель здесь только выбирает файл и показывает, что происходит.
// ---------------------------------------------------------------------------
XC.модуль('likes', () => {
  if (window.__лайки) return null;

  const t = (ключ, данные) => XCI18n.t(ключ, данные);
  XCI18n.добавить({
    ru: {
      'likes.title': 'Удаление лайков',
      'likes.choose': 'Выбрать like.js',
      'likes.action': 'Снять лайки',
      'likes.errorNoArray': 'в файле нет массива лайков',
      'likes.errorJson': 'внутри like.js не JSON — возможно, файл обрезан',
      'likes.errorNotArray': 'ожидал массив лайков, а внутри не массив'
    },
    en: {
      'likes.title': 'Remove likes',
      'likes.choose': 'Choose like.js',
      'likes.action': 'Remove likes',
      'likes.errorNoArray': 'no likes array in the file',
      'likes.errorJson': 'like.js does not contain JSON — the file may be truncated',
      'likes.errorNotArray': 'expected an array of likes, got something else'
    }
  });
  if (!/(^|\.)x\.com$/.test(location.hostname) && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return null;
  }

  /** like.js → список id. Формат: window.YTD.like.part0 = [{like:{tweetId}}]. */
  const разобрать = текст => {
    let body = String(текст || '').trim();
    if (body.startsWith('window.') || body.startsWith('var ')) {
      const начало = body.indexOf('[');
      if (начало < 0) throw new Error(t('likes.errorNoArray'));
      body = body.slice(начало);
    }
    let данные;
    try { данные = JSON.parse(body.replace(/;\s*$/, '')); }
    catch (e) { throw new Error(t('likes.errorJson')); }
    // Молча вернуть пустой список хуже ошибки: человек решит, что лайков нет.
    if (!Array.isArray(данные)) throw new Error(t('likes.errorNotArray'));

    const ids = [];
    const видели = new Set();
    for (const запись of данные) {
      const like = (запись && запись.like) || запись || {};
      const id = like.tweetId || like.tweet_id || like.id;
      if (!id || видели.has(String(id))) continue;
      видели.add(String(id));
      ids.push(String(id));
    }
    return { ids };
  };

  const панель = XJobPanel.создать({
    вид: 'likes',
    заголовок: t('likes.title'),
    ключАрхива: 'архив_лайки',
    кнопкаФайла: t('likes.choose'),
    действие: t('likes.action'),
    разобрать,
    темп: 1500,
    каждые: 100,        // каждые 100 снятий — длинная пауза
    пауза: 25000
  });

  window.__лайки = {
    панель: панель.элемент,
    стоп: панель.стоп,
    сколько: панель.сколько
  };

  console.log('%c✅ Cleanup for X: панель удаления лайков. Нужен data/like.js из архива.', 'color:#1d9bf0;font-weight:700');
  return window.__лайки;
});
