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


const NOT_FOUND = -1;


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
    

/***[Suclasses]***************************************************************/


class SemigroupError extends ScriptumError {};


class UnionError extends ScriptumError {};


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
  [TAG]: tag,
  [TYPE]: type
});


const unionGetter = type => (tag, o) => { // allows a lazy getter for runFoo
  o[TAG] = tag;
  o[TYPE] = type;
  return o;
};


const match = ({[TYPE]: type, [TAG]: tag}, o) =>
  o.type !== type ? _throw(new UnionError("invalid type"))
    : !(tag in o) ? _throw(new UnionError("invalid tag"))
    : o[tag];


/******************************************************************************
********************************[ RECORD TYPE ]********************************
******************************************************************************/


const struct = type => x => ({
  ["run" + type]: x,
  [TYPE]: type,
});


const structExt = type => cons => { // for more complex constructors
  const f = x => ({
    ["run" + type]: x,
    [TYPE]: type,
  });

  return cons(f);
};


const structGetter = type => o => { // allows a lazy getter for runFoo
  o[TYPE] = type;
  return o;
};


const structMemo = type => thunk => ({
  get ["run" + type] () {
    delete this["run" + type];
    return this["run" + type] = thunk();
  },
                                     
  [TYPE]: type
});


const structMemoExt = type => cons => {
  const f = thunk => ({
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
***********************[ AD-HOC POLYMORPHIC FUNCTIONS ]************************
*******************************************************************************
******************************************************************************/


/***[Applicative]*************************************************************/


const varAp = ap => tf =>
  varComp({comp: ap, id: tf});


const varLiftA = ({ap, of}) => f =>
  varComp({comp: ap, id: of(f)});


/***[Category]****************************************************************/


const varComp = ({comp, id}) =>
  varArgs(arrFold(comp) (id));


const varPipe = ({pipe, id}) =>
  varArgs(arrFold(pipe) (id));


/***[Ix]**********************************************************************/


const range = ({succ, gt}) => (lower, upper) =>
  arrUnfold(x =>
    gt(x) (upper)
      ? None
      : Some([x, succ(x)])) (lower);


const index = ({succ, eq}) => (lower, upper) => x =>
  loop((y = lower, i = 0) =>
    eq(y) (upper) ? None
      : eq(x) (y) ? Some(i)
      : recur(succ(y), i + 1));

const inRange = ({succ, eq, gt}) => (lower, upper) => x =>
  loop((y = lower) =>
    gt(y) (upper) ? false
      : eq(x) (y) ? true
      : recur(succ(y)));

const rangeSize = ({succ, eq, gt}) => (lower, upper) =>
  loop((x = lower, n = 0) =>
    gt(x) (upper)
      ? n
      : recur(succ(x), n + 1));


/***[Foldable]****************************************************************/


const foldMap = ({fold, append, empty}) => f =>
  fold(comp2nd(append) (f)) (empty);


/***[Monad]*******************************************************************/


const varChain = ({map, of, chain, join}) => fm => // TODO: derive from varComp
  varArgs(args =>
    join(arrFold(mg => mx =>
      chain(g => map(g) (mx)) (mg)) (of(fm)) (args)));


const kleisliComp = chain => fm => gm => x =>
  chain(fm) (gm(x));


const varKleisliComp = ({of, chain}) =>
  varComp({comp: kleisliComp(chain), id: of});


const kleisliPipe = chain => gm => fm => x =>
  chain(fm) (gm(x));


const varKleisliPipe = ({of, chain}) =>
  varPipe({comp: kleisliPipe(chain), id: of});


const varLiftM = ({map, of, chain}) => f =>
  varComp({
    comp: mg => mx => chain(g => map(g) (mx)) (mg),
    id: of(f)
  });


/***[Monoid]******************************************************************/


const concat = ({append, empty}) =>
  arrFold(append) (empty);


/******************************************************************************
*******************************************************************************
******************************[ BUILT-IN TYPES ]*******************************
*******************************************************************************
******************************************************************************/


/***[Eq]**********************************************************************/


const eq = x => y => x === y;


const neq = x => y => x !== y;


/***[Ord]*********************************************************************/


const compare = x => y =>
  x < y ? LT
    : x === y ? EQ
    : GT;
      

const gt = x => y => x > y;


const gtf = y => x => x > y;


const gte = x => y => x >= y;


const gtef = y => x => x >= y;


const lt = x => y => x < y;


const ltf = y => x => x < y;


const lte = x => y => x <= y;


const ltef = y => x => x <= y;


const min = x => y =>
  x < y ? x
    : x === y ? x
    : y;


const max = x => y =>
  x < y ? y
    : x === y ? x
    : x;


/***[Misc. Combinators]*******************************************************/


const and = x => y =>
  x && y;


const imply = x => y =>
  !x || y;


const not = x => !x;


const or = x => y =>
  x || y;


/******************************************************************************
***********************************[ ARRAY ]***********************************
******************************************************************************/


/***[Applicative]*************************************************************/


const arrAp = fs => xs => // TODO: replace reduce
  fs.reduce((acc, f) =>
    acc.concat(xs.map(x => f(x))), []);


const arrOf = x => [x];


/***[ChainRec]****************************************************************/


const arrChainRec = f => {
  const stack = [],
    acc = [];

  let step = f();

  if (step && step.type === recur)
    arrPushFlat(stack) (step.arg);

  else
    arrPushFlat(acc) (step.arg);

  while (stack.length > 0) {
    step = f(stack.shift());

    if (step && step.type === recur)
      arrPushFlat(stack) (step.arg);

    else
      arrPushFlat(acc) (step);
  }

  return acc;
};


/***[Clonable]****************************************************************/


const arrClone = xs => {
  const ys = [];

  for (let i = 0; i < xs.length; i++)
    ys[i] = xs[i];

  return ys;
};


/***[Filterable]**************************************************************/


const arrFilter = p => xs =>
  xs.filter(x => p(x) ? x : null);


/***[Foldable]****************************************************************/


const arrFold = alg => zero => xs => { // aka catamorphism
  let acc = zero;

  for (let i = 0; i < xs.length; i++)
    acc = alg(acc) (xs[i], i);

  return acc;
};


const arrFoldM = ({append, empty}) =>
  arrFold(append) (empty);


const arrFoldr = alg => zero => xs => { // TODO: make non-strict?
  const stack = [];
  let acc = zero;

  for (let i = 0; i < xs.length; i++)
    stack.unshift(alg(xs[i]));

  for (let i = 0; i < xs.length; i++)
    acc = stack[i] (acc);

  return acc;
};


const arrFoldWhile = alg => zero => xs => {
  let acc = Loop(zero);

  for (let i = 0; i < xs.length; i++) {
    acc = alg(acc.runStep) (xs[i], i);
    if (acc && acc[TAG] === "Done") break;
  }

  return acc.runStep;
};


const arrHisto = alg => zero =>
  comp(headH) (history(alg) (zero));


const arrHylo = alg => zero => coalg =>
  comp(arrFold(alg) (zero)) (arrAna(coalg));


const arrMutu = alg1 => alg2 => zero1 => zero2 =>
  comp(snd)
    (arrFold(([acc1, acc2]) => x =>
      [alg1(acc1) (acc2) (x), alg2(acc1) (acc2) (x)])
        ([zero1, zero2]));


const arrPara = alg => zero => xs => {
  const ys = arrClone(xs);
  
  let acc = zero,
    len = 0,
    x;

  while (x = ys.shift()) 
    acc = alg(acc) (ys) (x, len++);

  return acc;
};


const arrParaWhile = alg => zero => xs => {
  const ys = arrClone(xs);
  
  let acc = Loop(zero),
    len = 0, x;

  while (x = ys.shift()) {
    acc = alg(acc.runStep) (ys) (x, len++);
    if (acc && acc[TAG] === "Done") break;
  }

  return acc.runStep;
};


// arrSum @derived


const arrZygo = alg1 => alg2 => zero1 => zero2 =>
  comp(snd)
    (arrFold(([acc1, acc2]) => x =>
      [alg1(acc1) (x), alg2(acc1) (acc2) (x)])
        ([zero1, zero2]));


/***[Functor]*****************************************************************/


const arrMap = f => xs =>
  xs.map(x => f(x));


const arrSeqF = x => xs => {
  const f = _const(x);
  return xs.map(f);
};


/***[Monad]*******************************************************************/


const arrChain = fm => xs => // TODO: replace reduce
  xs.reduce((acc, x) => arrPushFlat(acc) (fm(x)), []);


const arrJoin = xss => {
  let xs = [];

  for (let i = 0; i < xss.length; i++)
    for (let j = 0; j < xss[i].length; j++)
      xs.push(xss[i] [j]);

  return xs;
};


/***[Monoid]******************************************************************/


const arrEmpty = [];


/***[Semigroup]***************************************************************/


const arrAppend = xs => ys => {
  const zs = arrClone(xs);

  if (!Array.isArray(ys)) // prevents the common mistake of passing a non-array
    throw new SemigroupError(`array expected but "${ys}" given`);

  else {
    for (let i = 0; i < ys.length; i++)
      zs.push(ys[i]);
  }

  return zs;
};


// arrAppendf @derived


const arrConcat =
  concat({append: arrAppend, empty: arrEmpty});


/***[Transduce]***************************************************************/


const arrTransduce = alg => reduce =>
  arrFold(alg(reduce));


const arrTransduceWhile = alg => reduce =>
  arrFoldWhile(alg(reduce));


/***[Tuple]*******************************************************************/


const fst = ([x]) => x;


const snd = ([x, y]) => y;


const thd = ([x, y, z]) => z;


/***[Unfoldable]**************************************************************/


const arrUnfold = coalg => x => { // TODO: make non-strict
  const acc = [];

  while (true) {
    let tx = coalg(x);

    switch (tx[TAG]) {
      case "None": return acc;
      
      case "Some": {
        acc.push(tx.runOption[0]);
        x = tx.runOption[1];
        break;
      }

      default: throw new UnionError("invalid tag");
    }
  }
};


const arrApo = coalg => x => { // TODO: make non-strict
  const acc = [];

  while (true) {
    let tx = coalg(x);

    switch (tx.tag) {
      case "None": return acc;
      
      case "Some": {
        switch (tx.runOption[1].tag) {
          case "Left": {
            arrPushFlat(acc)
              ((tx.runOption[1].runEither.unshift(tx.runOption[0]),
                tx.runOption[1].runEither));
            
            return acc;
          }

          case "Right": {
            acc.push(tx.runOption[0]);
            x = tx.runOption[1].runEither;
            break;
          }

          default: throw new UnionError("invalid tag");
        }
        
        break;
      }

      default: throw new UnionError("invalid tag");
    }
  }
};


const arrFutu = coalg => x => { // TODO: make non-strict
  const acc = [];

  while (true) {
    let optX = coalg(x);

    switch (optX.tag) {
      case "None": return acc;

      case "Some": {
        let [y, [ys, optX_]] = optX.runOption;

        switch(optX_.tag) {
          case "None": {
            arrPushFlat(acc) ((ys.unshift(y), ys));
            return acc;
          }

          case "Some": {
            arrPushFlat(acc) ((ys.unshift(y), ys)); 
            x = optX_.runOption;
            break;
          }

          default: throw new UnionError("invalid tag");
        }

        break;
      }

      default: throw new UnionError("invalid tag");
    }
  }
};


/***[Misc. Combinators]*******************************************************/


// TODO: add arrDedupe/arrDedupeBy


// TODO: add arrDiffl/arrDiffr


// TODO: add arrIntersect/arrIntersectBy


// TODO: add arrUnion/arrUnionBy


// TODO: add arrMapAccum


// TODO: add arrTailOr


// TODO: add arrInitOr


// TODO: add arrLastOr


// TODO: add arrSort/arrSortOn


// TODO: add arrSpan


// TODO: add arrUncons


// TODO: add arrUntail


// TODO: add arrShift


// TODO: add arrPop


// TODO: add arrGroupBy


const arrIsEmpty = xs => xs.length === 0;


const arrHead = xs =>
  xs.length === 0
    ? None
    : Some(xs[0]);


const arrHeadOr = def => xs =>
  xs.length === 0
    ? def
    : xs[0];


const arrModOr = def => (i, f) => xs =>
  arrModOrx(def) (i, f) (arrClone(xs));


const arrModOrx = def => (i, f) => xs =>
  i in xs
    ? (xs[i] = f(xs[i]), xs)
    : xs[i] = def;


const arrPartition = f => xs => // TODO: replace reduce
  xs.reduce((m, x) =>
    _let((r = f(x), ys = m.get(r) || []) =>
      m.set(r, (ys.push(x), ys))), new Map());


const arrPush = xs => x =>
  (xs.push(x), xs);


const arrPushf = x => xs =>
  (xs.push(x), xs);


const arrPushFlat = xs => ys => {
  ys.forEach(x =>
    xs.push(x));

  return xs;
};


const arrScan = f => x_ => xs => // TODO: use fold
  loop((acc = [], x = x_, i = 0) =>
    i === xs.length
      ? acc
      : recur(
        (acc.push(f(x) (xs[i])), acc),
        acc[acc.length - 1], i + 1));


const arrSet = (i, x) => xs =>
  arrSetx(i, x) (arrClone(xs));


const arrSetx = (i, x) => xs =>
  (xs[i] = x, xs);


const arrTranspose = matrix =>
  matrix[0].map((_, i) =>
    matrix.map(xs => xs[i]));


const arrUnshift = xs => x =>
  (xs.unshift(x), xs);


const arrUnshiftf = x => xs =>
  (xs.unshift(x), xs);


const arrUnshiftFlat = xs => ys => {
  ys.forEach(x =>
    xs.unshift(x));

  return xs;
};


const arrUnzip = xss => // TODO: use fold
  loop((acc = [[], []], i = 0) =>
    i === xss.length
      ? acc
      : recur((
          acc[0].push(xss[i] [0]),
          acc[1].push(xss[i] [1]),
          acc), i + 1));


const arrZip = xs => ys => // TODO: use fold
  loop((acc = [], i = 0) => {
    const x = xs[i], y = ys[i];

    if (x === undefined || y === undefined)
      return acc;

    else
      return recur(
        (acc.push([xs[i], ys[i]]), acc), i + 1);
  });


const arrZipBy = f => xs => ys => // TODO: use fold
  loop((acc = [], i = 0) => {
    const x = xs[i], y = ys[i];

    if (x === undefined || y === undefined)
      return acc;

    else
      return recur(
        (acc.push(f(xs[i]) (ys[i])), acc), i + 1);
  });


/******************************************************************************
***********************************[ DATE ]************************************
******************************************************************************/


const formatDate = sep => (...fs) => date =>
  fs.map(f => f(date))
    .join(sep);


const fromTimestamp = n => new Date(n);


// getDate @derived


const getMonthDays = y => m =>
  new Date(y, m, 0).getDate();


// getMonth @derived


// getYear @derived


const verifyDate = y => m => d =>
  typeof y !== "number" || typeof m !== "number" || typeof d !== "number" ? false
    : Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)? false
    : m <= 0 || m > 12 ? false
    : d <= 0 || d > getMonthDays(y) (m) ? false
    : true;


/******************************************************************************
***********************************[ FLOAT ]***********************************
******************************************************************************/


// ceil @derived


// floor @derived


// round @derived


const roundBy = k => places => fp => {
  let [n, ex] = `${fp < 0 ? Math.abs(fp) : fp}e`.split('e'),
    r = Math[k](`${n}e${Number(ex) + places}`);

  [n, ex] = `${r}e`.split('e');
  r = Number(`${n}e${Number(ex) - places}`);

  return fp < 0 ? -r : r;
};


const toFixedFloat = places => fp =>
  String(round(places) (fp));


/***[Derived]*****************************************************************/


const ceil = roundBy("ceil");


const floor = roundBy("floor");


const round = roundBy("round");


/******************************************************************************
*********************************[ FUNCTION ]**********************************
******************************************************************************/


/***[Applicative]*************************************************************/


const funAp = f => g => x =>
  f(x) (g(x));


const funLiftA2 = f => g => h => x =>
  f(g(x)) (h(x));


/***[Arguments]***************************************************************/


const fromMultiArg = (...args) => [...args];


const infixl = (x, ...args) =>
  arrFold(acc => (op, i) =>
    (i & 1) === 0
      ? op(acc)
      : acc(op)) (x) (args);


const infixr = (...args) =>
  loop((acc = args[args.length - 1], stack = null, i = args.length - 2) =>
    i < 0 ? acc
      : (i & 1) === 1 ? recur(args[i], acc, i - 1)
      : recur(acc(args[i]) (stack), null, i - 1));


const swapMultiArg = (x, y) => [y, x];


const varArgs = f => {
  const go = args =>
    Object.defineProperties(
      arg => go(args.concat([arg])), {
        "runVarArgs": {get: function() {return f(args)}, enumerable: true},
        [TYPE]: {value: "VarArgs", enumerable: true}
      });

  return go([]);
};


/***[Choice]******************************************************************/


const funLeft = f =>
  eithCata(x => Left(f(x))) (Right);


const funRight = f =>
  eithCata(Left) (x => Right(f(x)));


/***[Composition]*************************************************************/


const comp = f => g => x =>
  f(g(x));


const comp3 = f => g => h => x =>
  f(g(h(x)));


const comp2nd = f => g => x => y =>
  f(x) (g(y));


const pipe = g => f => x =>
  f(g(x));


const pipe3 = h => g => f => x =>
  f(g(h(x)));


const on = f => g => x => y =>
  f(g(x)) (g(y));


// funVarComp @derived


// funVarPipe @derived


/***[Conditional Branching]***************************************************/


const guard = p => f => x =>
  p(x) ? f(x) : x;


const select = p => f => g => x =>
  p(x) ? f(x) : g(x);


/***[Contravariant Functor]***************************************************/


const funContra = pipe;


/***[Currying/Partial Application]********************************************/


const curry = f => x => y =>
  f(x, y);


const curry3 = f => x => y => z =>
  f(x, y, z);


const curry4 = f => w => x => y => z =>
  f(w, x, y, z);


const curry5 = f => v => w => x => y => z =>
  f(v, w, x, y, z);


const partial = (f, ...args) => (...args_) =>
  f(...args, ...args_);


const partialCurry = (f, ...args) =>
  varArgs(args_ => f(...args, ...args_));


const uncurry = f => (x, y) =>
  f(x) (y);


const uncurry3 = f => (x, y, z) =>
  f(x) (y) (z);


const uncurry4 = f => (w, x, y, z) =>
  f(w) (x) (y) (z);


const uncurry5 = f => (v, w, x, y, z) =>
  f(v) (w) (x) (y) (z);

/***[Debugging]***************************************************************/


const debug = f => x => {
  debugger;
  return f(x);
};


const log = pre =>
  eff(x => console.log(pre, x));


/***[Functor]*****************************************************************/


const funMap = comp;


/***[Impure]******************************************************************/


const eff = f => x => (f(x), x); // aka tap


const introspect = x =>
  x && x[TYPE] !== undefined
    ? x[TYPE]
    : Object.prototype.toString.call(x).slice(8, -1);


const _throw = e => {
  throw e;
};


const throwOn = p => f => (e, msg) => x => {
  const r = f(x);
  
  if (p(r))
    throw new e(msg);
  
  else return r;
};


// throwOnFalse @derived


// throwOnTrue @derived


// throwOnUnit @derived


const tryCatch = f => g => x => {
  try {
    return f(x);
  }

  catch(e) {
    return g([x, e]);
  }
};


/***[Monad]*******************************************************************/


const funChain = f => g => x =>
  f(g(x)) (x);


const funJoin = f => x =>
  f(x) (x);


/***[Monoid]******************************************************************/


// funEmpty @derived


/***[Predicate]***************************************************************/


const isArr = Array.isArray;


const isArrOf = f => x =>
  isArr(x) && arrMap(f) (x);


const isBoo = x =>
  typeof x === "boolean";


const isDate = x =>
  introspect(x) === "Date"
    && !Number.isNaN(x.getTime());


const isFalse =x => x === false;


const isFloatStr = s =>
  s.search(new RegExp("^\\d+\\.\\d+$")) !== NOT_FOUND;


const isIntStr = s =>
  s.search(new RegExp("^\\d+$")) !== NOT_FOUND;


const isMap = x =>
  x && x[Symbol.toStringTag] === "Map";


const isMapOf = p => x =>
  isMap(x) && mapMap(f) (x);


const isNaN = Number.isNaN;


const isNull = x => x === null;


const isNum = x =>
  typeof x === "number";


const isObj = x =>
  typeof x === "object" && x !== null;


const isSet = x =>
  x && x[Symbol.toStringTag] === "Set";


const isSetOf = f => x =>
  isSet(x) && setMap(f) (x);


const isStr = x =>
  typeof x === "string";


const isTrue = x => x === true;


const isUndef = x => x === undefined;


const isUnit = x => // unit types are undefined/null/NaN/invalid Date
  x === undefined
    || x === null
    || x === x === false
    || x.getTime !== undefined && !Number.isNaN(x.getTime());


const notp = p => x => !p(x);


const notp2 = p => x => y =>
  !p(x) (y);


const notp3 = p => x => y => z =>
  !p(x) (y) (z);  


/***[Primitive]***************************************************************/


const app = f => x => f(x);


const _const = x => y => x;


const flip = f => y => x => f(x) (y);


const id = x => x;


const _let = f => f(); // simulates let binding as an expression


/***[Profunctor]**************************************************************/


const funDimap = f => g => hx => x =>
  g(hx(f(x)));


const funLmap = f => hx => x =>
  hx(f(x));


const funRmap = g => hx => x =>
  g(hx(x));


/***[Relations]***************************************************************/


const select11 = m => (ks, vs) => k =>
  vs[m.get(ks.indexOf(k))];


const select1N = m => (ks, vs) => k =>
  m.get(ks.indexOf(k)).map(l => vs[l]);


/***[Semigroup]***************************************************************/


const funAppend = comp;


const funAppendf = pipe;


/***[Strong]******************************************************************/


// TODO: add


/***[Transducer]**************************************************************/


const mapper = f => reduce => acc => x =>
  reduce(acc) (f(x));


const filterer = p => reduce => acc => x =>
  p(x) ? reduce(acc) (x) : acc;


/***[Derived]*****************************************************************/


const funEmpty = id;


const funVarComp = varComp({comp, id});


const funVarPipe = varPipe({pipe, id});


const throwOnFalse = throwOn(isFalse);


const throwOnTrue = throwOn(isTrue);


const throwOnUnit = throwOn(isUnit);


/******************************************************************************
************************************[ MAP ]************************************
******************************************************************************/


const mapMap = f => m => {
  let n = new Map();
  
  for (const [k, v] of m)
    n.set(k, f(v));
  
  return n;
};


/******************************************************************************
**********************************[ NUMBER ]***********************************
******************************************************************************/


/***[Enum]********************************************************************/


const fromEnum = n => Some(n);


const pred = n => Some(n + 1);


const succ = n => Some(n - 1);


const toEnum = n => Some(n);


/***[Eq]**********************************************************************/


const numEq = eq;


const numNeq = neq;


/***[Ord]**********************************************************************/


const numCompare = compare;


const numGt = gt;


const numGtf = gtf;


const numGte = gte;


const numGtef = gtef;


const numLt = lt;


const numLtf = ltf;


const numLte = lte;


const numLtef = ltef;


const numMin = min;


const numMax = max;


/******************************************************************************
**********************************[ OBJECT ]***********************************
******************************************************************************/


const invoke = k => (...args) => o =>
  o[k] (...args);


const memoMethx = k => f => o => Object.defineProperty(o, k, {get: function() {
  return x => {
    const r = f(x);
    delete this[k];
    this[k] = () => r;
    return r;
  };
}, configurable: true});


const _new = cons => (...args) =>
  new cons(...args);


const objClone = o => {
  const p = {};

  for (k of objKeys(o))
    Object.defineProperty( // getter/setter safe
      p, k, Object.getOwnPropertyDescriptor(o, k));

  return p;
};


const objDel = k => o =>
  objDelx(k) (objClone(o));


const objDelx = k => o =>
  (delete o[k], o);


// TODO: add objDiffl/objDiffr


// TODO: add objIntersect


const objModOr = def => (k, f) => o =>
  objModOrx(def) (k, f) (objClone(o));


const objModOrx = def => (k, f) => o =>
  k in o
    ? (o[k] = f(o[k]), o)
    : (o[k] = def, o);


const objPathOr = def =>
  varArgs(arrFold(p => k => p[k] || def) (o));


const objSet = (k, v) => o =>
  objSetx(k, v) (objClone(o));


const objSetx = (k, v) => o =>
  (o[k] = v, o);


const objUnion = o => p =>
  objUnionx(objClone(o)) (p);


const objUnionx = o => p => {
  for ([k, v] of objEntries(p))
    o[k] = v;

  return o;
};


const thisify = f => f({}); // mimics this context


/***[Iterators]**************************************************************/


function* objEntries(o) {
  for (let prop in o) {
    yield [prop, o[prop]];
  }
}


function* objKeys(o) {
  for (let prop in o) {
    yield prop;
  }
}


function* objValues(o) {
  for (let prop in o) {
    yield o[prop];
  }
}


/******************************************************************************
************************************[ SET ]************************************
******************************************************************************/


const setMap = f => s => {
  const t = new Set();
  
  for (const x of s)
    t.add(f(x));
  
  return t;
};


/******************************************************************************
**********************************[ STRING ]***********************************
******************************************************************************/


/***[Foldable]****************************************************************/


// strings are folded in chunks rather than char by char

const strFold = alg => zero => s => {
  let acc = zero;

  while (s) {
    [acc, s] = alg(acc) (s);
  }

  return acc;
};


/***[Regular Expressions]*****************************************************/


const strDel = (r, flags) => s =>
  s.replace(new RegExp(r, flags), "");


const strMatch = (r, flags) => s => {
  const xs = s.match(new RegExp(r, flags));

  if (xs === null)
    return Matched(None);

  else if (!("index" in xs))
    throw new Error(
      `invalid regular expression - greediness is not permitted in\n${r}`);

  else if (xs.groups === undefined)
    xs.groups = {}; // add empty group instead of undefined

  xs.relIndex = xs.index; // add relative index in case of multiple matches
  xs.relInput = xs.input; // add relative input in case of multiple matches
  return Matched(Some(xs));
};


const strMatchAll = (r, flags) => s_ =>
  loop((acc = [], s = s_, i = 0) => {
    if (s === "")
      return acc;

    else {
      const tx = strMatch(r, flags) (s);

      switch (tx.runMatched[TAG]) {
        case "None": return acc;

        case "Some": {
          const xs = tx.runMatched.runOption;
          xs.index += i;
          xs.input = s_;

          return recur(
            (acc.push(tx), acc),
            s_.slice(xs.index + xs[0].length),
            xs.index + xs[0].length);
        }

        default: _throw(new UnionError("unknown tag"));
      }
    }
  });


const strMatchLast = (r, flags) => s_ =>
  loop((acc = Matched(None), s = s_, i = 0) => {
    if (s === "")
      return acc;

    else {
      const tx = strMatch(r, flags) (s);

      switch (tx.runMatched[TAG]) {
        case "None": return acc;

        case "Some": {
          const xs = tx.runMatched.runOption;
          xs.index += i;
          xs.input = s_;

          return recur(
            tx,
            s_.slice(xs.index + xs[0].length),
            xs.index + xs[0].length);
        }

        default: _throw(new UnionError("unknown tag"));
      }
    }
  });


const strMod = (r, f, flags) => s =>
  s.replace(new RegExp(r, flags), f);


const strSet = (r, t, flags) => s =>
  s.replace(new RegExp(r, flags), t);


/***[Misc. Combinators]*******************************************************/


const strIsEmpty = s => s === "";


const strPadl = n => c => s =>
  c.repeat(n)
    .concat(s)
    .slice(-n);


const strPadr = n => c => s =>
  c.repeat(n)
    .concat(s)
    .slice(0, n);


/******************************************************************************
**********************************[ DERIVED ]**********************************
******************************************************************************/


const arrAppendf = flip(arrAppend);


const getDay = invoke("getDate") ();


const getMonth = invoke("getMonth") ();


const getYear = invoke("getFullYear") ();


/******************************************************************************
*******************************************************************************
***********************[ FUNCTIONAL PROGRAMMING TYPES ]************************
*******************************************************************************
******************************************************************************/


/******************************************************************************
************************************[ ALL ]************************************
******************************************************************************/


const All = struct("All");


/***[Monoid]******************************************************************/


const allEmpty = All(false);


/***[Semigroup]***************************************************************/


const allAppend = tx => ty =>
  All(tx.runAll && ty.runAll);


const allAppendf = allAppend;


/******************************************************************************
************************************[ ANY ]************************************
******************************************************************************/


const Any = struct("Any");


/***[Monoid]******************************************************************/


const anyEmpty = Any(false);


/***[Semigroup]***************************************************************/


const anyAppend = tx => ty =>
  Any(tx.runAny || ty.runAny);


const anyAppendf = anyAppend;


/******************************************************************************
********************************[ COMPARATOR ]*********************************
******************************************************************************/


const Comparator = unionGetter("Comparator");


const LT = Comparator("LT",
  {get runComparator() {return LT}, valueOf: () => -1});


const EQ = Comparator("EQ",
  {get runComparator() {return EQ}, valueOf: () => 0});


const GT = Comparator("GT",
  {get runComparator() {return GT}, valueOf: () => 1});


/***[Foldable]****************************************************************/


const ctorCata = lt => eq => gt => tx =>
  match(tx, {
    type: "Comparator",
    LT: lt,
    EQ: eq,
    GT: gt
  });


/***[Monoid]******************************************************************/


const ctorEmpty = EQ;


/***[Semigroup]***************************************************************/


const ctorAppend = tx => ty =>
  ctorCata(LT) (ty) (GT) (tx);


const ctorAppendf = ctorAppend;


/******************************************************************************
**********************************[ COMPARE ]**********************************
******************************************************************************/


const Compare = struct("Compare");


/***[Contravariant Functor]***************************************************/


const compContra = f => tf =>
  Compare(on(tf.runCompare) (f));


/***[Monoid]******************************************************************/


const compEmpty = Compare(x => y => EQ);


/***[Semigroup]***************************************************************/


const compAppend = tf => tg =>
  Compare(x => y =>
    ctorAppend(tf.runCompare(x) (y)) (tg.runCompare(x) (y)));


const compAppendf = flip(compAppend);


/******************************************************************************
**********************************[ COMPOSE ]**********************************
******************************************************************************/


const Comp = struct("Comp");


/***[Applicative]*************************************************************/


const compOf = ({of1, of2}) => x =>
  Comp(of1(of2(x)));


const compAp = ({map1, ap1, ap2}) => ttf => ttx =>
  Comp(ap1(map1(ap2) (ttf.runComp)) (ttx.runComp));


/***[Functor]*****************************************************************/


const compMap = ({map1, map2}) => f => ttx =>
  Comp(map1(map2(f)) (ttx.runComp));


/******************************************************************************
*********************************[ CONSTANT ]**********************************
******************************************************************************/


const Const = struct("Const");


/***[Functor]*****************************************************************/


const constMap = f => tx =>
  Const(tx.runConst);


/******************************************************************************
*******************************[ CONTINUATION ]********************************
******************************************************************************/


const Cont = struct("Cont");


/***[Applicative]*************************************************************/


const contAp = tf => tx =>
  Cont(k => tf.runCont(f => tx.runCont(x => k(f(x)))));


const contLiftA2 = f => tx => ty =>
  contAp(contMap(f) (tx)) (ty);


const contOf = x => Cont(k => k(x));


/***[Functor]*****************************************************************/


const contMap = f => tx =>
  Cont(k => tx.runCont(x => k(f(x))));
                                  

/***[Monad]*******************************************************************/


const contChain = fm => mx =>
  Cont(k => mx.runCont(x => fm(x).runCont(y => k(y))));


const contChain2 = fm => mx => my =>
  Cont(k => mx.runCont(x => my.runCont(y => fm(x) (y).runCont(z => k(z)))));


const contJoin = mmx =>
  Cont(k => mmx.runCont(mx => mx.runCont(x => k(x))));


const contLiftM2 = f => mx => my =>
  Cont(k => mx.runCont(x => my.runCont(y => k(f(x) (y)))));


/***[Misc. Combinators]*******************************************************/


const contReset = tx => // delimited continuations
  of(tx.runCont(id));
  

const contShift = f => // delimited continuations
  Cont(k => f(k).runCont(id));


/******************************************************************************
***************************[ DEFERRED COMPUTATION ]****************************
******************************************************************************/


const Defer = struct("Defer");


/***[Applicative]*************************************************************/


const defAp = tf => tx =>
  Defer(() => tf.runDefer() (tx.runDefer()));


const defOf = x => Defer(() => x);


/***[Functor]*****************************************************************/


const defMap = f => tx =>
  Defer(() => f(tx.runDefer()));


/***[Monad]*******************************************************************/


const defChain = fm => mx =>
  Defer(() => fm(mx.runDefer()).runDefer());


const defJoin = mmx =>
  Defer(() => mmx.runDefer().runDefer());


/******************************************************************************
**********************************[ EITHER ]***********************************
******************************************************************************/


const Either = union("Either");


const Left = x =>
  Either("Left", x);


const Right = x =>
  Either("Right", x);


/***[Foldable]****************************************************************/


const eithCata = left => right => tx =>
  match(tx, {
    type: "Either",
    get Left() {return left(tx.runEither)},
    get Right() {return right(tx.runEither)}
  });


/******************************************************************************
*******************************[ ENDOMORPHISM ]********************************
******************************************************************************/


const Endo = struct("Endo");


/***[Monoid]******************************************************************/


const endoEmpty = Endo(id);


/***[Semigroup]***************************************************************/


const endoAppend = tf => tg => x =>
  Endo(tf.runEndo(tg.runEndo(x)));


const endoAppendf = flip(endoAppend);


/******************************************************************************
********************************[ EQUIVALENT ]*********************************
******************************************************************************/


const Equiv = struct("Equiv");


/***[Contravariant Functor]***************************************************/


const equivContra = f => tf =>
  Equiv(on(tf.runEquiv) (f));


/***[Monoid]******************************************************************/


const equivEmpty = Equiv(x => y => true);


/***[Semigroup]***************************************************************/


const equivAppend = tf => tg =>
  Equiv(x => y =>
    tf.runEquiv(x) (y) && tg.runEquiv(x) (y));


const equivAppendf = equivAppend;


/******************************************************************************
***********************************[ FIRST ]***********************************
******************************************************************************/


const First = struct("First");


/***[Semigroup]***************************************************************/


const firstAppend = x => _ => x;


// firstAppendf @derived


/******************************************************************************
**********************************[ HISTORY ]**********************************
******************************************************************************/


// part of the histomorpishm

const History = union("History");


const Ancient = x => History("Ancient", x);


const Age = x => y => History("Age", [x, y, z]);


const history = alg => zero =>
  arrFoldr(x => acc => Age(x) (alg(x) (acc)) (acc))
    (Ancient(zero));


const headH = tx => {
  switch (tx[TAG]) {
    case "Ancient": return tx.runHistory;
    case "Age": return tx.runHistory[1];
    default: throw new UnionError("invalid tag");
  }
};


/******************************************************************************
************************************[ ID ]*************************************
******************************************************************************/


const Id = struct("Id");


/***[Functor]*****************************************************************/


const idMap = f => tx =>
  Id(f(tx.runId));


/******************************************************************************
***********************************[ LAST ]************************************
******************************************************************************/


const Last = struct("Last");


/***[Semigroup]***************************************************************/


const lastAppend = _ => y => y;


const lastAppendf = firstAppend;


/******************************************************************************
*****************************[ LAZY COMPUTATION ]******************************
******************************************************************************/


// Defer with memoization

const Lazy = structMemo("Lazy");


/***[Applicative]*************************************************************/


const lazyAp = tf => tx =>
  Defer(() => tf.runLazy() (tx.runLazy()));


const lazyOf = x => Lazy(() => x);


/***[Functor]*****************************************************************/


const lazyMap = f => tx =>
  Lazy(() => f(tx.runLazy()));


/***[Monad]*******************************************************************/


const lazyChain = fm => mx =>
  Lazy(() => fm(mx.runLazy()).runLazy());


const lazyJoin = mmx =>
  Lazy(() => mmx.runLazy().runLazy());


/******************************************************************************
*******************************[ LENS (OPTICS) ]*******************************
******************************************************************************/


const Lens = f => struct("Lens");


/***[Instances]***************************************************************/


const objLens = map => k =>
  Lens(f => o => map(x =>
    objUnionx(objDel(k) (o)) (x === null ? {} : {[k]: x})) (f(o[k])));


/***[Category]****************************************************************/


const lensComp = tx => ty =>
  Lens(x => tx.runLens(ty.runLens(x)));


const lensComp3 = tx => ty => tz =>
  Lens(x => tx.runLens(ty.runLens(tz.runLens(x))));


const lensId = Lens(id);


const lensVarComp = varComp({comp: lensComp, id: lensId});


/***[Misc. Combinators]*******************************************************/


const lensDel = k => o =>
  objPrism(idMap) (k).runLens(_const(Id(null))) (o);


const lensGet = k => o => 
  objPrism(constMap) (k).runLens(tx => Const(tx)) (o);


// TODO: add lensMapped


const lensMod = (k, f) => o => // aka lensOver
  objPrism(idMap) ("xyz").runLens(tx =>
    Id(optMap(x => x.toUpperCase()) (tx))) (o);


const lensSet = (k, v) => o =>
  objPrism(idMap) (k).runLens(_const(Id(v))) (o);


/******************************************************************************
**************************[ MATCHED (REGEXP RESULT) ]**************************
******************************************************************************/


const Matched = struct("Matched");


/***[Foldable]****************************************************************/


const matchCata = x => tx =>
  match(tx.runMatched, {
    type: "Option",
    None: x,
    Some: tx.runMatched.runOption
  });


/******************************************************************************
************************************[ MAX ]************************************
******************************************************************************/


const Max = struct("Max");


/***[Monoid]******************************************************************/


const maxEmpty = minBound => Max(minBound);


/***[Semigroup]***************************************************************/


const maxAppend = max => x => y =>
  max(x) (y);


const maxAppendf = maxAppend;


/******************************************************************************
************************************[ MIN ]************************************
******************************************************************************/


const Min = struct("Min");


/***[Monoid]******************************************************************/


const minEmpty = maxBound => Min(maxBound);


/***[Semigroup]***************************************************************/


const minAppend = min => x => y =>
  min(x) (y);


const minAppendf = minAppend;


/******************************************************************************
**********************************[ OPTION ]***********************************
******************************************************************************/


const Option = unionGetter("Option");


const None = Option("None", {get runOption() {return None}});


const Some = x => Option("Some", {runOption: x});


/***[Applicative]*************************************************************/


const optAp = tf => tx =>
  match(tf, {
    type: "Option",
    None: None,
    get Some() {
      return match(tx, {
        type: "Option",
        None: None,
        get Some() {return Some(tf.runOption(tx.runOption))}
      });
    }
  });


const optOf = x => Some(x);


/***[Folding]*****************************************************************/


const optCata = none => some => tx =>
  match(tx, {
    type: "Option",
    None: none,
    get Some() {return some(tx.runOption)}
  });


/***[Functor]*****************************************************************/


const optMap = f => tx =>
  match(tx, {
    type: "Option",
    None: None,
    get Some() {return Some(f(tx.runOption))}
  });


/***[Monad]*******************************************************************/


const optChain = fm => mx =>
  match(mx, {
    type: "Option",
    None: None,
    get Some() {return fm(mx.runOption)}
  });


/******************************************************************************
*****************************[ ASYNC IN PARALLEL ]*****************************
******************************************************************************/


// asynchronous computations in parallel

const Parallel = structExt("Parallel")
  (Parallel => k => Parallel((res, rej) => k(res, rej)));


/***[Foldable]****************************************************************/


const parCata = alg => tf.runParallel;


/***[Applicative]*************************************************************/


const parAp = tf => tx =>
  Parallel((res, rej) =>
    parAnd(tf) (tx).runParallel(([f, x]) => res(f(x)), rej));


const parOf = x => Parallel((res, rej) => res(x));


/***[Functor]*****************************************************************/


const parMap = f => tx =>
  Parallel((res, rej) => tx.runParallel(x => res(f(x)), rej));


/***[Monoid]******************************************************************/


const parEmpty = Parallel((res, rej) => null);


/***[Semigroup]***************************************************************/


// parAppend @derived


// parAppendf @derived


/***[Misc. Combinators]*******************************************************/


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


/***[Derived]*****************************************************************/


const parAppend = parOr;


const parAppendf = parOr;


/******************************************************************************
*********************************[ PREDICATE ]*********************************
******************************************************************************/


const Pred = struct("Pred");


/***[Contravariant Functor]***************************************************/


const predContra = f => tf =>
  x => Pred(tf.runPred(f(x)));


/***[Monoid]******************************************************************/


const predEmpty = Pred(x => true);


/***[Semigroup]***************************************************************/


const predAppend = tf => tg =>
  Pred(x => tf.runPred(x) && tg.runPred(x));


const predAppendf = predAppend;


/******************************************************************************
******************************[ PRISM (OPTICS) ]*******************************
******************************************************************************/


const Prism = struct("Prism");


/***[Instances]***************************************************************/


// Object


const objPrism = map => k =>
  Prism(f => o => map(tx =>
    match(tx, {
      type: "Option",
      get None() {return o},
      get Some() {return objUnionx(objDel(k) (o)) (tx.runOption === null ? {} : {[k]: tx.runOption})}
    })) (f(k in o ? Some(o[k]) : None)));


// Either


const leftPrism = map =>
  Prism(f => tx => map(ty =>
    match(ty, {
      type: "Option",
      get None() {return tx},
      
      get Some() {
        return match(tx, {
          type: "Either",
          get Left() {return Left(ty.runOption)},
          get Right() {return tx}
        })
      }
    })) (f(match(tx, {
      type: "Either",
      get Left() {return Some(tx.runEither)},
      get Right() {return None}
    }))));


const rightPrism = map =>
  Prism(f => tx => map(ty =>
    match(ty, {
      type: "Option",
      get None() {return tx},
      
      get Some() {
        return match(tx, {
          type: "Either",
          get Left() {return tx},
          get Right() {return Right(ty.runOption)}
        })
      }
    })) (f(match(ty, {
      type: "Either",
      get Left() {return None},
      get Right() {return Some(tx.runEither)}
    }))));


/***[Misc. Combinators]*******************************************************/


const prismGet = prism => tx =>
  prism(constMap).runPrism(tx => Const(tx)) (tx);


// TODO: add prismMapped


const prismMod = prism => f => tx => // aka prismOver
  prism(idMap).runPrism(ty =>
    Id(optMap(f) (ty))) (tx);


const prismSet = prism => x => tx =>
  prism(idMap).runPrism(_const(Id(Some(x)))) (tx);


/******************************************************************************
**********************************[ PRODUCT ]**********************************
******************************************************************************/


const Prod = struct("Prod");


/***[Monoid]******************************************************************/


const prodEmpty = Prod(1);


/***[Semigroup]***************************************************************/


const prodAppend = tm => tn =>
  Sum(tm.runProd * tn.runProd);


const prodAppendf = prodAppend;


/******************************************************************************
**********************************[ READER ]***********************************
******************************************************************************/


const Reader = struct("Reader");


/***[Applicative]**************************************************************/


const readAp = tf => tg =>
  Reader(x => tf.runReader(x) (tg.runReader(x)));


const readOf = x => Reader(_ => x);


/***[Functor]******************************************************************/


const readMap = f => tg =>
  Reader(x => f(tg.runReader(x)));


/***[Monad]********************************************************************/


const readChain = fm => mg =>
  Reader(x => fm(mg.runReader(x)).runReader(x));


const readJoin = mmf =>
  Reader(x => mmf.runReader(x).runReader(x));


/***[Misc. Combinators]*******************************************************/


const ask = Reader(id);


const asks = f =>
  readChain(x => readOf(f(x))) (ask);


const local = f => tg =>
  Reader(x => tg.runReader(f(x)));


/******************************************************************************
***********************************[ STATE ]***********************************
******************************************************************************/


const State = struct("State");


/***[Applicative]*************************************************************/


const stateOf = x => State(y => [x, y]);


/***[Monad]*******************************************************************/


const stateChain = fm => mg =>
  State(y => _let(([x, y_] = mg.runState(y)) => fm(x).runState(y_)));


/***[Misc. Combinators]*******************************************************/


const evalState = tf =>
  y => tf.runState(y) [0];


const execState = tf =>
  y => tf.runState(y) [1];


const stateGet = State(y => [y, y]);


const stateGets = f =>
  stateChain(y => stateOf(f(x))) (stateGet);


const stateModify = f =>
  stateChain(y => statePut(f(y))) (stateGet);


const statePut = y => State(_ => [null, y]);


/******************************************************************************
***********************************[ STEP ]************************************
******************************************************************************/


const Step = union("Step");


const Loop = x => Step("Loop", x);


const Done = x => Step("Done", x);


/******************************************************************************
************************************[ SUM ]************************************
******************************************************************************/


const Sum = struct("Sum");


/***[Monoid]******************************************************************/


const sumEmpty = Sum(0);


/***[Semigroup]***************************************************************/


const sumAppend = tm => tn =>
  Sum(tm.runSum + tn.runSum);


const sumAppendf = sumAppend;


/******************************************************************************
*****************************[ ASYNC IN SEQUENCE ]*****************************
******************************************************************************/


// asynchronous computations in sequence

const Task = structExt("Task")
  (Task => k => Task((res, rej) => k(res, rej)));


/***[Applicative]*************************************************************/


const tAp = tf => tx =>
  Task((res, rej) => tf.runTask(f => tx.runTask(x => res(f(x)), rej), rej));


const tLiftA2 = f => tx => ty =>
  tAp(tMap(f) (tx)) (ty);


const tOf = x => Task((res, rej) => res(x));


/***[Foldable]****************************************************************/


const tCata = alg => tf.runTask;


/***[Functor]*****************************************************************/


const tMap = f => tx =>
  Task((res, rej) => tx.runTask(x => res(f(x)), rej));


/***[Monad]*******************************************************************/


const tChain = fm => mx =>
  Task((res, rej) => mx.runTask(x => fm(x).runTask(res, rej), rej));


const tChain2 = fm => mx => my =>
  Task((res, rej) => mx.runTask(x =>
    my.runTask(y =>
      fm(x) (y).runTask(res, rej), rej), rej));


const tJoin = mmx =>
  Task((res, rej) => mmx.runTask(mx => mx.runTask(res, rej), rej));


const tLiftM2 = f => mx => my =>
  tChain(mx) (x => tChain(my) (y => tOf(f(x) (y))));


/***[Misc. Combinators]*******************************************************/


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


/******************************************************************************
***********************************[ THESE ]***********************************
******************************************************************************/


const These_ = union("These");


const This = x =>
  These_("This", x);


const That = x =>
  These_("That", x);


const These = (x, y) =>
  These_("These", [x, y]);


/***[Foldable]****************************************************************/


const theseCata = _this => that => these => tx =>
  match(tx, {
    type: "These",
    get This() {return _this(tx.runThese)},
    get That() {return that(tx.runThese)},
    get These() {return these(...tx.runThese)}
  });


/***[Misc. Combinators]*******************************************************/


const fromThese = (x, y) => tx =>
  match(tx) ({
    type: "These",
    get This() {return [tx.runThese, y]},
    get That() {return [x, tx.runThese]},
    get These() {return tx.runThese}
  });


/******************************************************************************
****************************[ TRAVERSAL (OPTICS) ]*****************************
******************************************************************************/


// TODO: add


/******************************************************************************
**********************************[ WRITER ]***********************************
******************************************************************************/


const Writer = structExt("Writer")
  (Writer => (x, y) => Writer([x, y]));


/***[Applicative]*************************************************************/


const writeOf = empty => x =>
  Writer(x, empty);


/***[Monad]*******************************************************************/


const writeChain = append => fm => mx =>
  mx.runWriter(([x, y]) => f(x).runWriter(([x_, y_]) => Writer(x_, append(y) (y_))));


/***[Misc. Combinators]*******************************************************/


const evalWriter = tx =>
  tx.runWriter(([x, y]) => x);


const execWriter = tx =>
  tx.runWriter(([x, y]) => y);


const writeCensor = f => mx =>
  pass(mx.runWriter(pair => Writer(pair, f)));


const writeListen = tx =>
  tx.runWriter(([x, y]) => Writer([x, y], y));


const writeListens = f => mx =>
  listen(mx).runWriter(([pair, y]) => Writer(pair, f(y)));


const writePass = tx =>
  tx.runWriter(([[x, f], y]) => Writer([x, f(x)]));


const writeTell = y => Writer(null, y);


/******************************************************************************
**********************************[ DERIVED ]**********************************
******************************************************************************/


const firstAppendf = lastAppend;


/******************************************************************************
*******************************************************************************
************************************[ IO ]*************************************
*******************************************************************************
******************************************************************************/


/******************************************************************************
********************************[ FILE SYSTEM ]********************************
******************************************************************************/


// TODO: parameterize sequential/parallel execution behavior


const fileRead_  = fs => enc => path =>
  Task((res, rej) =>
    fs.readFile(path, enc, (e, s) =>
      e ? rej(e) : res(s)));


const fileScanDir_ = fs => path =>
  Task((res, rej) =>
    fs.readdir(path, (e, ss) =>
      e ? rej(e) : res(ss)));



/******************************************************************************
*******************************************************************************
**********************************[ DERIVED ]**********************************
*******************************************************************************
******************************************************************************/


const arrSum = arrFoldM({append: sumAppend, empty: sumEmpty});


/******************************************************************************
*******************************************************************************
************************************[ API ]************************************
*******************************************************************************
******************************************************************************/


module.exports = {
  Age,
  All,
  allAppend,
  allAppendf,
  allEmpty,
  Ancient,
  and,
  Any,
  anyAppend,
  anyAppendf,
  anyEmpty,
  app,
  arrAp,
  arrApo,
  arrAppend,
  arrAppendf,
  arrChain,
  arrChainRec,
  arrClone,
  arrConcat,
  arrEmpty,
  arrFilter,
  arrFold,
  arrFoldM,
  arrFoldr,
  arrFoldWhile,
  arrFutu,
  arrHead,
  arrHeadOr,
  arrHisto,
  arrHylo,
  arrIsEmpty,
  arrJoin,
  arrMap,
  arrModOr,
  arrModOrx,
  arrMutu,
  arrOf,
  arrPara,
  arrParaWhile,
  arrPartition,
  arrPush,
  arrPushf,
  arrPushFlat,
  arrScan,
  arrSeqF,
  arrSet,
  arrSetx,
  arrSum,
  arrTransduce,
  arrTransduceWhile,
  arrTranspose,
  arrUnfold,
  arrUnshift,
  arrUnshiftf,
  arrUnshiftFlat,
  arrUnzip,
  arrZip,
  arrZipBy,
  arrZygo,
  ask,
  asks,
  ceil,
  Comp,
  comp,
  comp2nd,
  comp3,
  compAp,
  compAppend,
  compAppendf,
  Comparator,
  Compare,
  compare,
  compContra,
  compEmpty,
  compMap,
  compOf,
  concat,
  Const,
  _const,
  constMap,
  Cont,
  contAp,
  contChain,
  contChain2,
  contJoin,
  contLiftA2,
  contLiftM2,
  contMap,
  contReset,
  contShift,
  contOf,
  ctorAppend,
  ctorAppendf,
  ctorCata,
  ctorEmpty,
  curry,
  curry3,
  curry4,
  curry5,
  debug,
  Defer,
  defAp,
  defChain,
  defJoin,
  defMap,
  defOf,
  Done,
  eff,
  Either,
  Endo,
  endoAppend,
  endoAppendf,
  endoEmpty,
  EQ,
  eq,
  Equiv,
  equivAppend,
  equivAppendf,
  equivContra,
  equivEmpty,
  eithCata,
  evalState,
  execState,
  fileRead_,
  fileScanDir_,
  filterer,
  First,
  firstAppend,
  firstAppendf,
  flip,
  floor,
  foldMap,
  formatDate,
  fromTimestamp,
  fst,
  fromMultiArg,
  fromThese,
  funAp,
  funAppend,
  funAppendf,
  funContra,
  funEmpty,
  funLiftA2,
  funChain,
  funDimap,
  funJoin,
  funLmap,
  funMap,
  funRmap,
  funVarComp,
  funVarPipe,
  getDay,
  getMonth,
  getMonthDays,
  getYear,
  GT,
  guard,
  headH,
  History,
  history,
  Id,
  id,
  idMap,
  imply,
  index,
  infixl,
  infixr,
  inRange,
  invoke,
  introspect,
  isArr,
  isArrOf,
  isBoo,
  isDate,
  isFalse,
  isIntStr,
  isMap,
  isMapOf,
  isNaN,
  isNull,
  isNum,
  isObj,
  isSet,
  isSetOf,
  isStr,
  isTrue,
  isUndef,
  isUnit,
  kleisliComp,
  kleisliPipe,
  Last,
  lastAppend,
  lastAppendf,
  Lazy,
  lazyAp,
  lazyChain,
  lazyJoin,
  lazyMap,
  lazyOf,
  Left,
  leftPrism,
  Lens,
  lensComp,
  lensComp3,
  lensId,
  lensVarComp,
  _let,
  local,
  log,
  Loop,
  loop,
  LT,
  mapMap,
  mapper,
  match,
  matchCata,
  Matched,
  Max,
  max,
  maxEmpty,
  maxAppend,
  maxAppendf,
  Min,
  min,
  minAppend,
  minAppendf,
  minEmpty,
  neq,
  _new,
  None,
  not,
  NOT_FOUND,
  notp,
  notp2,
  notp3,
  numCompare,
  numEq,
  numNeq,
  numGt,
  numGtf,
  numGte,
  numGtef,
  numLt,
  numLtf,
  numLte,
  numLtef,
  objClone,
  objDel,
  objDelx,
  objEntries,
  objKeys,
  objLens,
  objModOr,
  objModOrx,
  objPathOr,
  objPrism,
  objSet,
  objSetx,
  objUnion,
  objUnionx,
  objValues,
  on,
  memoMethx,
  Option,
  optAp,
  optCata,
  optChain,
  optMap,
  optOf,
  or,
  throwOn,
  throwOnFalse,
  throwOnTrue,
  throwOnUnit,
  Parallel,
  parAll,
  parAnd,
  parAny,
  parAp,
  parAppend,
  parAppendf,
  parCata,
  parEmpty,
  parMap,
  parOf,
  parOr,
  partial,
  partialCurry,
  pipe,
  pipe3,
  Pred,
  predAppend,
  predAppendf,
  predContra,
  predEmpty,
  Prism,
  Prod,
  prodAppend,
  prodAppendf,
  prodEmpty,
  range,
  rangeSize,
  recur,
  Reader,
  readAp,
  readChain,
  readJoin,
  readMap,
  readOf,
  Right,
  rightPrism,
  round,
  roundBy,
  ScriptumError,
  select,
  select11,
  select1N,
  SemigroupError,
  setMap,
  snd,
  Some,
  State,
  stateChain,
  stateGet,
  stateGets,
  stateModify,
  stateOf,
  statePut,
  Step,
  strDel,
  strFold,
  strIsEmpty,
  strMatch,
  strMatchAll,
  strMatchLast,
  strMod,
  strSet,
  strPadl,
  strPadr,
  struct,
  structExt,
  structGetter,
  structMemo,
  structMemoExt,
  Sum,
  sumAppend,
  sumAppendf,
  sumEmpty,
  swapMultiArg,
  Task,
  tAnd,
  tAll,
  tAp,
  tCata,
  tChain,
  tChain2,
  That,
  These,
  These_,
  theseCata,
  This,
  thisify,
  _throw,
  tJoin,
  tLiftA2,
  tLiftM2,
  tMap,
  tOf,
  tramp,
  tryCatch,
  toFixedFloat,
  uncurry,
  uncurry3,
  uncurry4,
  uncurry5,
  union,
  unionGetter,
  UnionError,
  TAG,
  thd,
  TYPE,
  varAp,
  varArgs,
  varChain,
  varComp,
  varKleisliComp,
  varKleisliPipe,
  varLiftA,
  varLiftM,
  varPipe,
  verifyDate,
  Writer,
  writeCensor,
  writeChain,
  writeListen,
  writeListens,
  writeOf,
  writePass,
  writeTell,
};
