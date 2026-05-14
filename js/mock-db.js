/**
 * 테스트용 Mock DB — localStorage로 Firebase Firestore API를 흉내냄
 * 실제 Firebase로 전환 시 이 파일 로드를 제거하면 됩니다.
 */
(function () {
  window.MOCK_MODE = true;

  // ── 스토리지 헬퍼 ──────────────────────────────────────────────
  function loadCol(name) {
    try { return JSON.parse(localStorage.getItem('mockdb_' + name) || '{}'); }
    catch { return {}; }
  }
  function saveCol(name, data) {
    localStorage.setItem('mockdb_' + name, JSON.stringify(data));
  }
  function deepCopy(v) { return JSON.parse(JSON.stringify(v)); }

  // ── 구독 시스템 ────────────────────────────────────────────────
  const _listeners = {};
  function subscribe(col, fn) {
    if (!_listeners[col]) _listeners[col] = [];
    _listeners[col].push(fn);
    return () => { _listeners[col] = _listeners[col].filter(f => f !== fn); };
  }
  function notify(col) {
    (_listeners[col] || []).forEach(fn => setTimeout(fn, 0));
  }

  // ── FieldValue ─────────────────────────────────────────────────
  class FV {
    constructor(t, v) { this._t = t; this._v = v; }
  }

  function applyFV(existing, updates) {
    const result = deepCopy(existing || {});
    for (const [k, v] of Object.entries(updates)) {
      if (v instanceof FV) {
        if (v._t === 'increment') {
          result[k] = (result[k] || 0) + v._v;
        } else if (v._t === 'arrayUnion') {
          const arr = Array.isArray(result[k]) ? [...result[k]] : [];
          for (const item of v._v) {
            if (!arr.includes(item)) arr.push(item);
          }
          result[k] = arr;
        } else if (v._t === 'ts') {
          result[k] = new Date().toISOString();
        }
      } else {
        result[k] = v;
      }
    }
    return result;
  }

  // ── DocRef ─────────────────────────────────────────────────────
  class DocRef {
    constructor(col, id) { this._col = col; this._id = id; }

    async get() {
      const d = loadCol(this._col)[this._id];
      return { exists: d !== undefined, id: this._id, data: () => d ? deepCopy(d) : null };
    }

    async set(data) {
      const col = loadCol(this._col);
      col[this._id] = applyFV({}, data);
      saveCol(this._col, col);
      notify(this._col);
      return this;
    }

    async update(data) {
      const col = loadCol(this._col);
      if (!col[this._id]) {
        // 없으면 생성 (관대하게 처리)
        col[this._id] = {};
      }
      col[this._id] = applyFV(col[this._id], data);
      saveCol(this._col, col);
      notify(this._col);
    }

    async delete() {
      const col = loadCol(this._col);
      delete col[this._id];
      saveCol(this._col, col);
      notify(this._col);
    }

    onSnapshot(callback) {
      const fire = () => {
        const d = loadCol(this._col)[this._id];
        callback({ exists: d !== undefined, id: this._id, data: () => d ? deepCopy(d) : null });
      };
      fire();
      return subscribe(this._col, fire);
    }
  }

  // ── Query / Collection ─────────────────────────────────────────
  class Query {
    constructor(col, filters = [], order = null) {
      this._col = col;
      this._filters = filters;
      this._order = order;
    }

    where(field, op, value) {
      return new Query(this._col, [...this._filters, { field, op, value }], this._order);
    }

    orderBy(field, dir = 'asc') {
      return new Query(this._col, this._filters, { field, dir });
    }

    _run() {
      const col = loadCol(this._col);
      let docs = Object.entries(col).map(([id, data]) => ({ id, ...deepCopy(data) }));
      for (const { field, op, value } of this._filters) {
        docs = docs.filter(d => {
          const v = d[field];
          if (op === '==')  return v === value;
          if (op === '!=')  return v !== value;
          if (op === '>')   return v > value;
          if (op === '>=')  return v >= value;
          if (op === '<')   return v < value;
          if (op === '<=')  return v <= value;
          return true;
        });
      }
      if (this._order) {
        const { field, dir } = this._order;
        docs.sort((a, b) => {
          const av = a[field] ?? 0, bv = b[field] ?? 0;
          return dir === 'desc' ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
        });
      }
      return docs;
    }

    _toSnap(docs) {
      return {
        docs: docs.map(({ id, ...rest }) => ({
          id, exists: true,
          data: () => deepCopy(rest),
        })),
        empty: docs.length === 0,
      };
    }

    async get() { return this._toSnap(this._run()); }

    onSnapshot(callback) {
      const fire = () => callback(this._toSnap(this._run()));
      fire();
      return subscribe(this._col, fire);
    }
  }

  class Collection extends Query {
    constructor(name) { super(name); }

    doc(id) { return new DocRef(this._col, id || _uid()); }

    async add(data) {
      const ref = new DocRef(this._col, _uid());
      await ref.set(data);
      return ref;
    }
  }

  // ── Transaction / Batch ────────────────────────────────────────
  class Tx {
    constructor() { this._ops = []; }
    update(ref, data) { this._ops.push(['update', ref, data]); }
    set(ref, data)    { this._ops.push(['set',    ref, data]); }
    async _commit() {
      for (const [t, ref, data] of this._ops) {
        if (t === 'update') await ref.update(data);
        else                await ref.set(data);
      }
    }
  }

  class Batch {
    constructor() { this._ops = []; }
    update(ref, data) { this._ops.push(['update', ref, data]); }
    set(ref, data)    { this._ops.push(['set',    ref, data]); }
    delete(ref)       { this._ops.push(['delete', ref]);       }
    async commit() {
      for (const [t, ref, data] of this._ops) {
        if (t === 'update') await ref.update(data);
        else if (t === 'set') await ref.set(data);
        else await ref.delete();
      }
    }
  }

  // ── 유틸 ──────────────────────────────────────────────────────
  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ── 전역 노출 ──────────────────────────────────────────────────
  window.db = {
    collection: name => new Collection(name),
    runTransaction: async fn => { const tx = new Tx(); await fn(tx); await tx._commit(); },
    batch: () => new Batch(),
  };

  window.firebase = window.firebase || {};
  window.firebase.firestore = window.firebase.firestore || {};
  window.firebase.firestore.FieldValue = {
    increment:       n    => new FV('increment', n),
    arrayUnion:      (...v) => new FV('arrayUnion', v),
    serverTimestamp: ()   => new FV('ts', null),
  };

  // ── 테스트 데이터 시드 함수 (콘솔에서 seedTestData() 호출) ─────
  window.seedTestData = async function () {
    // 장소 3개
    const locations = [
      {
        name: '분수대 앞',
        lat: 37.5665, lng: 126.9780,
        enabled: true,
        quiz: {
          question: '대한민국의 수도는 어디인가요?',
          options: ['부산', '서울', '인천', '대전'],
          correctIndex: 1,
          points: 100,
        },
      },
      {
        name: '카페 테라스',
        lat: 37.5670, lng: 126.9790,
        enabled: true,
        quiz: {
          question: '2024년 파리 올림픽에서 한국이 획득한 금메달 수는?',
          options: ['10개', '12개', '13개', '8개'],
          correctIndex: 2,
          points: 150,
        },
      },
      {
        name: '광장 입구',
        lat: 37.5658, lng: 126.9770,
        enabled: true,
        quiz: {
          question: '한국의 국화(나라꽃)는 무엇인가요?',
          options: ['장미', '벚꽃', '무궁화', '진달래'],
          correctIndex: 2,
          points: 120,
        },
      },
    ];

    for (const loc of locations) {
      await db.collection('locations').add(loc);
    }

    // QR 코드 2개
    await db.collection('qrcodes').doc('test-qr-001').set({
      label: '테스트 QR 1번',
      points: 50,
      enabled: true,
      usedBy: [],
    });
    await db.collection('qrcodes').doc('test-qr-002').set({
      label: '테스트 QR 2번',
      points: 80,
      enabled: true,
      usedBy: [],
    });

    console.log('✅ 테스트 데이터가 추가됐어요!');
    alert('테스트 데이터 추가 완료!\n장소 3개 + QR 코드 2개');
  };

  // ── 초기화 로그 ────────────────────────────────────────────────
  console.log('%c🧪 Mock DB (테스트 모드) 실행 중', 'color:#3b82f6; font-weight:bold; font-size:14px;');
  console.log('브라우저 콘솔에서 seedTestData() 를 실행하면 테스트 데이터가 추가됩니다.');
})();
