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
		var pref = { "ForceNewTabs" 			: "permaTabsPrefForceNewTabs",
					 "ForceNewTabsDomain" 		: "permaTabsPrefForceNewTabsDomain",
					 "HideAdditionalMenuItems" 	: "permaTabsPrefHideAdditionalMenuItems",
					 "SubMenu" 					: "permaTabsPrefSubMenu",
					 "Distinguish" 				: "permaTabsPrefDistinguish",
					 "LabelSet"					: "permaTabsPrefLabelSet",
					 "MacStyle"					: "permaTabsPrefMacStyle",
					 "ToggleKey"				: "permaTabsPrefToggleKeyActive",
					 "HomeKey"					: "permaTabsPrefHomeKeyActive" };

		for(i in pref)
		{
			var opt = document.getElementById(pref[i]);
			pref[i] = (opt.hasAttribute('checked') && opt.getAttribute('checked')=='true');
		}

		document.getElementById('permaTabsPrefForceNewTabsDomain').setAttribute('disabled', !pref['ForceNewTabs']);
		document.getElementById('permaTabsPrefAllowUrlbarDomain').setAttribute('disabled', (pref['ForceNewTabs'] && !pref['ForceNewTabsDomain']));
		document.getElementById('permaTabsPrefAllowSubDomains').setAttribute('disabled', !(pref['ForceNewTabs'] && pref['ForceNewTabsDomain']));
		
		document.getElementById('permaTabsPrefColor').setAttribute('disabled', !pref['Distinguish']);
		document.getElementById('permaTabsPrefColorTransparent').setAttribute('disabled', !pref['Distinguish']);
		document.getElementById('permaTabsPrefLabelColor').setAttribute('disabled', !pref['LabelSet']);
		document.getElementById('permaTabsPrefLabelColorTransparent').setAttribute('disabled', !pref['LabelSet']);

		document.getElementById('permaTabsPrefForceColor').setAttribute('disabled', pref['MacStyle']);
		if(pref['MacStyle'])
		{ document.getElementById('permaTabsPrefForceColor').setAttribute('checked', true); }
		
		document.getElementById('permaTabsPrefSubMenu').setAttribute('disabled', pref['HideAdditionalMenuItems']);
		document.getElementById('permaTabsPrefSubMenuExclude').setAttribute('disabled', (pref['HideAdditionalMenuItems'] || !pref['SubMenu']));
		document.getElementById('permaTabsPrefAskOverwrite').setAttribute('disabled', pref['HideAdditionalMenuItems']);

		document.getElementById('permaTabsPrefToggleKeyModificator').setAttribute('disabled', !pref['ToggleKey']);
		document.getElementById('PermaTabsPrefToggleKey').setAttribute('disabled', !pref['ToggleKey']);

		document.getElementById('permaTabsPrefHomeKeyModificator').setAttribute('disabled', !pref['HomeKey']);
		document.getElementById('PermaTabsPrefHomeKey').setAttribute('disabled', !pref['HomeKey']);
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
				//linux!!
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