function PrefsWindow()
{
	this.onLoad = function()
	{
		this.transparency('permaTabsPrefColor');
		this.transparency('permaTabsPrefLabelColor');

		this.disablefields();
	};

	this.onSave = function()
	{
		var wm = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
		var en = wm.getEnumerator("");
		
		while(en.hasMoreElements())
		{
			var w = en.getNext();
			if(w.permaTabs && w.permaTabs.initialized)
			{
				w.permaTabs.colorPermaTabs();
				w.permaTabs.setToolbarButtonType();
			}
		}
	};
	
	this.disablefields = function()
	{
		var pref = {
			"Distinguish"				: "permaTabsPrefDistinguish",
			"LabelSet"					: "permaTabsPrefLabelSet",
			"ToggleKey"					: "permaTabsPrefToggleKeyActive",
			"HomeKey"					: "permaTabsPrefHomeKeyActive",
			"SetHomeKey"				: "permaTabsPrefSetHomeKeyActive"
		 };

		for(i in pref)
		{
			var opt = document.getElementById(pref[i]);
			pref[i] = (opt.hasAttribute('checked') && opt.getAttribute('checked')=='true');
		}

		document.getElementById('permaTabsPrefColor').setAttribute('disabled', !pref['Distinguish']);
		document.getElementById('permaTabsPrefColorTransparent').setAttribute('disabled', !pref['Distinguish']);
		document.getElementById('permaTabsPrefLabelColor').setAttribute('disabled', !pref['LabelSet']);
		document.getElementById('permaTabsPrefLabelColorTransparent').setAttribute('disabled', !pref['LabelSet']);

		document.getElementById('permaTabsPrefToggleKeyModificator').setAttribute('disabled', !pref['ToggleKey']);
		document.getElementById('PermaTabsPrefToggleKey').setAttribute('disabled', !pref['ToggleKey']);

		document.getElementById('permaTabsPrefHomeKeyModificator').setAttribute('disabled', !pref['HomeKey']);
		document.getElementById('PermaTabsPrefHomeKey').setAttribute('disabled', !pref['HomeKey']);

		document.getElementById('permaTabsPrefSetHomeKeyModificator').setAttribute('disabled', !pref['SetHomeKey']);
		document.getElementById('PermaTabsPrefSetHomeKey').setAttribute('disabled', !pref['SetHomeKey']);
	};
	
	this.transparency = function(id, toggle)
	{
     	var colorpicker = document.getElementById(id);
     	var button = document.getElementById(id+'Transparent');
     	
		if(toggle)
		{
			document.getElementById(colorpicker.getAttribute("preference"))._setValue('transparent');
			colorpicker.color = 'transparent';

			if(document.getElementById(colorpicker.getAttribute("preference")).instantApply)
			{
				//linux/mac!! what now?
			}
		}

		button.setAttribute('checked', (colorpicker.getAttribute('color')=="transparent"));
	};
	
	this.closeAllPermaTabs = function()
	{
		var wm = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
		var en = wm.getEnumerator("");

		while(en.hasMoreElements())
		{
			var w = en.getNext();
			if(w.permaTabs && w.permaTabs.initialized)
			{
				w.permaTabs.closeAllPermaTabs(false, window);
			}
		}
	}
}

this.prefsWindow = new PrefsWindow;
