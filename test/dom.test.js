// DOM-тест дока и общей панели заданий: jsdom, без Chrome.
// Запуск: node test/dom.test.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.com/home', runScripts: 'outside-only' });
const { window } = dom;
window.document.body.style.backgroundColor = 'rgb(255, 255, 255)';

// --- заглушки расширения --------------------------------------------------
const хранилище = {};
const слушателиХранилища = [];
window.chrome = {
  storage: {
    local: {
      get: (ключи, готово) => {
        const список = Array.isArray(ключи) ? ключи : [ключи];
        const итог = {};
        список.forEach(ключ => { if (хранилище[ключ] !== undefined) итог[ключ] = хранилище[ключ]; });
        готово(итог);
      },
      set: (объект, готово) => { Object.assign(хранилище, объект); if (готово) готово(); },
      remove: (ключ, готово) => { delete хранилище[ключ]; if (готово) готово(); }
    },
    onChanged: {
      addListener: обработчик => слушателиХранилища.push(обработчик),
      removeListener: () => {}
    }
  },
  runtime: {
    sendMessage: (сообщение, готово) => {
      if (готово) готово({ запущено: false, всего: 0, сделано: 0, статус: 'простой' });
    }
  }
};

const журналДействий = [];
window.XHistory = {
  прочитать: async вид => [],
  добавить: async (вид, ids) => { журналДействий.push([вид, ids]); return ids; },
  очистить: async () => []
};

const запустить = файл => window.eval(fs.readFileSync(new URL(файл, import.meta.url), 'utf8'));

// --- 1. док: вкладки ------------------------------------------------------
запустить('../shared/i18n.js');
window.XCI18n.установить('ru');
запустить('../shared/modules.js');
запустить('../shared/dock.js');
assert.ok(window.XCDock, 'XCDock не появился');
assert.equal(window.document.getElementById('xc-dock'), null, 'док не должен создаваться без модулей');

const панельРаз = window.document.createElement('div');
панельРаз.className = 'xc-panel';
панельРаз.innerHTML = '<div class="xc-head"><div class="xc-title">Отписка</div></div><div>тело</div>';

const панельДва = window.document.createElement('div');
панельДва.className = 'xc-panel';
панельДва.innerHTML = '<div class="xc-head"><div class="xc-title">ЛС</div></div><div>тело</div>';

window.XCDock.регистрировать({ id: 'unfollow', титул: 'Отписка', элемент: панельРаз });
window.XCDock.регистрировать({ id: 'dms', титул: 'ЛС', элемент: панельДва });

const док = window.document.getElementById('xc-dock');
assert.ok(док, 'док не создался после регистрации');
const вкладки = [...док.querySelectorAll('[role="tab"]')];
assert.equal(вкладки.length, 2, 'должно быть две вкладки');
assert.deepEqual(вкладки.map(в => в.dataset.tab), ['unfollow', 'dms'], 'порядок вкладок не тот');
assert.equal(вкладки[0].getAttribute('aria-selected'), 'true', 'первая вкладка должна быть активной');
assert.equal(панельРаз.hidden, false, 'активная панель должна быть видна');
assert.equal(панельДва.hidden, true, 'неактивная панель должна быть скрыта');
console.log('ок: док собрал вкладки и показал одну панель');

// --- 2. переключение вкладки ---------------------------------------------
вкладки[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
assert.equal(вкладки[1].getAttribute('aria-selected'), 'true');
assert.equal(панельДва.hidden, false);
assert.equal(панельРаз.hidden, true);
console.log('ок: вкладка переключает панель');

// --- 3. свёртка ----------------------------------------------------------
const свернуть = док.querySelector('[data-collapse]');
свернуть.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
assert.ok(док.classList.contains('is-collapsed'), 'док не свернулся');
assert.equal(свернуть.getAttribute('aria-expanded'), 'false');
свернуть.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
assert.ok(!док.classList.contains('is-collapsed'), 'док не развернулся');
console.log('ок: свёртка и разворот работают');

// --- 4. тема от страницы X ----------------------------------------------
window.document.body.style.backgroundColor = 'rgb(21, 32, 43)';   // Dim
window.XCDock.подстроитьТему();
assert.equal(док.getAttribute('data-xc-theme'), 'dark', 'Dim должен давать тёмную тему');

window.document.body.style.backgroundColor = 'rgb(255, 255, 255)'; // Default
window.XCDock.подстроитьТему();
assert.equal(док.getAttribute('data-xc-theme'), 'light', 'светлый X должен давать светлую тему');
console.log('ок: тема дока следует теме X, а не системе');

// --- 5. журнал -----------------------------------------------------------
window.XCDock.журнал('лайки: 429 — лимит X', 'bad');
const журнал = док.querySelector('.xc-dock-log');
assert.equal(журнал.hidden, false, 'журнал должен показаться после записи');
const пункты = журнал.querySelectorAll('[data-entries] li');
assert.equal(пункты.length, 1);
assert.equal(пункты[0].className, 'bad');
assert.match(пункты[0].textContent, /429/);
console.log('ок: журнал показывает событие с тоном');

// --- 5.1 строка состояния работы в шапке дока ----------------------------
const состояниеРаботы = док.querySelector('.xc-dock-status');
assert.equal(состояниеРаботы.hidden, true, 'без заданий строка состояния скрыта');
слушателиХранилища.forEach(обработчик => обработчик({
  'задания': { newValue: { unfollow: { запущено: true, сделано: 2, всего: 10 } } }
}, 'local'));
assert.equal(состояниеРаботы.hidden, false, 'идущее задание должно показаться в шапке');
assert.match(состояниеРаботы.textContent, /Отписка: 2 из 10/);
док.classList.add('is-collapsed');
assert.equal(состояниеРаботы.hidden, false, 'в свёрнутом виде статус тоже виден');
док.classList.remove('is-collapsed');
слушателиХранилища.forEach(обработчик => обработчик({
  'задания': { newValue: { unfollow: { запущено: false, статус: 'готово', старт: Date.now() } } }
}, 'local'));
assert.equal(состояниеРаботы.hidden, true, 'после завершения строка состояния скрыта');
console.log('ок: шапка дока показывает идущую работу');

// --- 6. общая панель заданий ---------------------------------------------
запустить('../shared/archive-job.js');
assert.ok(window.XJobPanel, 'XJobPanel не появился');

const панель = window.XJobPanel.создать({
  вид: 'likes',
  заголовок: 'Удаление лайков',
  ключАрхива: 'архив_лайки',
  кнопкаФайла: 'Выбрать like.js',
  действие: 'Снять лайки',
  разобрать: текст => ({ ids: ['1', '2', '3'] })
});

const вкладкаЛайков = [...док.querySelectorAll('[role="tab"]')].find(в => в.dataset.tab === 'likes');
assert.deepEqual([...док.querySelectorAll('[role="tab"]')].map(в => в.dataset.tab),
  ['likes', 'unfollow', 'dms'], 'вкладки должны идти в порядке словаря модулей');
assert.ok(вкладкаЛайков, 'вкладка лайков не зарегистрировалась');
assert.ok(панель.элемент.isConnected, 'панель не попала в док');
assert.equal(панель.элемент.closest('#xc-dock') !== null, true, 'панель должна жить внутри дока');

const старт = панель.элемент.querySelector('[data-старт]');
const тест = панель.элемент.querySelector('[data-тест]');
assert.equal(старт.disabled, true, 'без файла старт должен быть заблокирован');
assert.equal(тест.disabled, true, 'без файла тест должен быть заблокирован');
assert.match(старт.textContent, /Снять лайки/);
console.log('ок: панель задания собралась и ждёт файл');

// В доке и в панели живут setInterval — закрываем окно, иначе node не выйдет.
window.close();

console.log('все тесты прошли');
