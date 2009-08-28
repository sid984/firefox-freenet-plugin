var _Freemail = new Class({

		port: 3143,
		
		autologin: null, // {login: "test", password: "test"},
		
		initialize: function(){
			
			window.WIDTH = window.innerWidth;
			window.HEIGHT = window.innerHeight;
	
			this.header = {};
			this.mailbox = "inbox";
			this.data = {
				inbox: {},
				outbox: {},
				contacts: {}
			};
			
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
						//this.onMailboxTotal(data.mailbox, data.exists, data.recent);
						break;
					case "data":
						this.onMailboxData(data.mailbox, data.list);
						break;
					case "mail":
						this.onFetch(data);
						break;
					case "unseen":
						if(this.unseen != null && this.unseen < data)
							this.onNewMail();
						this.unseen = data;
						break;
					/*
					case "deleted":
						this.switch_to(this.current_block);
						break;
					*/
					case "block":
						$("indicator").style.backgroundColor = data ? "red" : "green";
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
				this.imap.fetchMailbox("inbox");
				this.imap.fetchMailbox("contacts");
			} else {
				$("status").innerHTML = "Login failed";
			}
		},
		
		onStatus: function(connected){
			$("status").innerHTML = connected
				? "" // ? "Connected to IMAP server on localhost:" + this.port
				: "Failed to connect to IMAP server on localhost:" + this.port;
		},
		
		onMailboxTotal: function(mailbox, exists, recent){
			var title = mailbox == "contacts"
				? exists + " contacts"
				: exists + " messages " + (recent > 0 ? " (" + recent + " new)" : "");
			var opts = mailbox == "contacts"
				? [A("My Info", F(this ,this.openContact, [-1])), A("Add Contact", F(this, this.openContact))]
				: null;
			this.setHeader(mailbox, title, opts);
		},
		
		setHeader: function(mailbox, title, opts){
			//if(title)
				this.header.title = title;
			//if(opts)
				this.header.opts = opts;
			
			var e = $$(".total", $("freemail-block-" + mailbox))[0];
			var table = FormatTable(
				Table([
					this.header.title,
					this.header.opts ? "|" : "",
					Klass("opts", Div.apply(null, this.header.opts))
				]),
				[
					{width: "49%", textAlign: "right"},
					{width: "2%", textAlign: "center"},
					{width: "49%", textAlign: "left"}
				]
			);
			
			Replace(e, table);
		},
		
		// mailbox = inbox | outbox | contacts
		onMailboxData: function(mailbox, list){
			var self = this;
			var maillist = $$(".mailbox-list", $("freemail-block-" + mailbox))[0];
			Clear(maillist);
			var recent = 0;
			
			Every(list, function(item){
				this.data[mailbox][item.id] = item;
			}, this);
			
			if(mailbox == "contacts"){
				
				list = list.sort(function(a, b){
					return a.Name.toLowerCase() > b.Name.toLowerCase() ? 1: -1;
				});
				for(var i = 0; i < list.length; i++){
					var write_button;
					var item = Format(Table([
						Div(list[i].Name),
						Div(list[i].Mail),
						Div(list[i].Short),
						Div(write_button = A("write"))
					]), null, null, {
						className: "contact"
					});
				
					FormatTable(item, [
						{width: 300},
						{width: 400},
						null,
						{width: 60}
					]);
				
					item._id = write_button._id = list[i].id;
					item.onclick = function(e){
						if(!e.cancel)
							self.openContact(this._id);
						return false;
					}
					write_button.onclick = function(e){
						e.cancel = true;
						self.writeToContact(this._id);
						return false;
					}
					Inject(maillist, item);
				}
				
			// inbox | oubox
			} else {
				
				list = list.sort(function(a, b){
					return Number(a.id) < Number(b.id);
				});
				
				for(var i = 0; i < list.length; i++){
					var mail = list[i];
					var delete_button;
					var from = mail.from.name != null
						? mail.from.name + " <" + mail.from.mail + ">"
						: mail.from.mail;
					var to = mail.to.name != null
						? mail.to.name + " <" + mail.to.mail + ">"
						: mail.to.mail;
						
					var item = Format(Table([
						Klass("number", Div(flagged_button = Img(mail.flags.Flagged ? "/img/flagged.png" : "/img/unflagged.png"))),
						Klass("address", Div(mailbox == "inbox" ? from : to)),
						Klass("subject", Div(mail.subject)),
						Klass("date", Div(this.parseDate(mail.date))),
						Klass("delete", Div(delete_button = Img("/img/delete1.png", "Delete mail")))
					]), null, {
						//width: window.WIDTH - 2
					}, {
						className: "item" + (mail.flags.Seen ? "" : " new")
					});
					
					FormatTable(item, [
						{width: 50},
						{width: 500},
						null,
						{width: 240},
						{width: 30}
					]);
					
					item._id = delete_button._id = flagged_button._id = mail.id;
					flagged_button._flagged = mail.flags.Flagged;
					item.onclick = function(e){
						if(!e.cancel)
							self.openMail(this, this._id);
						return false;
					}
					/*
					item.onmouseover = function(){
						this.className = "item hover";
					};
					item.onmouseout = function(){
						this.className = "item";
					};
					*/
					delete_button.onclick = function(e){
						e.cancel = true;
						self.deleteMail(this, this._id);
						return false;
					}
					delete_button.onmouseover = function(){
						this.src = "/img/delete2.png";
					}
					delete_button.onmouseout = function(){
						this.src = "/img/delete1.png";
					}
					flagged_button.onclick = function(e){
						e.cancel = true;
						this._flagged = !this._flagged;
						this.src = this._flagged ? "/img/flagged.png" : "/img/unflagged.png";
						self.markFlagged(this._id, this._flagged);
						return false;
					}
					Inject(maillist, item);
					
					recent += mail.flags.Seen ? 0 : 1;
				}
			}
			
			this.onMailboxTotal(mailbox, list.length, recent);
		},
		
		onNewMail: function(){
			warn("New mail");
			this.imap.fetchMailbox("inbox");
		},
		
		onFetch: function(mail){
			this.switch_to("mail");
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
			
			var address = mail.headers[mail.mailbox == "inbox" ? "From" : "To"];
			mail.contact = this.findContact(address);
			$("mail-add-contact").style.display = mail.contact ? "none" : "inline";
			
			if(mail.headers.Subject == "Welcome to Freemail!" 
					&& mail.headers.From == "Dave Baker <dave@dbkr.freemail>"){
				this.saveMyInfo("Long", mail.headers.To);
			}
		},
		
		saveMyInfo: function(type, address){
			var contact = this.getMyInfo() || {Type: "self"};
			if(!contact[type] && confirm("Address " + address + " will be added to 'My Info'")){
				contact[type] = address;
				this.imap.saveContact(contact);
			}
		},
		
		getMyInfo: function(){
			for(var k in this.data.contacts)
				if(this.data.contacts[k].Type == "self")
					return this.data.contacts[k];
		},
		
		parseAddress: function(address){
			var res = {};
			if(m = /(.*)\s*<(.*?)>$/.exec(address)){
				return {address: m[2], name: m[1]};
			} else {
				return {address: address};
			}
		},
		
		composeAddress: function(contact){
			return contact.Name
				? contact.Name + " <" + contact.Long + ">"
				: contact.Long;
		},
		
		findContact: function(address){
			address = this.parseAddress(address).address;
			for(var k in this.data.contacts)
				if(this.data.contacts[k].Long == address || this.data.contacts[k].Short == address)
					return this.data.contacts;
		},
		
		openContact: function(id){
			// open My Info
			if(id == -1){
				
				this.contact = this.getMyInfo() || {Type: "self"};
				
			// add contact from mail
			} else if(id == -2){
			
				var contact = this.parseAddress(this.current_mail.headers[
					this.current_mail.mailbox == "inbox" ? "From" : "To"
				]);
				var type = contact.address.match(/([\w\d\_]+\@)([\w\d\_]{30,154})(\.freemail)/) ? "Long" : "Short";
				this.contact = {Name: contact.name};
				this.contact[type] = contact.address;
				
			// edit existing contact
			} else {
				
				this.contact = this.data.contacts[id] || {};
				
			}
			
			$("contact-name").value 		= this.contact.Name 	|| "";
			$("contact-long").value 		= this.contact.Long 	|| "";
			$("contact-short").value 		= this.contact.Short 	|| "";
			$("contact-notes").value 	= this.contact.Notes 	|| "";
			$("contact-type").value 		= this.contact.Type 	|| "";
			this.switch_to("contact");
		},
		
		deleteContact: function(){
			if(this.contact){
				this.imap.removeContact(this.contact.id, F(this, this.contacts));
			}
		},
		
		writeToContact: function(id){
			var contact = this.data.contacts[id];
			if(contact){
				this.newMail(null, this.composeAddress(contact));
				this.switch_to("write");
			}
		},
		
		saveContact: function(){
			Apply(this.contact, {
				Name: 	$("contact-name").value,
				Long: 		$("contact-long").value,
				Short: 		$("contact-short").value,
				Notes:	$("contact-notes").value,
				Type:		$("contact-type").value
			});
			this.imap.saveContact(this.contact, F(this, function(){
				this.switch_to("contacts");	
			}));
		},
		
		markFlagged: function(id, flagged){
			this.imap.store(id, flagged, "Flagged");
		},
		
		openMail: function(div, id){
			div.className = "item";
			this.imap.fetch(id, this.mailbox);
		},
		
		deleteMail: function(item, id){
			this.imap.remove(id, F(this, this.inbox));
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
						// saving to outbox
						this.imap.addMail("outbox", data);
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
					Subject: $("new-mail-subject").value,
					Date: this.formatDate()
				}
			};
			if(from == "")
				this.smpt.onStatus("error", "From field is empty");
			else if(to == "")
				this.smpt.onStatus("error", "To field is empty");
			else
				this.smpt.send(mail);
		},
		
		formatDate: function(){
			return (new Date()).toUTCString();
		},
		
		parseDate: function(str){
			var date = Date.parse(str);
			if(isNaN(date))
				return str;
			var d = new Date();
			d.setTime(date);
			return d.toLocaleString();
		},
		
		newMail: function(from, to, subject, body){
			$("new-mail-from").value = from || "";
			$("new-mail-to").value = to || "";
			$("new-mail-subject").value = subject || "";
			$("new-mail-body").value = body || "";
		},
		
		write: function(){
			var my = this.getMyInfo();
			var address = my ? this.composeAddress(my) : null;
			this.newMail(address);
			this.switch_to("write");
		},
		
		reply: function(){
			var headers = this.current_mail.headers;
			var inbox = this.current_mail.mailbox == "inbox";
			var body = "> " + this.current_mail.body.replace(/\r\n/g, "\r\n> ");
			this.newMail(
				inbox ? headers.To : headers.From,
				inbox ? headers.From : headers.To,
				"Re: " + headers.Subject,
				body
			);
			this.switch_to("write");
		},
		
		inbox: function(){
			this.mailbox = "inbox"; 
			this.imap.fetchMailbox(this.mailbox, F(this, this.switch_to, [this.mailbox]));
		},
		
		outbox: function(){
			this.mailbox = "outbox";
			this.imap.fetchMailbox(this.mailbox, F(this, this.switch_to, [this.mailbox]));
		},
		
		contacts: function(){
			this.mailbox = "contacts";
			this.imap.fetchMailbox(this.mailbox, F(this, this.switch_to, [this.mailbox]));
		},
		
		back: function(){
			this.switch_to(this.mailbox);
		},
		
		switch_to: function(block, subblock){
			this.current_block = block || this.current_block;
			
			var blocks = {
				write: 			"freemail-block-write",
				inbox: 			"freemail-block-inbox",
				outbox: 		"freemail-block-outbox",
				mail: 			"freemail-block-mail",
				contacts:	"freemail-block-contacts",
				contact:		"freemail-block-contact"
			};
			/*
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
			*/
			if(block != null){
				hide.apply(null, Values(blocks));
				show(blocks[this.current_block = block]);
			}
		}
		
});