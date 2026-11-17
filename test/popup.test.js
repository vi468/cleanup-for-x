// ---------------------------------------------------------------------------
//  Тест попапа: данные должны обновляться сами, пока окно открыто.
//
//  Проверяем не «нарисовалось ли что-то», а именно живые обновления: пишем в
//  chrome.storage так, как это делает фон или страница, и смотрим DOM без
//  перезапуска попапа. Плюс слияние файла данных и состояние тумблеров.
//  Запуск: node test/popup.test.js
// ---------------------------------------------------------------------------
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const читать = путь => fs.readFileSync(new URL(путь, import.meta.url), 'utf8');

const dom = new JSDOM(читать('../popup/popup.html'), {
  url: 'chrome-extension://test/popup/popup.html',
  runScripts: 'outside-only'
});
const { window } = dom;
const document = window.document;

// --- заглушка расширения ---------------------------------------------------
const хранилище = { local: {}, sync: {} };
const слушатели = [];
const сообщения = [];
let вкладки = [{ id: 7, url: 'https://x.com/example' }];

const получить = (область, ключи, готово) => {
  const данные = хранилище[область] || {};
  if (ключи == null) { готово({ ...данные }); return; }
  const список = Array.isArray(ключи) ? ключи : [ключи];
  const итог = {};
  список.forEach(ключ => { if (данные[ключ] !== undefined) итог[ключ] = данные[ключ]; });
  готово(итог);
};

const область = имя => ({
  get: (ключи, готово) => получить(имя, ключи, готово),
  set: (объект, готово) => { Object.assign(хранилище[имя], объект); if (готово) готово(); },
  remove: (ключи, готово) => {
    (Array.isArray(ключи) ? ключи : [ключи]).forEach(ключ => { delete хранилище[имя][ключ]; });
    if (готово) готово();
  }
});

const событие = () => {
  const набор = new Set();
  return {
    addListener: обработчик => набор.add(обработчик),
    removeListener: обработчик => набор.delete(обработчик),
    _вызвать: (...аргументы) => набор.forEach(обработчик => обработчик(...аргументы))
  };
};
const вкладкиСобытия = { onCreated: событие(), onRemoved: событие(), onUpdated: событие(), onActivated: событие() };

window.chrome = {
  storage: {
    local: область('local'),
    sync: область('sync'),
    onChanged: {
      addListener: обработчик => слушатели.push(обработчик),
      removeListener: обработчик => {
        const место = слушатели.indexOf(обработчик);
        if (место >= 0) слушатели.splice(место, 1);
      }
    }
  },
  tabs: {
    query: (условие, готово) => готово(вкладки.slice()),
    create: адрес => { сообщения.push({ type: 'open', адрес }); },
    ...вкладкиСобытия
  },
  runtime: {
    sendMessage: (сообщение, готово) => { сообщения.push(сообщение); if (готово) готово({}); },
    getManifest: () => ({ version: '1.11.0' })
  }
};

const послатьИзменение = (областьИмя, изменения) => {
  слушатели.forEach(обработчик => обработчик(изменения, областьИмя));
};

// --- загрузка скриптов попапа ---------------------------------------------
const запустить = файл => window.eval(читать(файл));
запустить('../shared/i18n.js');
window.XCI18n.установить('ru');             // тесты проверяют русские тексты
запустить('../shared/modules.js');
запустить('../shared/history.js');
запустить('../shared/protect.js');

const ждать = мс => new Promise(готово => setTimeout(готово, мс));

// начальные данные: как будто пользователь уже что-то делал
хранилище.sync = { tweets: true, reposts: true, quotes: true, likes: false, dms: true, unfollow: true };
хранилище.local = {
  'история': { unfollow: { ids: ['1', '2'] }, likes: { ids: ['3'] } },
  'защита': { ники: ['github'], id: ['42'] }
};

запустить('../popup/popup.js');
await ждать(30);

// --- 1. модули нарисованы по словарю --------------------------------------
const карточки = [...document.querySelectorAll('.module')];
assert.equal(карточки.length, 7, 'должно быть семь карточек модулей');
assert.deepEqual(
  карточки.map(карточка => карточка.dataset.id),
  ['tweets', 'reposts', 'quotes', 'likes', 'ghostlikes', 'unfollow', 'dms'],
  'порядок карточек должен идти по группам словаря'
);
assert.equal(document.querySelectorAll('.group').length, 2, 'две группы: посты и люди');

// тумблеры отражают сохранённые настройки (likes выключен)
const лайки = document.querySelector('input[data-id="likes"]');
assert.equal(лайки.checked, false, 'выключенный модуль должен быть снят');
assert.equal(document.querySelector('.module[data-id="likes"]').dataset.on, 'false');
assert.equal(document.querySelector('input[data-id="tweets"]').checked, true, 'включённый модуль включён');

// --- 2. история и защита из хранилища -------------------------------------
assert.equal(document.getElementById('hist-unfollow').textContent.trim(), '2');
assert.equal(document.getElementById('hist-likes').textContent.trim(), '1');
assert.equal(document.getElementById('hist-total').textContent.trim(), '3');
assert.equal(document.getElementById('protect-count').textContent.trim(), '2');

// --- 3. ЖИВОЕ обновление истории без перезапуска --------------------------
послатьИзменение('local', {
  'история': { newValue: { unfollow: { ids: ['1', '2'] }, likes: { ids: ['3'] }, quotes: { ids: Array.from({ length: 57 }, (_, и) => String(и)) } } }
});
await ждать(10);
assert.equal(document.getElementById('hist-quotes').textContent.trim(), '57',
  'счётчик цитат должен появиться от события storage, а не только при открытии');
assert.equal(document.getElementById('hist-total').textContent.trim(), '60', 'итог пересчитался');

// --- 4. ЖИВОЕ обновление прогресса очереди --------------------------------
послатьИзменение('local', {
  'задания': { newValue: { unfollow: { вид: 'unfollow', запущено: true, всего: 10, сделано: 2, статус: 'работаю', старт: Date.now() - 5000 } } }
});
await ждать(10);
const работа = document.getElementById('jobs');
assert.equal(работа.hidden, false, 'блок «сейчас идёт» должен раскрыться');
assert.match(работа.textContent, /Отписка/, 'видно название задания');
assert.match(работа.textContent, /2 из 10/, 'видно счётчик');

послатьИзменение('local', {
  'задания': { newValue: { unfollow: { вид: 'unfollow', запущено: true, всего: 10, сделано: 5, статус: 'работаю', старт: Date.now() - 5000 } } }
});
await ждать(10);
assert.match(document.getElementById('jobs').textContent, /5 из 10/, 'прогресс обновился сам');

// остановка задания из попапа
document.querySelector('.job-stop').click();
await ждать(10);
assert.equal(document.getElementById('jobs').hidden, true, 'после «стоп» блок скрылся');
assert.ok(сообщения.some(сообщение => сообщение.type === 'jobs-stop' && сообщение.вид === 'unfollow'),
  'в фон ушёл jobs-stop');

// --- 5. ЖИВОЕ обновление защиты ------------------------------------------
послатьИзменение('local', { 'защита': { newValue: { ники: ['github', 'NASA'], id: [] } } });
await ждать(10);
assert.equal(document.getElementById('protect-count').textContent.trim(), '2');
document.getElementById('protect-toggle').click();
assert.equal(document.querySelectorAll('#protect-list .chip-item').length, 2, 'два чипа в списке');
assert.equal(document.getElementById('protect-body').hidden, false, 'список раскрылся');

// --- 6. ЖИВОЕ обновление тумблера из sync ---------------------------------
послатьИзменение('sync', { tweets: { oldValue: true, newValue: false } });
await ждать(10);
assert.equal(document.querySelector('input[data-id="tweets"]').checked, false,
  'выключение в другом месте гасит тумблер без перезагрузки');

// --- 7. Вкладки X: строка состояния --------------------------------------
assert.match(document.getElementById('page-state-text').textContent, /X открыт · 1 вкладка/);
вкладки = [];
вкладкиСобытия.onUpdated._вызвать();
await ждать(200);                      // обновление вкладок отложено на 120 мс
assert.match(document.getElementById('page-state-text').textContent, /X не открыт/);
assert.equal(document.getElementById('open-x').textContent, 'Открыть x.com');

// --- 8. Слияние файла данных --------------------------------------------
const слито = window.__XCleaner.слитьДанные(
  { 'история': { unfollow: { ids: ['1'] } }, 'защита': { ники: ['github'], id: [] } },
  {
    приложение: 'Cleanup for X',
    данные: {
      'история': { unfollow: { ids: ['1', '2'] }, reposts: { ids: ['9'] } },
      'защита': { ники: ['GitHub', 'nasa'], id: ['42'] },
      'архив_списки': { подписки: ['100'], подписчики: [], ts: 1 },
      'архив_лайки': { ids: ['5'], ts: 2 }
    }
  }
);
assert.deepEqual([...слито.итог['история'].unfollow.ids], ['1', '2'], 'история объединилась без дублей');
assert.deepEqual([...слито.итог['история'].reposts.ids], ['9'], 'новая запись истории добавилась');
assert.deepEqual([...слито.итог['защита'].ники], ['github', 'nasa'], 'ники без дублей и в нижнем регистре');
assert.deepEqual([...слито.итог['защита'].id], ['42']);
assert.deepEqual([...слито.итог['архив_списки'].подписки], ['100'], 'архивные списки тоже переносятся');
assert.equal(слито.историяДобавлено, 2, 'счётчик добавленного в историю');
assert.equal(слито.защитаДобавлено, 2, 'счётчик добавленной защиты');
assert.equal(слито.архивовДобавлено, 2, 'счётчик архивных списков');

console.log('ок: попап — карточки, живые счётчики, очередь, тумблеры, вкладки, слияние данных');
console.log('все тесты прошли');
