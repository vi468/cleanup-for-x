// Тест фоновой очереди без Chrome: подменяем chrome.storage / chrome.cookies / fetch.
// Запуск: node test/engine.test.js
import assert from 'node:assert/strict';

// В движке паузы при 429 — от 5 секунд, а тесту они не нужны: сжимаем всё, что
// длиннее секунды, до 2 мс. Логика паузы от этого не меняется, проверяем её по
// состоянию («пауза», счётчики), а не по секундомеру.
const настоящийSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (функция, мс, ...аргументы) =>
  настоящийSetTimeout(функция, мс > 1000 ? 2 : мс, ...аргументы);

const хранилище = {};
let чтений = 0;          // сколько раз движок сходил в storage за ключами
let задержка = 0;        // искусственная задержка storage: так видны гонки записи
let записи = [];         // снимки «задания» на каждую запись: видны промежуточные состояния
const подождатьХранилище = () => new Promise(готово => setTimeout(готово, задержка));

globalThis.chrome = {
  storage: {
    local: {
      get: async ключ => {
        чтений += 1;
        await подождатьХранилище();
        return typeof ключ === 'string' ? { [ключ]: хранилище[ключ] } : {};
      },
      set: async объект => {
        await подождатьХранилище();
        Object.assign(хранилище, объект);
        if (объект['задания']) записи.push(JSON.parse(JSON.stringify(объект['задания'])));
      }
    }
  },
  cookies: {
    get: async ({ name }) => (name === 'ct0' ? { value: 'csrf-тест' } : null)
  },
  runtime: { getPlatformInfo: готово => готово && готово({}) }
};

let вызовы = [];
let режим = 'ок';
let звонков = 0;         // сколько запросов уже было в текущем тесте
let прочитаноТел = 0;    // сколько раз движок тянул тело ответа целиком
let отменилПоток = 0;    // сколько раз движок отпустил поток тела, не дочитав

globalThis.fetch = async (url, opts) => {
  звонков += 1;
  вызовы.push({
    url: String(url),
    headers: opts && opts.headers,
    method: opts && opts.method,
    body: opts && opts.body
  });

  const ответить = (status, body = '{}', reset, длина) => ({
    status,
    text: async () => { прочитаноТел += 1; return body; },
    headers: {
      get: имя => {
        if (имя === 'x-rate-limit-reset' && reset) return String(reset);
        if (имя === 'content-length' && длина) return String(длина);
        return null;
      }
    }
  });

  const сейчас = Math.floor(Date.now() / 1000);

  if (режим === '429') return ответить(429, '{"errors":[{"code":88}]}', сейчас - 10);
  if (режим === '429раз') {
    return звонков === 1 ? ответить(429, '{"errors":[{"code":88}]}', сейчас - 10) : ответить(200);
  }
  if (режим === '429наСнятии') {
    // Пара «зависшего лайка»: постановка проходит, снятие (второй запрос)
    // упирается в лимит. Движок должен подождать и пройти пару целиком заново,
    // то есть закончить четвёртым запросом.
    return звонков === 2 ? ответить(429, '{"errors":[{"code":88}]}', сейчас - 10) : ответить(200);
  }
  if (режим === '404пустоЛайк') {
    // Сломан только маршрут FavoriteTweet: снятие отвечает как обычно.
    return /\/FavoriteTweet$/.test(String(url)) ? ответить(404, '') : ответить(200);
  }
  if (режим === '404телоUnfavorite') {
    // Постановка прошла, первое снятие отвечает 404 с телом (сервис ещё не
    // увидел свежий лайк), повторное — 200. Движок должен повторить снятие,
    // а не записать id в историю с висящим лайком.
    return звонков === 2 ? ответить(404, '{"errors":[{"code":34}]}') : ответить(200);
  }
  if (режим === 'новыйUnfavorite') {
    // Старого маршрута снятия больше нет (404 без тела), операция нового
    // клиента x-web отвечает 200 — пара должна дойти до неё.
    return /\/UnfavoriteTweet$/.test(String(url)) ? ответить(404, '') : ответить(200);
  }
  if (режим === '403') return ответить(403, '{"errors":[{"code":32}]}');
  if (режим === '404пусто') return ответить(404, '');
  if (режим === '404тело') return ответить(404, '{"errors":[{"code":34,"message":"Not found"}]}');
  if (режим === 'сеть') throw new Error('сеть недоступна');
  if (режим === 'форма') {
    // DeleteRetweet в разных сборках ждёт source_tweet_id или tweet_id:
    // на source_tweet_id отвечаем «не та форма», на tweet_id — успехом.
    const тело = JSON.parse(opts.body || '{}');
    const переменные = (тело && тело.variables) || {};
    return 'source_tweet_id' in переменные
      ? ответить(400, '{"errors":[{"code":44}]}')
      : ответить(200);
  }
  if (режим === '204') {
    return { status: 204, text: async () => { throw new Error('у 204 нет тела'); } };
  }
  if (режим === 'большое') {
    return ответить(500, 'HTML'.repeat(100000), null, 300000);
  }
  if (режим === 'тело_падает') {
    return {
      status: 500,
      text: async () => { throw new Error('тело оборвалось'); },
      headers: { get: () => null }
    };
  }
  if (режим === 'поток') {
    let прочитано = 0;
    return {
      status: 500,
      headers: { get: () => null },
      body: {
        getReader: () => ({
          read: async () => {
            прочитано += 1;
            if (прочитано > 10) return { done: true };
            return { done: false, value: Uint8Array.from('a'.repeat(100), с => с.charCodeAt(0)) };
          },
          cancel: async () => { отменилПоток += 1; }
        })
      },
      text: async () => { throw new Error('поток уже прочитан кусками'); }
    };
  }
  return ответить(200);
};

// Движок держит прогресс, очередь и queryId ещё и в памяти worker'а, поэтому
// между сценариями тест поднимает его заново — как worker после выгрузки.
// Без этого копия из прошлого сценария пережила бы чистку storage.
let очередь = await import('../background/queue.js');
let загрузок = 0;

const ждать = мс => new Promise(готово => setTimeout(готово, мс));

const до = async (условие, мс = 3000) => {
  const конец = Date.now() + мс;
  while (Date.now() < конец) {
    if (await условие()) return true;
    await ждать(10);
  }
  return false;
};

const сброс = async () => {
  // прошлый сценарий мог оставить хвостовую запись в истории — даём ей улечься,
  // прежде чем объявлять новый «worker»
  await ждать(15);
  загрузок += 1;
  очередь = await import(`../background/queue.js?загрузка=${загрузок}`);
  хранилище['задания'] = undefined;
  хранилище['задания_очередь'] = undefined;
  хранилище['история'] = undefined;
  хранилище['queryids'] = undefined;
  вызовы = [];
  записи = [];
  режим = 'ок';
  звонков = 0;
  чтений = 0;
  задержка = 0;
  прочитаноТел = 0;
  отменилПоток = 0;
};

const готово = async (вид, мс = 4000) => {
  const успел = await до(async () => !(await очередь.читатьСостояние(вид)).запущено, мс);
  assert.ok(успел, `очередь «${вид}» не завершилась`);
};

// 1. обычный проход
{
  await сброс();
  await очередь.начать({ вид: 'unfollow', ids: ['11', '22', '33'], темп: 5 });
  await готово('unfollow');
  const состояние = await очередь.читатьСостояние('unfollow');
  assert.equal(состояние.сделано, 3);
  assert.equal(состояние.ошибок, 0);
  assert.equal(состояние.статус, 'готово');
  assert.equal(вызовы.length, 3);
  assert.match(вызовы[0].url, /friendships\/destroy\.json\?user_id=11$/);
  assert.equal(вызовы[0].method, 'POST');
  assert.equal(вызовы[0].headers['x-csrf-token'], 'csrf-тест');
  assert.match(вызовы[0].headers['x-client-transaction-id'], /^[A-Za-z0-9]{95}$/);
  assert.deepEqual(хранилище['история'].unfollow.ids.sort(), ['11', '22', '33']);
  console.log('ок: обычный проход, история записана');
}

// 2. повторный запуск не трогает уже снятых
{
  вызовы = [];
  const состояние = await очередь.начать({ вид: 'unfollow', ids: ['11', '22', '44'], темп: 5 });
  assert.equal(состояние.всего, 1, 'должен остаться только новый id');
  assert.equal(состояние.принято, 1);
  assert.equal(состояние.отклонено, 2);
  await готово('unfollow');
  assert.deepEqual(вызовы.map(в => в.url.match(/user_id=(\d+)/)[1]), ['44']);
  console.log('ок: история отсекает снятых');
}

// 3. остановка на середине
{
  await сброс();
  await очередь.начать({ вид: 'unfollow', ids: ['1', '2', '3', '4', '5'], темп: 40 });
  await ждать(60);
  await очередь.остановить('unfollow');
  await ждать(150);
  const состояние = await очередь.читатьСостояние('unfollow');
  assert.equal(состояние.запущено, false);
  assert.ok(состояние.сделано < 5, 'очередь не остановилась');
  assert.ok(вызовы.length < 5);
  console.log('ок: остановка на середине, снято', состояние.сделано);
}

// 4. 403 — очередь встаёт сама
{
  await сброс();
  режим = '403';
  await очередь.начать({ вид: 'unfollow', ids: ['7', '8', '9'], темп: 5 });
  await готово('unfollow');
  const состояние = await очередь.читатьСостояние('unfollow');
  assert.equal(состояние.запущено, false);
  assert.match(состояние.статус, /403/);
  assert.equal(вызовы.length, 1, 'после 403 должны были остановиться сразу');
  console.log('ок: 403 останавливает очередь');
}

// 5. 404 без тела — сломанный маршрут: в историю не пишем
{
  await сброс();
  режим = '404пусто';
  await очередь.начать({ вид: 'unfollow', ids: ['101', '102', '103', '104'], темп: 1 });
  await готово('unfollow');
  const состояние = await очередь.читатьСостояние('unfollow');
  assert.match(состояние.статус, /404/);
  const ид = ((хранилище['история'] || {}).unfollow || {}).ids || [];
  assert.deepEqual(ид, [], 'сломанный маршрут не должен запоминать id как снятые');
  assert.equal(вызовы.length, 3, 'должен встать на третьем 404 подряд');
  console.log('ок: 404 без тела — очередь встаёт, история не портится');
}

// 6. 404 с телом — записи правда нет, шаг засчитывается
{
  await сброс();
  режим = '404тело';
  await очередь.начать({ вид: 'unfollow', ids: ['201', '202'], темп: 1 });
  await готово('unfollow');
  const состояние = await очередь.читатьСостояние('unfollow');
  assert.equal(состояние.пропущено, 2);
  assert.deepEqual(хранилище['история'].unfollow.ids.sort(), ['201', '202']);
  console.log('ок: 404 с телом считается «уже нет» и уходит в историю');
}

// 7. лайки идут через GraphQL-адаптер
{
  await сброс();
  await очередь.начать({ вид: 'likes', ids: ['900'], темп: 1 });
  await готово('likes');
  const состояние = await очередь.читатьСостояние('likes');
  assert.equal(состояние.сделано, 1);
  assert.match(вызовы[0].url, /\/UnfavoriteTweet$/);
  assert.match(вызовы[0].url, /graphql/);
  assert.deepEqual((хранилище['история'].likes.ids), ['900']);
  console.log('ок: лайки идут через общий движок (UnfavoriteTweet)');
}

// 8. очередь хранится списком, а не через shift: прогресс живёт отдельно
{
  await сброс();
  await очередь.начать({ вид: 'quotes', ids: ['a', 'b'], темп: 1 });
  await готово('quotes');
  assert.deepEqual(хранилище['задания_очередь'].quotes, ['a', 'b'], 'список не должен выедаться');
  const состояние = await очередь.читатьСостояние('quotes');
  assert.equal(состояние.курсор, 2);
  console.log('ок: очередь лежит целиком, прогресс идёт курсором');
}

// 9. живая очередь: пополняется по ходу и не закрывается на пустой
{
  await сброс();
  await очередь.добавить({ вид: 'reposts', ids: [], живой: true, темп: 5 });
  await очередь.добавить({ вид: 'reposts', ids: ['a1', 'a2'], темп: 5 });
  assert.ok(await до(async () => (await очередь.читатьСостояние('reposts')).статус === 'жду прокрутки'),
    'живая очередь не дошла до состояния «жду прокрутки»');
  assert.ok((await очередь.читатьСостояние('reposts')).сделано >= 2,
    'живая очередь не отработала добавленное');

  let состояние = await очередь.читатьСостояние('reposts');
  assert.equal(состояние.живой, true);
  assert.equal(состояние.статус, 'жду прокрутки', 'живая очередь не должна объявлять «готово»');
  assert.equal(состояние.запущено, true);

  // повторная добавка тех же id не должна дублировать работу
  const было = вызовы.length;
  await очередь.добавить({ вид: 'reposts', ids: ['a1', 'a2'] });
  await ждать(30);
  assert.equal(вызовы.length, было, 'повторные id не должны попадать в очередь снова');

  await очередь.завершить('reposts');
  состояние = await очередь.читатьСостояние('reposts');
  assert.equal(состояние.запущено, false);
  assert.equal(состояние.статус, 'готово');
  console.log('ок: живая очередь принимает id по ходу и закрывается по команде');
}

// 10. повторный «Старт» во время работы не теряет присланные id
{
  await сброс();
  const первое = await очередь.начать({ вид: 'unfollow', ids: ['1'], темп: 60 });
  assert.equal(первое.принято, 1);
  const второе = await очередь.начать({ вид: 'unfollow', ids: ['2', '3'], темп: 60 });
  assert.equal(второе.ужеЗапущено, true, 'второй старт должен сказать, что задание уже идёт');
  assert.equal(второе.принято, 2, 'новые id должны попасть в очередь, а не пропасть');
  assert.equal(второе.отклонено, 0);
  await готово('unfollow', 6000);
  const состояние = await очередь.читатьСостояние('unfollow');
  assert.equal(состояние.сделано, 3);
  assert.deepEqual(вызовы.map(в => в.url.match(/user_id=(\d+)/)[1]).sort(), ['1', '2', '3']);
  assert.deepEqual(хранилище['история'].unfollow.ids.sort(), ['1', '2', '3']);
  console.log('ок: второй старт дописывает id в идущую очередь');
}

// 11. добавить() говорит, сколько принято и сколько отсечено
{
  await сброс();
  хранилище['история'] = { reposts: { ids: ['old'] } };
  const пусто = await очередь.добавить({ вид: 'reposts', ids: [], живой: true, темп: 5 });
  assert.equal(пусто.принято, 0);
  assert.equal(пусто.отклонено, 0);
  const пачка = await очередь.добавить({ вид: 'reposts', ids: ['a1', 'a1', 'old'], темп: 5 });
  assert.equal(пачка.принято, 1, 'дубль внутри пачки не должен удваивать работу');
  assert.equal(пачка.отклонено, 2, 'дубль и уже сделанное идут в отклонённые');
  const ещё = await очередь.добавить({ вид: 'reposts', ids: ['a1'], темп: 5 });
  assert.equal(ещё.принято, 0);
  assert.equal(ещё.отклонено, 1);
  await очередь.завершить('reposts');
  console.log('ок: добавить() отчитывается принято/отклонено');
}

// 12. два вида одновременно не затирают состояние и историю друг друга
{
  await сброс();
  задержка = 2;                       // без задержки storage гонка не успевает проявиться
  await Promise.all([
    очередь.начать({ вид: 'likes', ids: ['л1', 'л2', 'л3'], темп: 1 }),
    очередь.начать({ вид: 'quotes', ids: ['ц1', 'ц2', 'ц3'], темп: 1 })
  ]);
  await готово('likes', 6000);
  await готово('quotes', 6000);
  задержка = 0;
  const лайки = await очередь.читатьСостояние('likes');
  const цитаты = await очередь.читатьСостояние('quotes');
  assert.equal(лайки.сделано, 3, 'состояние лайков затёрто вторым видом');
  assert.equal(цитаты.сделано, 3, 'состояние цитат затёрто первым видом');
  assert.equal(лайки.статус, 'готово');
  assert.equal(цитаты.статус, 'готово');
  assert.deepEqual(((хранилище['история'].likes || {}).ids || []).slice().sort(), ['л1', 'л2', 'л3'],
    'запись истории одного вида затёрла другой');
  assert.deepEqual(((хранилище['история'].quotes || {}).ids || []).slice().sort(), ['ц1', 'ц2', 'ц3'],
    'запись истории одного вида затёрла другой');
  console.log('ок: два вида одновременно не затирают состояние и историю');
}

// 13. прогресс и очередь не перечитываются из storage на каждом шаге
{
  await сброс();
  const ids = Array.from({ length: 60 }, (_, и) => String(1000 + и));
  await очередь.начать({ вид: 'unfollow', ids, темп: 1 });
  await готово('unfollow', 8000);
  // было бы ~4 чтения на шаг (240+); с копией в памяти хватает десятка
  assert.ok(чтений < 25, `на 60 шагов ушло ${чтений} чтений storage — состояние не кэшируется`);
  assert.deepEqual(хранилище['задания_очередь'].unfollow, ids, 'очередь должна остаться целой');
  assert.equal((хранилище['история'].unfollow.ids || []).length, 60);
  console.log('ок: чтений storage на 60 шагов:', чтений);
}

// 14. 429 — пауза, «сделано» не растёт, шаг не съезжает
{
  await сброс();
  режим = '429раз';
  await очередь.начать({ вид: 'likes', ids: ['л1'], темп: 1 });
  await готово('likes', 6000);
  // Пауза короткая (её сжали), поэтому смотрим не «сейчас», а все записи
  // состояния: среди них обязана быть пауза, и в ней счётчики не двигались.
  const паузы = записи.filter(с => с.likes && с.likes.статус === 'пауза — лимит X');
  assert.ok(паузы.length >= 1, 'очередь не сказала про паузу');
  assert.equal(паузы[0].likes.сделано, 0, 'на 429 «сделано» не растёт');
  assert.equal(паузы[0].likes.курсор, 0, 'на 429 курсор стоит');
  assert.equal(паузы[0].likes.запущено, true);
  assert.match(паузы[0].likes.последняя, /429, пауза/);
  const перескок = записи.filter(с => с.likes && с.likes.сделано > 1);
  assert.equal(перескок.length, 0, 'сделано перескочило: ' + JSON.stringify(перескок.slice(0, 2)));

  const состояние = await очередь.читатьСостояние('likes');
  assert.equal(состояние.сделано, 1, 'после паузы id должен отработать');
  assert.equal(состояние.статус, 'готово');
  assert.deepEqual((хранилище['история'].likes || {}).ids, ['л1']);
  console.log('ок: 429 — пауза без ложного «сделано», затем повтор и успех');
}

// 15. подряд 5 пауз по лимиту — очередь встаёт сама
{
  await сброс();
  режим = '429';
  await очередь.начать({ вид: 'likes', ids: ['л9'], темп: 1 });
  await готово('likes', 8000);
  const состояние = await очередь.читатьСостояние('likes');
  assert.equal(состояние.запущено, false);
  assert.equal(состояние.сделано, 0);
  assert.match(состояние.статус, /лимит X не отпускает/);
  assert.equal(вызовы.length, 5, 'должно быть пять попыток, потом стоп');
  assert.equal(((хранилище['история'] || {}).likes || {}).ids, undefined);
  console.log('ок: пять пауз по лимиту подряд — стоп');
}

// 16. 404 с телом на GraphQL — записи нет: один запрос, без перебора queryId
{
  await сброс();
  режим = '404тело';
  await очередь.начать({ вид: 'quotes', ids: ['ц1'], темп: 1 });
  await готово('quotes');
  const состояние = await очередь.читатьСостояние('quotes');
  assert.equal(состояние.пропущено, 1);
  assert.equal(вызовы.length, 1, '404 с телом не должен перебирать все queryId');
  assert.match(вызовы[0].url, /graphql\/nxpZCY2K-I6QoFHAHeojFQ\/DeleteTweet$/,
    'первым должен идти queryId с живой сессии, а не устаревший');
  assert.deepEqual((хранилище['история'].quotes || {}).ids, ['ц1']);
  console.log('ок: 404 с телом — один запрос на id, без перебора queryId');
}

// 17. сеть отказала: проверка отвечает {status:0}, а не падает исключением
{
  await сброс();
  режим = 'сеть';
  const ответ = await очередь.проверить('likes', 'л1');
  assert.equal(ответ.status, 0);
  assert.match(ответ.body, /сеть недоступна/);
  console.log('ок: отказ сети в jobs-test — это ответ status 0');
}

// 18. set-qid: мусор не сохраняется, настоящий id идёт в работу первым
{
  await сброс();
  assert.equal((await очередь.установитьQid('UnfavoriteTweet', 'x')).ok, false);
  assert.equal((await очередь.установитьQid('UnfavoriteTweet', 'short')).ok, false);
  assert.equal((await очередь.установитьQid('UnfavoriteTweet', '<script>alert(1)</script>')).ok, false);
  assert.equal((await очередь.установитьQid('DeleteFriendship', 'VaenaVgh5q5ih7kvyVjgtg')).ok, false,
    'неизвестная операция не должна храниться');
  assert.equal((await очередь.установитьQid('toString', 'VaenaVgh5q5ih7kvyVjgtg')).ok, false,
    'свойства прототипа — не операции');
  assert.equal(хранилище['queryids'], undefined, 'мусорный queryId не должен попадать в storage');

  const ок = await очередь.установитьQid('UnfavoriteTweet', 'SvezhijQid_2026-01');
  assert.equal(ок.ok, true);
  await очередь.начать({ вид: 'likes', ids: ['л7'], темп: 1 });
  await готово('likes');
  assert.match(вызовы[0].url, /graphql\/SvezhijQid_2026-01\/UnfavoriteTweet$/,
    'свежий queryId должен пробоваться первым');
  console.log('ок: set-qid проверяет формат и подставляется в запрос');
}

// 19. тело ответа: 204 без заголовков не ломает разбор
{
  await сброс();
  режим = '204';
  const ответ = await очередь.проверить('likes', 'л1');
  assert.equal(ответ.status, 204);
  assert.equal(ответ.body, '');
  assert.equal(ответ.reset, 0);
  console.log('ок: 204 без заголовков разбирается в пустое тело');
}

// 20. тело ответа: большое (HTML на 403/404) не читаем целиком
{
  await сброс();
  режим = 'большое';
  const ответ = await очередь.проверить('likes', 'л1');
  assert.equal(ответ.status, 500);
  assert.equal(ответ.body, '', 'тело на 300 КБ читать незачем');
  assert.equal(прочитаноТел, 0);
  console.log('ок: большое тело не читается');
}

// 21. тело ответа: оборвалось — это пустое тело, а не исключение
{
  await сброс();
  режим = 'тело_падает';
  const ответ = await очередь.проверить('likes', 'л1');
  assert.equal(ответ.status, 500);
  assert.equal(ответ.body, '');
  console.log('ок: оборванное тело не роняет разбор ответа');
}

// 22. тело ответа: поток читаем по кускам и отпускаем, не дочитывая
{
  await сброс();
  режим = 'поток';
  const ответ = await очередь.проверить('likes', 'л1');
  assert.equal(ответ.status, 500);
  assert.ok(ответ.body.length <= 200, 'тело обрезано до 200 символов');
  assert.equal(отменилПоток, 1, 'остаток потока нужно отпустить');
  console.log('ок: поток тела читается не больше предела и отпускается');
}

// 23. репосты: рабочая форма переменных запоминается, перебора на каждый id нет
{
  await сброс();
  режим = 'форма';
  await очередь.начать({ вид: 'reposts', ids: ['р1', 'р2', 'р3', 'р4'], темп: 1 });
  await готово('reposts', 8000);
  const состояние = await очередь.читатьСостояние('reposts');
  assert.equal(состояние.сделано, 4);
  // р1: две «не те» формы (400) и одна рабочая; р2–р4 — сразу по одному запросу
  assert.equal(вызовы.length, 6, 'перебор форм не должен повторяться на каждом id');
  assert.deepEqual((хранилище['история'].reposts || {}).ids.slice().sort(), ['р1', 'р2', 'р3', 'р4']);
  console.log('ок: форма переменных репоста запоминается');
}

// 24. дубли внутри одной пачки не удваивают работу
{
  await сброс();
  const ответ = await очередь.начать({ вид: 'unfollow', ids: ['77', '77', '78'], темп: 1 });
  assert.equal(ответ.принято, 2, 'дубль в списке должен отсекаться');
  assert.equal(ответ.отклонено, 1);
  await готово('unfollow');
  assert.equal(вызовы.length, 2);
  console.log('ок: дубли внутри пачки отсекаются');
}

// 25. мусор в storage не роняет движок
{
  await сброс();
  хранилище['задания'] = 'мусор вместо состояния';
  хранилище['задания_очередь'] = ['тоже', 'мусор'];
  хранилище['история'] = { likes: { ids: 5 } };   // не массив ids
  const ответ = await очередь.начать({ вид: 'likes', ids: ['л1'], темп: 1 });
  assert.equal(ответ.принято, 1, 'мусорная история не должна мешать приёму id');
  await готово('likes');
  const состояние = await очередь.читатьСостояние('likes');
  assert.equal(состояние.сделано, 1);
  assert.deepEqual(хранилище['задания_очередь'].likes, ['л1'], 'мусорная очередь должна замениться новой');
  assert.deepEqual(хранилище['история'].likes.ids, ['л1']);
  console.log('ок: мусор в storage не ломает очередь');
}

// 26. зависшие лайки: свежая пара FavoriteTweet → UnfavoriteTweet
{
  await сброс();
  await очередь.начать({ вид: 'ghostlikes', ids: ['г1'], темп: 1 });
  await готово('ghostlikes');
  const состояние = await очередь.читатьСостояние('ghostlikes');
  assert.equal(состояние.сделано, 1);
  assert.equal(состояние.статус, 'готово');
  assert.deepEqual(вызовы.map(в => в.url.match(/graphql\/[^/]+\/(\w+)$/)[1]),
    ['FavoriteTweet', 'UnfavoriteTweet'], 'сначала ставим лайк, потом снимаем');
  assert.match(вызовы[0].url, /graphql\/(?:gWHQmsY1Atd_XuOoMR2v5A|lI07N6Otwv1PhnEgXILM7A)\/FavoriteTweet$/);
  assert.match(вызовы[1].url, /graphql\/ZYKSe-w7KEslx3JhSIk5LA\/UnfavoriteTweet$/);
  assert.equal(вызовы[0].method, 'POST');
  assert.deepEqual((хранилище['история'].ghostlikes || {}).ids, ['г1'],
    'вылеченный id должен попасть в историю вида');
  console.log('ок: зависший лайк лечится парой FavoriteTweet → UnfavoriteTweet');
}

// 27. зависшие лайки: оба запроса пары несут variables.tweet_id
{
  await сброс();
  await очередь.начать({ вид: 'ghostlikes', ids: ['1234567890'], темп: 1 });
  await готово('ghostlikes');
  assert.equal(вызовы.length, 2);
  for (const [номер, вызов] of вызовы.entries()) {
    const тело = JSON.parse(вызов.body || '{}');
    assert.equal((тело.variables || {}).tweet_id, '1234567890',
      `тело запроса ${номер + 1} без variables.tweet_id`);
    assert.ok(тело.queryId, `тело запроса ${номер + 1} без queryId`);
  }
  console.log('ок: оба запроса пары несут variables.tweet_id');
}

// 28. 429 на снятии: пауза, «сделано» не растёт, затем повтор всей пары и успех
{
  await сброс();
  режим = '429наСнятии';
  await очередь.начать({ вид: 'ghostlikes', ids: ['г2'], темп: 1 });
  await готово('ghostlikes', 6000);
  const состояние = await очередь.читатьСостояние('ghostlikes');
  assert.equal(состояние.сделано, 1, 'после паузы пара должна доработать');
  assert.equal(состояние.статус, 'готово');
  assert.equal(вызовы.length, 4, 'должны быть две пары: постановка и снятие дважды');
  assert.deepEqual(вызовы.map(в => в.url.match(/graphql\/[^/]+\/(\w+)$/)[1]),
    ['FavoriteTweet', 'UnfavoriteTweet', 'FavoriteTweet', 'UnfavoriteTweet'],
    'после 429 пара должна повториться целиком, а не с половины');
  const паузы = записи.filter(с => с.ghostlikes && с.ghostlikes.статус === 'пауза — лимит X');
  assert.ok(паузы.length >= 1, 'очередь не сказала про паузу');
  assert.equal(паузы[0].ghostlikes.сделано, 0, 'на 429 «сделано» не растёт');
  assert.equal(паузы[0].ghostlikes.курсор, 0, 'на 429 курсор стоит');
  assert.match(паузы[0].ghostlikes.последняя, /429, пауза/);
  const перескок = записи.filter(с => с.ghostlikes && с.ghostlikes.сделано > 1);
  assert.equal(перескок.length, 0, 'сделано перескочило: ' + JSON.stringify(перескок.slice(0, 2)));
  assert.deepEqual((хранилище['история'].ghostlikes || {}).ids, ['г2']);
  console.log('ок: 429 на снятии — пауза, повтор пары (4 запроса), без ложного «сделано»');
}

// 29. 404 без тела на FavoriteTweet: очередь встаёт, история не портится
{
  await сброс();
  режим = '404пустоЛайк';
  await очередь.начать({ вид: 'ghostlikes', ids: ['г3', 'г4', 'г5', 'г6'], темп: 1 });
  await готово('ghostlikes');
  const состояние = await очередь.читатьСостояние('ghostlikes');
  assert.equal(состояние.запущено, false);
  assert.match(состояние.статус, /404/);
  // Два queryId FavoriteTweet (новый клиент и старый) × три попытки.
  assert.equal(вызовы.length, 6, 'должен встать на третьем 404 подряд, перебрав оба id');
  assert.ok(вызовы.every(в => /\/FavoriteTweet$/.test(в.url)), 'до снятия дело не дошло');
  assert.deepEqual(((хранилище['история'] || {}).ghostlikes || {}).ids, undefined,
    'сломанный маршрут не должен запоминать id как вылеченные');
  console.log('ок: 404 без тела на FavoriteTweet — очередь встаёт, история не портится');
}

// 30. старый UnfavoriteTweet исчез: пара пробует операцию нового клиента
{
  await сброс();
  режим = 'новыйUnfavorite';
  await очередь.начать({ вид: 'ghostlikes', ids: ['г7'], темп: 1 });
  await готово('ghostlikes', 6000);
  const состояние = await очередь.читатьСостояние('ghostlikes');
  assert.equal(состояние.сделано, 1, 'пара должна дойти до операции нового клиента');
  assert.equal(состояние.статус, 'готово');
  assert.deepEqual(вызовы.map(в => в.url.match(/graphql\/[^/]+\/(\w+)$/)[1]),
    ['FavoriteTweet', 'UnfavoriteTweet', 'likeButtonControlUnfavoriteMutation'],
    'после 404 старого маршрута должен идти запасной');
  assert.deepEqual((хранилище['история'].ghostlikes || {}).ids, ['г7']);
  console.log('ок: старый UnfavoriteTweet исчез — снятие уходит на операцию нового клиента');
}

// 31. 404 с телом на снятии после успешной постановки — повтор, не история
{
  await сброс();
  режим = '404телоUnfavorite';
  await очередь.начать({ вид: 'ghostlikes', ids: ['г8'], темп: 1 });
  await готово('ghostlikes', 8000);
  const состояние = await очередь.читатьСостояние('ghostlikes');
  assert.equal(состояние.сделано, 1, 'повторное снятие должно пройти');
  assert.equal(состояние.статус, 'готово');
  assert.deepEqual(вызовы.map(в => в.url.match(/graphql\/[^/]+\/(\w+)$/)[1]),
    ['FavoriteTweet', 'UnfavoriteTweet', 'UnfavoriteTweet'],
    'после 404 с телом снятие повторяется, а не считается «записи нет»');
  assert.deepEqual((хранилище['история'].ghostlikes || {}).ids, ['г8']);
  console.log('ок: 404 с телом после постановки — снятие повторяется, лайк не остаётся');
}

console.log('все тесты прошли');
