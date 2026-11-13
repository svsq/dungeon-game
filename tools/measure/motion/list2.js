const Q=SCENE.QA();const re=/imp|golem|magma|lava|vent|salam|colos|priest|crust|gate|town|enter/;const f=(o)=>Object.keys(o||{}).filter(k=>re.test(k)).map(k=>k+':'+o[k].length);
return {c:f(Q.cycles),t:f(Q.transitions),l:f(Q.loops),s:Q.states.map(s=>s[0]).filter(k=>re.test(k)).length,sub:Object.keys(Q.subject).filter(k=>/colos|imp|golem/.test(k)).map(k=>k+'='+Q.subject[k])};
