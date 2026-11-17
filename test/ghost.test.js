// ---------------------------------------------------------------------------
//  Независимые тесты модуля «Зависшие лайки» (content/ghost-likes.js).
//
//  Проверяем поведение, а не повторяем ассерты test/modules.test.js:
//    • новый клиент x-web 2026 (article без data-testid, aria-pressed,
//      сердце в svg use[href="#icon-heart"]) и старый (data-testid like/unlike);
//    • выбор id поста: in_reply_to → метка времени → первая ссылка,
//      цитата не подменяет id основного поста;
//    • реклама и карточки без кнопки лайка не попадают в фон;
//    • страницы «Нравится» и чужие страницы;
//    • сбор по одному (лайк → снятие → следующий), без повторов, с jobs-finish;
//    • остановка сбора кнопкой «Стоп».
//
//  Chrome и раскладка не нужны: jsdom + заглушки chrome.storage/runtime,
//  XCDock/XJobPanel поднимаются из shared, паузы укорочены
//  window.__XC_ТЕСТ_БЫСТРО.
//  Запуск: node test/ghost.test.js
// ---------------------------------------------------------------------------
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const ждать = (мс = 20) => new Promise(готово => setTimeout(готово, мс));

/** Ждёт условие, а не фиксированную паузу: иначе тест ловит тайминги. */
const дождаться = async (условие, что, предел = 5000) => {
  const начато = Date.now();
  while (Date.now() - начато < предел) {
    if (условие()) return;
    await ждать(10);
  }
  throw new Error('не дождался: ' + что);
};

const ВКЛЮЧЕНО = { ghostlikes: true };

/**
 * Страница X с заглушками расширения. Фоновая очередь смоделирована грубо,
 * но честно: jobs-add пополняет задание и асинхронно двигает «сделано»,
 * jobs-finish/stop закрывают живое задание. Этого хватает панели, чтобы
 * включать/выключать кнопки и показывать статусы.
 */
const страница = (путь, разметка) => {
  const dom = new JSDOM(`<!doctype html><html><body>${разметка}</body></html>`, {
    url: 'https://x.com' + путь,
    runScripts: 'outside-only'
  });
  const { window } = dom;

  // jsdom не считает раскладку и не умеет прокрутку; тесты, которым нужна
  // прокрутка, переопределяют scrollY/scrollTo/scrollBy через двигать().
  window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  window.Element.prototype.scrollIntoView = () => {};
  window.scrollTo = () => {};
  window.scrollBy = () => {};
  window.confirm = () => true;
  window.document.body.style.backgroundColor = 'rgb(255, 255, 255)';

  const хранилище = {};
  const сообщения = [];
  const задание = {
    запущено: false, курсор: 0, сделано: 0, пропущено: 0, ошибок: 0,
    всего: 0, статус: 'простой', живой: false, очередь: new Set()
  };
  const снимок = () => ({ ...задание, очередь: new Set(задание.очередь) });
  window.__хранилище = хранилище;
  window.__сообщения = сообщения;
  window.__тестОтвет = 200;

  const чтение = (ключи, готово) => {
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
        get: чтение,
        set: (объект, готово) => { Object.assign(хранилище, объект); if (готово) готово(); },
        remove: (ключ, готово) => { delete хранилище[ключ]; if (готово) готово(); }
      },
      sync: {
        get: (ключи, готово) => готово({ ...ВКЛЮЧЕНО, ...хранилище }),
        set: (объект, готово) => { Object.assign(хранилище, объект); if (готово) готово(); }
      },
      onChanged: { addListener() {} }
    },
    runtime: {
      sendMessage: (сообщение, готово) => {
        сообщения.push({ ...сообщение });

        if (сообщение.type === 'jobs-add') {
          if (сообщение.живой) задание.живой = true;
          const уже = new Set(задание.очередь);
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
            // пустое живое задание: фон ждёт, пока страница подкинет id
            задание.запущено = false;
            задание.статус = задание.живой ? 'жду прокрутки' : 'готово';
          }
        } else if (сообщение.type === 'jobs-finish') {
          задание.живой = false;
          задание.запущено = false;
          задание.статус = 'готово';
        } else if (сообщение.type === 'jobs-stop') {
          задание.живой = false;
          задание.запущено = false;
          задание.статус = 'остановлено';
        }

        if (готово) готово(сообщение.type === 'jobs-test'
          ? { status: window.__тестОтвет }
          : снимок());
      }
    }
  };

  return dom;
};

const выполнить = (dom, файл) =>
  dom.window.eval(fs.readFileSync(new URL(файл, import.meta.url), 'utf8'));

// Порядок как в manifest.json: словарь модулей и общие скрипты раньше модуля.
const ОБЩИЕ = [
  '../shared/modules.js',
  '../shared/history.js',
  '../shared/protect.js',
  '../shared/xqid.js',
  '../shared/dock.js',
  '../shared/archive-job.js',
  '../content/gate.js'
];

const поднять = async dom => {
  выполнить(dom, '../shared/i18n.js');
  dom.window.XCI18n.установить('ru');          // тесты проверяют русские тексты
  [...ОБЩИЕ, '../content/ghost-likes.js'].forEach(файл => выполнить(dom, файл));
  await ждать(80);
};

const панельДока = dom => {
  const панель = dom.window.document.getElementById('__ghostlikes_панель');
  assert.ok(панель, 'панель «Зависшие лайки» не появилась');
  return панель;
};

const нажатьСбор = dom => панельДока(dom).querySelector('[data-без-архива]').click();

const дождатьсяКонца = async dom => {
  await дождаться(
    () => dom.window.__сообщения.some(с => с.type === 'jobs-finish'),
    'jobs-finish после сбора');
  await ждать(20);
};

/** Клик по «Найти и убрать» и все непустые пачки (теперь по одному id). */
const собратьПачки = async dom => {
  нажатьСбор(dom);
  await дождатьсяКонца(dom);
  return dom.window.__сообщения
    .filter(с => с.type === 'jobs-add' && (с.ids || []).length)
    .map(с => [...с.ids]);
};

/** Прокрутка «как в браузере»: scrollY реально меняется, зовётся приПрокрутке. */
const двигать = (dom, приПрокрутке) => {
  const { window } = dom;
  let положение = 0;
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => положение });
  window.scrollTo = () => { положение = 0; };
  window.scrollBy = (x, y) => {
    // приПрокрутке может вернуть false: «дошли до низа, дальше некуда»
    const двигаться = приПрокрутке ? приПрокрутке() !== false : true;
    if (двигаться) положение += Math.abs(y) || 1;
  };
};

// --- разметка X ------------------------------------------------------------
// Новый клиент x-web 2026: article без data-testid, лайк — button с
// aria-pressed и сердцем в svg use. Метка времени — отдельная ссылка.
const сердце = '<svg viewBox="0 0 24 24"><use href="#icon-heart"></use></svg>';

const кнопкаЛайка = лайкнут => `
  <button aria-pressed="${лайкнут}" aria-label="${лайкнут ? 'Liked' : 'Like'}">${сердце}</button>`;

const новаяКарточка = ({ id = '', лайкнут = false, до = '', метка = true }) => `
  <article>
    <div data-testid="User-Name"><a href="/someone">Автор</a></div>
    <div data-testid="tweetText">запись ${id}</div>
    ${до}
    ${метка && id ? `<a href="/someone/status/${id}"><time datetime="2026-11-14T10:00:00">14 ноя</time></a>` : ''}
    <div role="group">${кнопкаЛайка(лайкнут)}</div>
  </article>`;

// Старый клиент: article[data-testid=tweet], состояние лайка в data-testid.
const стараяКарточка = ({ id, лайкнут = false, до = '' }) => `
  <article data-testid="tweet">
    ${до}
    <a href="/me/status/${id}"><time>14 ноя</time></a>
    <div role="group"><button data-testid="${лайкнут ? 'unlike' : 'like'}" aria-label="${лайкнут ? 'Liked' : 'Like'}"></button></div>
  </article>`;

// --- 1. новый клиент: все карточки, кроме закладки/рекламы/без кнопки ---
{
  const dom = страница('/i/history/likes', `
    ${новаяКарточка({ id: '1101' })}
    ${новаяКарточка({ id: '1102', лайкнут: true })}
    <article>
      <a href="/someone/status/1103"><time>14 ноя</time></a>
      <button aria-pressed="false" aria-label="В закладки">закладка</button>
    </article>
    <div data-testid="placementTracking">${новаяКарточка({ id: '1104' })}</div>
    <article><a href="/someone/status/1105"><time>14 ноя</time></a><div>карточка без кнопки лайка</div></article>`);
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  await поднять(dom);

  const вкладка = dom.window.document.querySelector('#xc-dock [data-tab="ghostlikes"]');
  assert.ok(вкладка, 'в доке должна быть вкладка «Зависшие»');
  assert.equal(вкладка.textContent.trim(), 'Зависшие');

  const пачки = await собратьПачки(dom);
  assert.deepEqual(пачки, [['1101'], ['1102']],
    'в фон уходят все карточки списка, включая лайкнутую; закладка, реклама и карточка без кнопки — нет');

  const первоеЗадание = dom.window.__сообщения.find(с => с.type === 'jobs-add');
  assert.equal(первоеЗадание.вид, 'ghostlikes');
  assert.deepEqual([...первоеЗадание.ids], [], 'живое задание открывается пустым — id приходят пачками');
  assert.equal(первоеЗадание.живой, true);
  assert.equal(первоеЗадание.темп, 1600, 'на один пост уходит пара запросов — шаг длиннее обычного');
  assert.equal(dom.window.__сообщения.filter(с => с.type === 'jobs-finish').length, 1,
    'по концу листания фону говорят «доканчивай» ровно один раз');
  assert.match(панельДока(dom).querySelector('[data-статус]').textContent, /Дошёл до конца|Убрано/);

  console.log('ок: новый клиент — зависший по aria-pressed=false, лайкнутый и не-лайк пропущены');
  dom.window.close();
}

// --- 2. id из in_reply_to важнее прочих ссылок ----------------------------
{
  const dom = страница('/i/history/likes', `
    <article>
      <a href="/quoted/status/9996"><span></span></a>
      <a href="/compose/post?in_reply_to=4004">Ответить</a>
      <div role="group">${кнопкаЛайка(false)}</div>
    </article>`);
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  await поднять(dom);
  const пачки = await собратьПачки(dom);
  assert.deepEqual(пачки, [['4004']],
    'id ответа берётся из ?in_reply_to=, даже если раньше встретилась чужая /status/-ссылка');
  console.log('ок: id — приоритет у ?in_reply_to=');
  dom.window.close();
}

// --- 3. цитата не подменяет id основного поста ----------------------------
{
  // В новом клиенте цитата — ссылка на /status/ внутри карточки, и в превью
  // есть метка времени цитируемого поста: она не должна победить метку
  // основного поста.
  const dom = страница('/i/history/likes', `
    <article>
      <div data-testid="User-Name"><a href="/someone">Автор</a></div>
      <div data-testid="tweetText">свой текст</div>
      <a href="/quoted/status/9999">
        <div data-testid="User-Name">Автор цитаты</div>
        <div>текст цитаты</div>
        <time datetime="2026-11-13">13 ноя</time>
      </a>
      <a href="/author/status/5001"><time datetime="2026-11-14">14 ноя</time></a>
      <div role="group">${кнопкаЛайка(false)}</div>
    </article>`);
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  await поднять(dom);
  const пачки = await собратьПачки(dom);
  assert.deepEqual(пачки, [['5001']],
    'метка времени внутри цитаты не должна выдавать цитируемый пост за основной');
  console.log('ок: новый клиент — цитата с меткой времени не подменяет id основного поста');
  dom.window.close();
}

{
  // Старый клиент: цитата — вложенный article. Его пустое сердце относится к
  // цитируемому посту, а не к записи «Нравится», поэтому в фон он не идёт.
  const dom = страница('/i/history/likes', `
    <article data-testid="tweet">
      <div data-testid="quoteTweet">
        <article data-testid="tweet">
          <a href="/quoted/status/7777"><time>13 ноя</time></a>
          <button data-testid="like"></button>
        </article>
      </div>
      <a href="/me/status/2201"><time>14 ноя</time></a>
      <button data-testid="like"></button>
    </article>`);
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  await поднять(dom);
  const пачки = await собратьПачки(dom);
  assert.deepEqual(пачки, [['2201']],
    'вложенная карточка цитаты — не запись «Нравится», её id в фон не уходит');
  console.log('ок: старый клиент — вложенная цитата не считается отдельной записью');
  dom.window.close();
}

// --- 4. запасной вариант: первая ссылка на /status/ ----------------------
{
  const dom = страница('/i/history/likes', `
    <article>
      <a href="/a/status/6001"><span></span></a>
      <a href="/b/status/6002"></a>
      <div role="group">${кнопкаЛайка(false)}</div>
    </article>`);
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  await поднять(dom);
  const пачки = await собратьПачки(dom);
  assert.deepEqual(пачки, [['6001']], 'если метки времени нет, берём первую ссылку на статус');
  console.log('ок: id — запасной вариант с первой /status/-ссылкой');
  dom.window.close();
}

// --- 5. старый клиент целиком: like/unlike, вложенная цитата, реклама -----
{
  const dom = страница('/i/history/likes', `
    ${стараяКарточка({ id: '2101', до: `
      <div data-testid="quoteTweet">
        <article data-testid="tweet">
          <a href="/quoted/status/8888"><time>13 ноя</time></a>
          <button data-testid="unlike"></button>
        </article>
      </div>` })}
    ${стараяКарточка({ id: '2102', лайкнут: true, до: `
      <div data-testid="quoteTweet">
        <article data-testid="tweet">
          <a href="/quoted/status/8889"><time>13 ноя</time></a>
          <button data-testid="like"></button>
        </article>
      </div>` })}
    <div data-testid="placementTracking">${стараяКарточка({ id: '2103' })}</div>
    <article data-testid="tweet">
      <a href="/someone/status/2104"><time>14 ноя</time></a>
      <div>карточка без кнопки лайка</div>
    </article>`);
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  await поднять(dom);
  const пачки = await собратьПачки(dom);
  assert.deepEqual(пачки, [['2101'], ['2102']],
    'старая разметка: обе карточки списка; реклама, карточка без кнопки и вложенная цитата — мимо');
  console.log('ок: старый клиент — все карточки списка, вложенная цитата не задваивается');
  dom.window.close();
}

// --- 6. страницы: «Нравится» работает, чужие — только подсказка -----------
{
  const кейсы = [
    { путь: '/i/history/likes', id: '7101', ждём: [['7101']] },
    { путь: '/nick_1/likes', id: '7102', ждём: [['7102']] },
    { путь: '/i/history/likes/', id: '7103', ждём: [['7103']] },
    { путь: '/home', id: '7104', ждём: [] },
    { путь: '/settings/likes', id: '7105', ждём: [] }
  ];

  for (const кейс of кейсы) {
    const dom = страница(кейс.путь, новаяКарточка({ id: кейс.id }));
    dom.window.__XC_ТЕСТ_БЫСТРО = true;
    await поднять(dom);

    let пачки;
    if (кейс.ждём.length) {
      пачки = await собратьПачки(dom);
    } else {
      // на чужой странице сбор не должен даже открывать живое задание
      нажатьСбор(dom);
      await ждать(150);
      пачки = dom.window.__сообщения
        .filter(с => с.type === 'jobs-add' && (с.ids || []).length)
        .map(с => [...с.ids]);
      assert.deepEqual(dom.window.__сообщения.filter(с => с.type === 'jobs-add'), [],
        `${кейс.путь}: на чужой странице в фон не должно уходить ни одного задания`);
      assert.deepEqual(dom.window.__сообщения.filter(с => с.type === 'jobs-finish'), [],
        `${кейс.путь}: живое задание не открывали — и закрывать нечего`);
    }

    assert.deepEqual(пачки, кейс.ждём, `${кейс.путь}: не тот набор id`);
    if (!кейс.ждём.length) {
      assert.match(панельДока(dom).querySelector('[data-статус]').textContent, /История → Нравится/,
        `${кейс.путь}: нужна подсказка, где на самом деле «Нравится»`);
    }
    dom.window.close();
  }

  console.log('ок: страницы — /i/history/likes и /nick/likes работают, /home и /settings/likes отклоняются');
}

// --- 7. пачки: без повторов, дорисовка после прокрутки, один jobs-finish --
{
  const dom = страница('/i/history/likes',
    новаяКарточка({ id: '7001' }) + новаяКарточка({ id: '7001' }) + новаяКарточка({ id: '7002' }));
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  await поднять(dom);

  let дорисовали = false;
  двигать(dom, () => {
    if (дорисовали) return false;         // лента закончилась: дальше не прокручиваем
    дорисовали = true;
    // X вполне может показать уже собранный пост ещё раз после прокрутки
    dom.window.document.body.insertAdjacentHTML('beforeend',
      новаяКарточка({ id: '7003' }) + новаяКарточка({ id: '7001' }));
    return true;
  });

  const пачки = await собратьПачки(dom);
  assert.deepEqual(пачки, [['7001'], ['7002'], ['7003']],
    'идём по одному: один id в фон, дождались шага, следующий; повторный id не отправляем');

  const плоский = пачки.flat();
  assert.equal(new Set(плоский).size, плоский.length, 'один id должен уходить в фон только один раз');
  assert.equal(dom.window.__сообщения.filter(с => с.type === 'jobs-finish').length, 1);
  assert.equal(dom.window.__сообщения[dom.window.__сообщения.length - 1].type, 'jobs-finish',
    'jobs-finish — последнее слово сбора');
  console.log('ок: пачки — без повторов, с дорисовкой после прокрутки и одним jobs-finish');
  dom.window.close();
}

// --- 8. «Проверить на одной записи» ---------------------------------------
{
  const dom = страница('/i/history/likes',
    новаяКарточка({ id: '8101', лайкнут: true }) + новаяКарточка({ id: '8102' }) + новаяКарточка({ id: '8103' }));
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  await поднять(dom);

  панельДока(dom).querySelector('[data-тест]').click();
  await дождаться(() => dom.window.__сообщения.some(с => с.type === 'jobs-test'), 'jobs-test');
  await ждать(80);

  const тест = dom.window.__сообщения.find(с => с.type === 'jobs-test');
  assert.equal(тест.вид, 'ghostlikes');
  assert.equal(тест.id, '8101', 'проверяем первую видимую карточку списка');

  const история = ((dom.window.__хранилище['история'] || {}).ghostlikes || {}).ids || [];
  assert.ok(история.includes('8101'), 'после ответа 200 id должен попасть в историю модуля');
  assert.match(панельДока(dom).querySelector('[data-статус]').textContent, /Запрос прошёл \(200\)/);
  dom.window.close();

  // А если карточек нет — честная подсказка и ни одного запроса в фон.
  const пустая = страница('/i/history/likes', '');
  пустая.window.__XC_ТЕСТ_БЫСТРО = true;
  await поднять(пустая);
  панельДока(пустая).querySelector('[data-тест]').click();
  await ждать(80);
  assert.equal(пустая.window.__сообщения.filter(с => с.type === 'jobs-test').length, 0,
    'если карточек нет, тестовый запрос отправлять некуда');
  assert.match(панельДока(пустая).querySelector('[data-статус]').textContent, /В видимой части списка постов нет/);
  пустая.window.close();

  console.log('ок: «проверить на одной записи» — первая видимая карточка, история при 200, подсказка без них');
}

// --- 9. «Стоп» прекращает сбор --------------------------------------------
{
  const dom = страница('/i/history/likes', новаяКарточка({ id: '8001' }));
  dom.window.__XC_ТЕСТ_БЫСТРО = true;
  await поднять(dom);

  // Лента бесконечная: каждая прокрутка дорисовывает новый зависший пост,
  // иначе сбор закончится сам и остановку не проверить.
  let дорисовано = 0;
  двигать(dom, () => {
    дорисовано += 1;
    dom.window.document.body.insertAdjacentHTML('beforeend',
      новаяКарточка({ id: '90' + String(дорисовано).padStart(2, '0') }));
  });

  нажатьСбор(dom);

  // Как в бою: кнопка «Стоп» включается по первому тику опроса очереди (2.5 с).
  const стоп = панельДока(dom).querySelector('[data-стоп]');
  await дождаться(() => !стоп.disabled, 'кнопка «Стоп» включилась', 6000);
  стоп.click();
  await дождаться(() => dom.window.__сообщения.some(с => с.type === 'jobs-finish'), 'jobs-finish после стопа');
  await ждать(120);

  const сообщения = dom.window.__сообщения;
  assert.equal(сообщения.filter(с => с.type === 'jobs-stop').length, 1, 'фону говорят остановиться');
  assert.equal(сообщения.filter(с => с.type === 'jobs-finish').length, 1, 'живое задание закрывают и после стопа');

  const номерСтопа = сообщения.findIndex(с => с.type === 'jobs-stop');
  const послеСтопа = сообщения
    .slice(номерСтопа + 1)
    .filter(с => с.type === 'jobs-add' && (с.ids || []).length);
  assert.deepEqual(послеСтопа, [], 'после «Стоп» новые id в фон не уходят');

  const панель = панельДока(dom);
  const статус = панель.querySelector('[data-статус]').textContent;
  assert.match(статус, /^Остановился:/, 'статус должен объяснять, что сбор остановлен');
  assert.ok(!/ghost\.\w+/.test(статус), `в статусе сырой ключ перевода: ${статус}`);
  assert.equal(панель.querySelector('[data-без-архива]').disabled, false, 'кнопку сбора возвращают');
  assert.equal(панель.querySelector('[data-без-архива]').textContent, 'Найти и убрать');

  console.log('ок: «Стоп» — сбор прекращается, фон закрывают, кнопка снова доступна');
  dom.window.close();
}

console.log('все тесты прошли');
