function Class(p){
	var object = (p.initialize = p.initialize || function(){});
	object.prototype = p;
	return object;
}

function F(o, f, a){
	return function(){return f.apply(o, a || arguments)};
}

function log(m){
	if(window.console)
		console.log(m);
}

function warn(m){
	if(window.console)
		console.warn(m);
}

function isArray(obj) {
    return obj.constructor == Array;
}

function $(a){
	return document.getElementById(a);
}

function Each(e, f, bind){
	for(var k in e)
		f.call(bind, e[k], k);
}

function Every(a, f, bind){
	for(var i = 0; i < a.length; i++)
		f.call(bind, a[i], i);
}

function hide(){
	Every(arguments, function(e){
		(typeof(e) == "string" ? $(e) : e).style.display = "none";
	});
}

function show(){
	Every(arguments, function(e){
		(typeof(e) == "string" ? $(e) : e).style.display = "block";
	});
}

function toggle(s, e, e2){
	(s ? show : hide)(e);
	if(e2)
		(s ? hide : show)(e2);
}

function Inject(el, content){
	if(typeof(content) == "string"){
		el.appendChild(document.createTextNode(content));
	} else if(content){
		content.parentNode && content.parentNode.removeChild(content);
		el.appendChild(content);
	}
	return el;
}

function Replace(el, content){
	Clear(el);
	return Inject(el, content);
}

function Clear(e){
	for(var i = e.childNodes.length - 1; i >= 0; i--)
		e.removeChild(e.childNodes[i]);
}

function El(name, content, props){	
	var el = document.createElement(name);
	for(var i = 0; i < (content || []).length; i++){
		Inject(el, content[i]);
	}
	return Apply(el, props);
}

function Div(){
	return El("div", arguments);
}

function Span(){
	return El("span", arguments);
}

function B(){
	return El("b", arguments);
}

function Table(){
	var table = El("table", null, {cellSpacing: 0, cellPadding: 0, width: "100%"});
	var b = document.createElement("tbody");	
    for(var i = 0; i < arguments.length; i++){
       var r = document.createElement("tr");	   
	   for(var j = 0; j < arguments[i].length; j++){
		   r.appendChild( Inject(document.createElement("td"), arguments[i][j]) );
	   }
	   b.appendChild(r);
	}
    table.appendChild(b);
	return table;
}

function FormatTable(T, style, attr){
	if(attr == null && style == null)
		return T;
	Every(T.getElementsByTagName("tr"), function(tr){
		//var i = 0;
		if(tr.parentNode.parentNode != T)
			return;
		Every(tr.childNodes, function(e, i){
			if(e.nodeName.toLowerCase() == "td"){
				Apply(e, 			(attr 	|| {})[i]);
				Apply(e.style, 	(style 	|| {})[i]);
				//i++;
			}
		});
	});
	return T;
}


function Klass(k, o){
	o.className = k;
	return o;
}

function Apply(o, props, f){
	for(var k in props)
		if(typeof(f) != "function" || f(k, o[k], props[k]))
			o[k] = props[k];
	return o;	
}

function Extends(c1, c2){
	c1.prototype.super = function(func, params){
		this["__" + func].apply(this, params);
	};
	for(var k in c1.prototype)
		if(c2.prototype[k] == null)
			c2.prototype[k] = c1.prototype[k];
	return c2;
}

function Values(o){
	var a = [];
	for(var k in o)
		a.push(o[k]);
	return a;
}

function Keys(o){
	var a = [];
	for(var k in o)
		a.push(k);
	return a;
}

function Format(e, parent, style, attr){
	Each(style, function(v, k){
		e.style[k] = v;
	});
	parent ? parent.appendChild(e) : 0;
	return Apply(e, attr);
}

