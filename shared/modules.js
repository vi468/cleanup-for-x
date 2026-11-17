// ---------------------------------------------------------------------------
//  Один словарь модулей на всё расширение.
//
//  Раньше названия, описания и иконки жили в пяти местах (попап, док, фон,
//  история, панели) и расходились. Теперь источник один: этот файл.
//
//  Подключается как обычный скрипт (window.XCModules) и в попап, и в
//  контент-скрипты — поэтому здесь только данные, без chrome.* и без DOM.
//  Тексты двуязычные: { ru, en }, выбор делает shared/i18n.js.
//
//  Поля модуля:
//    название    — как зовём в интерфейсе
//    кратко      — одна строка «что делает» простыми словами
//    где         — где это работает (для строки «Где»)
//    режим       — 'фон' (очередь в service worker) или 'вкладка' (клики по DOM)
//    подробнее   — абзац для «Как это работает»
//    совет       — одно предупреждение, которое важно знать до запуска
//    страница    — функция (ник) → адрес, куда ведёт кнопка «Открыть»
//    кнопка      — подпись кнопки «Открыть»
//    иконка      — svg 18×18 в общем стиле (тонкие линии)
// ---------------------------------------------------------------------------
(() => {
  const иконки = {
    tweets: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.4 5.2h11.2"/><path d="M7 5.2V3.6h4v1.6"/><path d="M4.8 5.2l.7 9.2h7l.7-9.2"/><path d="M7.6 8v4M10.4 8v4"/></svg>',
    reposts: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 6.6h9.4l-2.3-2.3"/><path d="M15.2 11.4H5.8l2.3 2.3"/></svg>',
    quotes: '<svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><path d="M7 5.4C4.7 6.1 3.3 7.9 3.3 10.3v2.5h3.5v-3.4H5.1c.1-1.1.7-1.8 1.9-2.2L7 5.4Z"/><path d="M13.4 5.4c-2.3.7-3.7 2.5-3.7 4.9v2.5h3.5v-3.4h-1.7c.1-1.1.7-1.8 1.9-2.2l-.4-1.8Z"/></svg>',
    likes: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 15s-5.6-3.4-5.6-7A3.2 3.2 0 0 1 9 5.8 3.2 3.2 0 0 1 14.6 8c0 3.6-5.6 7-5.6 7Z"/></svg>',
    ghostlikes: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.9 14.7S3.8 11.6 3.8 8.3A3 3 0 0 1 8.9 6.2a3 3 0 0 1 4.9 1.6"/><path d="M11.9 12.1a3.3 3.3 0 1 0 1.6 1.6"/><path d="M13.7 10.9v3h-3"/></svg>',
    unfollow: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7.5" cy="6.2" r="2.9"/><path d="M2.6 15c0-2.6 2.3-4.3 4.9-4.3s4.9 1.7 4.9 4.3"/><path d="M12.6 4.4h3.6"/></svg>',
    dms: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 9.3c0 3-2.7 5.2-6 5.2-.8 0-1.6-.1-2.3-.3L3.2 15.6l.8-2.7A5 5 0 0 1 3 9.3C3 6.3 5.7 4 9 4s6 2.3 6 5.3Z"/></svg>'
  };

  const мета = {
    tweets: {
      название: { ru: 'Удаление твитов', en: 'Delete tweets' },
      кратко: {
        ru: 'Кнопка «Удалить» у каждого своего твита',
        en: 'A Delete button on each of your tweets'
      },
      где: { ru: 'лента и профиль', en: 'timeline and profile' },
      режим: 'вкладка',
      подробнее: {
        ru: 'На любой странице X у твоих твитов появляется кнопка «Удалить» рядом с ответом и репостом. Чужие твиты и репосты она не трогает.',
        en: 'On any X page each of your tweets gets a Delete button next to reply and repost. Other people’s tweets and reposts are left alone.'
      },
      совет: {
        ru: 'Удаление необратимо и без вопроса: нажал — твит удалён. Черновиков и корзины в X нет.',
        en: 'Deletion is permanent and has no confirmation: tap once and it is gone. X has no drafts or trash bin.'
      },
      страница: () => 'https://x.com/home',
      кнопка: { ru: 'Открыть ленту', en: 'Open timeline' },
      иконка: иконки.tweets
    },
    reposts: {
      название: { ru: 'Отмена репостов', en: 'Undo reposts' },
      кратко: {
        ru: 'Снимает твои репосты — по архиву X или при листании',
        en: 'Removes your reposts — from the X archive or while scrolling'
      },
      где: { ru: 'профиль → «Репосты»', en: 'profile → Reposts' },
      режим: 'фон',
      подробнее: {
        ru: 'Два пути: выбрать файл tweets.js из скачанного архива X (полный список) или открыть свой профиль на вкладке «Репосты» и просто листать — расширение снимает репост за репостом. Цитаты и свои твиты не трогаются.',
        en: 'Two ways: pick tweets.js from your downloaded X archive (the full list), or open your profile’s Reposts tab and simply scroll — the extension undoes reposts one by one. Quotes and your own tweets are not touched.'
      },
      совет: {
        ru: 'Работает в фоне: вкладку можно закрыть, очередь продолжится. X ограничивает частоту действий.',
        en: 'Runs in the background: you can close the tab and the queue continues. X limits how often you can act.'
      },
      страница: ник => ник ? `https://x.com/${ник}/reposts` : 'https://x.com/home',
      кнопка: { ru: 'Открыть «Репосты»', en: 'Open Reposts' },
      иконка: иконки.reposts
    },
    quotes: {
      название: { ru: 'Удаление цитат', en: 'Delete quotes' },
      кратко: {
        ru: 'Удаляет твои твиты-комментарии к чужим постам',
        en: 'Deletes your quote tweets with comments'
      },
      где: { ru: 'через файл tweets.js', en: 'via tweets.js' },
      режим: 'фон',
      подробнее: {
        ru: 'Цитата — это твой твит с комментарием и вложенным чужим постом. Модуль берёт список из tweets.js архива X и удаляет только такие записи; репосты и обычные твиты остаются.',
        en: 'A quote is your tweet with a comment and someone else’s post embedded. The module takes the list from tweets.js in your X archive and deletes only those; reposts and regular tweets stay.'
      },
      совет: {
        ru: 'Работает в фоне, вкладку можно закрыть. Удаление необратимо.',
        en: 'Runs in the background; you can close the tab. Deletion is permanent.'
      },
      страница: ник => ник ? `https://x.com/${ник}` : 'https://x.com/home',
      кнопка: { ru: 'Открыть профиль', en: 'Open profile' },
      иконка: иконки.quotes
    },
    likes: {
      название: { ru: 'Удаление лайков', en: 'Remove likes' },
      кратко: {
        ru: 'Снимает лайки по файлу из архива X',
        en: 'Removes likes from your X archive file'
      },
      где: { ru: 'файл из архива X', en: 'file from X archive' },
      режим: 'фон',
      подробнее: {
        ru: 'Берёт data/like.js из скачанного архива — там все лайки, включая те, что уже не достать из ленты, — и снимает их по одному. Работает в фоне.',
        en: 'Takes data/like.js from your downloaded archive — every like, including ones no longer in the timeline — and removes them one by one. Runs in the background.'
      },
      совет: {
        ru: 'X разрешает примерно 500 снятий за 15 минут: десятки тысяч лайков — это часы. Очередь сама ждёт, когда лимит отпустит.',
        en: 'X allows about 500 removals per 15 minutes: tens of thousands of likes take hours. The queue waits for the limit to reset by itself.'
      },
      страница: ник => ник ? `https://x.com/${ник}/likes` : 'https://x.com/home',
      кнопка: { ru: 'Открыть «Лайки»', en: 'Open Likes' },
      иконка: иконки.likes
    },
    ghostlikes: {
      название: { ru: 'Зависшие лайки', en: 'Stuck likes' },
      кратко: {
        ru: 'Убирает записи из «Нравится»: лайк ставит и сразу снимает',
        en: 'Removes rows from Likes: puts and immediately removes the like'
      },
      где: { ru: '«История → Нравится»', en: 'History → Likes' },
      режим: 'вкладка',
      подробнее: {
        ru: 'Бывает, что лайк уже снят, а пост всё ещё висит в «История → Нравится» с пустым сердцем: запись осталась в списке X. Расширение идёт по всему списку и нажимает сердечко на странице: у зависшей записи ставит лайк и сразу снимает, у оставшегося лайка — просто снимает. Каждый пост обрабатывается по одному, быстро: сердечко закрашивается и сразу снимается — медленная пара историю X не чистит. Вкладку надо держать открытой.',
        en: 'Sometimes a like is already gone, but the post still sits in History → Likes with an empty heart: X kept the row. The extension walks the whole list and clicks the heart on the page: for a stuck row it puts a like and removes it right away, for a remaining like it simply removes it. Posts are processed one by one, quickly: the heart fills and is removed right away — a slow pair does not clean X history. Keep the tab open.'
      },
      совет: {
        ru: 'Пройдётся по всем постам списка: у зависших поставит и снимет лайк, у оставшихся — просто снимет. Если какой-то лайк нужно сохранить, не запускай. Автор может увидеть уведомление; вкладку держи открытой.',
        en: 'It walks every post in the list: stuck rows get a like and lose it, remaining likes are simply removed. If you want to keep a like, do not run it. The author may see a notification; keep the tab open.'
      },
      страница: () => 'https://x.com/i/history/likes',
      кнопка: { ru: 'Открыть «Нравится»', en: 'Open Likes' },
      иконка: иконки.ghostlikes
    },
    unfollow: {
      название: { ru: 'Отписка', en: 'Unfollow' },
      кратко: {
        ru: 'Отписывает от тех, кто на тебя не подписан',
        en: 'Unfollows people who do not follow you back'
      },
      где: { ru: 'страница «Подписки»', en: 'Following page' },
      режим: 'фон',
      подробнее: {
        ru: 'На странице «Подписки» у каждой строки появляется кружок: выбери тех, от кого хочешь отписаться, или загрузи following.js и follower.js из архива — расширение само найдёт невзаимных. Взаимные подписки и список «Кого не трогать» пропускаются.',
        en: 'On the Following page every row gets a circle: select who to unfollow, or load following.js and follower.js from your archive — the extension finds non-followers itself. Mutual follows and the protect list are skipped.'
      },
      совет: {
        ru: 'Массовая отписка упирается в лимиты X: 50–100 за подход спокойно, тысячи за день — временная блокировка действий.',
        en: 'Mass unfollowing hits X limits: 50–100 per run is fine, thousands a day means a temporary action block.'
      },
      страница: ник => ник ? `https://x.com/${ник}/following` : 'https://x.com/following',
      кнопка: { ru: 'Открыть «Подписки»', en: 'Open Following' },
      иконка: иконки.unfollow
    },
    dms: {
      название: { ru: 'Чистка переписок', en: 'Clean up DMs' },
      кратко: {
        ru: 'Удаляет диалоги в личных сообщениях',
        en: 'Deletes conversations in direct messages'
      },
      где: { ru: 'личные сообщения', en: 'direct messages' },
      режим: 'вкладка',
      подробнее: {
        ru: 'На странице сообщений расширение по одному удаляет переписки так же, как это делают руки: меню → «Удалить переписку» → подтверждение. Группы по умолчанию не покидаются.',
        en: 'On the messages page the extension deletes conversations one by one the same way you would: menu → Delete conversation → confirm. Groups are not left by default.'
      },
      совет: {
        ru: 'Диалог исчезает только у тебя: у собеседника копия остаётся. Работает, пока вкладка открыта.',
        en: 'A conversation disappears only for you; the other person keeps a copy. Works while the tab is open.'
      },
      страница: () => 'https://x.com/i/chat',
      кнопка: { ru: 'Открыть сообщения', en: 'Open messages' },
      иконка: иконки.dms
    }
  };

  // Порядок и группы заданы один раз: попап, док и фон ходят сюда.
  const группы = [
    {
      id: 'posts',
      название: { ru: 'Посты и лайки', en: 'Posts and likes' },
      иды: ['tweets', 'reposts', 'quotes', 'likes', 'ghostlikes']
    },
    {
      id: 'people',
      название: { ru: 'Люди и сообщения', en: 'People and messages' },
      иды: ['unfollow', 'dms']
    }
  ];
  const иды = группы.flatMap(группа => группа.иды);

  // Виды фоновых заданий (у них есть прогресс в очереди).
  const видыЗаданий = {
    unfollow: { ru: 'Отписка', en: 'Unfollow' },
    reposts: { ru: 'Репосты', en: 'Reposts' },
    quotes: { ru: 'Цитаты', en: 'Quotes' },
    likes: { ru: 'Лайки', en: 'Likes' },
    ghostlikes: { ru: 'Зависшие лайки', en: 'Stuck likes' }
  };

  const выбрать = объект => (typeof XCI18n !== 'undefined' ? XCI18n.выбрать(объект) : (объект && объект.ru) || '');

  globalThis.XCModules = {
    иды,
    группы,
    мета,
    видыЗаданий,
    поУмолчанию: true,
    получить: id => мета[id] || null,
    название: id => выбрать(мета[id] && мета[id].название) || id,
    кратко: id => выбрать(мета[id] && мета[id].кратко),
    где: id => выбрать(мета[id] && мета[id].где),
    подробнее: id => выбрать(мета[id] && мета[id].подробнее),
    совет: id => выбрать(мета[id] && мета[id].совет),
    кнопка: id => выбрать(мета[id] && мета[id].кнопка),
    названиеЗадания: вид => выбрать(видыЗаданий[вид]) || вид,
    // По умолчанию включён только явный false: ключа может не быть вовсе.
    включён: (настройки, id) => !настройки || настройки[id] !== false
  };

  // В content-скриптах и попапе это window, в service worker — globalThis.
  if (typeof window !== 'undefined') window.XCModules = globalThis.XCModules;
})();
