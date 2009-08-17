var _Freemail = new Class({

		port: 3143,
		
		autologin: null, //{login: "", password: ""},
		
		initialize: function(){
			
			window.WIDTH = window.innerWidth;
			window.HEIGHT = window.innerHeight;
	
			hide("auth-box");
			
			this.logged = false;
			this.imap = new IMAP_Client("/proxy", this.port);
			this.imap.onStatus = F(this, function(status, data){
				//log("onStatus: " + status);
				switch(status){
					case "connected":
						this.onStatus(true);
						break;
					case "ready":
						if(this.autologin)
							this.login(this.autologin.login, this.autologin.password);
						break;
					case "disconnected":
						this.onStatus(false);
						break;
					case "logged":
						this.onLogin(data);
						break;
					case "total":
						this.onMailboxTotal(data.exists, data.recent);
						break;
					case "data":
						this.onMailboxData(data);
						break;
					case "mail":
						this.onFetch(data);
						break;						
				}
			});
			this.imap.connect();
		},
		
		login: function(login, password){
			this.imap.login(
				this.user_login 			= login 			|| $("freemail-login").value,
				this.user_password	= password 	|| $("freemail-password").value
			);
		},
		
		logout: function(){
			this.imap.logout();
			hide("auth-box");
			show("login-box");
		},
		
		onLogin: function(logged){
			if(logged){
				$("logged-in").innerHTML = this.user_login; 
				show("auth-box");
				hide("login-box");
				this.switch_to("inbox");
			} else {
				$("status").innerHTML = "Login failed";
			}
		},
		
		onStatus: function(connected){
			$("status").innerHTML = connected
				? "" // ? "Connected to IMAP server on localhost:" + this.port
				: "Failed to connect to IMAP server on localhost:" + this.port;
		},
		
		onMailboxTotal: function(exists, recent){
			$("total").innerHTML = exists + " messages " + (recent > 0 ? "(" + recent + " new)" : "");
		},
		
		onMailboxData: function(list){
			var maillist = $("mail-list");
			Clear(maillist);
			for(var i = 0; i < list.length; i++){
				var item = Format(Table([
					Klass("number", Div(list[i].id)),
					Klass("from", Div(list[i].ShortFrom || list[i].From)),
					Klass("subject", Div(list[i].Subject)),
					Klass("date", Div(list[i].Date))
				]), null, {
					//width: window.WIDTH - 2
				}, {
					className: "item"
				});
				FormatTable(item, [
					{width: 50},
					{width: 500},
					null,
					{width: 240}
				]);
				item.onclick = F(this, this.openMail, [item, list[i].id]);
				item.onmouseover = function(){
					this.className = "item hover";
				};
				item.onmouseout = function(){
					this.className = "item";
				};
				Inject(maillist, item);
			}
		},
		
		onFetch: function(mail){
			this.switch_to(null, "mail");
			this.current_mail = mail;
			var e = $("mail-body");
			Clear(e);
			
			// headers
			var headers = Klass("mail-headers", Div());
			for(var k in mail.headers){
				Inject(headers, Div(B(k + ": "), mail.headers[k]));
			}			
			Inject(e, headers);
			
			// attach
			if((mail.attachments || []).length > 0){
				var link = El(
					"button",
					[Span("attachments: " + mail.attachments.length)],
					{onclick: function(){alert("Not implemented")}}
				);
				var attach = Klass("mail-headers", Div(link));
				Inject(e, attach);
			}
			
			// body
			var pre = El("pre", mail.body);
			Inject(e, pre);
			
			log(mail);
		},
		
		openMail: function(div, id){
			this.imap.fetch(id);
		},
		
		closeMail: function(){
			this.switch_to(null, "list");
		},
		
		
		sendMail: function(){
			this.smpt = new SMTP_Client("/proxy", 3025, this.user_login, this.user_password);
			this.smpt.onStatus =  F(this, function(status, data){
				log("onStatus: " + status);
				var el = $("new-mail-status");
				switch(status){
					case "sending":
						el.innerHTML = "Sending...";
						break;
					case "success":
						el.innerHTML = "Sent successfully";
						break;
					case "error":
						el.innerHTML = "Error: " + data;
						break;
				}
			});
			var from = $("new-mail-from").value;
			var to = $("new-mail-to").value;
			var mail = {
				from: from,
				to: to,
				text: $("new-mail-body").value,
				headers: {
					From: from,
					To: to,
					Subject: $("new-mail-subject").value
				}
			};
			if(from == "")
				this.smpt.onStatus("error", "From field is empty");
			else if(to == "")
				this.smpt.onStatus("error", "To field is empty");
			else
				this.smpt.send(mail);
		},
		
		newMail: function(from, to, subject, body){
			$("new-mail-from").value = from || "";
			$("new-mail-to").value = to || "";
			$("new-mail-subject").value = subject || "";
			$("new-mail-body").value = body || "";
		},
		
		write: function(){
			this.newMail();
			this.switch_to("write");
		},
		
		reply: function(){
			var headers = this.current_mail.headers;
			var body = "> " + this.current_mail.body.replace(/\r\n/g, "\r\n> ");
			this.newMail(headers.To, headers.From, "Re: " + headers.Subject, body);
			this.switch_to("write");
		},
		
		inbox: function(){
			this.switch_to("inbox");
		},
		
		outbox: function(){
			alert("Not implemented");
		},
		
		switch_to: function(block, subblock){
			this.current_block = block || this.current_block;
			
			var blocks = {
				write: "freemail-block-write",
				inbox: "freemail-block-inbox",
				outbox: "freemail-block-outbox"
			};
			var subblocks = {
				inbox: {
					mail: "freemail-inbox-mail",
					list: "freemail-inbox-list",
				},
				_default: {
					inbox: "list"
				} 
			};
			if(subblocks[this.current_block] != null){
				var bb = subblocks[this.current_block];
				hide.apply(null, Values(bb));
				show(subblock != null ? bb[subblock] : bb[subblocks._default[this.current_block]]);
			}
			
			if(block != null){
				hide.apply(null, Values(blocks));
				show(blocks[this.current_block = block]);
			}
		}
		
});