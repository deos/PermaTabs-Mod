/*
PermaTabs Mod
Turn Firefox tabs of your choice into permanent tabs. PermaTabs can't be closed accidentally
no matter what you click (even actions like "Close other tabs" will not affect them) and
will stick around between sessions.

Copyright (C) 2009 deos

This program is free software; you can redistribute it and/or modify it under the terms of the
GNU General Public License as published by the Free Software Foundation; either version 3 of
the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program;
if not, see <http://www.gnu.org/licenses/>.
*/


// permatabs : 1.7.0
// contact   : david@donesmart.com
// copyright : 2006-2007 donesmart ltd

// modifications by deos, 2008 - 2011
// bump to version Mod 2.0.0
// contact: deos.dev@gmail.com
//
// known issues:
// - there are firefox bugs which can lead to loosing all app tabs, which means permatabs are gone too
// - if this addon might crash or gets disabled, all permatabs gets normal app tabs
//
// hidden options:
// - Do not aks before closing all PermaTabs:		extensions.permatabs.doNotPromptOnCloseAllPermaTabs		default: false


var permaTabs = {
	
	version: [2,0,0],
	prevVersion: false,
	initialized: false,
	prefs: null,
	tabContextMenu: null,

	tempAllowed: false,
	addonsInstalled: {},
	wrappedFunctions: {},


	init: function(){
		if(this.initialized){
			return;
		}

		//start this script only once per window
		this.initialized = true;
		window.removeEventListener('load', function(){ permaTabs.init(); }, false);
		window.removeEventListener('DOMContentLoaded', function(){ permaTabs.init(); }, false);

		//add permaTab attributes to session store manager
		var ss = Components.classes['@mozilla.org/browser/sessionstore;1'].getService(Components.interfaces.nsISessionStore);
		ss.persistTabAttribute('isPermaTab');
		ss.persistTabAttribute('permaTabUrl');

		//init services and get data
		this.prefs = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefBranch);
		this.tabContextMenu = document.getElementById('content').mStrip.childNodes[1];

		//set some browser data
		this.setStyles();
		this.setKeys();

		//add listeners
		this.tabContextMenu.addEventListener('popupshowing', this.updateContextMenu, false);
		getBrowser().mTabContainer.addEventListener('TabSelect', this.tabFocused, false);

		//patch whats there to patch
		this.patchInternals();
		this.patchAddons();

		//some stuff can be executed delayed for better startup performance
		var self = this;
		var runDelayed = {
			notify: function(){
				//if there are some, get the old permatabs and integrate them to the new system
				if(self.prefs.getPrefType('extensions.permatabs.permatabs.urls')==self.prefs.PREF_STRING && self.prefs.getPrefType('extensions.permatabs.permatabs.urls')){
					self.convertOldPermatabs();
				}
				
				//button handling
				self.setToolbarButtonType();
				self.setToolbarButton();

				//set your version in the prefs
				self.prefs.setCharPref('extensions.permatabs.version', self.version.join('.'));
			}
		}
		var timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
		timer.initWithCallback(runDelayed, 500, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
	},

	patchInternals: function(){
		//you cant unpin permatabs
		this.wrappedFunctions['gBrowser.unpinTab'] = gBrowser.unpinTab;
		gBrowser.unpinTab = function(aTab){
			if(permaTabs.isPermaTab(aTab)){
				return null;
			}

			return permaTabs.wrappedFunctions['gBrowser.unpinTab'].apply(gBrowser, arguments);
		};

		//and of course you cant close them
		this.wrappedFunctions['gBrowser.removeTab'] = gBrowser.removeTab;
		gBrowser.removeTab = function(aTab){
			if(permaTabs.isPermaTab(aTab)){
				return null;
			}

			return permaTabs.wrappedFunctions['gBrowser.removeTab'].apply(gBrowser, arguments);
		};

		//you cant load a uri in a permatab either
		this.wrappedFunctions['gBrowser.loadURI'] = gBrowser.loadURI;
		gBrowser.loadURI = function(aURI, aReferrerURI, aCharset){
			if(permaTabs.isPermaTab(getBrowser().mCurrentTab) && !permaTabs.tempAllowed){
				return gBrowser.loadOneTab(aURI, aReferrerURI, aCharset, null, false);
			}

			permaTabs.tempAllowed = false;
			return permaTabs.wrappedFunctions['gBrowser.loadURI'].apply(gBrowser, arguments);
		};

		//same goes for this way of loading a uri
		this.wrappedFunctions['window.loadURI'] = window.loadURI;
		window.loadURI = function(uri, referrer, postData, allowThirdPartyFixup){
			if(permaTabs.isPermaTab(getBrowser().mCurrentTab) && !permaTabs.tempAllowed){
				return gBrowser.loadOneTab(uri, referrer, null, postData, false, allowThirdPartyFixup);
			}

			permaTabs.tempAllowed = false;
			return permaTabs.wrappedFunctions['window.loadURI'].apply(window, arguments);
		};

		//urlbar can only load inside the tab if its the same domain (fix for bug #598587)
		this.wrappedFunctions['gURLBar.handleCommand'] = gURLBar.handleCommand;
		gURLBar.handleCommand = function(){
			permaTabs.tempAllowSameUrlDomain();
			return permaTabs.wrappedFunctions['gURLBar.handleCommand'].apply(gURLBar, arguments);
		};
	},

	patchAddons: function(){

		//this addons needs to get patched
		var addonsToLookFor = {
			'{dc572301-7619-498c-a57d-39143191b318}':	'tabMixPlus',
			'faviconizetab@espion.just-size.jp':		'faviconizeTab',
			'{61ED2A9A-39EB-4AAF-BD14-06DFBE8880C3}':	'duplicateTab',
			'{9669CC8F-B388-42FE-86F4-CB5E7F5A8BDC}':	'mrTechToolkit',
			'{44d0a1b4-9c90-4f86-ac92-8680b5d6549e}':	'gmailnotifier',
			'{0545b830-f0aa-4d7e-8820-50a4629a56fe}':	'colorfultabs',
			'{11615921-d8e7-3e9a-827d-2b41d3e5e22d}':	'flagtab',
			'{1cff04ef-0c75-4621-ba2a-2efb77346996}':	'chromatabsplus',
			'tabgroupsplus@t3approved':					'tabgroupsplus',
			'aging-tabs@design-noir.de':				'agingtabs',
			'fabtab@captaincaveman.nl':					'fabtabs'
		};

		var self = this;

		//check if addons are installed
		for(i in addonsToLookFor){
			AddonManager.getAddonByID(i, function(addon){
				if(addon && addon.isActive){
					self.addonsInstalled[addonsToLookFor[i]] = true;
				}
			});
		}

/*
		//TODO: check and fix old addon compatibility fixes
		
		
		//tabmix plus
		try
		{
			if(this.tabMixInstalled && !window.__contentAreaClick && (typeof TMP_miniT_init == 'function'))
			{ return permaTabs.utils.wrapFunction('window.TMP_miniT_init', TMP_miniT_init, function(){ if(typeof tablib == 'undefined'){ return null; } var ret = $base(); permaTabs.init(); return ret;}); }
		}
		catch(e){}

		//faviconize
		try
		{
			if(this.faviconizeTabInstalled && !document.getElementById('tabContextFaviconizeTab'))
			{ return permaTabs.utils.wrapFunction('faviconize.ui.init', faviconize.ui.init, function(){ var ret = $base(); permaTabs.init(); return ret; }); }
		}
		catch(e){}

		//colorful tabs
		try
		{
			if(this.colorfultabsinstalled && typeof ct.setColor == 'function')
			{ permaTabs.utils.wrapFunction('ct.setColor',ct.setColor, function(tab, tabClr){ if(!permaTabs.isPermaTab(tab) || !permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish')){ $base(); } } ); }
		}
		catch(e){}

		//flagtab
		try
		{
			if(this.flagtabinstalled && typeof flagTab.color == 'function')
			{ permaTabs.utils.wrapFunction('flagTab.color',flagTab.color, function(clr,special){ if(!permaTabs.isPermaTab(flagTab.tab) || !permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish')){ $base(); }else{ permaTabs.flagtabUpdateBottomBar(permaTabs.isPermaTab(flagTab.tab)); } } ); }

			if(this.flagtabinstalled && typeof flagTab.clear == 'function')
			{ permaTabs.utils.wrapFunction('flagTab.clear',flagTab.clear, function(tab){ if(!permaTabs.isPermaTab(tab) || !permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish')){ $base(); } } ); }
		}
		catch(e){}

		//chromatabs plus
		try
		{
		    if(this.chromatabsplusinstalled && typeof CHROMATABS.colorizeTab == 'function')
		    { permaTabs.utils.wrapFunction('CHROMATABS.colorizeTab',CHROMATABS.colorizeTab, function(tab, byEventHandler){ if(permaTabs.isPermaTab(tab) && permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish')){ CHROMATABS.colorBottomBar(); }else{ $base(); } } ); }
		}
		catch(e){}

		//aging tabs
		try
		{
		    if(this.agingtabsinstalled && typeof agingTabs.setColor == 'function')
			{ permaTabs.utils.wrapFunction('agingTabs.setColor',agingTabs.setColor, function(obj, color, important){ if(!permaTabs.isPermaTab(obj) || !permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish')){ $base(); } } ); }
		}
		catch(e){}




		//tabmixplus
		try
		{
		    if(this.tabMixInstalled)
		    {
            	//just in case tablib isn't init yet
		    	tablib.init();

			    //duplicate
				if(typeof gBrowser.duplicateTab == 'function')
				{ permaTabs.utils.patchFunction('gBrowser.duplicateTab',gBrowser.duplicateTab,'return newTab;', "if(aTab.hasAttribute('isPermaTab')){ if((gBrowser.getBrowserForTab(aTab).currentURI.spec=='' || gBrowser.getBrowserForTab(aTab).currentURI.spec=='about:blank') && aTab.getAttribute('permaTabUrl')){ gBrowser.getBrowserForTab(newTab).loadURI(aTab.getAttribute('permaTabUrl')); } newTab.removeAttribute('isPermaTab'); newTab.removeAttribute('permaTabId'); newTab.removeAttribute('permaTabUrl'); } return newTab;"); }

				//auto reload tabs
				if(typeof gBrowser.enableAutoReload == 'function')
				{ permaTabs.utils.wrapFunction('gBrowser.enableAutoReload',gBrowser.enableAutoReload, permaTabs.patchedTabMixPlusEnableAutoReload); }
				if(typeof gBrowser.disableAutoReload == 'function')
				{ permaTabs.utils.wrapFunction('gBrowser.disableAutoReload',gBrowser.disableAutoReload, permaTabs.patchedTabMixPlusDisableAutoReload); }
			}
		}
		catch(e){}


		this.showAllPermaTabs();


		//faviconizetab
		try
		{
			if(this.faviconizeTabInstalled && typeof faviconize.toggle == 'function')
			{ permaTabs.utils.wrapFunction('faviconize.toggle', faviconize.toggle, permaTabs.patchedFaviconizeToogle); }
		}
		catch(e){}

		//duplicatetab
		try
		{
			if(this.duplicateTabInstalled && typeof duplicateTab.setClonedData == 'function')
			{ permaTabs.utils.patchFunction('duplicateTab.setClonedData',duplicateTab.setClonedData,'ss.setTabState(aTab, aClonedData);', "ss.setTabState(aTab, aClonedData); if(aTab.hasAttribute('isPermaTab')){ aTab.removeAttribute('isPermaTab'); aTab.removeAttribute('permaTabId'); aTab.removeAttribute('permaTabUrl'); }"); }

			if(this.duplicateTabInstalled && typeof duplicateTab.duplicateInTab == "function")
			{ permaTabs.utils.patchFunction('duplicateTab.duplicateInTab',duplicateTab.duplicateInTab,"this.setClonedData(newTab, clonedData);", "this.setClonedData(newTab, clonedData); if(aTab.hasAttribute('isPermaTab') && (gBrowser.getBrowserForTab(aTab).currentURI.spec=='' || gBrowser.getBrowserForTab(aTab).currentURI.spec=='about:blank') && aTab.getAttribute('permaTabUrl')){ gBrowser.getBrowserForTab(newTab).loadURI(aTab.getAttribute('permaTabUrl')); }"); }
		}
		catch(e){}

		//mrtechtoolkit
		try
		{
			if(this.mrTechToolkitInstalled && typeof local_common.openURL == "function")
			{ permaTabs.utils.patchFunction('local_common.openURL',local_common.openURL," if (myWindowContent == \"about:blank\") {", "if (permaTabs.isPermaTab(gBrowser.mCurrentTab)){ forceTab = true; } else if (myWindowContent == 'about:blank') {"); }
		}
		catch(e){}

		//gmail notifier
		try
		{
			if(this.gmailnotifierinstalled && typeof gm_notifier.prototype.loadWebmail == "function")
			{ permaTabs.utils.patchFunction('gm_notifier.prototype.loadWebmail',gm_notifier.prototype.loadWebmail,'if (getBrowser().mCurrentBrowser.currentURI.spec == "about:blank")', 'if (permaTabs.isPermaTab(gBrowser.mCurrentTab) && location==0){ location = 1; } if (getBrowser().mCurrentBrowser.currentURI.spec == "about:blank" && !permaTabs.isPermaTab(gBrowser.mCurrentTab))'); }
		}
		catch(e){}

		//tabgroups plus
		try
		{
		    if(this.tabgroupsplusinstalled && typeof TG_Create_Group_Default == "function")
			{ permaTabs.utils.patchFunction('TG_Create_Group_Default',TG_Create_Group_Default,'var group = TG_Create_Group();', 'var group = TG_Create_Group(); for(var x = 0; x < gBrowser.mTabContainer.childNodes.length; x++){ if(gBrowser.mTabContainer.childNodes[x] && gBrowser.mTabContainer.childNodes[x]!=gBrowser.selectedTab){ TG_Add_To_Group(gBrowser.mTabContainer.childNodes[x],group); } }'); }
		}
		catch(e){}

		//aging tabs
		try
		{
		    if(this.agingtabsinstalled && typeof agingTabs.step == "function")
			{ permaTabs.utils.patchFunction('agingTabs.step',agingTabs.step,'let tab = tabs[i];', 'let tab = tabs[i]; if(permaTabs.isPermaTab(tab) && permaTabs.prefs.getBoolPref(\'extensions.permatabs.distinguish\')){ continue; } '); }
		}
		catch(e){}

		//fabtabs 1.2
		try
		{
		    if(this.fabtabsinstalled && typeof FabTab_Handler.prototype.UpdateTabs == "function")
			{ permaTabs.utils.patchFunction('FabTab_Handler.prototype.UpdateTabs',FabTab_Handler.prototype.UpdateTabs,'oWindow = oTabs[iIndex].linkedBrowser.contentWindow;', 'if(permaTabs.isPermaTab(oTabs[iIndex]) && permaTabs.prefs.getBoolPref(\'extensions.permatabs.distinguish\')){ continue; } oWindow = oTabs[iIndex].linkedBrowser.contentWindow;'); }
		}
		catch(e){}

		//fabtabs 1.3
		try
		{
		    if(this.fabtabsinstalled && typeof FabTabOverlay.UpdateTabs == "function")
			{ permaTabs.utils.patchFunction('FabTabOverlay.UpdateTabs',FabTabOverlay.UpdateTabs,'oWindow = oTabs[iIndex].linkedBrowser.contentWindow;', 'if(permaTabs.isPermaTab(oTabs[iIndex]) && permaTabs.prefs.getBoolPref(\'extensions.permatabs.distinguish\')){ continue; } oWindow = oTabs[iIndex].linkedBrowser.contentWindow;'); }
		}
		catch(e){ alert(e); }
*/
	},
	
	isPermaTab: function(tab){
		return tab.hasAttribute('isPermaTab');
	},

	tabFocused: function(){
		var tab = getBrowser().mCurrentTab;
			isPermaTab = permaTabs.isPermaTab(tab);

		getBrowser().mTabContainer.setAttribute('disableclose', isPermaTab);
		permaTabs.setToolbarButton();
	},

	togglePermanence: function(toggleCurrentTab){
		var tab = (toggleCurrentTab ? getBrowser().mCurrentTab : getBrowser().mContextTab),
			isPermaTab = permaTabs.isPermaTab(tab);

		permaTabs.setPermanence(tab, !isPermaTab);
	},

	setPermanence: function(tab, permanence){
		var url = this.getTabUri(tab);

		//permaTabsStartPage can not be permanent
		if(url=='chrome://permatabs/content/start.xul'){ 
			return;
		}

		if(permanence){
			tab.setAttribute('isPermaTab', true);
			tab.setAttribute('permaTabUrl', url);

			getBrowser().pinTab(tab);
		}
		else{
			if(!this.prefs.getBoolPref('extensions.permatabs.askUnset') || confirm(document.getElementById('permatabStrings').getString('tab.askUnset.label'))===true){

				//remove permatab status
				tab.removeAttribute('isPermaTab');
				tab.removeAttribute('permaTabUrl');

				switch(this.prefs.getIntPref('extensions.permatabs.unsetAction')){
					case 2:
						//close tab
						getBrowser().removeTab(tab);
						return;

					case 1:
						//let it stay as app tab
						break;

					case 0:
					default:
						//turn it back into a normal tab
						getBrowser().unpinTab(tab);
						break;
				}
			}
			else{
				permanence = !permanence;
			}
		}

		this.setToolbarButton();


/*
		//TODO: check this stuff

		if(this.prefs.getBoolPref('extensions.permatabs.distinguish'))
		{ currentTab.style.removeProperty('background-color'); }
		currentTab.style.removeProperty('color');

		if(currentTab == getBrowser().mCurrentTab)
		{ getBrowser().mTabContainer.setAttribute('disableclose', !isPermaTab); }


		if(this.colorfultabsinstalled && this.prefs.getBoolPref('extensions.permatabs.distinguish'))
		{
		    try
		    {
				try
				{ ct.setTaBottomClr(); }
				catch(e)
				{ setTaBottomClr(); }
			}
			catch(e){}
		}

		if(this.flagtabinstalled && this.prefs.getBoolPref('extensions.permatabs.distinguish'))
		{ this.flagtabUpdateBottomBar(!isPermaTab); }

		if(this.chromatabsplusinstalled && this.prefs.getBoolPref('extensions.permatabs.distinguish'))
		{ CHROMATABS.colorizeTab(currentTab, true); }
*/
	},

	goHome: function(useCurrentTab){
		var tab = (useCurrentTab ? getBrowser().mCurrentTab : getBrowser().mContextTab);

		if(!permaTabs.isPermaTab(tab)){ 
			return;
		}

		var url = tab.getAttribute("permaTabUrl");

		if(url){
			getBrowser().selectedTab = tab;

			//permaTabs.tempAllowed = true;
			getBrowser().mCurrentBrowser.loadURI(url);
			//permaTabs.tempAllowed = false;
		}
	},

	setHome: function(useCurrentTab){
		var tab = (useCurrentTab ? getBrowser().mCurrentTab : getBrowser().mContextTab);

  		if(!permaTabs.isPermaTab(tab)){ 
			return;
		}

		if(permaTabs.prefs.getBoolPref('extensions.permatabs.askOverwrite') && confirm(document.getElementById("permatabStrings").getString("tab.askOverwrite.label"))!==true){ 
			return;
		}

		var url = permaTabs.getTabUri(tab);
		tab.setAttribute('permaTabUrl', url);
	},

	closeAllPermaTabs: function(force, prefwindow){
	    if(!force && !permaTabs.prefs.getBoolPref('extensions.permatabs.doNotPromptOnCloseAllPermaTabs')){
	        if(prompt(document.getElementById("permatabStrings").getString("tab.askCloseAll.label"),"")!=document.getElementById("permatabStrings").getString("tab.askCloseAll.confirmString")){
				if(prefwindow)
				{ prefwindow.focus(); }

				return;
			}
	    }

		for(var x = getBrowser().mTabContainer.childNodes.length-1; x>=0; x--){
			permaTabs.closePermaTab(getBrowser().mTabContainer.childNodes[x]);
		}

		if(prefwindow){ 
			prefwindow.focus();
		}
	},

	closePermaTab: function(tab){
        if(this.isPermaTab(tab)){
			tab.removeAttribute('isPermaTab');
			getBrowser().unpinTab(tab);
		    getBrowser().removeTab(tab);
		}
	},

	convertOldPermatabs: function(){
		//load old permatabs data
		var urls = this.prefs.getCharPref('extensions.permatabs.permatabs.urls').split('\n'),
			emptyOptions = {'ids':'', 'urls':'', 'titles':'', 'images':'', 'faviconizeds':''},
			i, x;

		if(urls.length > 0){
			for(i = 0; i < urls.length; i++){
				if(!urls[i]){
					continue;
				}

				var tab = getBrowser().addTab();

				tab.setAttribute('isPermaTab', true);
				tab.setAttribute('permaTabUrl', urls[i]);

				getBrowser().getBrowserForTab(tab).loadURI(urls[i]);

				getBrowser().pinTab(tab);
			}

			//empty option strings, we dont need them anymore
			for(x in emptyOptions){
				this.prefs.setCharPref('extensions.permatabs.permatabs.'+x, '');
			}
		}
	},

	setStyles: function(){
		var colorrule = ((this.prefs.getBoolPref('extensions.permatabs.distinguish')) ? 'background-color: ' + this.prefs.getCharPref('extensions.permatabs.color') + ' !important;' : ''),
			textcolorrule = ((this.prefs.getBoolPref('extensions.permatabs.labelSet')) ? 'color: ' + this.prefs.getCharPref('extensions.permatabs.labelColor') + ' !important;' : ''),
			imagerule = ((this.prefs.getBoolPref('extensions.permatabs.removeBackground')) ? 'background-image: none !important;' : '');

		try{
			for(var x = 0; x < document.styleSheets.length; x++){
				if(document.styleSheets[x].href == 'chrome://permatabs/skin/permatabs.css'){
					document.styleSheets[x].deleteRule(document.styleSheets[x].cssRules.length - 1);
				    document.styleSheets[x].deleteRule(document.styleSheets[x].cssRules.length - 1);

					document.styleSheets[x].insertRule('tab.tabbrowser-tab[isPermaTab=true] * { background-color: transparent !important;' + textcolorrule + '}', document.styleSheets[x].cssRules.length);
					document.styleSheets[x].insertRule('tab.tabbrowser-tab[isPermaTab=true] {' + colorrule + textcolorrule + imagerule + '}', document.styleSheets[x].cssRules.length);

					break;
				}
			}
		}
		catch(e){}
	},

	setKeys: function(){
		var togglekey = document.getElementById('permaTabToggleKey');
		togglekey.setAttribute('key', this.prefs.getCharPref('extensions.permatabs.toggleKey'));
		togglekey.setAttribute('modifiers', this.prefs.getCharPref('extensions.permatabs.toggleKeyModificator'));
		togglekey.setAttribute('disabled', !this.prefs.getBoolPref('extensions.permatabs.toggleKeyActive'));

		var homekey = document.getElementById('permaTabHomeKey');
		homekey.setAttribute('key', this.prefs.getCharPref('extensions.permatabs.homeKey'));
		homekey.setAttribute('modifiers', this.prefs.getCharPref('extensions.permatabs.homeKeyModificator'));
		homekey.setAttribute('disabled', !this.prefs.getBoolPref('extensions.permatabs.homeKeyActive'));

		var sethomekey = document.getElementById('permaTabSetHomeKey');
		sethomekey.setAttribute('key', this.prefs.getCharPref('extensions.permatabs.setHomeKey'));
		sethomekey.setAttribute('modifiers', this.prefs.getCharPref('extensions.permatabs.setHomeKeyModificator'));
		sethomekey.setAttribute('disabled', !this.prefs.getBoolPref('extensions.permatabs.setHomeKeyActive'));
	},

	setToolbarButtonType: function(){
	    if(!document.getElementById('permatabs-togglebutton')){ 
			return false;
		}

		if(!this.prefs.getBoolPref('extensions.permatabs.hideAdditionalMenuItems')){
		    document.getElementById('permatabs-togglebutton').setAttribute('type', 'menu-button');

            if(!document.getElementById('permatabs-tooglebutton-submenu')){
				var submenu = document.createElement('menupopup');
				submenu.setAttribute('id', 'permatabs-tooglebutton-submenu');
				document.getElementById('permatabs-togglebutton').appendChild(submenu);
			}

		    try{
		        document.getElementById('permatabs-togglebutton').removeEventListener('popupshowing', this.updateButtonContextMenu, false);
		    }
			catch(e){}

		    document.getElementById('permatabs-togglebutton').addEventListener('popupshowing', this.updateButtonContextMenu, false);
		}
		else{
		    document.getElementById('permatabs-togglebutton').setAttribute('type', 'checkbox');

		    if(document.getElementById('permatabs-tooglebutton-submenu')){ 
				document.getElementById('permatabs-togglebutton').removeChild(document.getElementById('permatabs-tooglebutton-submenu'));
			}

		    try{
		        document.getElementById('permatabs-togglebutton').removeEventListener('popupshowing', this.updateButtonContextMenu, false);
		    }
			catch(e){}
		}

		if(this.prefs.getBoolPref('extensions.permatabs.toggleKeyActive')){ 
			document.getElementById('permatabs-togglebutton').setAttribute('key', 'permaTabToggleKey');
		}
	},

	updateButtonContextMenu: function(){
        if(permaTabs.prefs.getBoolPref('extensions.permatabs.hideAdditionalMenuItems')){
			return false;
		}

		var buttonsubmenulist = document.getElementById('permatabs-tooglebutton-submenu');
	    if(!buttonsubmenulist){ 
			return false;
		}

		if(!document.getElementById('permaTabButtonContextMenuItemPermanentHome') || !document.getElementById('permaTabButtonContextMenuItemPermanentHomeSet')){
			var menuItem1 = document.createElement("menuitem");
			menuItem1.setAttribute("label", document.getElementById("permatabStrings").getString("tab.goPermaHome.label"));
			menuItem1.setAttribute("id", "permaTabButtonContextMenuItemPermanentHome");
			menuItem1.setAttribute("oncommand", "permaTabs.goHome(true);");
			if(permaTabs.prefs.getBoolPref('extensions.permatabs.homeKeyActive')){ menuItem1.setAttribute("key", "permaTabHomeKey"); }

			var menuItem2 = document.createElement("menuitem");
			menuItem2.setAttribute("label", document.getElementById("permatabStrings").getString("tab.setPermaHome.label"));
			menuItem2.setAttribute("id", "permaTabButtonContextMenuItemPermanentHomeSet");
			menuItem2.setAttribute("oncommand", "permaTabs.setHome(true);");

			buttonsubmenulist.appendChild(menuItem1);
			//buttonsubmenulist.appendChild(document.createElement("menuseparator"));
			buttonsubmenulist.appendChild(menuItem2);
		}

		var tab = getBrowser().mCurrentTab,
			isPermaTab = (tab && permaTabs.isPermaTab(tab)),
			url = permaTabs.getTabUri(tab),
			validurl = !(url == '' || url == 'about:blank');
 
		document.getElementById('permaTabButtonContextMenuItemPermanentHome').setAttribute("disabled", !isPermaTab);
		document.getElementById('permaTabButtonContextMenuItemPermanentHomeSet').setAttribute("disabled", (!isPermaTab || !validurl || url==getBrowser().mCurrentTab.getAttribute("permaTabUrl")));
	},

	setToolbarButton: function(){
		var tab = getBrowser().mCurrentTab,
			isPermaTab = this.isPermaTab(tab),
			button = document.getElementById('permatabs-togglebutton');

	    if(button){
			button.setAttribute('checked', isPermaTab);
		}
	},

	updateContextMenu: function(){
		var tab = getBrowser().mContextTab,
			closeTabID = 'context_closeTab',
			unpinTabID = 'context_unpinTab',
			unpinMenuItem = null,
			closeMenuItem = null;


		//did options change?
		var noSubMenu = permaTabs.prefs.getBoolPref('extensions.permatabs.hideAdditionalMenuItems'),
			subMenuItem = (document.getElementById('permaTabsSubMenu') ? true : false),
			optionsChanged = (permaTabs.menuItemsAdded && ((noSubMenu && subMenuItem) || (!noSubMenu && !subMenuItem)));

		//delete and rebuild contextmenu when options changed
		if(optionsChanged){
			var menuItemIds = [
				'permaTabContextMenuItemMakePermanent',
				'permaTabContextMenuItemPermanentHome',
				'permaTabContextMenuItemPermanentHomeSet',
				'permaTabsSubMenuList',
				'permaTabsSubMenu'
			];

			for(i in menuItemIds){
				try{
					permaTabs.tabContextMenu.removeChild(document.getElementById(menuItemIds[i]));
				}
				catch(e){}
			}
		}


		//get the important nodes
		for(var x = 0; x < permaTabs.tabContextMenu.childNodes.length; x++){
			if(permaTabs.tabContextMenu.childNodes[x].getAttribute('id') == unpinTabID){
				unpinMenuItem =  permaTabs.tabContextMenu.childNodes[x];
			}
			else if(permaTabs.tabContextMenu.childNodes[x].getAttribute('id') == closeTabID){
				closeMenuItem =  permaTabs.tabContextMenu.childNodes[x];
			}
		}

		var insertBeforeItem = unpinMenuItem.nextSibling || unpinMenuItem || closeMenuItem;


		//building contextmenu
		if(!permaTabs.menuItemsAdded || optionsChanged){
			//create items
			var menuItem1 = document.createElement('menuitem');
			menuItem1.setAttribute('label', document.getElementById('permatabStrings').getString('tab.togglePermanence.label'));
			menuItem1.setAttribute('id', 'permaTabContextMenuItemMakePermanent');
			menuItem1.setAttribute('oncommand', 'permaTabs.togglePermanence();');
			menuItem1.setAttribute('type', 'checkbox');

			var menuItem2 = document.createElement('menuitem');
			menuItem2.setAttribute('label', document.getElementById('permatabStrings').getString('tab.goPermaHome.label'));
			menuItem2.setAttribute('id', 'permaTabContextMenuItemPermanentHome');
			menuItem2.setAttribute('oncommand', 'permaTabs.goHome();');

			var menuItem3 = document.createElement('menuitem');
			menuItem3.setAttribute('label', document.getElementById('permatabStrings').getString('tab.setPermaHome.label'));
			menuItem3.setAttribute('id', 'permaTabContextMenuItemPermanentHomeSet');
			menuItem3.setAttribute('oncommand', 'permaTabs.setHome();');


			//set keys
			if(permaTabs.prefs.getBoolPref('extensions.permatabs.toggleKeyActive')){
				menuItem1.setAttribute('key', 'permaTabToggleKey');
			}
			if(permaTabs.prefs.getBoolPref('extensions.permatabs.homeKeyActive')){
				menuItem2.setAttribute('key', 'permaTabHomeKey');
			}


			//inset switch into the context menu
			permaTabs.tabContextMenu.insertBefore(menuItem1, insertBeforeItem);


			//if enabled, insert the submenu into the context menu
			if(!noSubMenu){
				var submenu = document.createElement('menu');
				submenu.setAttribute('label', document.getElementById('permatabStrings').getString('tab.subMenu.label'));
				submenu.setAttribute('id', 'permaTabsSubMenu');

				var submenulist = document.createElement('menupopup');
				submenulist.setAttribute('id', 'permaTabsSubMenuList');

				submenulist.appendChild(menuItem2);
				submenulist.appendChild(menuItem3);

				submenu.appendChild(submenulist);
				permaTabs.tabContextMenu.insertBefore(submenu, insertBeforeItem);
			}

			permaTabs.menuItemsAdded = true;
		}


		var isPermaTab = (tab && permaTabs.isPermaTab(tab)),
			url = permaTabs.getTabUri(tab),
			validurl = !(url == '' || url == 'about:blank');

		document.getElementById('permaTabContextMenuItemMakePermanent').setAttribute('checked', isPermaTab);

		if(!noSubMenu){
			document.getElementById('permaTabContextMenuItemPermanentHome').setAttribute('disabled', !isPermaTab);
			document.getElementById('permaTabContextMenuItemPermanentHomeSet').setAttribute('disabled', (!isPermaTab || !validurl || url==getBrowser().mContextTab.getAttribute('permaTabUrl')));
			document.getElementById('permaTabsSubMenu').setAttribute('disabled', !isPermaTab);
		}

//		TODO: check this addon fix stufff
//		if(permaTabs.colorfultabsinstalled && document.getElementById('ctTabCtx') && permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish')){ document.getElementById('ctTabCtx').setAttribute('disabled', isPermaTab); }
//		if(permaTabs.flagtabinstalled && document.getElementById('flagtab-options') && permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish')){ document.getElementById('flagtab-options').setAttribute('disabled', isPermaTab); }

		unpinMenuItem.setAttribute('disabled', isPermaTab);
		closeMenuItem.setAttribute('disabled', isPermaTab);
	},

	tempAllowSameUrlDomain: function(){
		if(permaTabs.isPermaTab(getBrowser().mCurrentTab) && gURLBar.value.replace(/[htfps]{3,}:\/\/([^\/]*)\/*.*/i,'$1')==getBrowser().mCurrentBrowser.currentURI.host){
			permaTabs.tempAllowed = true;
		}
	},

	getTabUri: function(tab){
		if(!tab){
			return '';
		}

		var tabs = getBrowser().mTabContainer.childNodes,
		length = tabs.length;

		for(var i = 0; i<length; i++){
			if(tabs[i] == tab){
				return getBrowser().getBrowserAtIndex(i).currentURI.spec;
			}
		}

		return '';
	},

	OptionWindow: function(){
	    window.openDialog('chrome://permatabs/content/prefsWindow.xul', 'PermaTabs Options', 'chrome,titlebar,toolbar,centerscreen').focus();
	}
/*
	//TODO: get this stuff out completely
	
	utils: {
		wrappedFunctions: {},

		wrapFunction: function(name, orig, wrapper){
			if(permaTabs.utils.wrappedFunctions[name]){ 
				return false;
			}

			permaTabs.utils.wrappedFunctions[name] = orig;
			eval(name + ' = ' + wrapper.toString().replace('$base()', 'permaTabs.utils.wrappedFunctions["' + name + '"].apply(this, arguments);'));
			return true;
		},

		patchFunction: function(name, func, search, replace){
			eval(name + ' = ' + func.toString().replace(search, replace));
			return true;
		}
	}
*/
}

window.addEventListener('load', function(){ permaTabs.init(); }, false);
window.addEventListener('DOMContentLoaded', function(){ permaTabs.init(); }, false);




/*
	//TODO: check what to do with this addon fixes
	
	flagtabUpdateBottomBar: function(status)
	{
		var color = (status ? permaTabs.prefs.getCharPref("extensions.permatabs.color") : '-moz-dialog');

		try
		{
			for(var i=0; i<document.styleSheets.length; i++)
			{
				if(document.styleSheets[i].href=="chrome://flagtab/content/bottomBar.css")
				{
					document.styleSheets[i].cssRules[2].style.setProperty('background-color',color,'important');
					break;
				}
			}
		}
		catch(e){}
		
		return true;
	},
	
	patchedTabMixPlusEnableAutoReload: function(aTab, reloadData)
	{
	    //load permaTabs at startup when they should get reloaded
	    if(reloadData && permaTabs.isPermaTab(aTab))
		{
		    gBrowser.getBrowserForTab(aTab).loadURI(aTab.getAttribute('permaTabUrl'));
		}

	    $base();
	    
	    if(reloadData)
	    {
			setupAutoReload(aTab);

			reloadData = reloadData.split(" ");
			aTab.autoReloadEnabled = true;
			aTab.autoReloadURI = reloadData[0];
			aTab.autoReloadTime = reloadData[1];
			
			clearTimeout(aTab.autoReloadTimerID);
			aTab.autoReloadTimerID = setTimeout(reloadPage, aTab.autoReloadTime*1000, aTab.id);
			aTab.setAttribute("reload-data", aTab.autoReloadURI + " " + aTab.autoReloadTime);
		}
	},
*/
