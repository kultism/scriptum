/*
                           db             mm                                 
                                          MM                                 
,pP"Ybd  ,p6"bo `7Mb,od8 `7MM `7MMpdMAo.mmMMmm `7MM  `7MM  `7MMpMMMb.pMMMb.  
8I   `" 6M'  OO   MM' "'   MM   MM   `Wb  MM     MM    MM    MM    MM    MM  
`YMMMa. 8M        MM       MM   MM    M8  MM     MM    MM    MM    MM    MM  
L.   I8 YM.    ,  MM       MM   MM   ,AP  MM     MM    MM    MM    MM    MM  
M9mmmP'  YMbmd' .JMML.   .JMML. MMbmmd'   `Mbmo  `Mbod"YML..JMML  JMML  JMML.
                                MM                                           
                              .JMML.                                         
*/


/******************************************************************************
*******************************************************************************
*******************************************************************************
*********************************[ CONSTANTS ]*********************************
*******************************************************************************
*******************************************************************************
******************************************************************************/


const ARGS = Symbol("args"); // used for debugging


const TAG = Symbol("tag"); // the tag property of tagged unions


const TYPE = Symbol.toStringTag; // used for debugging


/******************************************************************************
*******************************************************************************
*******************************************************************************
**********************************[ ERRORS ]***********************************
*******************************************************************************
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
*******************************************************************************
*******************************[ INTROSPECTION ]*******************************
*******************************************************************************
*******************************************************************************
******************************************************************************/


const introspect = x =>
  x && TYPE in x
    ? x[TYPE]
    : Object.prototype.toString.call(x).slice(8, -1);


/******************************************************************************
*******************************************************************************
*******************************************************************************
********************************[ TRAMPOLINES ]********************************
*******************************************************************************
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
*******************************************************************************
*******************************[ CONSTRUCTORS ]********************************
*******************************************************************************
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
*******************************************************************************
******************************[ BUILT-IN TYPES ]*******************************
*******************************************************************************
*******************************************************************************
******************************************************************************/


/******************************************************************************
***********************************[ ARRAY ]***********************************
******************************************************************************/


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


const comp = f => g => x =>
  f(g(x));


const compn = (...fs) => x_ =>
  loop((x = x_, i = fs.length - 1) =>
    i < 0
      ? x
      : recur(fs[i] (x), i - 1));


const compm = f =>
  Object.assign(g => compm(x => f(g(x))), {runComp: f});


const compKleisli = chain => fm => gm => x =>
  chain(fm) (gm(x));


const compKleislin = (chain, of) => (...fs) => x =>
  loop((tx = of(x), i = fs.length - 1) =>
      i < 0
        ? tx
        : recur(chain(fs[i]) (tx), i - 1));


const compKleislim = chain => {
  const go = f =>
    Object.assign(g => go(x => chain(f) (g(x))), {runCompk: f});

  return go;
};


const comp2nd = f => g => x => y =>
  f(x) (g(y));


const contra = g => f => x =>
  f(g(x));


const contran = (...fs) => x_ =>
  loop((x = x_, i = 0) =>
    i === fs.length
      ? x
      : recur(fs[i] (x), i + 1));


const contram = g =>
  Object.assign(f => pipem(x => f(g(x))), {runPipe: g});


const contraKleisli = chain => gm => fm => x =>
  chain(fm) (gm(x));


const contraKleislin = (chain, of) => (...fs) => x =>
  loop((tx = of(x), i = 0) =>
      i === fs.length
        ? tx
        : recur(chain(fs[i]) (tx), i + 1));


const contraKleislim = chain => {
  const go = gm =>
    Object.assign(fm => go(x => chain(fm) (gm(x))), {runPipek: gm});

  return go;
};


const on = f => g => x => y =>
  f(g(x)) (g(y));


const pipe = contra;


const pipen = contran;


const pipem = contram;


const pipeKleisli = contraKleisli;


const pipeKleislin = contraKleislin;


const pipeKleislim = contraKleislim;


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


/***[Typeclasses]*************************************************************/


const funAp = f => g => x =>
  f(x) (g(x));


const funChain = f => g => x =>
  f(g(x)) (x);


const funJoin = f => x =>
  f(x) (x);


const funLiftA2 = f => g => h => x =>
  f(g(x)) (h(x));


/******************************************************************************
*******************************************************************************
*******************************************************************************
*******************************[ CUSTOM TYPES ]********************************
*******************************************************************************
*******************************************************************************
******************************************************************************/


/******************************************************************************
***********************************[ PAIR ]************************************
******************************************************************************/


const Pair = struct("Pair") (Pair => x => y => Pair([x, y]));


/******************************************************************************
**********************************[ TRIPLE ]***********************************
******************************************************************************/


const Triple = struct("Triple") (Triple => x => y => z => Triple([x, y, z]));


