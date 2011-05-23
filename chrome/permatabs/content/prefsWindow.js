function PrefsWindow()
{
	this.sync = function()
	{
		var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		var prefWindow = document.getElementById('permaTabsPrefWindow');
		var elms = prefWindow.getElementsByAttribute("pref", "*");

		for(var i = 0; i < elms.length; i++)
		{
			switch(elms[i].localName)
			{
				case 'checkbox':
					elms[i].setAttribute('checked', prefs.getBoolPref(elms[i].getAttribute('pref')));
					break;

				case 'colorpicker':
					elms[i].setAttribute('color', prefs.getCharPref(elms[i].getAttribute('pref')));
					elms[i].color = prefs.getCharPref(elms[i].getAttribute('pref'));
					break;

				case 'radio':
					elms[i].parentNode.setAttribute('selectedItem', elms[i]);
					break;
			}
		}

        document.getElementById('permaTabsPrefAllowUrlbarDomain').setAttribute('disabled', (prefs.getBoolPref('extensions.permatabs.forceNewTabs') && !prefs.getBoolPref('extensions.permatabs.forceNewTabsDomain')));
		document.getElementById('permaTabsPrefForceNewTabsDomain').setAttribute('disabled', !prefs.getBoolPref('extensions.permatabs.forceNewTabs'));
		document.getElementById('permaTabsPrefSubMenuExclude').setAttribute('disabled', !prefs.getBoolPref('extensions.permatabs.subMenu'));
		document.getElementById('permaTabsPrefColor').setAttribute('disabled', !prefs.getBoolPref('extensions.permatabs.distinguish'));
	};

	this.save = function()
	{
		var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		var prefWindow = document.getElementById('permaTabsPrefWindow');
		var elms = prefWindow.getElementsByAttribute("pref", "*");

		for(var i = 0; i < elms.length; i++)
		{
			switch(elms[i].localName)
			{
				case 'checkbox':
					var checked = elms[i].hasAttribute('checked') && elms[i].getAttribute('checked') == 'true';
					prefs.setBoolPref(elms[i].getAttribute('pref'), checked);
					break;

				case 'colorpicker':
					prefs.setCharPref(elms[i].getAttribute('pref'), elms[i].getAttribute('color'));
					break;

				case 'radio':
					var checked = elms[i].hasAttribute('selected') && elms[i].getAttribute('selected') == 'true';
					prefs.setBoolPref(elms[i].getAttribute('pref'), checked);
					break;
			}
		}

		var wm = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
		var en = wm.getEnumerator("");
		
		while (en.hasMoreElements())
		{
			var w = en.getNext();
			if(w.permaTabs && w.permaTabs.initialized)
			w.permaTabs.colorPermaTabs();
		}
	};
}
this.prefsWindow = new PrefsWindow;