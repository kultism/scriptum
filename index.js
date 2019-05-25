/*
                                                                                      
                                                   I8                                 
                                                   I8                                 
                                 gg             88888888                              
                                 ""                I8                                 
   ,g,       ,gggg,   ,gggggg,   gg   gg,gggg,     I8   gg      gg   ,ggg,,ggg,,ggg,  
  ,8'8,     dP"  "Yb  dP""""8I   88   I8P"  "Yb    I8   I8      8I  ,8" "8P" "8P" "8, 
 ,8'  Yb   i8'       ,8'    8I   88   I8'    ,8i  ,I8,  I8,    ,8I  I8   8I   8I   8I 
,8'_   8) ,d8,_    _,dP     Y8,_,88,_,I8 _  ,d8' ,d88b,,d8b,  ,d8b,,dP   8I   8I   Yb,
P' "YY8P8PP""Y8888PP8P      `Y88P""Y8PI8 YY88888P8P""Y88P'"Y88P"`Y88P'   8I   8I   `Y8
                                      I8                                              
                                      I8                                              
                                      I8                                              
*/


/******************************************************************************
*******************************************************************************
*********************************[ CONSTANTS ]*********************************
*******************************************************************************
******************************************************************************/


const ARGS = Symbol("args"); // used for debugging


const TAG = Symbol("tag"); // the tag property of tagged unions


const TYPE = Symbol.toStringTag; // used for debugging


/******************************************************************************
*******************************************************************************
**********************************[ ERRORS ]***********************************
*******************************************************************************
******************************************************************************/


// I actually do subtying in scriptum :D

class ExtendableError extends Error {
  constructor(s) {
    super(s);
    this.name = this.constructor.name;

    if (typeof Error.captureStackTrace === "function")
      Error.captureStackTrace(this, this.constructor);
    
    else
      this.stack = (new Error(s)).stack;
  }
};


class ScriptumError extends ExtendableError {};


class UnionError extends ScriptumError {};


/******************************************************************************
*******************************************************************************
*******************************[ INTROSPECTION ]*******************************
*******************************************************************************
******************************************************************************/


const introspect = x =>
  x && TYPE in x
    ? x[TYPE]
    : Object.prototype.toString.call(x).slice(8, -1);


/******************************************************************************
*******************************************************************************
********************************[ TRAMPOLINES ]********************************
*******************************************************************************
******************************************************************************/


/******************************************************************************
******************************[ TAIL RECURSION ]*******************************
******************************************************************************/


const loop = f => {
  let step = f();

  while (step && step.type === recur)
    step = f(...step.args);

  return step;
};


const recur = (...args) =>
  ({type: recur, args});


/******************************************************************************
*****************************[ MUTUAL RECURSION ]******************************
******************************************************************************/


const tramp = f => (...args) => {
  let step = f(...args);

  while (step && step.type === recur) {
    let [f, ...args_] = step.args;
    step = f(...args_);
  }

  return step;
};


/******************************************************************************
*******************************************************************************
*******************************[ CONSTRUCTORS ]********************************
*******************************************************************************
******************************************************************************/


/******************************************************************************
********************************[ UNION TYPE ]*********************************
******************************************************************************/


const union = type => (tag, x) => ({
  ["run" + type]: x,
  tag,
  [TYPE]: type
});


const match = ({[TYPE]: type, tag}) => o =>
  o.type !== type ? _throw(new UnionError("invalid type"))
    : !(tag in o) ? _throw(new UnionError("invalid tag"))
    : o[tag];


const match2 = ({[TYPE]: type1, tag1}) => ({[TYPE]: type2, tag2}) => o =>
  o.type !== type ? _throw(new UnionError("invalid type"))
    : !(type2 in o) ? _throw(new UnionError("invalid type"))
    : !(tag1 in o) ? _throw(new UnionError("invalid tag"))
    : !(tag2 in o) ? _throw(new UnionError("invalid tag"))
    : tag1 !== tag2 ? _throw(new UnionError("tag mismatch"))
    : o[tag];


/******************************************************************************
********************************[ RECORD TYPE ]********************************
******************************************************************************/


const struct = type => cons => {
  const f = x => ({
    ["run" + type]: x,
    [TYPE]: type,
  });

  return cons(f);
};


const structMemo = type => cons => {
  const f = (thunk, args) => ({
    get ["run" + type] () {
      delete this["run" + type];
      return this["run" + type] = thunk();
    },
    [TYPE]: type
  });

  return cons(f);
};


/******************************************************************************
*******************************************************************************
****************************[ TYPECLASS FUNCTIONS ]****************************
*******************************************************************************
******************************************************************************/


/***[Contravariant Functor]***************************************************/


const contran = contra => {
  const go = x =>
    Object.assign(y => go(contra(x) (y)), {runContra: x, [TYPE]: "Contra"});

  return go;
};


/***[Foldable]****************************************************************/


const foldMap = (fold, append, empty) => f =>
  fold(comp2nd(append) (f)) (empty);


/***[Functor]*****************************************************************/


const mapn = map => {
  const go = x =>
    Object.assign(y => go(map(x) (y)), {runMap: x, [TYPE]: "Map"});

  return go;
};


/***[Applicative]*************************************************************/


const liftAn = (map, ap) => f => {
  const go = ts =>
    Object.assign(
      t => (ts.push(t), go(ts)),
      {get runLiftA() {return liftAn(map, ap) (f) (...ts)}, [TYPE]: "LiftA"});

  return go([]);
};


/***[Monad]*******************************************************************/


const kleisli = chain => fm => gm => x =>
  chain(fm) (gm(x));


const kleislin = chain => {
  const go = f =>
    Object.assign(g => go(x => chain(f) (g(x))), {runKleisli: f, [TYPE]: "Kleisli"});

  return go;
};


const chainn = chain => fm => {
  const go = ms =>
    Object.assign(
      m => (ms.push(m), go(ms)),
      {get runChain() {return chainn(chain) (fm) (...ms)}, [TYPE]: "Chain"});

    return go([]);
};


const liftMn = (chain, of) => f => {
  const go = ms =>
    Object.assign(
      m => (ms.push(m), go(ms)),
      {get runLiftM() {return liftMn(chain, of) (f) (...ms)}, [TYPE]: "LiftM"});

    return go([]);
};


/******************************************************************************
*******************************************************************************
******************************[ BUILT-IN TYPES ]*******************************
*******************************************************************************
******************************************************************************/


/******************************************************************************
***********************************[ ARRAY ]***********************************
******************************************************************************/


/***[Clonable]****************************************************************/


const arrClone = xs => {
  const ys = [];

  for (let i = 0; i < xs.length; i++)
    ys[i] = xs[i];

  return ys;
};


/***[Foldable]****************************************************************/


const arrFold = alg => zero => xs => {
  let acc = zero;

  for (let i = 0; i < xs.length; i++)
    acc = alg(acc) (xs[i]);

  return acc;
};


const arrFoldp = p => alg => zero => xs => {
  let acc = zero;

  for (let i = 0; i < xs.length; i++) {
    if (!p([xs[i], acc])) break;
    acc = alg(acc) (xs[i]);
  }

  return acc;
};


/***[Monoid]******************************************************************/


const arrAppend = xs => ys => xs.concat(ys);


const arrPrepend = ys => xs => xs.concat(ys);


/***[Transduce]***************************************************************/


const arrTransduce = alg => reduce =>
  arrFold(alg(reduce));


const arrTransducep = p => alg => reduce =>
  arrFoldp(p) (alg(reduce));


/******************************************************************************
*********************************[ FUNCTIONS ]*********************************
******************************************************************************/


const app = f => x => f(x);


const appr = f => y => x => f(x) (y);


const _const = x => y => x;


const flip = f => y => x => f(x) (y);


const id = x => x;


const infix = (x, f, y) => f(x) (y); // simulates function calls in infix position


const _let = f => f(); // simulates let binding as an expression


/***[Composition]*************************************************************/


const comp2nd = f => g => x => y =>
  f(x) (g(y));


const on = f => g => x => y =>
  f(g(x)) (g(y));


/***[Conditional Branching]***************************************************/


const cond = x => y => b =>
  b ? x : y;


const cond_ = b => x => y =>
  b ? x : y;


const guard = p => f => x =>
  p(x) ? f(x) : x;


const select = p => f => g => x =>
  p(x) ? f(x) : g(x);


/***[Currying]****************************************************************/


const curry = f => x => y =>
  f(x, y);


const curry3 = f => x => y => z =>
  f(x, y, z);


const curry4 = f => w => x => y => z =>
  f(w, x, y, z);


const curry5 = f => v => w => x => y => z =>
  f(v, w, x, y, z);


const uncurry = f => (x, y) =>
  f(x) (y);


const uncurry3 = f => (x, y, z) =>
  f(x) (y) (z);


const uncurry4 = f => (w, x, y, z) =>
  f(w) (x) (y) (z);


const uncurry5 = f => (v, w, x, y, z) =>
  f(v) (w) (x) (y) (z);


/***[Impure]******************************************************************/


const eff = f => x => (f(x), x); // aka tap


const memoThunk = (f, memo) => () =>
  memo === undefined
    ? (memo = f(), memo)
    : memo;


const _throw = e => {
  throw e;
};


const tryCatch = f => g => x => {
  try {
    return f(x);
  }

  catch(e) {
    return g([x, e]);
  }
};


/***[Partial Application]*****************************************************/


const partial = (f, ...args) => (...args_) =>
  f(...args, ...args_);


const pcurry = (f, n, ...args) => {
  const go = (acc, m) =>
    m === 0
      ? f(...args, ...acc)
      : x => go((acc.push(x), acc), m - 1);

  return go([], n);
};


/***[Transducer]**************************************************************/


const mapper = f => reduce => acc => x =>
  reduce(acc) (f(x));


const filterer = p => reduce => acc => x =>
  p(x) ? reduce(acc) (x) : acc;


/***[Typeclass Functions]*****************************************************/


const funAp = f => g => x =>
  f(x) (g(x));


const funChain = f => g => x =>
  f(g(x)) (x);


const funContra = g => f => x => f(g(x));


const funJoin = f => x =>
  f(x) (x);


const funLiftA2 = f => g => h => x =>
  f(g(x)) (h(x));


const funMap = f => g => x => f(g(x));


/******************************************************************************
**********************************[ OBJECT ]***********************************
******************************************************************************/


const objPath = def => {
  go = o => Object.assign(k => go(o[k] || def), {runPath: o, [TYPE]: "Path"});
  return go;
};


/******************************************************************************
**********************************[ STRING ]***********************************
******************************************************************************/


const strDeleteAt = i => s =>
  t.slice(0, i) + t.slice(i + 1);


const strReplaceAt = i => s => t =>
  t.slice(0, i) + s + t.slice(i + 1);


const strReplaceAtWith = i => f => s =>
  s.slice(0, i) + f(s[i]) + s.slice(i + 1);


/******************************************************************************
*******************************************************************************
*******************************[ CUSTOM TYPES ]********************************
*******************************************************************************
******************************************************************************/


/******************************************************************************
***********************************[ LENS ]************************************
******************************************************************************/


const Lens = struct("Lens") (Lens => o => Lens(o));


const objLens = k => Lens({
  get: o =>
    o[k],

  set: v => o =>
    Object.assign({}, o, {[k]: v}),

  mod: f => o =>
    Object.assign({}, o, {[k]: f(o[k])}),

  del: o => {
    const o_ = Object.assign({}, o);
    delete o_[k];
    return o_;
  }
});


const arrLens = i => Lens({
  get: xs =>
    xs[i],

  set: v => xs => {
    const xs_ = xs.concat([]);
    xs_[i] = v;
    return xs_;
  },

  mod: f => xs => {
    const xs_ = xs.concat([]);
    xs_[i] = f(xs_[i]);
    return xs_;
  },

  del: xs => {
    const xs_ = xs.concat([]);
    delete xs_[i]
    return xs_;
  }
});


const mapLens = k => Lens({
  get: m =>
    m.get(k),

  set: v => m => {
    const m_ = new Map(m);
    return m_.set(k, v);
  },

  mod: f => m => {
    const m_ = new Map(m);
    return m_.set(k, f(v));
  },

  del: m => {
    const m_ = new Map(m);
    return m_.delete(k);
  }
});


const setLens = k => Lens({
  get: s =>
    s.get(k),

  set: v => s => {
    const s_ = new Set(s);
    return s_.add(k, v);
  },

  mod: f => s => {
    const s_ = new Set(s);
    return s_.add(k, f(v));
  },

  del: s => {
    const s_ = new Set(s);
    return s_.delete(k);
  }
});


const strLens = i => Lens({
  get: s =>
    s[i],

  set: v => s =>
    strReplaceAt(i) (v) (s),

  mod: f => s =>
    strReplaceAtWith(i) (f) (s),

  del: xs =>
    strDeleteAt(i) (s)
});


/***[Composition]*************************************************************/


const lensGetComp = tx => ty => o =>
  ty.runLens.get(tx.runLens.get(o));


const lensSetComp = tx => ty => v => o =>
  tx.runLens.set(ty.runLens.set(v) (tx.runLens.get(o))) (o);


const lensModComp = tx => ty => f => o =>
  tx.runLens.set(f(ty.runLens.set(v) (tx.runLens.get(o)))) (o);


const lensDelComp = tx => ty => o =>
  tx.runLens.set(ty.runLens.del(tx.runLens.get(o))) (o);


/******************************************************************************
*********************************[ PARALLEL ]**********************************
******************************************************************************/


// asynchronous computations in parallel

const Parallel = struct("Parallel")
  (Parallel => k => Parallel((res, rej) => k(res, rej)));


/***[Foldable]****************************************************************/


const parCata = alg => tf.runParallel;


/***[Applicative]*************************************************************/


const parAp = tf => tx =>
  Parallel((res, rej) =>
    parAnd(tf) (tx).runParallel(([f, x]) => res(f(x)), rej));


const parOf = x => Parallel((res, rej) => res(x));


/***[Combinators]*************************************************************/


const parAnd = tf => tg => {
  const r = []

  const guard = (res, rej, i) => [
    x => (
      r[i] = x,
      isRes || isRej || r[0] === undefined || r[1] === undefined
        ? false
        : (isRes = true, res(r))),
    e =>
      isRes || isRej
        ? false
        : (isRej = true, rej(e))];

  let isRes = false,
    isRej = false;

  return Parallel(
    (res, rej) => (
      tf.runParallel(...guard(res, rej, 0)),
      tg.runParallel(...guard(res, rej, 1))));
};


const parOr = tf => tg => {
  const guard = (res, rej) => [
    x => (
      isRes || isRej
        ? false
        : (isRes = true, res(x))),
    e =>
        isRes || isRej
          ? false
          : (isRej = true, rej(e))];

  let isRes = false,
    isRej = false;

  return Parallel(
    (res, rej) => (
      tf.runParallel(...guard(res, rej)),
      tg.runParallel(...guard(res, rej))))
};


const parAll = ts => // eta abstraction to create a new tOf([]) for each invocation
  arrFold(acc => tf =>
    parMap(([xs, x]) =>
      (xs.push(x), xs))
        (parAnd(acc) (tf)))
          (parOf([])) (ts);


const parAny =
  arrFold(acc => tf =>
    parOr(acc) (tf))
      (parEmpty);


/***[Functor]*****************************************************************/


const parMap = f => tx =>
  Parallel((res, rej) => tx.runParallel(x => res(f(x)), rej));


/***[Monoid]******************************************************************/


const parEmpty = Parallel((res, rej) => null);


/***[Semigroup]***************************************************************/


const parAppend = parOr;


const parPrepend = parOr;


/******************************************************************************
***********************************[ TASK ]************************************
******************************************************************************/


// asynchronous computations in sequence

const Task = struct("Task") (Task => k => Task((res, rej) => k(res, rej)));


/***[Applicative]*************************************************************/


const tAp = tf => tx =>
  Task((res, rej) => tf.runTask(f => tx.runTask(x => res(f(x)), rej), rej));


const tOf = x => Task((res, rej) => res(x));


/***[Combinators]*************************************************************/


const tAnd = tf => tg =>
  Task((res, rej) =>
    tf.runTask(f =>
      tg.runTask(g =>
        res([f, g]), rej),
        rej));


const tAll = ts => // eta abstraction to create a new tOf([]) for each invocation
  arrFold(acc => tf =>
    tMap(([xs, x]) =>
      (xs.push(x), xs))
        (tAnd(acc) (tf)))
          (tOf([])) (ts);


/***[Foldable]****************************************************************/


const tCata = alg => tf.runTask;


/***[Functor]*****************************************************************/


const tMap = f => tx =>
  Task((res, rej) => tx.runTask(x => res(f(x)), rej));


/***[Monad]*******************************************************************/


const tChain = mx => fm =>
  Task((res, rej) => mx.runTask(x => fm(x).runTask(res, rej), rej));


const tChainf = fm => mx =>
  Task((res, rej) => mx.runTask(x => fm(x).runTask(res, rej), rej));


/******************************************************************************
*******************************************************************************
************************************[ API ]************************************
*******************************************************************************
******************************************************************************/


module.exports = {
  // CONSTANTS
  
  ARGS,
  TAG,
  TYPE,
  
  // INTROSPECTION
  
  introspect,
  
  // TRAMPOLINES
  
  loop,
  recur,
  tramp,
  
  // CONSTRUCTORS
  
  union,
  match,
  match2,
  struct,
  structMemo,
  
  // TYPECLASS FUNCTIONS
  
  contran,
  foldMap,
  mapn,
  liftAn,
  kleisli,
  kleislin,
  chainn,
  liftMn,
  
  
  // BUILT-IN TYPES
  
  // Array
  
  arrClone,
  arrFold,
  arrFoldp,
  arrAppend,
  arrPrepend,
  arrTransduce,
  arrTransducep,
  
  // Function
  
  app,
  appr,
  _const,
  flip,
  id,
  infix,
  _let,
  comp2nd,
  on,
  cond,
  cond_,
  guard,
  select,
  curry,
  curry3,
  curry4,
  curry5,
  uncurry,
  uncurry3,
  uncurry4,
  uncurry5,
  eff,
  memoThunk,
  _throw,
  tryCatch,
  partial,
  pcurry,
  mapper,
  filterer,
  funAp,
  funChain,
  funContra,
  funJoin,
  funLiftA2,
  funMap,
  
  // String
  
  strDeleteAt,
  strReplaceAt,
  strReplaceAtWith,
  
  // CUSTOM TYPES
  
  // Lens
  
  Lens,
  arrLens,
  objLens,
  mapLens,
  setLens,
  strLens,
  lensGetComp,
  lensSetComp,
  lensModComp,
  lensDelComp,
  
  // Parallel
  
  Parallel,
  parCata,
  parOf,
  parAnd,
  parOr,
  parAll,
  parAny,
  parMap,
  parEmpty,
  parAppend,
  parPrepend,
  
  // Task
  
  Task,
  tAp,
  tOf,
  tAnd,
  tAll,
  tCata,
  tMap,
  tChain,
  tChainf
}
