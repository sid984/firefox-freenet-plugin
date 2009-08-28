var IMAP_Parser = new Class({

		events: {
			LOGIN: {
				OK: "onLogin",
				NO: "onLoginFailed"
			},
			SELECT: {
				OK: "onSelect",
				NO: "noMailbox"
			},
			CREATE: {
				OK: "onCreate"
			},
			FETCH: {
				OK: "onFetch"
			},
			STORE: {
				OK: "onStore"
			},
			EXPUNGE: {
				OK: "onExpunge"
			},
			APPEND: {
				OK: true
			},
			STATUS: {
				OK: "onStatus"
			}
		},
		
		matches: {
			SELECT: {
				exists: /(\d+)\sEXISTS/,
				recent: /(\d+)\sRECENT/
			},
			FETCH: {
				list: [
					/(\d+)\sFETCH\s+\(flags\s+\(([^)]*)\)\s+ENVELOPE\s+\((NIL|\".*?\")\s+(NIL|\".*?\")\s+\(\((.*?)\)\).*?\(\((.*?)\)\).*?\)\)$/i
				],
				contact: [
					/(\d+)\sFETCH\s+\(body\[[^\]]*\]\s+{(\d+)}$/i,
					2
				],
				mail: [
					/(\d+)\sFETCH\s*\(FLAGS\s*\((\S*)\)\s*INTERNALDATE\s*\"([^\"]+)\"\s*ENVELOPE\s*\((.*?)\)\s*BODY\[\]\s*\{(\d+)\}$/
					, 5 // 5th match - data
				]
			},
			STATUS: {
				unseen: /STATUS\s+\S+\s+\(Unseen\s(\d+)\)/i
			}
		},
		
		initialize: function(request, prefix, eventCallback, finishCallback){
			this.index = 0;
			this.matched = [];
			this.data = "";
			this.tmp = "";
			this.request = request;
			this.prefix = prefix;
			this.eventCallback = eventCallback;
			this.finishCallback = finishCallback;
		},
		
		parse: function(data){
			try {
				this.data += data;
				this.tmp = data;
				var line;
				var finished = false;
				while((line = this.get_line()) != null){
					//log("line: " + line);
					//this.match_data(line);
					finished |= this.match_status(line);	
				}
				
				if(finished){
					this.finishCallback();
					
					log("Parsing data...");
					
					this.tmp = this.data;
					while((line = this.get_line()) != null){
						//log("!!line: " + line);
						var match = this.match_data(line);
						if(match){
							if(match.data_length > 0){
								// read next `match.data_length` characters >> match.data
								log("reading " + match.data_length + " chars to data...");
								match.data = this.tmp.substring(0, match.data_length);
								this.tmp = this.tmp.substring(match.data_length);
							}
							this.matched.push(match);
						}
					}
					
					var handler = this.events[this.request.command];
					if(handler && handler[this.code])
						this.eventCallback(
							handler[this.code],
							this.message,
							this.matched,
							this.request
						);
					else
						log("NO HANDLER FOUND FOR COMMAND '" + this.request.command + "' WITH CODE '" + this.code + "'");
				}
			}catch(e){
				log("Parse error: " + e);
				warn(e);
			}
		},
		
		get_line: function(){
			var length = this.tmp.indexOf("\n");
			//log("length: " + length);
			if(length == -1)
				return null;
			var line = this.tmp.substring(0, length - 1); // length); ???
			this.tmp = this.tmp.substring(length + 1);
			return line;
		},
		
		match_status: function(line){
			var re = new RegExp(this.prefix + "([A-Z]+) (.*)$");
			var m;
			if(m = re.exec(line)){
				this.code = m[1];
				this.message = m[2];
				//log("code: " + this.code);
				//log("message: " + this.message);
				return true;
			}
			return false;
		},
		
		match_data: function(line){
			if(line.charAt(0) != '*')
				return;
			var matches = this.matches[this.request.command];
			if(matches == null)
				return;
			line = line.substring(2);
			
			for(var k in matches){
				var m;
				var re 	= isArray(matches[k]) ? matches[k][0] : matches[k];
				var ext 	= isArray(matches[k]) ? matches[k][1] :null;
				if(m = re.exec(line)){
					var match = {
						name: k,
						matches: m.length > 2 ? m.slice(1) : m[1],
						data: null,
						data_length: null
					};
					if(ext && m[ext] != null){
						match.data_length = Number(m[ext]);
					}
					return match;
				}
			}
		}
		
});