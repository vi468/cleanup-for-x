// ---------------------------------------------------------------------------
//  Тест словаря интерфейса: обе локали на месте, склонения и статусы очереди
//  переводятся, у каждого модуля есть русское и английское описание.
//  Запуск: node test/i18n.test.js
// ---------------------------------------------------------------------------
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const контекст = {
  window: {},
  navigator: { language: 'en-US' },
  location: { search: '' },
  chrome: { i18n: { getUILanguage: () => 'en-US' } },
  console
};
vm.createContext(контекст);
const выполнить = файл => vm.runInContext(
  fs.readFileSync(new URL(файл, import.meta.url), 'utf8'), контекст
);

выполнить('../shared/i18n.js');
const i18n = контекст.window.XCI18n;
контекст.XCI18n = i18n;              // в vm window не даёт глобальных имён
assert.ok(i18n, 'XCI18n не появился');

// 1. По умолчанию английский; переключение работает.
assert.equal(i18n.язык, 'en');
assert.equal(i18n.t('app.openX'), 'Open x.com');
i18n.установить('ru');
assert.equal(i18n.t('app.openX'), 'Открыть x.com');
assert.equal(i18n.установить('de'), 'ru', 'неизвестный язык не меняет текущий');
console.log('ок: i18n — английский по умолчанию и переключение');

// 2. Ключи совпадают в обеих локалях: забытая строка не вылезет ключом.
const ru = new Set(i18n.ключи('ru'));
const en = new Set(i18n.ключи('en'));
const нетВEn = [...ru].filter(ключ => !en.has(ключ));
const нетВRu = [...en].filter(ключ => !ru.has(ключ));
assert.deepEqual(нетВEn, [], 'у русского ключа нет английского перевода');
assert.deepEqual(нетВRu, [], 'у английского ключа нет русского перевода');
console.log('ок: i18n — словари совпадают по ключам');

// 3. Склонения и подстановки.
i18n.установить('ru');
assert.equal(i18n.числоСлово(1, 'plural.tab'), 'вкладка');
assert.equal(i18n.числоСлово(2, 'plural.tab'), 'вкладки');
assert.equal(i18n.числоСлово(5, 'plural.tab'), 'вкладок');
assert.equal(i18n.числоСлово(11, 'plural.tab'), 'вкладок');
assert.equal(i18n.числоСлово(21, 'plural.tab'), 'вкладка');
i18n.установить('en');
assert.equal(i18n.числоСлово(1, 'plural.tab'), 'tab');
assert.equal(i18n.числоСлово(2, 'plural.tab'), 'tabs');
assert.equal(i18n.t('page.open', { n: 2, word: 'tabs' }), 'X is open · 2 tabs · ready to clean');
console.log('ок: i18n — склонения и подстановки');

// 4. Статусы фоновой очереди переводятся, а не показываются по-русски.
assert.equal(i18n.статус('работаю'), 'working');
assert.equal(i18n.статус('готово'), 'done');
assert.equal(i18n.статус('остановлено: 5 ошибок подряд'), 'stopped: 5 errors in a row');
assert.equal(i18n.статус('123: 429, пауза 60 с'), '123: 429, pause 60 s');
assert.equal(i18n.статус('неизвестный статус'), 'неизвестный статус');
i18n.установить('ru');
assert.equal(i18n.статус('остановлено: 5 ошибок подряд'), 'остановлено: 5 ошибок подряд');
console.log('ок: i18n — статусы очереди');

// 5. У каждого модуля есть оба языка, группы и подписи заданий совпадают.
выполнить('../shared/modules.js');
const модули = контекст.window.XCModules;
assert.equal(модули.иды.length, 8);
модули.иды.forEach(id => {
  const мета = модули.получить(id);
  ['название', 'кратко', 'где', 'подробнее', 'совет', 'кнопка'].forEach(поле => {
    assert.equal(typeof мета[поле].ru, 'string', `${id}.${поле}: нет ru`);
    assert.equal(typeof мета[поле].en, 'string', `${id}.${поле}: нет en`);
    assert.ok(мета[поле].ru.length > 0, `${id}.${поле}: пустой ru`);
    assert.ok(мета[поле].en.length > 0, `${id}.${поле}: пустой en`);
  });
});
assert.equal(модули.группы.length, 2);
assert.deepEqual([...модули.группы.flatMap(группа => группа.иды)], [...модули.иды]);
Object.keys(модули.видыЗаданий).forEach(вид => {
  assert.ok(модули.видыЗаданий[вид].ru && модули.видыЗаданий[вид].en, `${вид}: нет перевода`);
});
i18n.установить('en');
assert.equal(модули.название('tweets'), 'Delete tweets');
assert.equal(модули.кнопка('dms'), 'Open messages');
i18n.установить('ru');
assert.equal(модули.название('tweets'), 'Удаление твитов');
console.log('ок: i18n — модули и их подписи на двух языках');

console.log('все тесты прошли');
