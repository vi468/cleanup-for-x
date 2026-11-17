// ---------------------------------------------------------------------------
//  Актуальный queryId операции X и заголовок x-client-transaction-id.
//
//  X меняет queryId в GraphQL при сборках: зашитый в модуле id рано или поздно
//  начинает отвечать 404. Запасной путь — вытащить id из уже загруженных
//  бандлов страницы (performance resource timing) и закэшировать до перезагрузки.
//
//  Бандлы весят мегабайты, поэтому поиск ограничен: не больше НЕСКОЛЬКИХ свежих
//  штук, у каждого свой таймаут, общий бюджет на операцию, а неудача ещё и
//  запоминается на минуту — иначе на каждое действие страница снова качала бы
//  десяток файлов. Заголовок x-client-transaction-id X ждёт как base62-строку из
//  95 символов: A-Z a-z 0-9.
// ---------------------------------------------------------------------------
(() => {
  // Два поколения сборок X: legacy webpack и новый x-web (Rolldown/Vite, 2026).
  const БАНДЛ = /abs\.twimg\.com\/(?:responsive-web\/client-web\/[^/]+\.js|x-web\/[^/]+\/(?:assets\/)?[^/]+\.js)$/;
  const АЛФАВИТ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  // Сколько бандлов качать за один поиск и сколько ждать каждый.
  const ПОПЫТОК = 6;
  const ТАЙМАУТ_МС = 4000;
  const БЮДЖЕТ_МС = 12000;
  // В тестах реальные секунды не нужны: флаг __XC_ТЕСТ_БЫСТРО уже принят в модулях.
  const быстрые = () => !!(typeof window !== 'undefined' && window.__XC_ТЕСТ_БЫСТРО);
  const таймаут = () => (быстрые() ? 20 : ТАЙМАУТ_МС);
  const бюджет = () => (быстрые() ? 300 : БЮДЖЕТ_МС);
  // Неудача кэшируется ненадолго: бандл мог ещё не догрузиться.
  const ПРОВАЛ_МС = 60 * 1000;
  const В_КЭШЕ_ТЕКСТОВ = 4;          // сколько загруженных бандлов держим в памяти

  const кэш = new Map();
  const провалы = new Map();
  const тексты = new Map();

  const изТекста = (текст, операция) => {
    const кавычки = '["\'`]';
    const id = `([A-Za-z0-9_-]{10,})`;
    const до = текст.match(new RegExp('queryId:' + кавычки + id + кавычки + ',operationName:' + кавычки + операция + кавычки));
    if (до) return до[1];
    const после = текст.match(new RegExp('operationName:' + кавычки + операция + кавычки + ',queryId:' + кавычки + id + кавычки));
    if (после) return после[1];
    // Новый клиент x-web (2026): params:{id:`…`,metadata:{},name:`FavoriteTweet`,
    // operationKind:`mutation`}. Поле queryId/operationName здесь не встречается.
    const новый = текст.match(new RegExp('params:\\{id:' + кавычки + id + кавычки +
      '[\\s\\S]{0,160}?name:' + кавычки + операция + кавычки));
    return новый ? новый[1] : null;
  };

  /** Скачать бандл с таймаутом; null — не вышло или не успели. */
  const скачать = async путь => {
    if (тексты.has(путь)) return тексты.get(путь);
    let контроллер = null;
    try { контроллер = new window.AbortController(); } catch (e) { контроллер = null; }

    let таймер = null;
    const стоп = new Promise(resolve => {
      таймер = setTimeout(() => {
        try { if (контроллер) контроллер.abort(); } catch (e) {}
        resolve('');
      }, таймаут());
    });
    const загрузка = (async () => {
      try {
        const r = await fetch(путь, контроллер ? { signal: контроллер.signal } : undefined);
        return r && r.ok === false ? '' : await r.text();
      } catch (e) {
        return '';
      }
    })();

    const текст = await Promise.race([загрузка, стоп]);
    clearTimeout(таймер);
    if (!текст) return '';

    тексты.set(путь, текст);
    while (тексты.size > В_КЭШЕ_ТЕКСТОВ) тексты.delete(тексты.keys().next().value);
    return текст;
  };

  /** Ищет queryId операции в загруженных бандлах x.com; null — не нашёл. */
  const найти = async операция => {
    if (!операция) return null;
    if (кэш.has(операция)) return кэш.get(операция);

    const провал = провалы.get(операция);
    if (провал && Date.now() - провал < ПРОВАЛ_МС) return null;

    let пути = [];
    try {
      пути = performance.getEntriesByType('resource')
        .map(запись => запись.name)
        .filter(имя => БАНДЛ.test(имя));
    } catch (e) { пути = []; }
    // Свежие сборки грузятся последними — с них и начинаем, и без повторов.
    пути = [...new Set(пути)].reverse();

    const начало = Date.now();
    let попыток = 0;
    for (const путь of пути) {
      if (попыток >= ПОПЫТОК) break;
      if (Date.now() - начало > бюджет()) break;
      попыток++;
      const текст = await скачать(путь);
      if (!текст) continue;
      const id = изТекста(текст, операция);
      if (id) { кэш.set(операция, id); провалы.delete(операция); return id; }
    }

    провалы.set(операция, Date.now());
    return null;
  };

  /** 95 символов base62 — формат, который X принимает в x-client-transaction-id. */
  const транзакция = () => {
    const байты = crypto.getRandomValues(new Uint8Array(95));
    let строка = '';
    for (const байт of байты) строка += АЛФАВИТ[байт % АЛФАВИТ.length];
    return строка;
  };

  window.XQLookup = {
    найти,
    транзакция,
    сброситьКэш: () => { кэш.clear(); провалы.clear(); тексты.clear(); }
  };
})();
