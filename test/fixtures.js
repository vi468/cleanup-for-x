// ---------------------------------------------------------------------------
//  Макеты X для DOM-тестов: строка «Подписок», твит и файлы архива.
//  Разметка повторяет то, за что цепляются селекторы модулей.
// ---------------------------------------------------------------------------

/** Строка на странице «Подписки». */
export const userCell = ({ id, ник, взаимный = false, лишние = [] }) => `
  <div data-testid="UserCell">
    ${лишние.map(href => `<a href="${href}">служебная ссылка</a>`).join('')}
    <a href="/${ник}">@${ник}</a>
    ${взаимный ? '<div data-testid="userFollowIndicator">Follows you</div>' : ''}
    <div role="button" data-testid="${id}-unfollow">Following</div>
  </div>`;

/** Твит в ленте. */
export const твит = ({ ник, id }) => `
  <article data-testid="tweet">
    <div role="group"></div>
    <a href="/${ник}/status/${id}"><time datetime="2026-11-14T10:00:00">14 ноя</time></a>
  </article>`;

/** data/tweets.js из архива X: свои твиты, чистые репосты и цитаты. */
export const архивТвитов = ({ цитаты = 0, репосты = 0, обычные = 0 }) => {
  const записи = [];
  let номер = 1000;
  const добавить = объект => записи.push({ tweet: { id_str: String(номер++), ...объект } });

  for (let и = 0; и < обычные; и++) добавить({ full_text: 'свой обычный твит' });
  for (let и = 0; и < репосты; и++) добавить({ full_text: 'RT @someone: чужой текст', retweeted: true });
  for (let и = 0; и < цитаты; и++) добавить({ full_text: 'мой комментарий', is_quote_status: true });

  return 'window.YTD.tweets.part0 = ' + JSON.stringify(записи) + ';';
};

/**
 * data/tweets.js с краевыми случаями: репост только по «RT @» (без флага),
 * репост только по флагу (без текста), дубль одного и того же id и цитата.
 */
export const архивТвитовКрайние = () => {
  const записи = [
    { tweet: { id_str: '2001', full_text: 'RT @someone: только текст' } },
    { tweet: { id_str: '2002', retweeted: true } },
    { tweet: { id_str: '2001', full_text: 'RT @someone: только текст' } },
    { tweet: { id_str: '2003', full_text: 'мой комментарий', is_quote_status: true } },
    { tweet: { id_str: '2004', text: 'RT @other: текст в поле text' } },
    { tweet: { id_str: '2005', full_text: 'обычный твит' } },
    { tweet: { id_str: '2006', full_text: 'обычный с текстом «RT @» в середине' } }
  ];
  return 'window.YTD.tweets.part0 = ' + JSON.stringify(записи) + ';';
};

/** data/tweets.js с ответами: id, ник, user_id, дубль, цитата, репост, обычный. */
export const архивОтветовКрайние = () => {
  const записи = [
    { tweet: { id_str: '3001', full_text: 'ответ по id', in_reply_to_status_id_str: '900' } },
    { tweet: { id_str: '3002', full_text: 'ответ по нику', in_reply_to_screen_name: 'someone' } },
    { tweet: { id_str: '3001', full_text: 'ответ по id', in_reply_to_status_id_str: '900' } },
    { tweet: { id_str: '3003', full_text: 'ответ по user_id', in_reply_to_user_id_str: '42' } },
    { tweet: { id_str: '3004', full_text: 'мой комментарий', is_quote_status: true } },
    { tweet: { id_str: '3005', full_text: 'RT @someone: чужой текст', retweeted: true } },
    { tweet: { id_str: '3006', full_text: 'обычный твит' } }
  ];
  return 'window.YTD.tweets.part0 = ' + JSON.stringify(записи) + ';';
};

/** data/tweets.js с защищёнными и обычными авторами: ответы, цитаты, репосты. */
export const архивЗащиты = () => {
  const записи = [
    { tweet: { id_str: '4001', full_text: 'ответ другу', in_reply_to_screen_name: 'friend' } },
    { tweet: { id_str: '4002', full_text: 'ответ человеку', in_reply_to_screen_name: 'someone' } },
    { tweet: { id_str: '4003', full_text: 'цитата друга', is_quote_status: true, quoted_status: { user: { screen_name: 'friend' } } } },
    { tweet: { id_str: '4004', full_text: 'цитата человека', is_quote_status: true, quoted_status: { user: { screen_name: 'someone' } } } },
    { tweet: { id_str: '4005', retweeted: true, retweeted_status: { user: { screen_name: 'friend' } } } },
    { tweet: { id_str: '4006', retweeted: true, retweeted_status: { user: { screen_name: 'someone' } } } }
  ];
  return 'window.YTD.tweets.part0 = ' + JSON.stringify(записи) + ';';
};

/** data/like.js из архива X. */
export const архивЛайков = сколько => {
  const записи = Array.from({ length: сколько }, (_, и) => ({ like: { tweetId: String(9000 + и) } }));
  return 'window.YTD.like.part0 = ' + JSON.stringify(записи) + ';';
};

/** data/like.js с разными формами записи и дублем. */
export const архивЛайковКрайние = () => {
  const записи = [
    { like: { tweetId: '7001' } },
    { like: { tweet_id: '7002' } },
    { like: { id: '7003' } },
    { like: { tweetId: '7001' } },
    { like: { tweetId: 7004 } }
  ];
  return 'window.YTD.like.part0 = ' + JSON.stringify(записи) + ';';
};

/** data/like.js, внутри которого не массив (например, склеен не тот файл). */
export const архивЛайковБитый = () => '{"like": []}';

/** data/following.js из архива X: кого читаю. */
export const архивПодписок = ids =>
  'window.YTD.following.part0 = ' +
  JSON.stringify(ids.map(id => ({ following: { accountId: String(id) } }))) + ';';

/** data/follower.js из архива X: кто читает меня. */
export const архивПодписчиков = ids =>
  'window.YTD.follower.part0 = ' +
  JSON.stringify(ids.map(id => ({ follower: { accountId: String(id) } }))) + ';';
