const Q=SCENE.QA();const f=(o)=>Object.keys(o||{}).filter(k=>/imp|golem|magma|lava|vent|salam/.test(k)).map(k=>k+':'+o[k].length);
return {c:f(Q.cycles),t:f(Q.transitions),l:f(Q.loops),s:Q.states.map(s=>s[0]).filter(k=>/imp|golem|vent|magma_(lava|fall|rock|fog|ford|enter)/.test(k)),sub:Object.keys(Q.subject).filter(k=>/imp|golem/.test(k)).map(k=>k+'='+Q.subject[k])};
