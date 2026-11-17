// Тест разбора списка неприкасаемых и хранилища — без Chrome.
// Запуск: node test/protect.test.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const хранилище = {};
const удалённые = [];
const chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const list = Array.isArray(keys) ? keys : [keys];
        const out = {};
        list.forEach(k => { if (хранилище[k] !== undefined) out[k] = хранилище[k]; });
        cb(out);
      },
      set: (obj, cb) => { Object.assign(хранилище, obj); if (cb) cb(); },
      remove: (keys, cb) => {
        const list = Array.isArray(keys) ? keys : [keys];
        list.forEach(k => { удалённые.push(k); delete хранилище[k]; });
        if (cb) cb();
      }
    }
  }
};

const контекст = { window: {}, chrome, console };
vm.createContext(контекст);
vm.runInContext(fs.readFileSync(new URL('../shared/protect.js', import.meta.url), 'utf8'), контекст);
const XProtect = контекст.window.XProtect;

// 1. разбор «любого текста»
{
  const текст = `
    друзья 🔗
    https://x.com/inkonchain
    https://twitter.com/intent/follow?screen_name=CFCFighting
    @Aptos, @soneium
    https://x.com/Some_Handle/status/123456
    vityok
    123456789
    мусор: https://discord.com/channels/1/2 и https://example.com/abc
  `;
  const найдено = XProtect.разобратьТекст(текст);
  assert.deepEqual([...найдено.ники].sort(), ['aptos', 'cfcfighting', 'inkonchain', 'soneium', 'some_handle', 'vityok'].sort());
  assert.deepEqual([...найдено.id], ['123456789']);
  console.log('ок: разбор текста');
}

// 2. мусор не превращается в ники
{
  const найдено = XProtect.разобратьТекст('https://example.com/abc https://t.me/durov x.com twitter');
  assert.deepEqual([...найдено.ники], []);
  assert.deepEqual([...найдено.id], []);
  console.log('ок: мусор отброшен');
}

// 3. ЧУЖОЙ СПИСОК НЕ ПОДСТАВЛЯЕТСЯ: первый запуск ничего не пишет в хранилище.
//    Раньше здесь появлялись 223 ника владельца, и новый пользователь получал
//    чужой список защиты без своего ведома.
{
  assert.equal(хранилище['защита'], undefined, 'до чтения списка в хранилище пусто');
  const список = await XProtect.прочитать();
  assert.deepEqual([...список.ники], [], 'у нового пользователя список пустой');
  assert.deepEqual([...список.id], []);
  assert.equal(хранилище['защита'], undefined, 'чтение не должно создавать запись в хранилище');
  assert.equal(хранилище['защита_база_внесена'], undefined, 'флаг «база внесена» больше не ставится');
  assert.equal('ПО_УМОЛЧАНИЮ' in XProtect, false, 'списка владельца в коде быть не должно');
  console.log('ок: у нового пользователя нет чужого списка');
}

// 4. Старый флаг не трогает сохранённый список и вычищается сам.
//    У того, кто уже пользовался расширением, список остаётся ровно таким, каким
//    его сохранил браузер, — ничего не подмешивается и ничего не пропадает.
{
  хранилище['защита'] = { ники: ['Мой_Ник', 'second'], id: ['123456789'] };
  хранилище['защита_база_внесена'] = true;
  const список = await XProtect.прочитать();
  assert.deepEqual([...список.ники].sort(), ['second', 'мой_ник']);
  assert.deepEqual([...список.id], ['123456789']);
  assert.equal(список.ники.length, 2, 'база из кода не должна подмешиваться');
  assert.equal(хранилище['защита_база_внесена'], undefined, 'старый флаг убирается');
  assert.ok(удалённые.includes('защита_база_внесена'));
  assert.deepEqual(хранилище['защита'].ники, ['Мой_Ник', 'second'], 'сохранённый список не переписывается');
  console.log('ок: сохранённый список у старого пользователя не затронут');
}

// 4.1 Старый формат списка (массив вместо { ники, id }) не теряется.
//     Иначе первое же добавление перезаписало бы список пустым.
{
  const было = хранилище['защита'];
  хранилище['защита'] = ['OldNick', 'Second'];
  const список = await XProtect.прочитать();
  assert.deepEqual([...список.ники].sort(), ['oldnick', 'second'].sort(), 'массив читается как ники');
  const итог = await XProtect.добавитьИзТекста('@third');
  assert.deepEqual([...итог.состояние.ники].sort(), ['oldnick', 'second', 'third'].sort(),
    'старый список не затирается при добавлении');
  хранилище['защита'] = было;
  console.log('ок: старый формат списка не теряется');
}

// 5. добавление, повторы не дублируются
{
  const раз = await XProtect.добавитьИзТекста('https://x.com/second @newone');
  assert.equal(раз.добавлено, 1, 'second уже в списке, newone новый');
  const два = await XProtect.добавитьИзТекста('@newone');
  assert.equal(два.добавлено, 0);
  const список = await XProtect.прочитать();
  assert.ok(список.ники.includes('newone'));
  assert.equal(хранилище['защита_база_внесена'], undefined, 'флаг не возвращается при записи');
  console.log('ок: добавление и дедупликация');
}

// 6. удаление, очистка и «после очистки база не воскресает»
{
  await XProtect.удалить('@newone');
  let список = await XProtect.прочитать();
  assert.ok(!список.ники.includes('newone'));
  await XProtect.очистить();
  список = await XProtect.прочитать();
  assert.equal(список.ники.length, 0);
  assert.equal(список.id.length, 0);

  const чисто = await XProtect.прочитать();
  assert.ok(!чисто.ники.includes('inkonchain'), 'очистка не должна возвращать базу');
  assert.equal(чисто.ники.length, 0, 'после очистки список остаётся пустым');
  console.log('ок: удаление и очистка без возврата базы');
}

console.log('все тесты прошли');
