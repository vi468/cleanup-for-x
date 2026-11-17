// ---------------------------------------------------------------------------
//  DOM-тесты модулей на макетах X: кнопка удаления, кружки отписки, панели
//  архивных заданий с настоящей загрузкой файла.
//  Запуск: node test/modules.test.js
// ---------------------------------------------------------------------------
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import {
  userCell, твит, архивТвитов, архивТвитовКрайние, архивОтветовКрайние,
  архивЛайков, архивЛайковКрайние, архивЛайковБитый,
  архивПодписок, архивПодписчиков
} from './fixtures.js';

const ждать = (мс = 40) => new Promise(готово => setTimeout(готово, мс));

const ВСЕ_ВКЛЮЧЕНЫ = {
  tweets: true, reposts: true, quotes: true, replies: true, likes: true, ghostlikes: true, dms: true, unfollow: true
};

/** Страница X с заглушками расширения и «видимыми» элементами (jsdom без раскладки). */
const страница = (путь, разметка, данные = {}) => {
  const dom = new JSDOM(`<!doctype html><html><body>${разметка}</body></html>`, {
    url: 'https://x.com' + путь,
    runScripts: 'outside-only'
  });
  const { window } = dom;

  // jsdom не считает раскладку — модули проверяют видимость через getClientRects
  window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  window.Element.prototype.scrollIntoView = () => {};
  window.scrollBy = () => {};                 // jsdom не умеет прокрутку
  window.confirm = () => true;
  window.document.body.style.backgroundColor = 'rgb(255, 255, 255)';

  const хранилище = { ...данные };
  const сообщения = [];

  // Заглушка фоновой очереди: по jobs-add курсор двигается асинхронно,
  // поэтому пошаговый сборщик можно проверить по-настоящему.
  const задание = {
    запущено: false, курсор: 0, сделано: 0, пропущено: 0, ошибок: 0,
    всего: 0, статус: 'простой', живой: false, очередь: new Set()
  };

  /** ids вида, которые уже сделаны раньше: фон их в очередь не берёт. */
  const историяВида = вид => {
    const запись = (хранилище['история'] || {})[вид];
    return new Set(((запись && запись.ids) || []).map(String));
  };

  const ответ = (ключи, готово) => {
    const список = ключи == null ? Object.keys(хранилище)
      : (Array.isArray(ключи) ? ключи : [ключи]);
    const итог = {};
    список.forEach(ключ => { if (хранилище[ключ] !== undefined) итог[ключ] = хранилище[ключ]; });
    if (готово) { готово(итог); return undefined; }
    return итог;
  };

  window.chrome = {
    storage: {
      local: {
        get: ответ,
        set: (объект, готово) => { Object.assign(хранилище, объект); if (готово) готово(); },
        remove: (ключ, готово) => { delete хранилище[ключ]; if (готово) готово(); }
      },
      sync: {
        get: (ключи, готово) => готово({ ...ВСЕ_ВКЛЮЧЕНЫ, ...хранилище }),
        set: (объект, готово) => { Object.assign(хранилище, объект); if (готово) готово(); }
      },
      onChanged: { addListener() {} }
    },
    runtime: {
      sendMessage: (сообщение, готово) => {
        сообщения.push({ ...сообщение, сделано_при_отправке: задание.сделано });

        if (сообщение.type === 'jobs-add') {
          if (сообщение.живой) задание.живой = true;
          // Как в background/queue.js: id, который уже есть в истории или в
          // очереди, не добавляется — и шага по нему не будет.
          const уже = new Set([...историяВида(сообщение.вид), ...задание.очередь]);
          const добавка = (сообщение.ids || []).map(String).filter(id => !уже.has(id));
          задание.запущено = true;
          задание.статус = 'работаю';
          if (добавка.length) {
            добавка.forEach(id => задание.очередь.add(id));
            задание.всего += добавка.length;
            setTimeout(() => {
              задание.курсор += добавка.length;
              задание.сделано += добавка.length;
              if (задание.курсор >= задание.всего) {
                задание.запущено = задание.живой;
                задание.статус = задание.живой ? 'жду прокрутки' : 'готово';
              }
            }, 10);
          } else {
            // фон отфильтровал id — курсор стоит, живая очередь «ждёт прокрутки»
            задание.запущено = false;
            задание.статус = задание.живой ? 'жду прокрутки' : 'готово';
          }
        } else if (сообщение.type === 'jobs-finish') {
          задание.живой = false;
          задание.запущено = false;
          задание.статус = 'готово';
        }

        if (готово) готово({ ...задание });
      },
      getPlatformInfo: () => {}
    }
  };

  window.__хранилище = хранилище;
  window.__сообщения = сообщения;
  return dom;
};

const выполнить = (dom, файл) =>
  dom.window.eval(fs.readFileSync(new URL(файл, import.meta.url), 'utf8'));

const ОБЩИЕ = [
  '../shared/history.js',
  '../shared/protect.js',
  '../shared/xqid.js',
  '../shared/dock.js',
  '../shared/archive-job.js',
  '../content/gate.js'
];

const поднять = (dom, модули) => {
  выполнить(dom, '../shared/i18n.js');
  dom.window.XCI18n.установить('ru');       // тесты проверяют русские тексты
  [...ОБЩИЕ, ...модули].forEach(файл => выполнить(dom, файл));
  return ждать(60);
};

/** Кладёт файл в скрытый input панели и ждёт разбора. */
const загрузитьФайл = async (dom, idИнпута, текст, имя) => {
  const { window } = dom;
  const вход = window.document.getElementById(idИнпута);
  assert.ok(вход, 'не нашёл поле выбора файла ' + idИнпута);
  const файл = new window.File([текст], имя, { type: 'text/javascript' });
  Object.defineProperty(вход, 'files', { value: [файл], configurable: true });
  вход.dispatchEvent(new window.Event('change'));
  await ждать(80);
};

// --- 1. твиты: кнопка только у своих --------------------------------------
{
  const dom = страница('/home', `
    <a data-testid="AppTabBar_Profile_Link" href="/me">Профиль</a>
    ${твит({ ник: 'me', id: '111' })}
    ${твит({ ник: 'other', id: '222' })}`);
  dom.window.document.cookie = 'ct0=тест';
  await поднять(dom, ['../content/tweets.js']);

  const статьи = [...dom.window.document.querySelectorAll('article[data-testid="tweet"]')];
  assert.equal(статьи.length, 2);
  assert.ok(статьи[0].querySelector('button'), 'у своего твита должна быть кнопка «Удалить»');
  assert.equal(статьи[1].querySelector('button'), null, 'у чужого твита кнопки быть не должно');
  assert.equal(dom.window.__удаление.сколько(), 1);
  console.log('ок: кнопка «Удалить» только у своих твитов');
  dom.window.close();
}

// --- 2. подписки: кружки, взаимные и защита -------------------------------
{
  const dom = страница('/me/following', `
    ${userCell({ id: '1', ник: 'plain' })}
    ${userCell({ id: '2', ник: 'friend', взаимный: true })}
    ${userCell({ id: '3', ник: 'blocked' })}`,
  { 'защита': { ники: ['blocked'], id: [] } });
  dom.window.document.cookie = 'ct0=тест';
  await поднять(dom, ['../content/unfollow.js']);

  const документ = dom.window.document;
  const отметки = [...документ.querySelectorAll('[data-наша-отметка]')];
  assert.equal(отметки.length, 3, 'метка должна появиться у каждой строки');

  const обычная = отметки.find(э => !э.hasAttribute('data-взаимный') && !э.hasAttribute('data-взащите'));
  const взаимная = отметки.find(э => э.hasAttribute('data-взаимный'));
  const защищённая = отметки.find(э => э.hasAttribute('data-взащите'));

  assert.ok(обычная, 'обычная строка должна быть доступна для выбора');
  assert.ok(взаимная, 'взаимная подписка должна помечаться прочерком');
  assert.equal(взаимная.textContent, '—');
  assert.ok(защищённая, 'защищённая строка должна получить щит');
  assert.equal(защищённая.textContent, '🛡');

  // клик по кружку выбирает строку
  обычная.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(20);
  assert.equal(dom.window.__отписка.сколько().выбрано, 1, 'клик по кружку должен выбрать строку');
  console.log('ок: кружки отписки, взаимные и защищённые различаются');
  dom.window.close();
}

// --- 3. лайки: панель в доке и разбор like.js -----------------------------
{
  const dom = страница('/home', '', { 'защита': { ники: [], id: [] } });
  await поднять(dom, ['../content/likes.js']);

  const панель = dom.window.__лайки.панель;
  assert.ok(панель.closest('#xc-dock'), 'панель лайков должна жить в доке');
  assert.equal(панель.querySelector('[data-старт]').disabled, true, 'без файла старт заблокирован');

  await загрузитьФайл(dom, '__likes_инпут', архивЛайков(3), 'like.js');

  const статус = панель.querySelector('[data-статус]').textContent;
  assert.match(статус, /в файле 3/, 'панель должна показать, сколько лайков в файле');
  assert.equal(панель.querySelector('[data-старт]').disabled, false, 'после файла старт доступен');
  assert.match(панель.querySelector('[data-старт]').textContent, /\(3\)/);

  // старт передаёт очередь в фон, а не крутит её в странице
  панель.querySelector('[data-старт]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(40);
  const старт = dom.window.__сообщения.find(с => с.type === 'jobs-start');
  assert.ok(старт, 'модуль должен отдать очередь в фон');
  assert.equal(старт.вид, 'likes');
  assert.deepEqual([...старт.ids], ['9000', '9001', '9002']);
  console.log('ок: лайки — файл разобран, очередь ушла в фон');
  dom.window.close();
}

// --- 4. репосты и цитаты делят один архив, но не записи -------------------
{
  const dom = страница('/home', '', { 'защита': { ники: [], id: [] } });
  await поднять(dom, ['../content/reposts.js', '../content/quotes.js']);

  const текст = архивТвитов({ цитаты: 2, репосты: 3, обычные: 4 });

  await загрузитьФайл(dom, '__reposts_инпут', текст, 'tweets.js');
  const статусРепостов = dom.window.__репосты.панель.querySelector('[data-статус]').textContent;
  assert.match(статусРепостов, /в файле 3/, 'репосты должны взять только репосты, а не 9 записей');
  assert.match(статусРепостов, /цитат не трогаю: 2/);

  await загрузитьФайл(dom, '__quotes_инпут', текст, 'tweets.js');
  const статусЦитат = dom.window.__цитаты.панель.querySelector('[data-статус]').textContent;
  assert.match(статусЦитат, /в файле 2/, 'цитаты должны взять только цитаты');
  console.log('ок: репосты и цитаты расходятся по своим записям');
  dom.window.close();
}

// --- 5. переписки: панель в доке ------------------------------------------
{
  const dom = страница('/i/chat', `
    <div data-testid="dm-conversation-scroller">
      <div data-testid="dm-conversation-item-abc123">Переписка</div>
    </div>`, { 'защита': { ники: [], id: [] } });
  await поднять(dom, ['../content/dms.js']);

  const панель = dom.window.__переписки.панель;
  assert.ok(панель.closest('#xc-dock'), 'панель переписок должна жить в доке');
  assert.ok(панель.classList.contains('xc-panel'), 'панель должна пользоваться общим стилем');
  console.log('ок: панель переписок в общем стиле внутри дока');
  dom.window.close();
}

// --- 6. репосты без архива: отмена идёт по ходу листания ----------------
{
  const dom = страница('/me', `
    <a data-testid="AppTabBar_Profile_Link" href="/me">Профиль</a>
    <article data-testid="tweet">
      <div data-testid="socialContext"><a href="/me">You reposted</a></div>
      <div role="group"></div>
      <a href="/orig/status/500"><time datetime="2026-11-14T10:00:00">14 ноя</time></a>
    </article>
    <article data-testid="tweet">
      <div data-testid="socialContext"><a href="/friend">Friend reposted</a></div>
      <a href="/other/status/501"><time datetime="2026-11-14T10:00:00">14 ноя</time></a>
    </article>
    <article data-testid="tweet">
      <div role="group"></div>
      <a href="/me/status/777"><time datetime="2026-11-14T10:00:00">14 ноя</time></a>
    </article>`,
  { 'защита': { ники: [], id: [] } });
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  dom.window.document.cookie = 'ct0=тест';

  await поднять(dom, ['../content/reposts.js']);

  const панель = dom.window.__репосты.панель;
  const кнопка = панель.querySelector('[data-без-архива]');
  assert.ok(кнопка, 'должна быть кнопка «отменять при листании»');

  кнопка.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(200);

  const сообщения = dom.window.__сообщения;
  const старт = сообщения.find(с => с.type === 'jobs-add' && с.живой === true);
  assert.ok(старт, 'живой режим должен включаться до первого найденного id');

  const добавки = сообщения.filter(с => с.type === 'jobs-add' && (с.ids || []).length);
  assert.deepEqual(добавки.map(с => [...с.ids]), [['500']],
    'в фон должен уйти только свой репост, по одному за раз');
  assert.deepEqual(добавки.map(с => с.сделано_при_отправке), [0],
    'первый же id — очередь не должна убегать вперёд');
  assert.ok(сообщения.some(с => с.type === 'jobs-finish'), 'по концу листания фону говорят «доканчивай»');
  console.log('ок: репосты без архива — снимает по одному, дожидаясь каждого');
  dom.window.close();
}

// --- 7. вкладка «Репосты»: контекста в карточках может не быть -----------
{
  const dom = страница('/me', `
    <a data-testid="AppTabBar_Profile_Link" href="/me">Профиль</a>
    <div role="tablist">
      <div role="tab" aria-selected="false">Посты</div>
      <div role="tab" aria-selected="true">Репосты</div>
    </div>
    <article data-testid="tweet">
      <div role="group"></div>
      <a href="/orig/status/600"><time datetime="2026-11-14T10:00:00">14 ноя</time></a>
    </article>
    <article data-testid="tweet">
      <div role="group"></div>
      <a href="/orig/status/601"><time datetime="2026-11-14T10:00:00">14 ноя</time></a>
    </article>`,
  { 'защита': { ники: [], id: [] } });
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  dom.window.document.cookie = 'ct0=тест';

  await поднять(dom, ['../content/reposts.js']);

  dom.window.__репосты.панель.querySelector('[data-без-архива]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(200);

  const добавки = dom.window.__сообщения.filter(с => с.type === 'jobs-add' && (с.ids || []).length);
  assert.deepEqual(добавки.map(с => [...с.ids]), [['600'], ['601']],
    'во вкладке «Репосты» каждая карточка — репост, и уходит она по одной');
  assert.deepEqual(добавки.map(с => с.сделано_при_отправке), [0, 1],
    'следующий id уходит только после того, как предыдущий снят');
  console.log('ок: раздел «Репосты» по вкладке, и следующий id — только после предыдущего');
  dom.window.close();
}


// --- 8. репосты без архива: уже снятое не отправляем в фон ----------------
// Иначе фон отфильтрует id по истории, курсор не сдвинется, и страница
// прождёт шага до пяти минут, считая это ошибкой.
{
  const карточка = (id, контекст) => `
    <article data-testid="tweet">
      <div data-testid="socialContext"><a href="/me">${контекст}</a></div>
      <div role="group"></div>
      <a href="/orig/status/${id}"><time datetime="2026-11-14T10:00:00">14 ноя</time></a>
    </article>`;
  const dom = страница('/me', `
    <a data-testid="AppTabBar_Profile_Link" href="/me">Профиль</a>
    ${карточка('500', 'Вы сделали репост')}
    ${карточка('501', 'Вы сделали репост')}`,
  { 'защита': { ники: [], id: [] }, 'история': { reposts: { ids: ['500'], ts: Date.now() } } });
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  dom.window.document.cookie = 'ct0=тест';

  await поднять(dom, ['../content/reposts.js']);

  dom.window.__репосты.панель.querySelector('[data-без-архива]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(300);

  const добавки = dom.window.__сообщения.filter(с => с.type === 'jobs-add' && (с.ids || []).length);
  assert.deepEqual(добавки.map(с => [...с.ids]), [['501']],
    'уже снятый репост не должен уходить в очередь: фон его отфильтрует по истории');
  assert.ok(!добавки.some(с => [...с.ids].includes('500')), '500 уже в истории — не отправляем');
  assert.ok(dom.window.__сообщения.some(с => с.type === 'jobs-finish'), 'по концу листания фону говорят «доканчивай»');
  assert.doesNotMatch(dom.window.__репосты.панель.querySelector('[data-статус]').textContent, /остановился/,
    'пропуск уже снятого — не повод останавливаться');
  console.log('ок: репосты без архива пропускают уже снятое и не встают на пять минут');
  dom.window.close();
}

// --- 8б. русская подпись «Вы сделали репост» без ссылки на себя ----------
// Граница слова \b в JS считается по ASCII: после кириллицы её нет, и старый
// шаблон не находил ни одной русской подписи X.
{
  const dom = страница('/me', `
    <a data-testid="AppTabBar_Profile_Link" href="/me">Профиль</a>
    <article data-testid="tweet">
      <div data-testid="socialContext"><a href="/friend">Вы сделали репост</a></div>
      <div role="group"></div>
      <a href="/orig/status/700"><time datetime="2026-11-14T10:00:00">14 ноя</time></a>
    </article>`,
  { 'защита': { ники: [], id: [] } });
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  dom.window.document.cookie = 'ct0=тест';

  await поднять(dom, ['../content/reposts.js']);
  dom.window.__репосты.панель.querySelector('[data-без-архива]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(200);

  const добавки = dom.window.__сообщения.filter(с => с.type === 'jobs-add' && (с.ids || []).length);
  assert.deepEqual(добавки.map(с => [...с.ids]), [['700']],
    '«Вы сделали репост» — это мой репост, даже если ссылка в контексте не на меня');
  console.log('ок: репосты — русская подпись «Вы сделали репост» распознаётся');
  dom.window.close();
}

// --- 9. разбор архива: репосты по флагу и по «RT @», без дублей ----------
{
  const dom = страница('/home', '', { 'защита': { ники: [], id: [] } });
  await поднять(dom, ['../content/reposts.js', '../content/quotes.js']);

  const текст = архивТвитовКрайние();

  await загрузитьФайл(dom, '__reposts_инпут', текст, 'tweets.js');
  const статусРепостов = dom.window.__репосты.панель.querySelector('[data-статус]').textContent;
  assert.match(статусРепостов, /в файле 3/, 'репост с одним лишь «RT @» и дубль должны схлопнуться: 2001, 2002, 2004');
  assert.match(статусРепостов, /цитат не трогаю: 1/);

  const стартРепостов = dom.window.__репосты.панель.querySelector('[data-старт]');
  стартРепостов.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(40);
  const старт = dom.window.__сообщения.find(с => с.type === 'jobs-start');
  assert.ok(старт, 'репосты должны отдать очередь в фон');
  assert.deepEqual([...старт.ids], ['2001', '2002', '2004'], 'дубль id 2001 не повторяется');

  await загрузитьФайл(dom, '__quotes_инпут', текст, 'tweets.js');
  const статусЦитат = dom.window.__цитаты.панель.querySelector('[data-статус]').textContent;
  assert.match(статусЦитат, /в файле 1/, 'цитата одна (2003), репосты и обычные не берём');
  assert.match(статусЦитат, /репостов 4/, 'репост с текстом «RT @» в поле text тоже репост');
  assert.match(статусЦитат, /обычных твитов 2/, 'обычные твиты (2005 и 2006) в цитаты не попадают');
  console.log('ок: разбор архива — репосты по флагу и по «RT @», дубликаты и цитаты не путаются');
  dom.window.close();
}

// --- 9b. разбор архива: ответы по in_reply_to, дубли и чужие записи ------
{
  const dom = страница('/home', '', { 'защита': { ники: [], id: [] } });
  await поднять(dom, ['../content/replies.js']);

  await загрузитьФайл(dom, '__replies_инпут', архивОтветовКрайние(), 'tweets.js');
  const панель = dom.window.__ответы.панель;
  const статус = панель.querySelector('[data-статус]').textContent;
  assert.match(статус, /в файле 3/, 'ответы по id, нику и user_id; дубль 3001 схлопывается');
  assert.match(статус, /обычных твитов 2/, 'цитата и обычный твит — не ответы');
  assert.match(статус, /репостов 1/);

  панель.querySelector('[data-старт]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(40);
  const старт = dom.window.__сообщения.find(с => с.type === 'jobs-start');
  assert.ok(старт, 'ответы должны отдать очередь в фон');
  assert.deepEqual([...старт.ids], ['3001', '3002', '3003']);
  console.log('ок: разбор архива — ответы по in_reply_to всех трёх видов');
  dom.window.close();
}

// --- 10. лайки: разные формы записи и честная ошибка на битом файле ------
{
  const dom = страница('/home', '', { 'защита': { ники: [], id: [] } });
  await поднять(dom, ['../content/likes.js']);

  await загрузитьФайл(dom, '__likes_инпут', архивЛайковКрайние(), 'like.js');
  const панель = dom.window.__лайки.панель;
  assert.match(панель.querySelector('[data-статус]').textContent, /в файле 4/,
    'tweetId, tweet_id, id и дубль: должно остаться 4 уникальных лайка');

  await загрузитьФайл(dom, '__likes_инпут', архивЛайковБитый(), 'like.js');
  assert.match(панель.querySelector('[data-статус]').textContent, /массив лайков/,
    'файл с объектом вместо массива должен дать понятную ошибку, а не «лайков нет»');
  console.log('ок: лайки — краевые формы записи и ошибка на битом файле');
  dom.window.close();
}

// --- 11. твиты: свежий queryId уходит в фон и порядок запасных ------------
{
  const dom = страница('/home', `
    <a data-testid="AppTabBar_Profile_Link" href="/me">Профиль</a>
    ${твит({ ник: 'me', id: '111' })}`,
  { 'защита': { ники: [], id: [] } });
  dom.window.document.cookie = 'ct0=тест';
  await поднять(dom, ['../content/tweets.js']);

  const адреса = [];
  const ответы = [
    { status: 404, ok: false, text: async () => '' },
    { status: 200, ok: true, text: async () => '{}' }
  ];
  dom.window.fetch = async url => { адреса.push(String(url)); return ответы.shift() || { status: 200, ok: true, text: async () => '{}' }; };
  dom.window.XQLookup.найти = async операция => (операция === 'DeleteTweet' ? 'FRESH_QID' : null);

  const кнопка = dom.window.document.querySelector('article[data-testid="tweet"] button');
  assert.ok(кнопка, 'у своего твита должна быть кнопка «Удалить»');
  await ждать(450);                        // защита от случайного клика — 400 мс
  кнопка.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(80);

  assert.match(адреса[0], /nxpZCY2K-I6QoFHAHeojFQ/,
    'первым должен идти свежий DeleteTweet из docs/api-notes.md (2026-11-05), а не старый VaenaV…');
  assert.match(адреса[1], /FRESH_QID/, 'после 404 пробуем id, найденный в бандлах');
  const сообщение = dom.window.__сообщения.find(с => с.type === 'set-qid');
  assert.ok(сообщение, 'свежий queryId нужно отдать фону: там своя очередь цитат');
  assert.equal(сообщение.операция, 'DeleteTweet');
  assert.equal(сообщение.qid, 'FRESH_QID');
  assert.ok(((dom.window.__хранилище['история'] || {}).tweets || {}).ids.includes('111'), 'удалённый твит идёт в историю');
  console.log('ок: твиты — свежий QID первым, найденный в бандлах уходит в фон');
  dom.window.close();
}

// --- 12. отписка: служебный путь /i не становится ником -------------------
{
  const dom = страница('/me/following',
    userCell({ id: '1', ник: 'realnick', лишние: ['/i'] }),
    { 'защита': { ники: ['realnick'], id: [] } });
  await поднять(dom, ['../content/unfollow.js']);

  const щит = dom.window.document.querySelector('[data-наша-отметка][data-взащите]');
  assert.ok(щит, 'защита по нику должна сработать по настоящему нику, а не по «i» из ссылки /i');
  console.log('ок: отписка — служебный путь не превращается в ник');
  dom.window.close();
}

// --- 13. отписка: «проверить фоновый режим» спрашивает подтверждение ------
{
  const dom = страница('/me/following',
    userCell({ id: '1', ник: 'plain' }),
    { 'защита': { ники: [], id: [] } });
  await поднять(dom, ['../content/unfollow.js']);

  const спрошено = [];
  dom.window.confirm = текст => { спрошено.push(String(текст)); return false; };
  const кнопка = dom.window.document.querySelector('#__отписка_фон_тест');
  кнопка.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(40);

  assert.equal(спрошено.length, 1, 'перед настоящей отпиской должен быть вопрос');
  assert.match(спрошено[0], /@plain/, 'в вопросе должен быть ник, от которого отпишемся');
  assert.ok(!dom.window.__сообщения.some(с => с.type === 'bg-unfollow-test'),
    'отказ в подтверждении — никаких запросов в фон');

  dom.window.confirm = () => true;
  кнопка.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(40);
  assert.ok(dom.window.__сообщения.some(с => с.type === 'bg-unfollow-test' && String(с.id) === '1'),
    'после подтверждения проверка идёт');
  console.log('ок: отписка — проверка фона спрашивает подтверждение с ником');
  dom.window.close();
}

// --- 14. отписка: архивный старт не ставит галочку «в фоне» за нас --------
{
  const dom = страница('/me/following', '', {
    'защита': { ники: [], id: [] },
    'архив_списки': { подписки: ['1', '2'], подписчики: ['2'], ts: Date.now() }
  });
  await поднять(dom, ['../content/unfollow.js']);
  await ждать(80);

  const документ = dom.window.document;
  const галочка = документ.querySelector('#__отписка_фон');
  assert.equal(галочка.checked, false, 'галочка «продолжать в фоне» принадлежит пользователю');

  const старт = документ.querySelector('#__отписка_архив_старт');
  assert.equal(старт.disabled, false, 'кандидаты из архива должны быть готовы');
  старт.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(60);

  assert.equal(галочка.checked, false, 'архивный запуск не должен включать галочку сам');
  assert.ok(dom.window.__сообщения.some(с => с.type === 'bg-unfollow-start' && [...(с.ids || [])].map(String).includes('1')),
    'архивная отписка идёт через фон');
  console.log('ок: отписка — архивный старт не переключает чужую галочку');
  dom.window.close();
}

// --- 15. отписка: Shift-отрезок и пересчёт архивных кандидатов -----------
{
  const dom = страница('/me/following', `
    ${userCell({ id: '1', ник: 'a' })}
    ${userCell({ id: '2', ник: 'b' })}
    ${userCell({ id: '3', ник: 'c' })}
    ${userCell({ id: '4', ник: 'd' })}`,
  { 'защита': { ники: [], id: [] } });
  await поднять(dom, ['../content/unfollow.js']);

  const кружки = [...dom.window.document.querySelectorAll('[data-кружок]')];
  assert.equal(кружки.length, 4);
  кружки[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(20);
  кружки[2].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, shiftKey: true }));
  await ждать(20);
  assert.equal(dom.window.__отписка.сколько().выбрано, 3, 'Shift-отрезок выделяет 1–3');
  console.log('ок: отписка — Shift-отрезок выделяет весь интервал');
  dom.window.close();
}

// --- 16. отписка: архивные кандидаты пересчитываются после новых файлов --
{
  const dom = страница('/me/following', '', { 'защита': { ники: [], id: [] } });
  await поднять(dom, ['../content/unfollow.js']);

  const вход = dom.window.document.querySelector('input[type="file"]');
  const положить = async (подписки, подписчики) => {
    const файлы = [
      new dom.window.File([архивПодписок(подписки)], 'following.js'),
      new dom.window.File([архивПодписчиков(подписчики)], 'follower.js')
    ];
    Object.defineProperty(вход, 'files', { value: файлы, configurable: true });
    вход.dispatchEvent(new dom.window.Event('change'));
    await ждать(80);
  };

  await положить(['11', '12', '13'], ['12']);
  const итог = dom.window.document.querySelector('#__отписка_архив_итог');
  assert.match(итог.textContent, /к отписке 2/, '11 и 13 не подписаны на меня, 12 — подписан');

  // Новый файл: кэш обязан пересчитаться, иначе счёт останется старым.
  await положить(['11', '12', '13', '14'], ['12']);
  assert.match(итог.textContent, /к отписке 3/, 'после нового файла кандидатов 11, 13, 14');
  console.log('ок: отписка — архивные кандидаты пересчитываются, а не берутся из старого кэша');
  dom.window.close();
}

// --- 17. отписка: не нашёл строку — вернул страницу на место -------------
{
  const dom = страница('/me/following', `
    ${userCell({ id: '1', ник: 'gone' })}
    ${userCell({ id: '2', ник: 'stays' })}`,
  { 'защита': { ники: [], id: [] } });
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  await поднять(dom, ['../content/unfollow.js']);

  const документ = dom.window.document;
  const восстановлений = [];
  dom.window.scrollTo = (x, y) => { восстановлений.push(Number(y) || 0); };

  документ.querySelectorAll('[data-кружок]')[0]
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(20);

  // Строка исчезла из DOM уже после выбора (React перерисовал список).
  документ.querySelector('[data-testid="UserCell"]').remove();

  документ.querySelector('#__отписка_старт')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(120);

  assert.equal(dom.window.__отписка.сколько().ошибок, 1, 'промах считается ошибкой, а не зависанием');
  assert.ok(восстановлений.includes(0), 'после промаха прокрутка возвращается на исходное место');
  console.log('ок: отписка — ненайденная строка не крутит страницу до 28 секунд, а возвращает на место');
  dom.window.close();
}

// --- 18. xqid: лимит бандлов, таймаут и негативный кэш -------------------
{
  const dom = страница('/home', '', {});
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  выполнить(dom, '../shared/xqid.js');
  const w = dom.window;

  const бандлы = Array.from({ length: 12 }, (_, и) =>
    `https://abs.twimg.com/responsive-web/client-web/main.${и}.js`);
  w.performance.getEntriesByType = () => бандлы.map(name => ({ name }));

  // Нужный queryId лежит в самом старом бандле, до которого поиск не дойдёт.
  let скачано = 0;
  w.fetch = async путь => {
    скачано++;
    const текст = путь.endsWith('main.0.js')
      ? 'queryId:"STARYJ_QID1",operationName:"DeleteTweet"'
      : 'ничего полезного';
    return { ok: true, text: async () => текст };
  };
  assert.equal(await w.XQLookup.найти('DeleteTweet'), null, 'старый бандл искать не обязаны');
  assert.ok(скачано <= 6, `не больше шести бандлов за поиск, а скачано ${скачано}`);

  // Неудача запоминается: второй раз мегабайты не качаем.
  const былоСкачано = скачано;
  assert.equal(await w.XQLookup.найти('DeleteTweet'), null);
  assert.equal(скачано, былоСкачано, 'неудачный поиск кэшируется, повторной загрузки нет');

  // Зависший бандл не держит страницу: свой таймаут на файл и бюджет на поиск.
  w.XQLookup.сброситьКэш();
  let висящих = 0;
  w.fetch = () => { висящих++; return new Promise(() => {}); };
  const начато = Date.now();
  assert.equal(await w.XQLookup.найти('DeleteRetweet'), null);
  assert.ok(висящих > 0, 'бандлы должны были пытаться скачаться');
  assert.ok(Date.now() - начато < 3000, 'поиск не должен висеть на зависшем запросе');

  // А если id есть в разумной части бандлов — находим и запоминаем.
  w.XQLookup.сброситьКэш();
  w.fetch = async путь => ({
    ok: true,
    text: async () => путь.endsWith('main.11.js')
      ? "queryId:'FRESH_QID2',operationName:'DeleteTweet'"
      : 'ничего'
  });
  assert.equal(await w.XQLookup.найти('DeleteTweet'), 'FRESH_QID2', 'кавычки-одинарные тоже разбираем');
  assert.equal(await w.XQLookup.найти('DeleteTweet'), 'FRESH_QID2', 'найденный id кэшируется');

  // Новый клиент x-web (2026): id операции лежит в params.id, а не в queryId.
  // Бандлы нового клиента — /x-web/x-web/assets/*.js, их тоже надо сканировать.
  w.XQLookup.сброситьКэш();
  w.performance.getEntriesByType = () => [
    { name: 'https://abs.twimg.com/x-web/x-web/assets/abcDEF123.js' }
  ];
  let скачанXWeb = 0;
  w.fetch = async () => ({
    ok: true,
    text: async () => {
      скачанXWeb++;
      return 'x=1,params:{id:`NEWQID_12345`,metadata:{},name:`FavoriteTweet`,operationKind:`mutation`}';
    }
  });
  assert.equal(await w.XQLookup.найти('FavoriteTweet'), 'NEWQID_12345',
    'x-web: id операции берётся из params.id');
  assert.equal(скачанXWeb, 1, 'x-web бандл должен был скачаться');

  w.XQLookup.сброситьКэш();
  w.fetch = async () => ({
    ok: true,
    text: async () => 'params:{id:`OTHERQID_99`,metadata:{},name:`UnfavoriteTweet`}'
  });
  assert.equal(await w.XQLookup.найти('FavoriteTweet'), null,
    'id чужой операции не должен подставляться');
  console.log('ок: xqid — лимит бандлов, таймаут, негативный кэш и свежий id в памяти');
  dom.window.close();
}

// --- 19. gate: без ответа хранилища модули всё равно поднимаются ---------
{
  const dom = страница('/home', '', { 'защита': { ники: [], id: [] } });
  dom.window.chrome.storage.sync.get = () => { throw new Error('нет связи с хранилищем'); };
  await поднять(dom, ['../content/likes.js']);

  assert.ok(dom.window.__лайки, 'модуль должен подняться по запасному набору, а не пропасть молча');
  assert.ok(dom.window.document.querySelector('#__likes_панель'), 'панель модуля на месте');
  console.log('ок: gate — запасной набор настроек поднимает модули');
  dom.window.close();
}

// --- 20. зависшие лайки: собирает только карточки без лайка -------------
{
  const карточка = (id, лайкнут) => `
    <article data-testid="tweet">
      <div role="group">
        <button data-testid="${лайкнут ? 'unlike' : 'like'}" aria-label="${лайкнут ? 'Liked' : 'Like'}"></button>
      </div>
      <a href="/someone/status/${id}"><time datetime="2026-11-14T10:00:00">14 ноя</time></a>
    </article>`;

  const dom = страница('/i/history/likes', `
    ${карточка('7001', false)}
    ${карточка('7002', true)}
    <article data-testid="tweet">
      <div data-testid="quoteTweet">
        <article data-testid="tweet">
          <div role="group"><button data-testid="unlike" aria-label="Liked"></button></div>
          <a href="/orig/status/8001"><time datetime="2026-11-14T10:00:00">14 ноя</time></a>
        </article>
      </div>
      <div role="group"><button data-testid="like" aria-label="Like"></button></div>
      <a href="/me/status/8000"><time datetime="2026-11-14T10:00:00">14 ноя</time></a>
    </article>`,
  { 'защита': { ники: [], id: [] } });
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  await поднять(dom, ['../content/ghost-likes.js']);

  assert.ok(dom.window.__зависшие, 'модуль зависших лайков не поднялся');
  assert.ok(dom.window.document.querySelector('#xc-dock [data-tab="ghostlikes"]'),
    'в доке должна быть вкладка «Зависшие»');

  const панель = dom.window.__зависшие.панель;
  const кнопка = панель.querySelector('[data-без-архива]');
  assert.ok(кнопка, 'должна быть кнопка «Найти и убрать»');
  assert.equal(панель.querySelector('[data-файл]').hidden, true, 'файла у этого модуля нет');
  assert.equal(панель.querySelector('[data-старт]').hidden, true, 'старт по файлу не нужен');

  кнопка.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(250);

  const добавки = dom.window.__сообщения.filter(с => с.type === 'jobs-add' && (с.ids || []).length);
  assert.deepEqual(добавки.map(с => [...с.ids]), [['7001'], ['7002'], ['8000']],
    'все карточки списка уходят по одной; лайкнутая тоже, вложенная цитата — нет');
  assert.ok(dom.window.__сообщения.some(с => с.type === 'jobs-finish'),
    'по концу листания фону говорят «доканчивай»');
  const статус = панель.querySelector('[data-статус]').textContent;
  assert.match(статус, /Дошёл до конца|Убрано/, 'после прохода панель должна сказать, что дошла до конца');
  console.log('ок: зависшие лайки — идёт по всем карточкам списка, цитату не трогает');
  dom.window.close();
}

// --- 21. зависшие лайки: не на странице «Нравится» — подсказка, а не работа
{
  const dom = страница('/home', `
    <article data-testid="tweet">
      <div role="group"><button data-testid="like"></button></div>
      <a href="/someone/status/7001"><time>14 ноя</time></a>
    </article>`, { 'защита': { ники: [], id: [] } });
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  await поднять(dom, ['../content/ghost-likes.js']);
  const панель = dom.window.__зависшие.панель;
  панель.querySelector('[data-без-архива]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(200);
  const добавки = dom.window.__сообщения.filter(с => с.type === 'jobs-add' && (с.ids || []).length);
  assert.deepEqual(добавки, [], 'вне страницы «Нравится» id в фон не уходят');
  assert.match(панель.querySelector('[data-статус]').textContent, /История → Нравится/,
    'должна быть подсказка, куда идти');
  console.log('ок: зависшие лайки — на чужой странице только подсказка');
  dom.window.close();
}

// --- 22. зависшие лайки: «проверить на одной записи» берёт видимый пост --
{
  const dom = страница('/i/history/likes', `
    <article data-testid="tweet">
      <div role="group"><button data-testid="like"></button></div>
      <a href="/someone/status/7001"><time>14 ноя</time></a>
    </article>`, { 'защита': { ники: [], id: [] } });
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  await поднять(dom, ['../content/ghost-likes.js']);
  const панель = dom.window.__зависшие.панель;
  панель.querySelector('[data-тест]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(80);
  const тест = dom.window.__сообщения.find(с => с.type === 'jobs-test');
  assert.ok(тест, 'проверка должна спросить фон');
  assert.equal(тест.id, '7001', 'проверять надо первый видимый зависший пост');
  assert.equal(тест.вид, 'ghostlikes');
  console.log('ок: зависшие лайки — проверка на одной записи берёт первый видимый id');
  dom.window.close();
}

// --- 23. зависшие лайки: разметка старого клиента без data-testid у article
// (реальный снимок с x.com/i/history/likes: article без testid, кнопка like —
// div[role=button], у неё нет ни aria-pressed, ни use[href*=icon-heart])
{
  const статья = (id, ник) => `
    <article>
      <div role="group">
        <div role="button" data-testid="caret" aria-label="Ещё"></div>
        <div role="button" data-testid="reply" aria-label="21 ответ."></div>
        <div role="button" data-testid="retweet" aria-label="549 репостов. Сделать репост"></div>
        <div role="button" data-testid="like" aria-label="609 отметок «Нравится».">
          <svg viewBox="0 0 24 24"><path d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.65-7 10-7 10Z"></path></svg>
        </div>
        <div role="button" data-testid="bookmark" aria-label="Закладка"></div>
      </div>
      <a href="/${ник}/status/${id}"><time datetime="2023-11-27">27 нояб. 2023 г</time></a>
      <a href="/${ник}/status/${id}/analytics">8 тыс.</a>
    </article>`;

  const dom = страница('/i/history/likes', `
    ${статья('1729031524962775279', 'hyperdrivedefi')}
    ${статья('1715026816438878313', 'cainosullivan')}`, { 'защита': { ники: [], id: [] } });
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  await поднять(dom, ['../content/ghost-likes.js']);

  const панель = dom.window.__зависшие.панель;
  панель.querySelector('[data-тест]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(80);
  const тест = dom.window.__сообщения.find(с => с.type === 'jobs-test');
  assert.ok(тест, 'проверка должна спросить фон');
  assert.equal(тест.id, '1729031524962775279', 'id берётся из ссылки с меткой времени');

  // И главное: сбор видит обе карточки, а не «не вижу зависшего поста».
  панель.querySelector('[data-без-архива]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await ждать(250);
  const добавки = dom.window.__сообщения.filter(с => с.type === 'jobs-add' && (с.ids || []).length);
  assert.deepEqual(добавки.map(с => [...с.ids]),
    [['1729031524962775279'], ['1715026816438878313']],
    'разметка старого клиента должна обрабатываться по одной карточке');
  console.log('ок: зависшие лайки — старая разметка без data-testid у article собирается');
  dom.window.close();
}

console.log('все тесты прошли');
