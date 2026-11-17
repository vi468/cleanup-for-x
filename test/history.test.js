// Тест истории действий (shared/history.js) без Chrome.
// Запуск: node test/history.test.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const хранилище = {};
const контекст = {
  window: {},
  chrome: {
    storage: {
      local: {
        get: (keys, cb) => {
          const list = Array.isArray(keys) ? keys : [keys];
          const out = {};
          list.forEach(k => { if (хранилище[k] !== undefined) out[k] = хранилище[k]; });
          cb(out);
        },
        set: (obj, cb) => { Object.assign(хранилище, obj); if (cb) cb(); }
      }
    }
  },
  console
};
vm.createContext(контекст);
vm.runInContext(fs.readFileSync(new URL('../shared/history.js', import.meta.url), 'utf8'), контекст);
const H = контекст.window.XHistory;

assert.deepEqual([...(await H.прочитать('unfollow'))], []);
await H.добавить('unfollow', ['1', '2', 2]);
assert.deepEqual([...(await H.прочитать('unfollow'))].sort(), ['1', '2']);
await H.добавить('unfollow', ['3']);
assert.equal((await H.прочитать('unfollow')).length, 3);
console.log('ок: добавление и дедупликация');

await H.добавить('reposts', ['r1']);
let всё = await H.всё();
assert.deepEqual([...Object.keys(всё)].sort(), ['dms', 'ghostlikes', 'likes', 'quotes', 'reposts', 'tweets', 'unfollow']);
assert.equal(всё.unfollow, 3);
assert.equal(всё.reposts, 1);
assert.equal(всё.tweets, 0);
console.log('ок: счётчики по модулям');

await H.очистить('unfollow');
всё = await H.всё();
assert.equal(всё.unfollow, 0);
assert.equal(всё.reposts, 1, 'очистка одного модуля не должна трогать другие');
console.log('ок: очистка только своего модуля');

// Лимит: старые id отрезаются, свежие остаются. Иначе история на 34k лайков
// переписывалась бы всё длиннее и тормозила попап.
{
  const много = Array.from({ length: H.ЛИМИТ + 5 }, (_, и) => String(и));
  await H.добавить('likes', много);
  const ids = await H.прочитать('likes');
  assert.equal(ids.length, H.ЛИМИТ, 'история не должна расти глубже лимита');
  assert.equal(ids[0], '5', 'самые старые id отрезаются');
  assert.equal(ids[ids.length - 1], String(H.ЛИМИТ + 4), 'свежие id остаются');
  console.log('ок: лимит истории и порядок id');
}

// Гонка чтения-записи: два модуля пишут почти одновременно.
// С обычным «прочитал → добавил → записал» последняя запись затирает чужие
// модули (общий ключ «история»), и сделанное молча теряется.
{
  const медленное = {};
  const контекст2 = {
    window: {},
    chrome: {
      storage: {
        local: {
          get: (keys, cb) => setTimeout(() => {
            const list = Array.isArray(keys) ? keys : [keys];
            const out = {};
            list.forEach(k => { if (медленное[k] !== undefined) out[k] = медленное[k]; });
            cb(out);
          }, 5),
          set: (obj, cb) => setTimeout(() => { Object.assign(медленное, obj); if (cb) cb(); }, 5)
        }
      }
    },
    console
  };
  vm.createContext(контекст2);
  vm.runInContext(fs.readFileSync(new URL('../shared/history.js', import.meta.url), 'utf8'), контекст2);
  const H2 = контекст2.window.XHistory;

  await Promise.all([
    H2.добавить('unfollow', ['1']),
    H2.добавить('reposts', ['r1']),
    H2.добавить('likes', ['l1']),
    H2.добавить('quotes', ['q1'])
  ]);
  const итог = await H2.всё();
  assert.equal(итог.unfollow, 1, 'запись отписки не должна потеряться');
  assert.equal(итог.reposts, 1, 'запись репостов не должна потеряться');
  assert.equal(итог.likes, 1, 'запись лайков не должна потеряться');
  assert.equal(итог.quotes, 1, 'запись цитат не должна потеряться');

  // и сами id на месте, а не только счётчики
  assert.deepEqual([...await H2.прочитать('reposts')], ['r1']);
  assert.deepEqual([...await H2.прочитать('quotes')], ['q1']);
  console.log('ок: одновременные записи не затирают друг друга');
}

// Старый формат записи (массив id) читается и не теряется при добавлении.
{
  хранилище['история'] = { tweets: ['a', 'b'] };
  const ids = await H.прочитать('tweets');
  assert.deepEqual([...ids].sort(), ['a', 'b'], 'массив читается как история модуля');
  await H.добавить('tweets', ['c']);
  const после = await H.прочитать('tweets');
  assert.deepEqual([...после].sort(), ['a', 'b', 'c'], 'старая история не затирается');
  console.log('ок: старый формат истории не теряется');
}

console.log('все тесты прошли');
