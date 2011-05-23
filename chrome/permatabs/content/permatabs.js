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


//
// permatabs : 1.7.0
// contact   : david@donesmart.com
// copyright : 2006-2007 donesmart ltd

// modifications by deos in June 2008 - January 2010
// bump to version Mod 1.9.3
// contact: deos.dev@gmail.com
//
// new feature in Mod version:
// + support for FF 3.0 - 3.6
// + some bug fixes
// + Added "Permatab Home" function
// + Addes "Reload current url" function
// + Added "Open current url in new (normal) tab" function
// + Addes "set current tab as home of this permatab" function
// + Addes Toolbarbutton
// + Addes possibility to hide all additional context menu options
// + Added possibility to merge the menu items into a submenu
// + Added possibility to allow urlbar input inside the same domain not to load in a new tab
// + Added possibility to ignore subdomains when forcing links from external domains to open in new tabs
// + Added possibility to remove background of permaTabs (can fix some theme problems)
// + Added possibility to activate a need of confirming before disabling and overwriting permatabs
// + Added possibility to move the faviconize menu item next to the permatab item and to add a seperator between them (only about:config)
// + Added possibility to activate a special theme for permatabs on mac (and possibility to use additional theme for tabs in background - only about:config)
// + compatibility fix for dublicateTab [1.0.2]
// + compatibility fix for throbber function of MR Tech Toolkit [6.0.1 - 6.0.3.3]
// + compatibility fix for duplicating tabs with Tab Mix Plus [0.3.7pre - 0.3.7.3] (NOT 0.3.8.2)
// + compatibility fix for gmail notifier [0.6.3.8 - 0.6.4.1]
// + compatibility fix for Tabgroups-Plus [0.4.1]
// + compatibility fix for ColorfulTabs [3.5 - 4.1]
// + compatibility fix for FlagTab [2.1.3 - 2.3.3]
// + compatibility fix for ChromaTabs Plus [2.1 - 2.2]
// + compatibility fix for Aging Tabs [0.7.1]
// + compatibility fix for FabTabs [1.2.1 - 1.3.4.1]
//
// known issues:
// - sometimes permatabs crashes when restarting the browser
// - could not fix bug with dubplicateTab's openInNewWindow
// - problems with some coloring addons after restarting the browser
//
// hidden options:
// - move the faviconize menu item next to the permatab item(s): 						extensions.permatabs.faviconizeMenuItemReposition		default: true
// - use a seperator between the faviconize menu item and the permatabs menu item(s): 	extensions.permatabs.faviconizeMenuItemSeperator		default: true
// - use a special style for permatabs in background in mac-style: 						extensions.permatabs.macStyleBackground					default: true
// - Do not aks before closing all PermaTabs:											extensions.permatabs.doNotPromptOnCloseAllPermaTabs		default: false
// - Do not save TMP refresh functionality												extensions.permatabs.doNotSaveTabMixPlusRefreshData		default: false
// (changing most of this options in about:config requires restarting the browser or opening and saving the preferences window to take affect)


var permaTabs =
{
	version : [1,9,3],
	prevVersion : false,
	prerequisites : false,
	initialized : false,
	permaTabs : [],
	prefs : null,
	eTLDService: null,
	tabContextMenu : null,
	
	tabMixInstalled : false,
	faviconizeTabInstalled : false,
	duplicateTabInstalled : false,
	mrTechToolkitInstalled : false,
	gmailnotifierinstalled : false,
	colorfultabsinstalled : false,
	flagtabinstalled : false,
	chromatabsplusinstalled : false,
	tabgroupsplusinstalled : false,
	agingtabsinstalled : false,
	fabtabsinstalled : false,
	
	delayedStartupCall : false,
	ssWillRestore : false,
	ssTabsRestored : 0,
	ssRestored : false,
	
	OS : null,
	menuItemsAdded : false,
	firstInstall : false,
	firstInit : true,
	firstWindow : true,

	tempAllowed : false,

	privateBrowsingListener : false,
	privateBrowsingClosedPermaTabs : {},


	init : function()
	{
		if(this.initialized)
		{ return; }

		if(!this.delayedStartupCall)
		{
			this.delayedStartupCall = true;
			permaTabs.utils.patchFunction('window.delayedStartup', window.delayedStartup, 'gBookmarkAllTabsHandler = new BookmarkAllTabsHandler;', 'permaTabs.init(); gBookmarkAllTabsHandler = new BookmarkAllTabsHandler;');
			return;
		}

		var firstInit = this.firstInit;
		this.firstInit = false;

		var enumerator = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator).getEnumerator("navigator:browser");
		var currentWindow;
		while(enumerator.hasMoreElements() && (currentWindow = enumerator.getNext()))
		{
			if(!currentWindow)
			{ continue; }

			if(firstInit && currentWindow != window)
			{ this.firstWindow = false; }

			currentWindow.removeEventListener("focus", currentWindow.permaTabs.init, false);

			if(currentWindow.permaTabs && currentWindow.permaTabs.initialized)
			{
	    		if(document.getElementById('permatabs-togglebutton'))
	    		{ document.getElementById('permatabs-togglebutton').setAttribute('disabled', true); }

				return;
			}
		}

		if(!this.prerequisites)
		{
			this.prerequisites = true;

			this.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			this.tabContextMenu = document.getElementById('content').mStrip.childNodes[1];
			this.OS = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime).OS;
			this.eTLDService = Components.classes["@mozilla.org/network/effective-tld-service;1"].getService(Components.interfaces.nsIEffectiveTLDService);


			if(this.prefs.getPrefType("extensions.permatabs.permatabs.urls") != this.prefs.PREF_STRING || this.prefs.getPrefType("extensions.permatabs.permatabs.titles") != this.prefs.PREF_STRING || this.prefs.getPrefType("extensions.permatabs.permatabs.images") != this.prefs.PREF_STRING)
			{
				this.firstInstall = true;

				var sites = {
				news : 			  [ {'url': 'http://news.google.com/',		'title': 'Google News',			'image': 'http://www.google.com/favicon.ico'},
									{'url': 'http://news.bbc.co.uk/',		'title': 'BBC News',			'image': 'http://news.bbc.co.uk/favicon.ico'},
									{'url': 'http://www.cnn.com/',			'title': 'CNN.com',				'image': 'http://www.cnn.com/favicon.ico'},
									{'url': 'http://nytimes.com/',			'title': 'The New York Times',	'image': 'http://nytimes.com/favicon.ico'},
									{'url': 'http://www.theonion.com/',		'title': 'The Onion',			'image': 'http://www.theonion.com/favicon.ico'}],
				socialBookmarks : [	{'url': 'http://del.icio.us/',			'title': 'del.icio.us',			'image': 'http://del.icio.us/favicon.ico'},
									{'url': 'http://reddit.com/',			'title': 'reddit.com',			'image': 'http://reddit.com/favicon.ico'},
									{'url': 'http://www.technorati.com/',	'title': 'Technorati',			'image': 'http://www.technorati.com/favicon.ico'},
									{'url': 'http://digg.com/',				'title': 'Digg',				'image': 'http://digg.com/favicon.ico'}]				};

				var indexes = {news: Math.floor(Math.random() * sites.news.length), social: Math.floor(Math.random() * sites.socialBookmarks.length)}

				var save = {	ids : [1,2],
								urls : [sites.socialBookmarks[indexes.social].url, sites.news[indexes.news].url],
								titles : [sites.socialBookmarks[indexes.social].title, sites.news[indexes.news].title],
								images : [sites.socialBookmarks[indexes.social].image, sites.news[indexes.news].image],
								faviconizeds : [0,0]};

				for(x in save)
				this.prefs.setCharPref('extensions.permatabs.permatabs.' + x, save[x].join('\n'));
				

				if(permaTabs.OS == 'Darwin')
				{
				    this.prefs.setCharPref('extensions.permatabs.toggleKeyModificator','accel,shift');
				    this.prefs.setCharPref('extensions.permatabs.homeKeyModificator','accel,shift');
				}
			}

			var ss = Cc["@mozilla.org/browser/sessionstartup;1"].getService(Ci.nsISessionStartup);
			this.ssWillRestore = (ss.doRestore() && this.firstWindow);

			ss = Components.classes["@mozilla.org/browser/sessionstore;1"].getService(Components.interfaces.nsISessionStore);
			ss.persistTabAttribute('isPermaTab');
			ss.persistTabAttribute('permaTabId');
			ss.persistTabAttribute('permaTabUrl');
			ss.persistTabAttribute('wasPermaTab');

			
			try
			{
				if(window.setColor && typeof window.setColor == "function")
				{
					permaTabs.utils.wrapFunction('window.setColor', window.setColor, function(tab, tabClr){if(!permaTabs.isPermaTab(tab) || !permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish')){ return $base(); } });
				}
			}
			catch(e){}


			permaTabs.utils.patchFunction('getBrowser().removeTab', getBrowser().removeTab, 'var l = this.mTabContainer.childNodes.length;', 'if(aTab.hasAttribute("isPermaTab")){ return; } var l = this.mTabContainer.childNodes.length;');   																									//FF 3.0
			permaTabs.utils.patchFunction('getBrowser().removeTab', getBrowser().removeTab, 'this._endRemoveTab(this._beginRemoveTab(aTab, false, null, true));', 'if(aTab.localName!="tab"){ aTab = this.mCurrentTab; } if(aTab.hasAttribute("isPermaTab")){ return; } this._endRemoveTab(this._beginRemoveTab(aTab, false, null, true));'); 		//FF 3.5+

			permaTabs.utils.patchFunction('getBrowser().warnAboutClosingTabs', getBrowser().warnAboutClosingTabs, 'var numTabs = this.mTabContainer.childNodes.length;', 'var numTabs = this.mTabContainer.childNodes.length - permaTabs.permaTabs.length; if(!aAll && getBrowser().mContextTab && permaTabs.isPermaTab(getBrowser().mContextTab)) numTabs++;');

			permaTabs.utils.patchFunction('getBrowser().setTabTitle', getBrowser().setTabTitle, 'if (!title) {', 'var tabIndex = 0; var tabUrl = getBrowser().getBrowserForTab(aTab).currentURI.spec; if((tabUrl == "" || tabUrl == "about:blank") && (tabIndex = permaTabs.getPermaTabLocalIndex(aTab)) > -1) title = permaTabs.permaTabs[tabIndex].title; if (!title) {');

			if(typeof getBrowser().updateIcon == "function")
			{ permaTabs.utils.patchFunction('getBrowser().updateIcon', getBrowser().updateIcon, 'if (!aTab.hasAttribute("busy") && browser.mIconURL) {', 'var tabIndex = 0; var tabUrl = getBrowser().getBrowserForTab(aTab).currentURI.spec; if((tabUrl == "" || tabUrl == "about:blank") && (tabIndex = permaTabs.getPermaTabLocalIndex(aTab)) > -1) aTab.setAttribute("image", permaTabs.permaTabs[tabIndex].image); else if (!aTab.hasAttribute("busy") && browser.mIconURL) {'); }


			this.setKeys();

			this.setToolbarButtonType();


			var container = Components.classes["@mozilla.org/rdf/container;1"].getService(Components.interfaces.nsIRDFContainer);
			var RDFService = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
			var extManager = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager).datasource;

			container.Init(extManager, RDFService.GetResource("urn:mozilla:item:root"));

			for(var elements = container.GetElements(); elements.hasMoreElements();)
			{
				var element = elements.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
				var extId = element.Value.replace('urn:mozilla:item:', '');

				var target = extManager.GetTarget(element, RDFService.GetResource("http://www.mozilla.org/2004/em-rdf#appDisabled"), true);
				if(target && target.QueryInterface(Components.interfaces.nsIRDFLiteral).Value=="true")
				{ continue; }

				target = extManager.GetTarget(element, RDFService.GetResource("http://www.mozilla.org/2004/em-rdf#userDisabled"), true);
				if(target && target.QueryInterface(Components.interfaces.nsIRDFLiteral).Value=="true")
				{ continue; }

				if     (extId == '{dc572301-7619-498c-a57d-39143191b318}')	{ this.tabMixInstalled = true; 			}
				else if(extId == 'faviconizetab@espion.just-size.jp')		{ this.faviconizeTabInstalled = true; 	}
				else if(extId == '{61ED2A9A-39EB-4AAF-BD14-06DFBE8880C3}')	{ this.duplicateTabInstalled = true 	}
				else if(extId == '{9669CC8F-B388-42FE-86F4-CB5E7F5A8BDC}')	{ this.mrTechToolkitInstalled = true; 	}
				else if(extId == '{44d0a1b4-9c90-4f86-ac92-8680b5d6549e}')	{ this.gmailnotifierinstalled = true; 	}
				else if(extId == '{0545b830-f0aa-4d7e-8820-50a4629a56fe}')	{ this.colorfultabsinstalled = true;    }
				else if(extId == '{11615921-d8e7-3e9a-827d-2b41d3e5e22d}')	{ this.flagtabinstalled = true;         }
				else if(extId == '{1cff04ef-0c75-4621-ba2a-2efb77346996}')	{ this.chromatabsplusinstalled = true;	}
				else if(extId == 'tabgroupsplus@t3approved')  				{ this.tabgroupsplusinstalled = true;	}
				else if(extId == 'aging-tabs@design-noir.de')               { this.agingtabsinstalled = true; 		}
				else if(extId == 'fabtab@captaincaveman.nl')                { this.fabtabsinstalled = true;         }
			}
			
			this.restorePermaTabs();
		}

		//tabmix plus
		try
		{
			if(this.tabMixInstalled && !window.__contentAreaClick && (typeof TMP_miniT_init == "function"))
			{ return permaTabs.utils.wrapFunction('window.TMP_miniT_init', TMP_miniT_init, function(){ if(typeof tablib == "undefined"){ return null; } var ret = $base(); permaTabs.init(); return ret;}); }
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
			if(this.colorfultabsinstalled && typeof ct.setColor == "function")
			{ permaTabs.utils.wrapFunction('ct.setColor',ct.setColor, function(tab, tabClr){ if(!permaTabs.isPermaTab(tab) || !permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish')){ $base(); } } ); }
		}
		catch(e){}

		//flagtab
		try
		{
			if(this.flagtabinstalled && typeof flagTab.color == "function")
			{ permaTabs.utils.wrapFunction('flagTab.color',flagTab.color, function(clr,special){ if(!permaTabs.isPermaTab(flagTab.tab) || !permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish')){ $base(); }else{ permaTabs.flagtabUpdateBottomBar(permaTabs.isPermaTab(flagTab.tab)); } } ); }

			if(this.flagtabinstalled && typeof flagTab.clear == "function")
			{ permaTabs.utils.wrapFunction('flagTab.clear',flagTab.clear, function(tab){ if(!permaTabs.isPermaTab(tab) || !permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish')){ $base(); } } ); }
		}
		catch(e){}

		//chromatabs plus
		try
		{
		    if(this.chromatabsplusinstalled && typeof CHROMATABS.colorizeTab == "function")
		    { permaTabs.utils.wrapFunction('CHROMATABS.colorizeTab',CHROMATABS.colorizeTab, function(tab, byEventHandler){ if(permaTabs.isPermaTab(tab) && permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish')){ CHROMATABS.colorBottomBar(); }else{ $base(); } } ); }
		}
		catch(e){}
		
		//aging tabs
		try
		{
		    if(this.agingtabsinstalled && typeof agingTabs.setColor == "function")
			{ permaTabs.utils.wrapFunction('agingTabs.setColor',agingTabs.setColor, function(obj, color, important){ if(!permaTabs.isPermaTab(obj) || !permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish')){ $base(); } } ); }
		}
		catch(e){}


		if(this.ssWillRestore && !this.ssRestored)
		{ return; }


		this.initialized = true;

		window.removeEventListener("load", function() { permaTabs.init(); }, false);
		window.removeEventListener("DOMContentLoaded", function() { permaTabs.init(); }, false);

		this.tabContextMenu.addEventListener("popupshowing", permaTabs.updateContextMenu, false);

		getBrowser().mTabContainer.addEventListener("TabSelect", function(e){ permaTabs.onTabSelected(); }, false);


		permaTabs.utils.wrapFunction('window.contentAreaClick', window.contentAreaClick, this.patchedContentAreaClick);

		permaTabs.utils.wrapFunction('window.loadURI', window.loadURI, this.patchedLoadURI);
		permaTabs.utils.wrapFunction('gBrowser.loadURI', gBrowser.loadURI, this.patchedGBrowserLoadURI);

        //FF 3.0 only
		try
		{
		    permaTabs.utils.wrapFunction('window.BrowserLoadURL', window.BrowserLoadURL, this.patchedBrowserLoadURL);
		}
		catch(e){}
		
		//FF 3.5+ only
		try
		{
        	permaTabs.utils.wrapFunction('BrowserReloadOrDuplicate', BrowserReloadOrDuplicate, function(aEvent){ permaTabs.tempAllowed = true; var returnvalue = $base(); permaTabs.tempAllowed = false; return returnvalue; });
		}
		catch(e){}

		permaTabs.utils.patchFunction('whereToOpenLink',whereToOpenLink,/("current")/g,'((permaTabs.isPermaTab(getBrowser().mCurrentTab) && !permaTabs.tempAllowed) ? "tab" : "current")');

		permaTabs.utils.wrapFunction('BrowserBack', BrowserBack, function(aEvent){ permaTabs.tempAllowed = true; var returnvalue = $base(); permaTabs.tempAllowed = false; return returnvalue; });
		permaTabs.utils.wrapFunction('BrowserForward', BrowserForward, function(aEvent){ permaTabs.tempAllowed = true; var returnvalue = $base(); permaTabs.tempAllowed = false; return returnvalue; });
		permaTabs.utils.wrapFunction('gotoHistoryIndex', gotoHistoryIndex, function(aEvent){ permaTabs.tempAllowed = true; var returnvalue = $base(); permaTabs.tempAllowed = false; return returnvalue; });

		try
		{
		    //FF 3.0
			permaTabs.utils.patchFunction('handleURLBarCommand',handleURLBarCommand,/(function)((.|\n)*?)([{])((.|\n)*)([}])/,"$1$2$4 permaTabs.tempAllowSameUrlDomain(); $5 permaTabs.tempAllowed = false; $7 ");
			permaTabs.utils.patchFunction('handleURLBarCommand',handleURLBarCommand,/(return)(.*?)([;])/g,"permaTabs.tempAllowed = false; $1$2$3 ");
		}
		catch(e)
		{
		    //FF 3.5+
			permaTabs.utils.patchFunction('gURLBar.handleCommand',gURLBar.handleCommand,/(function)((.|\n)*?)([{])((.|\n)*)([}])/,"$1$2$4 permaTabs.tempAllowSameUrlDomain(); $5 permaTabs.tempAllowed = false; $7 ");
			permaTabs.utils.patchFunction('gURLBar.handleCommand',gURLBar.handleCommand,/(return)(.*?)([;])/g,"permaTabs.tempAllowed = false; $1$2$3 ");
		}

		var isset = false;
		var ver = false;
		
		if((isset = this.prefs.getPrefType("extensions.permatabs.version"))!=this.prefs.PREF_STRING || (ver = this.prefs.getCharPref("extensions.permatabs.version"))!=this.version.join('.'))
		{
			if(!this.firstInstall)
			{ this.prevVersion = (ver ? ver.split('.') : [1,0,0]); }

			this.prefs.setCharPref("extensions.permatabs.version", this.version.join('.'));
		}

		//tabmixplus
		try
		{
		    if(this.tabMixInstalled)
		    {
            	//just in case tablib isn't init yet
		    	tablib.init();

			    //duplicate
				if(typeof gBrowser.duplicateTab == "function")
				{ permaTabs.utils.patchFunction('gBrowser.duplicateTab',gBrowser.duplicateTab,"return newTab;", "if(aTab.hasAttribute('isPermaTab')){ if((gBrowser.getBrowserForTab(aTab).currentURI.spec=='' || gBrowser.getBrowserForTab(aTab).currentURI.spec=='about:blank') && aTab.getAttribute('permaTabUrl')){ gBrowser.getBrowserForTab(newTab).loadURI(aTab.getAttribute('permaTabUrl')); } newTab.removeAttribute('isPermaTab'); newTab.removeAttribute('permaTabId'); newTab.removeAttribute('permaTabUrl'); } return newTab;"); }

				//auto reload tabs
				if(typeof gBrowser.enableAutoReload == "function")
				{ permaTabs.utils.wrapFunction('gBrowser.enableAutoReload',gBrowser.enableAutoReload, permaTabs.patchedTabMixPlusEnableAutoReload); }
				if(typeof gBrowser.disableAutoReload == "function")
				{ permaTabs.utils.wrapFunction('gBrowser.disableAutoReload',gBrowser.disableAutoReload, permaTabs.patchedTabMixPlusDisableAutoReload); }
			}
		}
		catch(e){}


		this.showAllPermaTabs();


		//faviconizetab
		try
		{
			if(this.faviconizeTabInstalled && typeof faviconize.toggle == "function")
			{ permaTabs.utils.wrapFunction('faviconize.toggle', faviconize.toggle, permaTabs.patchedFaviconizeToogle); }
		}
		catch(e){}

		//duplicatetab
		try
		{
			if(this.duplicateTabInstalled && typeof duplicateTab.setClonedData == "function")
			{ permaTabs.utils.patchFunction('duplicateTab.setClonedData',duplicateTab.setClonedData,"ss.setTabState(aTab, aClonedData);", "ss.setTabState(aTab, aClonedData); if(aTab.hasAttribute('isPermaTab')){ aTab.removeAttribute('isPermaTab'); aTab.removeAttribute('permaTabId'); aTab.removeAttribute('permaTabUrl'); }"); }

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


		//brivate browsing observer
		this.PrivateBrowsingListenerFunction.prototype =
		{
			_os: null,
			_inPrivateBrowsing: false, // whether we are in private browsing mode
			_watcher: null, // the watcher object
			_autoStarted : false, // wheather private browsing mode is default mode

			init : function ()
			{
				this._inited = true;
				this._os = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
				this._os.addObserver(this, "private-browsing", false);
				this._os.addObserver(this, "quit-application", false);

				try
				{
					var pbs = Components.classes["@mozilla.org/privatebrowsing;1"].getService(Components.interfaces.nsIPrivateBrowsingService);
					this._inPrivateBrowsing = pbs.privateBrowsingEnabled;
					this._autoStarted = pbs.autoStarted;
				}
				catch(ex)
				{
					// ignore exceptions in older versions of Firefox
				}
			},

			observe : function (aSubject, aTopic, aData)
			{
				if (aTopic == "private-browsing")
				{
					if (aData == "enter")
					{
						this._inPrivateBrowsing = true;
						if (this.watcher && "onEnterPrivateBrowsing" in this._watcher)
						{ this.watcher.onEnterPrivateBrowsing(); }
					}
					else if (aData == "exit")
					{
						this._inPrivateBrowsing = false;
						if (this.watcher && "onExitPrivateBrowsing" in this._watcher)
						{ this.watcher.onExitPrivateBrowsing(); }
					}
				}
				else if (aTopic == "quit-application")
				{
					this._os.removeObserver(this, "quit-application");
					this._os.removeObserver(this, "private-browsing");
				}
			},

			get inPrivateBrowsing()
			{
				return this._inPrivateBrowsing;
			},

			get watcher()
			{
				return this._watcher;
			},

			set watcher(val)
			{
				this._watcher = val;
			},
			
			get autoStarted()
			{
			    return this._autoStarted;
			}
		};

        this.privateBrowsingListener = new this.PrivateBrowsingListenerFunction();


		//modify private browsing switch
		this.privateBrowsingListener.watcher =
		{
			onEnterPrivateBrowsing : function()
			{
				// we have just entered private browsing mode!
				permaTabs.enterPrivateBrowsing();
			},

			onExitPrivateBrowsing : function()
			{
				// we have just left private browsing mode!
				permaTabs.leavePrivateBrowsing();
			}
		};

		try
		{
			permaTabs.utils.patchFunction('gPrivateBrowsingUI.toggleMode', gPrivateBrowsingUI.toggleMode, 'this._privateBrowsingService.privateBrowsingEnabled = !this.privateBrowsingEnabled;', 'permaTabs.handlePrivateBrowsingChange(); this._privateBrowsingService.privateBrowsingEnabled = !this.privateBrowsingEnabled;');
		}
		catch(e){}


		return true;
	},

	deinit : function()
	{
		var enumerator = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator).getEnumerator("navigator:browser");
		var ffWindows = new Array();
		var currentWindow;

		while(enumerator.hasMoreElements() && (currentWindow = enumerator.getNext()))
		{
			if(currentWindow && currentWindow != window)
			{ ffWindows.push(currentWindow); }
		}

		if(ffWindows.length == 1)
		{ ffWindows[0].permaTabs.init(); }
		else
		{
			for(x in ffWindows)
			{ ffWindows[x].addEventListener("focus", ffWindows[x].permaTabs.init, false); }
		}
	},

	onTabSelected : function()
	{
		var browserIndex = this.getTabBrowserIndex(getBrowser().mCurrentTab);
		var localIndex = 0;
		var url = getBrowser().getBrowserAtIndex(browserIndex).currentURI.spec;
		var isPermaTab = false;

		if((url == '' || url == 'about:blank') && (localIndex = this.getPermaTabLocalIndex(getBrowser().mCurrentTab)) > -1)
		{
			isPermaTab = true;

			if(this.permaTabs[localIndex].url != '' && this.permaTabs[localIndex].url != 'about:blank')
			{ getBrowser().getBrowserAtIndex(browserIndex).loadURI(this.permaTabs[localIndex].url); }
		}

		getBrowser().mTabContainer.setAttribute('disableclose', isPermaTab);

		this.setToolbarButton();
	},
	
	setKeys : function()
	{
		var togglekey = document.getElementById("permaTabToggleKey");
		togglekey.setAttribute("key", permaTabs.prefs.getCharPref('extensions.permatabs.toggleKey'));
		togglekey.setAttribute("modifiers", permaTabs.prefs.getCharPref('extensions.permatabs.toggleKeyModificator'));
		togglekey.setAttribute("disabled", !permaTabs.prefs.getBoolPref('extensions.permatabs.toggleKeyActive'));
		
		var homekey = document.getElementById("permaTabHomeKey");
		homekey.setAttribute("key", permaTabs.prefs.getCharPref('extensions.permatabs.homeKey'));
		homekey.setAttribute("modifiers", permaTabs.prefs.getCharPref('extensions.permatabs.homeKeyModificator'));
		homekey.setAttribute("disabled", !permaTabs.prefs.getBoolPref('extensions.permatabs.homeKeyActive'));
	},

	updateContextMenu : function(e)
	{
		var closeTabID = "context_closeTab";
		var closeMenuItem = permaTabs.tabContextMenu.lastChild;

		for(var x = 0; x < permaTabs.tabContextMenu.childNodes.length; x++)
		{
			if(permaTabs.tabContextMenu.childNodes[x].getAttribute("id") == closeTabID)
			{
				closeMenuItem =  permaTabs.tabContextMenu.childNodes[x];
				break;
			}
		}
		
		if(permaTabs.prefs.getBoolPref('extensions.permatabs.hideAdditionalMenuItems'))
		{
			var optionsChanged = (permaTabs.menuItemsAdded &&
								 ((document.getElementById('permaTabsSubMenu') ? true : false) || (document.getElementById('permaTabContextMenuItemPermanentHome') ? true : false)));
		}
		else
		{
			var optionsChanged = (permaTabs.menuItemsAdded &&
								 ((document.getElementById('permaTabsSubMenu') ? true : false) != permaTabs.prefs.getBoolPref('extensions.permatabs.subMenu') ||
								 document.getElementById('permaTabContextMenuItemMakePermanent').hasAttribute('excluded') != (permaTabs.prefs.getBoolPref('extensions.permatabs.subMenuExclude') && permaTabs.prefs.getBoolPref('extensions.permatabs.subMenu')) ||
								 !document.getElementById('permaTabContextMenuItemPermanentHome')));
		}

		//delete and rebuild contextmenu when options changed
		if(optionsChanged)
		{
			var ids = {	1: "permaTabContextMenuItemMakePermanent",
						2: "permaTabContextMenuItemPermanentHome",
						3: "permaTabContextMenuItemReloadCurrentUrl",
						4: "permaTabContextMenuItemOpenInTab",
						5: "permaTabContextMenuItemPermanentHomeSet",
						6: "permaTabsSubMenuList",
						7: "permaTabsSubMenu",
						8: "permaTabsSeperator",
						9: "permaTabsSeperatorTMP",
						10:"permaTabsSeperatorFAV" };

			var failed = 0;
			
			for(i in ids)
			{
				try
				{
					permaTabs.tabContextMenu.removeChild(document.getElementById(ids[i]));
				}
				catch(e){ failed++; }
			}
		}

		//building contextmenu
		if(!permaTabs.menuItemsAdded || (optionsChanged && failed<10))
		{
			if(permaTabs.tabMixInstalled)
			{
				var seperator = document.createElement("menuseparator");
				seperator.setAttribute("id","permaTabsSeperatorTMP");
				permaTabs.tabContextMenu.insertBefore(seperator, closeMenuItem);
			}
			
			if(permaTabs.faviconizeTabInstalled && permaTabs.prefs.getBoolPref('extensions.permatabs.faviconizeMenuItemReposition'))
			{
				try
				{
					var faviconizeMenuItem = permaTabs.tabContextMenu.removeChild(document.getElementById('tabContextFaviconizeTab'));
					permaTabs.tabContextMenu.insertBefore(faviconizeMenuItem, closeMenuItem);

					if(permaTabs.prefs.getBoolPref('extensions.permatabs.faviconizeMenuItemSeperator'))
					{
						var seperator = document.createElement("menuseparator");
						seperator.setAttribute("id","permaTabsSeperatorFAV");
						permaTabs.tabContextMenu.insertBefore(seperator, closeMenuItem);
					}
				}
				catch(e){}
			}


			var menuItem1 = document.createElement("menuitem");
			menuItem1.setAttribute("label", document.getElementById("permatabStrings").getString("tab.togglePermanence.label"));
			menuItem1.setAttribute("id", "permaTabContextMenuItemMakePermanent");
			menuItem1.setAttribute("oncommand", "permaTabs.togglePermanence();");
			menuItem1.setAttribute("type", "checkbox");
			if(permaTabs.prefs.getBoolPref('extensions.permatabs.toggleKeyActive')){ menuItem1.setAttribute("key", "permaTabToggleKey"); }

			var menuItem2 = document.createElement("menuitem");
			menuItem2.setAttribute("label", document.getElementById("permatabStrings").getString("tab.goPermaHome.label"));
			menuItem2.setAttribute("id", "permaTabContextMenuItemPermanentHome");
			menuItem2.setAttribute("oncommand", "permaTabs.goHome();");
			if(permaTabs.prefs.getBoolPref('extensions.permatabs.homeKeyActive')){ menuItem2.setAttribute("key", "permaTabHomeKey"); }

			var menuItem3 = document.createElement("menuitem");
			menuItem3.setAttribute("label", document.getElementById("permatabStrings").getString("tab.reloadCurrentUrl.label"));
			menuItem3.setAttribute("id", "permaTabContextMenuItemReloadCurrentUrl");
			menuItem3.setAttribute("oncommand", "permaTabs.reloadCurrentUrl();");

			var menuItem4 = document.createElement("menuitem");
			menuItem4.setAttribute("label", document.getElementById("permatabStrings").getString("tab.openCurrentInTab.label"));
			menuItem4.setAttribute("id", "permaTabContextMenuItemOpenInTab");
			menuItem4.setAttribute("oncommand", "permaTabs.openCurrentInTab();");

			var menuItem5 = document.createElement("menuitem");
			menuItem5.setAttribute("label", document.getElementById("permatabStrings").getString("tab.setPermaHome.label"));
			menuItem5.setAttribute("id", "permaTabContextMenuItemPermanentHomeSet");
			menuItem5.setAttribute("oncommand", "permaTabs.setHome();");


			if(permaTabs.prefs.getBoolPref('extensions.permatabs.subMenu') && !permaTabs.prefs.getBoolPref('extensions.permatabs.hideAdditionalMenuItems'))
			{
				var submenu = document.createElement("menu");
				submenu.setAttribute("label", document.getElementById("permatabStrings").getString("tab.subMenu.label"));
				submenu.setAttribute("id","permaTabsSubMenu");

				var submenulist = document.createElement("menupopup");
				submenulist.setAttribute("id","permaTabsSubMenuList");

				if(permaTabs.prefs.getBoolPref('extensions.permatabs.subMenuExclude'))
				{
					menuItem1.setAttribute("excluded",true);
					permaTabs.tabContextMenu.insertBefore(menuItem1, closeMenuItem);
				}
				else
				{
					submenulist.appendChild(menuItem1);
					submenulist.appendChild(document.createElement("menuseparator"));
				}

				submenulist.appendChild(menuItem2);
				submenulist.appendChild(menuItem3);
				submenulist.appendChild(menuItem4);
				submenulist.appendChild(document.createElement("menuseparator"));
				submenulist.appendChild(menuItem5);

				submenu.appendChild(submenulist);
				permaTabs.tabContextMenu.insertBefore(submenu, closeMenuItem);
			}
			else
			{
				permaTabs.tabContextMenu.insertBefore(menuItem1, closeMenuItem);

				if(!permaTabs.prefs.getBoolPref('extensions.permatabs.hideAdditionalMenuItems'))
				{
					permaTabs.tabContextMenu.insertBefore(menuItem2, closeMenuItem);
					permaTabs.tabContextMenu.insertBefore(menuItem3, closeMenuItem);
					permaTabs.tabContextMenu.insertBefore(menuItem4, closeMenuItem);
					permaTabs.tabContextMenu.insertBefore(menuItem5, closeMenuItem);
				}
			}

			var seperator = document.createElement("menuseparator");
			seperator.setAttribute("id","permaTabsSeperator");
			permaTabs.tabContextMenu.insertBefore(seperator, closeMenuItem);


			permaTabs.menuItemsAdded = true;
		}

		var isPermaTab = (getBrowser().mContextTab && permaTabs.isPermaTab(getBrowser().mContextTab));
		var url = (getBrowser().mContextTab ? getBrowser().getBrowserAtIndex(permaTabs.getTabBrowserIndex(getBrowser().mContextTab)).currentURI.spec : '');
		var validurl = !(url == '' || url == 'about:blank');

		document.getElementById("permaTabContextMenuItemMakePermanent").setAttribute("checked", isPermaTab);
		
		if(!permaTabs.prefs.getBoolPref('extensions.permatabs.hideAdditionalMenuItems'))
		{
			document.getElementById("permaTabContextMenuItemPermanentHome").setAttribute("disabled", !isPermaTab);
			document.getElementById("permaTabContextMenuItemReloadCurrentUrl").setAttribute("disabled", (!isPermaTab || !validurl));
			document.getElementById("permaTabContextMenuItemOpenInTab").setAttribute("disabled", (!isPermaTab || !validurl));
			document.getElementById("permaTabContextMenuItemPermanentHomeSet").setAttribute("disabled", (!isPermaTab || !validurl || url==getBrowser().mContextTab.getAttribute("permaTabUrl")));
		}

		if(permaTabs.colorfultabsinstalled && document.getElementById("ctTabCtx") && permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish')){ document.getElementById("ctTabCtx").setAttribute("disabled", isPermaTab); }
		if(permaTabs.flagtabinstalled && document.getElementById("flagtab-options") && permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish')){ document.getElementById("flagtab-options").setAttribute("disabled", isPermaTab); }

		closeMenuItem.setAttribute('disabled', isPermaTab);
	},
	
	updateButtonContextMenu : function()
	{
        if(permaTabs.prefs.getBoolPref('extensions.permatabs.hideAdditionalMenuItems'))
        { return false; }
        
		var buttonsubmenulist = document.getElementById('permatabs-tooglebutton-submenu');
	    if(!buttonsubmenulist){ return false; }

		if(!document.getElementById('permaTabButtonContextMenuItemPermanentHome') || !document.getElementById('permaTabButtonContextMenuItemReloadCurrentUrl') || !document.getElementById('permaTabButtonContextMenuItemOpenInTab') || !document.getElementById('permaTabButtonContextMenuItemPermanentHomeSet'))
		{
			var menuItem1 = document.createElement("menuitem");
			menuItem1.setAttribute("label", document.getElementById("permatabStrings").getString("tab.goPermaHome.label"));
			menuItem1.setAttribute("id", "permaTabButtonContextMenuItemPermanentHome");
			menuItem1.setAttribute("oncommand", "permaTabs.goHome(true);");
			if(permaTabs.prefs.getBoolPref('extensions.permatabs.homeKeyActive')){ menuItem1.setAttribute("key", "permaTabHomeKey"); }

			var menuItem2 = document.createElement("menuitem");
			menuItem2.setAttribute("label", document.getElementById("permatabStrings").getString("tab.reloadCurrentUrl.label"));
			menuItem2.setAttribute("id", "permaTabButtonContextMenuItemReloadCurrentUrl");
			menuItem2.setAttribute("oncommand", "permaTabs.reloadCurrentUrl(true);");

			var menuItem3 = document.createElement("menuitem");
			menuItem3.setAttribute("label", document.getElementById("permatabStrings").getString("tab.openCurrentInTab.label"));
			menuItem3.setAttribute("id", "permaTabButtonContextMenuItemOpenInTab");
			menuItem3.setAttribute("oncommand", "permaTabs.openCurrentInTab(true);");

			var menuItem4 = document.createElement("menuitem");
			menuItem4.setAttribute("label", document.getElementById("permatabStrings").getString("tab.setPermaHome.label"));
			menuItem4.setAttribute("id", "permaTabButtonContextMenuItemPermanentHomeSet");
			menuItem4.setAttribute("oncommand", "permaTabs.setHome(true);");

			buttonsubmenulist.appendChild(menuItem1);
			buttonsubmenulist.appendChild(menuItem2);
			buttonsubmenulist.appendChild(menuItem3);
			buttonsubmenulist.appendChild(document.createElement("menuseparator"));
			buttonsubmenulist.appendChild(menuItem4);
		}
		
		var isPermaTab = (getBrowser().mCurrentTab && permaTabs.isPermaTab(getBrowser().mCurrentTab));
		var url = (getBrowser().mCurrentTab ? getBrowser().getBrowserAtIndex(permaTabs.getTabBrowserIndex(getBrowser().mCurrentTab)).currentURI.spec : '');
		var validurl = !(url == '' || url == 'about:blank');

		document.getElementById('permaTabButtonContextMenuItemPermanentHome').setAttribute("disabled", !isPermaTab);
		document.getElementById('permaTabButtonContextMenuItemReloadCurrentUrl').setAttribute("disabled", (!isPermaTab || !validurl));
		document.getElementById('permaTabButtonContextMenuItemOpenInTab').setAttribute("disabled", (!isPermaTab || !validurl));
		document.getElementById('permaTabButtonContextMenuItemPermanentHomeSet').setAttribute("disabled", (!isPermaTab || !validurl || url==getBrowser().mCurrentTab.getAttribute("permaTabUrl")));
	},
	
	setToolbarButtonType : function()
	{
	    if(!document.getElementById('permatabs-togglebutton'))
	    { return false; }
	    
		if(!permaTabs.prefs.getBoolPref('extensions.permatabs.hideAdditionalMenuItems'))
		{
		    document.getElementById('permatabs-togglebutton').setAttribute("type","menu-button");

            if(!document.getElementById('permatabs-tooglebutton-submenu'))
            {
				var submenu = document.createElement("menupopup");
				submenu.setAttribute("id","permatabs-tooglebutton-submenu");
				document.getElementById('permatabs-togglebutton').appendChild(submenu);
			}
			
		    try
		    {
		        document.getElementById('permatabs-togglebutton').removeEventListener("popupshowing", permaTabs.updateButtonContextMenu, false);
		    }
			catch(e){}

		    document.getElementById('permatabs-togglebutton').addEventListener("popupshowing", permaTabs.updateButtonContextMenu, false);
		}
		else
		{
		    document.getElementById('permatabs-togglebutton').setAttribute("type","checkbox");
		    
		    if(document.getElementById('permatabs-tooglebutton-submenu'))
		    { document.getElementById('permatabs-togglebutton').removeChild(document.getElementById('permatabs-tooglebutton-submenu')); }
		    
		    try
		    {
		        document.getElementById('permatabs-togglebutton').removeEventListener("popupshowing", permaTabs.updateButtonContextMenu, false);
		    }
			catch(e){}
		}
		
		if(permaTabs.prefs.getBoolPref('extensions.permatabs.toggleKeyActive')){ document.getElementById('permatabs-togglebutton').setAttribute("key", "permaTabToggleKey"); }
	},

	getTabBrowserIndex : function(tab)
	{
		var tabs = getBrowser().mTabContainer.childNodes;

		for(var i = 0; i < tabs.length; i++)
		{
			if(tabs[i] == tab)
			{ return i; }
		}

		return false;
	},

	getPermaTabLocalIndex : function(tab)
	{
		if(tab.hasAttribute("permaTabId"))
		{
			for(var tabIndex = 0; tabIndex < permaTabs.permaTabs.length; tabIndex++)
			{
				if(permaTabs.permaTabs[tabIndex].id == tab.getAttribute("permaTabId"))
				{ return tabIndex; }
			}
		}

		return -1;
	},

	getPermaTabById : function(id)
	{
		for(var x = 0; x < permaTabs.permaTabs.length; x++)
		{
			if(permaTabs.permaTabs[x].id == id)
			{ return permaTabs.permaTabs[x]; }
		}

		return false;
	},

	isPermaTab : function(tab)
	{
		return tab.hasAttribute("isPermaTab");
	},

	colorPermaTabs : function()
	{
		var colorrule = ((permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish')) ? 'background-color: ' + permaTabs.prefs.getCharPref("extensions.permatabs.color") + ' !important;' : '');
		var textcolorrule = ((permaTabs.prefs.getBoolPref('extensions.permatabs.labelSet')) ? 'color: ' + permaTabs.prefs.getCharPref("extensions.permatabs.labelColor") + ' !important;' : '');
		var imagerule = ((permaTabs.prefs.getBoolPref('extensions.permatabs.removeBackground')) ? 'background-image: none !important;' : '');
		var closeimagerule = (permaTabs.prefs.getBoolPref('extensions.permatabs.closeButtonImage') ? 'display: -moz-box !important; list-style-image: url(chrome://permatabs/skin/images/toolbarbutton_s.png) !important; -moz-image-region: rect(0px, 16px, 15px, 0px) !important;' : 'display: none !important;');
		
	    var macrule1 = "";
		var macrule2 = "";
		var macrule3 = "";
	    var macrule4 = "";
		var macrule5 = "";
		var macrule6 = "";

		if(permaTabs.prefs.getBoolPref('extensions.permatabs.macStyle'))
		{
		    if(permaTabs.prefs.getBoolPref('extensions.permatabs.macStyleBackground'))
		    {
				var macrule1 = "background: transparent url(chrome://permatabs/skin/images/mac-tab-left-bkgnd.png) no-repeat scroll top right !important;";
				var macrule2 = "background: transparent url(chrome://permatabs/skin/images/mac-tab-middle-bkgnd.png) repeat-x scroll top center !important;";
				var macrule3 = "background: transparent url(chrome://permatabs/skin/images/mac-tab-right-bkgnd.png) no-repeat scroll top left !important;";
			}

			var macrule4 = "background: transparent url(chrome://permatabs/skin/images/mac-tab-left.png) no-repeat scroll top right !important;";
			var macrule5 = "background: transparent url(chrome://permatabs/skin/images/mac-tab-middle.png) repeat-x scroll top center !important;";
			var macrule6 = "background: transparent url(chrome://permatabs/skin/images/mac-tab-right.png) no-repeat scroll top left !important;";
		}

		try
		{
			for(var x = 0; x < document.styleSheets.length; x++)
			{
				if(document.styleSheets[x].href == 'chrome://permatabs/skin/permatabs.css')
				{
					document.styleSheets[x].deleteRule(document.styleSheets[x].cssRules.length - 1);

				    document.styleSheets[x].deleteRule(document.styleSheets[x].cssRules.length - 1);
				    document.styleSheets[x].deleteRule(document.styleSheets[x].cssRules.length - 1);
				    document.styleSheets[x].deleteRule(document.styleSheets[x].cssRules.length - 1);
				    document.styleSheets[x].deleteRule(document.styleSheets[x].cssRules.length - 1);
				    document.styleSheets[x].deleteRule(document.styleSheets[x].cssRules.length - 1);
				    document.styleSheets[x].deleteRule(document.styleSheets[x].cssRules.length - 1);
				    
				    document.styleSheets[x].deleteRule(document.styleSheets[x].cssRules.length - 1);

				    document.styleSheets[x].deleteRule(document.styleSheets[x].cssRules.length - 1);


					document.styleSheets[x].insertRule('.tabbrowser-tab[isPermaTab=true] .tabs-closebutton, .tabbrowser-tab[isPermaTab=true] .tab-close-button { ' + closeimagerule + '}', document.styleSheets[x].cssRules.length);

					document.styleSheets[x].insertRule('#browser tab.tabbrowser-tab[isPermaTab=true] * { background-color: transparent !important;' + textcolorrule + '}', document.styleSheets[x].cssRules.length);

				    document.styleSheets[x].insertRule('#browser tab.tabbrowser-tab:not([selected="true"])[isPermaTab=true] .tab-image-left   { ' + macrule1 + '}', document.styleSheets[x].cssRules.length);
				    document.styleSheets[x].insertRule('#browser tab.tabbrowser-tab:not([selected="true"])[isPermaTab=true] .tab-image-middle { ' + macrule2 + '}', document.styleSheets[x].cssRules.length);
				    document.styleSheets[x].insertRule('#browser tab.tabbrowser-tab:not([selected="true"])[isPermaTab=true] .tab-image-right  { ' + macrule3 + '}', document.styleSheets[x].cssRules.length);
				    document.styleSheets[x].insertRule('#browser tab.tabbrowser-tab[isPermaTab=true] .tab-image-left   { ' + macrule4 + '}', document.styleSheets[x].cssRules.length);
				    document.styleSheets[x].insertRule('#browser tab.tabbrowser-tab[isPermaTab=true] .tab-image-middle { ' + macrule5 + '}', document.styleSheets[x].cssRules.length);
				    document.styleSheets[x].insertRule('#browser tab.tabbrowser-tab[isPermaTab=true] .tab-image-right  { ' + macrule6 + '}', document.styleSheets[x].cssRules.length);

					document.styleSheets[x].insertRule('#browser tab.tabbrowser-tab[isPermaTab=true] {' + colorrule + textcolorrule + imagerule + '}', document.styleSheets[x].cssRules.length);

					break;
				}
			}
		}
		catch(e){}
	},

	togglePermanence : function(toggleCurrentTab)
	{
		if(toggleCurrentTab)
		{ var currentTab = getBrowser().mCurrentTab; }
		else
		{ var currentTab = getBrowser().mContextTab; }

		var url = getBrowser().getBrowserAtIndex(permaTabs.getTabBrowserIndex(currentTab)).currentURI.spec;
		var isPermaTab = permaTabs.isPermaTab(currentTab);
		var loadurl = false;
		
		//permaTabsStartPage can not be permanent
		if(url=="chrome://permatabs/content/start.xul"){ return false; }

		if(!toggleCurrentTab)
		{ document.getElementById('permaTabContextMenuItemMakePermanent').setAttribute('checked', !isPermaTab); }

		if(!isPermaTab)
		{
			if(currentTab.hasAttribute('permaTabUrl') && (url == '' || url == 'about:blank') && getBrowser().getBrowserAtIndex(permaTabs.getTabBrowserIndex(currentTab)).sessionHistory.count == 0)
			{
				url = currentTab.getAttribute('permaTabUrl');
				loadurl = true;
			}

			var id = permaTabs.getNextId();
			
			currentTab.setAttribute('isPermaTab', true);
			currentTab.setAttribute('permaTabId', id);
			currentTab.setAttribute('permaTabUrl', url);

			var faviconized = (currentTab.hasAttribute('faviconized') ? 1 : 0);

			permaTabs.permaTabs[permaTabs.permaTabs.length] = {	'id'			: id,
																'title'			: currentTab.label,
																'url'			: url,
																'image'			: currentTab.getAttribute('image'),
																'faviconized'	: faviconized							};

			try
			{
				if(typeof window.setColor == "function" && permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish'))
				{
				    //FF 3
					for(var i = 0 ; i < document.getAnonymousNodes(currentTab).length; i++)
					{ document.getAnonymousNodes(currentTab)[i].style.setProperty("background-color", '' ,''); }
				}
			}
			catch(e)
			{}
		}
		else
		{
		    var id = currentTab.getAttribute('permaTabId');
		    
			if(!permaTabs.prefs.getBoolPref('extensions.permatabs.askUnset') || confirm(document.getElementById("permatabStrings").getString("tab.askUnset.label"))==true)
			{
				permaTabs.permaTabs.splice(permaTabs.getPermaTabLocalIndex(currentTab), 1);

				currentTab.removeAttribute('isPermaTab');
				currentTab.removeAttribute('permaTabId');
			}
			else
			{ isPermaTab = !isPermaTab; }
		}

		if(permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish'))
		{ currentTab.style.removeProperty('background-color'); }
		currentTab.style.removeProperty('color');

		if(loadurl)
		{ getBrowser().getBrowserAtIndex(permaTabs.getTabBrowserIndex(currentTab)).loadURI(url); }

		if(currentTab == getBrowser().mCurrentTab)
		{ getBrowser().mTabContainer.setAttribute('disableclose', !isPermaTab); }


		permaTabs.savePermaTabs();
		this.setToolbarButton();

		
		if(this.colorfultabsinstalled && permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish'))
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

		if(this.flagtabinstalled && permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish'))
		{ this.flagtabUpdateBottomBar(!isPermaTab); }

		if(this.chromatabsplusinstalled && permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish'))
		{ CHROMATABS.colorizeTab(currentTab, true); }
		
		if(this.tabMixInstalled)
		{ this.refreshAutoReloadData(currentTab, id); }
	},

	goHome : function(useCurrentTab)
	{
		if(useCurrentTab)
		{ var currentTab = getBrowser().mCurrentTab; }
		else
		{ var currentTab = getBrowser().mContextTab; }
		
		if(!permaTabs.isPermaTab(currentTab)){ return false; }

		var url = currentTab.getAttribute("permaTabUrl");
		getBrowser().selectedTab = currentTab;

		permaTabs.tempAllowed = true;
		getBrowser().mCurrentBrowser.loadURI(url);
		permaTabs.tempAllowed = false;
		
		return true;
	},
	
	setHome : function(useCurrentTab)
	{
		if(useCurrentTab)
		{ var currentTab = getBrowser().mCurrentTab; }
		else
		{ var currentTab = getBrowser().mContextTab; }
		
  		if(!permaTabs.isPermaTab(currentTab)){ return false; }

		if(permaTabs.prefs.getBoolPref('extensions.permatabs.askOverwrite') && confirm(document.getElementById("permatabStrings").getString("tab.askOverwrite.label"))!=true)
		{ return false; }

		var url = getBrowser().getBrowserAtIndex(permaTabs.getTabBrowserIndex(currentTab)).currentURI.spec;
		currentTab.setAttribute('permaTabUrl', url);

		var permatabdata = permaTabs.permaTabs[permaTabs.getPermaTabLocalIndex(currentTab)];
		permatabdata['title'] = currentTab.label;
		permatabdata['url'] = url;
		permatabdata['image'] = currentTab.getAttribute('image');

		permaTabs.savePermaTabs();
		
		return true;
	},

	reloadCurrentUrl : function(useCurrentTab)
	{
		if(useCurrentTab)
		{ var currentTab = getBrowser().mCurrentTab; }
		else
		{ var currentTab = getBrowser().mContextTab; }

		if(!permaTabs.isPermaTab(currentTab)){ return false; }

		var url = getBrowser().getBrowserAtIndex(permaTabs.getTabBrowserIndex(currentTab)).currentURI.spec;
		getBrowser().selectedTab = currentTab;

		permaTabs.tempAllowed = true;
		getBrowser().mCurrentBrowser.loadURI(url);
		permaTabs.tempAllowed = false;
		
		return true;
	},

	openCurrentInTab : function(useCurrentTab)
	{
		if(useCurrentTab)
		{ var currentTab = getBrowser().mCurrentTab; }
		else
		{ var currentTab = getBrowser().mContextTab; }

		var url = getBrowser().getBrowserAtIndex(permaTabs.getTabBrowserIndex(currentTab)).currentURI.spec;

		var tab = getBrowser().addTab(url);
		tab.focus();
	},

	restorePermaTabs : function()
	{
		var restore = {};

		for(var x in {'ids':'', 'urls':'', 'titles':'', 'images':'', 'faviconizeds':''})
		{ restore[x] = this.prefs.getCharPref('extensions.permatabs.permatabs.' + x).split("\n"); }

		var makeIds = (restore.ids == '' && restore.urls != '');
		var makeFaviconizeds = (restore.faviconizeds == '');

		this.colorPermaTabs();

		for(var i = 0; i < restore.urls.length; i++)
		{
			if(restore.urls[i] == "")
			{ continue; }

			var id = (!makeIds ? restore.ids[i] : this.getNextId());

			this.permaTabs[this.permaTabs.length] = {	'id'			: id,
														'title'			: restore.titles[i],
														'url'			: restore.urls[i],
														'image'			: restore.images[i],
														'faviconized'	: makeFaviconizeds ? 0 : parseInt(restore.faviconizeds[i])	};
		}

		if(makeIds)
		{ this.savePermaTabs(); }

		if(permaTabs.ssWillRestore)
		{ document.addEventListener("SSTabRestoring", permaTabs.handleSessionStoreTabRestore, false); }
	},

	savePermaTabs : function()
	{
	    //dont save in private browsing mode
		if(permaTabs.privateBrowsingListener.inPrivateBrowsing && !permaTabs.privateBrowsingListener.autoStarted)
		{ return false; }

		var order = [];

		for(var x = 0; x < getBrowser().mTabContainer.childNodes.length; x++)
		{
			if((i = this.getPermaTabLocalIndex(getBrowser().mTabContainer.childNodes[x])) > -1)
			{ order.push(i); }
		}

		var save = {'id' : '', 'url' : '', 'title' : '', 'image' : '', 'faviconized' : ''};

		for(var i = 0; i < order.length; i++)
		{
			for(x in save)
			{
				save[x] += this.permaTabs[order[i]][x].toString() + ((i + 1 < order.length) ? "\n" : "");
			}
		}

		for(i in save)
		{ this.prefs.setCharPref("extensions.permatabs.permatabs." + i + "s", save[i]); }

		this.prefs.savePrefFile(null);
	},
	
	closeAllPermaTabs : function(force, prefwindow, keepInternal)
	{
	    if(!force && !permaTabs.prefs.getBoolPref('extensions.permatabs.doNotPromptOnCloseAllPermaTabs'))
	    {
	        if(prompt(document.getElementById("permatabStrings").getString("tab.askCloseAll.label"),"")!=document.getElementById("permatabStrings").getString("tab.askCloseAll.confirmString"))
	        {
				if(prefwindow)
				{ prefwindow.focus(); }

				return false;
			}
	    }

		for(var x = getBrowser().mTabContainer.childNodes.length-1; x >=0; x--)
		{
			permaTabs.closePermaTab(getBrowser().mTabContainer.childNodes[x], keepInternal);
		}
		
		if(!force)
		{ permaTabs.savePermaTabs(); }
		
		if(prefwindow)
		{ prefwindow.focus(); }
	},
	
	closePermaTab : function(aTab, keepInternal)
	{
        if(permaTabs.getPermaTabLocalIndex(aTab)>-1)
        {
			var id = aTab.getAttribute("permaTabId");

		    aTab.removeAttribute('isPermaTab');

			if(this.tabMixInstalled && !keepInternal)
			{ this.refreshAutoReloadData(aTab); }

		    getBrowser().removeTab(aTab);

			if(!keepInternal)
			{
				permaTabs.permaTabs.splice(permaTabs.getPermaTabLocalIndex(aTab), 1);
			}
		}
	},

	getActualLinkNode : function(node)
	{
		if(!node.hasAttribute('href'))
		{
			var parent = node.parentNode;

			while(parent && parent.hasAttribute && !parent.hasAttribute('href'))
			{
				parent = parent.parentNode;
			}

			if(parent && parent.hasAttribute && parent.hasAttribute('href'))
			{ node = parent; }
		}

		return node;
	},

	tempAllowSameUrlDomain : function()
	{
		if(permaTabs.isPermaTab(getBrowser().mCurrentTab) &&
			(permaTabs.prefs.getBoolPref('extensions.permatabs.allowUrlbarDomain') &&
				(!permaTabs.prefs.getBoolPref('extensions.permatabs.forceNewTabs') ||
					permaTabs.prefs.getBoolPref('extensions.permatabs.forceNewTabsDomain'))) &&
			(gURLBar.value.replace(/[htfps]{3,}:\/\/([^\/]*)\/*.*/i,'$1')==getBrowser().mCurrentBrowser.currentURI.host || 
				(permaTabs.getBaseDomain(gURLBar.value)==permaTabs.getBaseDomain(getBrowser().mCurrentBrowser.currentURI, true) && 
					permaTabs.prefs.getBoolPref('extensions.permatabs.allowSubDomains') &&
					permaTabs.prefs.getBoolPref('extensions.permatabs.forceNewTabsDomain') &&
					permaTabs.prefs.getBoolPref('extensions.permatabs.forceNewTabs'))))
		{ permaTabs.tempAllowed = true; }
	},

	shouldOpenInNewTab : function(linkNode)
	{
		try
		{
			return (linkNode.hasAttribute('href') &&
					!/javascript\s*:/.test(linkNode.getAttribute('href').toLowerCase()) &&
					permaTabs.prefs.getBoolPref('extensions.permatabs.forceNewTabs') &&
					!(linkNode.host && 
						linkNode.host==getBrowser().mCurrentBrowser.currentURI.host && 
						permaTabs.prefs.getBoolPref('extensions.permatabs.forceNewTabsDomain')) &&
					!(getBrowser().mCurrentTab.hasAttribute('permaTabUrl') && 
						permaTabs.getBaseDomain(linkNode.href)==permaTabs.getBaseDomain(getBrowser().mCurrentTab.getAttribute('permaTabUrl')) && 
						permaTabs.prefs.getBoolPref('extensions.permatabs.allowSubDomains') && 
						permaTabs.prefs.getBoolPref('extensions.permatabs.forceNewTabsDomain')) &&
					(!linkNode.href || linkNode.getAttribute('href').indexOf('#') != 0));
		}
		catch(e)
		{ return false; }
	},
	
	getBaseDomain : function(url, URIObject)
	{
		if(!url){ return null; }
		
		try
		{
			if(URIObject) 
			{ url = permaTabs.eTLDService.getBaseDomain(url); }
			else
			{ url = permaTabs.eTLDService.getBaseDomainFromHost(url); }
		}
		catch(e)
		{ return null; }
		
		url = url.replace(new RegExp(/\/(.*)/),"");
		url = url.replace(new RegExp(/\?(.*)/),"");
		url = url.replace(new RegExp(/#(.*)/),"");

		return url;
	},
	
	setToolbarButton : function()
	{
		var isPermaTab = (this.getPermaTabLocalIndex(getBrowser().mCurrentTab)>-1 ? true : false);

	    if(document.getElementById('permatabs-togglebutton'))
	    {
			document.getElementById('permatabs-togglebutton').setAttribute('checked', isPermaTab);
		}

		return true;
	},

	patchedContentAreaClick : function(event, fieldNormalClicks)
	{
		if(!event.isTrusted)
		{ return true; }

		var target = permaTabs.getActualLinkNode(event.target);

		if(permaTabs.isPermaTab(getBrowser().mCurrentTab) && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey && event.button != 1 && event.button != 2 && permaTabs.shouldOpenInNewTab(target) && !event.getPreventDefault())
		{
			var newEvent = document.createEvent("MouseEvents");

			if(permaTabs.OS != 'Darwin')
			{ newEvent.initMouseEvent("click", event.bubbles, event.cancelable, event.view, event.detail, event.screenX, event.screenY, event.clientX, event.clientY, true, event.altKey, event.shiftKey, event.metaKey, event.button, event.relatedTarget); }
			else
			{ newEvent.initMouseEvent("click", event.bubbles, event.cancelable, event.view, event.detail, event.screenX, event.screenY, event.clientX, event.clientY, event.ctrlKey, event.altKey, event.shiftKey, true, event.button, event.relatedTarget); }

			event.preventDefault();
			event.stopPropagation();

			event.target.dispatchEvent(newEvent);

			return false;
		}

		return $base();
	},

	patchedBrowserLoadURL : function(aTriggeringEvent, aPostData)
	{
		if(permaTabs.isPermaTab(getBrowser().mCurrentTab) && !permaTabs.tempAllowed)
		{
			if(aTriggeringEvent instanceof MouseEvent && aTriggeringEvent.button == 2)
			return false;

			var url = gURLBar.value;

			if(aTriggeringEvent)
			{
				handleURLBarRevert();
				content.focus();
				gBrowser.loadOneTab(url, null, null, aPostData, false, true);
				aTriggeringEvent.preventDefault();
				aTriggeringEvent.stopPropagation();
			}
			else
			{ gBrowser.loadOneTab(url, null, null, aPostData, false, true); }

			content.focus();
			
			return true;
		}
		else
		{
			var returnvalue = $base();
			
			permaTabs.tempAllowed = false;
			return returnvalue;
		}
	},

	patchedLoadURI : function(uri, referrer, postData, allowThirdPartyFixup)
	{
		if(permaTabs.isPermaTab(getBrowser().mCurrentTab) && !permaTabs.tempAllowed)
		{ gBrowser.loadOneTab(uri, referrer, null, postData, false, allowThirdPartyFixup); }
		else
		{ permaTabs.tempAllowed = false; }
		
		return $base();
	},

	patchedGBrowserLoadURI : function(aURI, aReferrerURI, aCharset)
	{
		if(permaTabs.isPermaTab(getBrowser().mCurrentTab) && !permaTabs.tempAllowed)
		{ gBrowser.loadOneTab(uri, referrer, null, postData, false, allowThirdPartyFixup); }
		else
		{ permaTabs.tempAllowed = false; }

		return $base();
	},
	
	patchedFaviconizeToogle : function(tab)
	{
		if(!tab || tab.localName != 'tab')
		{ tab = gBrowser.mCurrentTab; }

		var ret = $base();

		if(permaTabs.isPermaTab(tab))
		{
			try
			{
				permaTabs.permaTabs[permaTabs.getPermaTabLocalIndex(tab)].faviconized = tab.hasAttribute('faviconized') ? 1 : 0;
				permaTabs.savePermaTabs();
			}
			catch(e){}
		}

		return ret;
	},
	
	flagtabUpdateBottomBar : function(status)
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
	
	patchedTabMixPlusEnableAutoReload : function(aTab, reloadData)
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
	    else if(permaTabs.isPermaTab(aTab))
        {
            permaTabs.refreshAutoReloadData(aTab);
		}
	},
	
    patchedTabMixPlusDisableAutoReload : function(aTab)
    {
        $base();

	    if(permaTabs.isPermaTab(aTab))
        {
		    permaTabs.refreshAutoReloadData(aTab);
		}
    },
    
    refreshAutoReloadData : function(aTab, id)
    {
	    if(permaTabs.prefs.getBoolPref('extensions.permatabs.doNotSaveTabMixPlusRefreshData'))
	    { return false; }

        var tabPreferences = permaTabs.getTabPref();
        
        var permaTabId = (id ? id : aTab.getAttribute("permaTabId"));

		if(aTab.hasAttribute("reload-data") && permaTabs.isPermaTab(aTab))
		{
			if(!tabPreferences[permaTabId])
			{ tabPreferences[permaTabId] = {}; }

			tabPreferences[permaTabId].tabMixPlusAutoReload = aTab.getAttribute("reload-data");

	        permaTabs.setTabPref(tabPreferences);
		}
		else if(tabPreferences[permaTabId])
        {
			delete tabPreferences[permaTabId].tabMixPlusAutoReload;

			var count = 0;
			for(i in tabPreferences[permaTabId]){ count++; }
			if(count==0){ delete tabPreferences[permaTabId]; }

	    	permaTabs.setTabPref(tabPreferences);
		}
    },

	getTabPref : function()
	{
		var str = permaTabs.prefs.getCharPref('extensions.permatabs.permatabs.tabPreferences');
		if(!str){ str = "{}"; }
		
        try
        {
            //FF 3.5
			return JSON.parse(str);
        }
        catch(e)
        {
            //FF 3
			var nativeJSON = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);
			return nativeJSON.decode(str);
        }
	},
	
	setTabPref : function(tabPreferences)
	{
	    //dont save in private browsing mode
		if(permaTabs.privateBrowsingListener.inPrivateBrowsing && !permaTabs.privateBrowsingListener.autoStarted)
		{ return false; }

		try
		{
		    //FF 3.5
			var str = JSON.stringify(tabPreferences);
		}
		catch(e)
		{
			//FF 3
			var nativeJSON = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);
			var str = nativeJSON.encode(tabPreferences);
		}
		
		permaTabs.prefs.setCharPref('extensions.permatabs.permatabs.tabPreferences', str);
	},

	showAllPermaTabs : function()
	{
	    var tabPreferences = permaTabs.getTabPref();
	    
		for(var i = (permaTabs.permaTabs.length-1); i >= 0 ; i--)
		{ permaTabs.showPermaTab(permaTabs.permaTabs[i].id, (tabPreferences[permaTabs.permaTabs[i].id] ? tabPreferences[permaTabs.permaTabs[i].id] : false)); }

		getBrowser().tabContainer.addEventListener("TabMove", function(){ permaTabs.savePermaTabs(); }, false);
	},

	showPermaTab : function(id, tabPreferences, position)
	{
		var props = permaTabs.getPermaTabById(id);
		var tabs = getBrowser().mTabContainer.getElementsByAttribute('permaTabId', id);
		var tab = null;
		var loadonstartup = this.prefs.getBoolPref('extensions.permatabs.loadonstartup');

		if(!position){ position = 0; }

		if(!(tabs && (tab = tabs[0])))
		{
			tab = getBrowser().addTab();

			//there is a problem with tabmixplus, so i need to try-catch it			
			try {
				getBrowser().moveTabTo(tab, position);
			}
			catch(e){}

			tab.setAttribute('isPermaTab', true);
			tab.setAttribute('permaTabId', props.id);
			tab.setAttribute('permaTabUrl', props.url);
			tab.setAttribute('image', props.image);
			getBrowser().setTabTitle(tab);
			getBrowser().updateIcon(tab);
			
			tab.style.removeProperty('background-color');
			tab.style.removeProperty('color');
			
			if(loadonstartup)
			{ gBrowser.getBrowserForTab(tab).loadURI(props.url); }
		}

		if(tab && permaTabs.faviconizeTabInstalled && props.faviconized && !tab.hasAttribute('faviconized'))
		{ faviconize.toggle(tab); }
		
		try
		{
			if(permaTabs.tabMixInstalled && tabPreferences && tabPreferences.tabMixPlusAutoReload)
			{ gBrowser.enableAutoReload(tab, tabPreferences.tabMixPlusAutoReload); }
		}
		catch(e){}
	},

	handleSessionStoreTabRestore : function(e)
	{
		if(++permaTabs.ssTabsRestored >= getBrowser().mTabContainer.childNodes.length)
		{
			permaTabs.ssRestored = true;
			permaTabs.init();
		}
	},

	getNextId : function()
	{
		var id = permaTabs.prefs.getIntPref("extensions.permatabs.nextId");
		permaTabs.prefs.setIntPref("extensions.permatabs.nextId", id + 1);

		return id;
	},
	
	PrivateBrowsingListenerFunction : function()
	{
  		this.init();
	},

	handlePrivateBrowsingChange : function()
	{
	    //function gets called befor entering/leaving private mode
	    
		if(!permaTabs.privateBrowsingListener.inPrivateBrowsing)
		{
			permaTabs.beforeEnterPrivateBrowsing();
		}
		else
		{
			permaTabs.beforeLeavePrivateBrowsing();
		}
	},
	
	beforeEnterPrivateBrowsing : function()
	{
		permaTabs.closeAllPermaTabs(true, false, true);
	},
	
	enterPrivateBrowsing : function()
	{
  		//permaTabs.showAllPermaTabs();
	},
	
	beforeLeavePrivateBrowsing : function()
	{
	    permaTabs.closeAllPermaTabs(true);
	},

	leavePrivateBrowsing : function()
	{
        window.setTimeout("permaTabs.afterLeavePrivateBrowsing()", 300);
	},

	afterLeavePrivateBrowsing : function()
	{
	    permaTabs.showAllPermaTabs();
	    permaTabs.savePermaTabs();
	},
	
	OptionWindow : function()
	{
	    var options = window.openDialog("chrome://permatabs/content/prefsWindow.xul", "PermaTabs Options", "chrome,titlebar,toolbar,centerscreen");
	    options.focus();
	    return true;
	},
	
	utils :
	{
		wrappedFunctions : {},

		wrapFunction : function(name, orig, wrapper)
		{
			if(permaTabs.utils.wrappedFunctions[name])
			{ return false; }

			permaTabs.utils.wrappedFunctions[name] = orig;
			eval(name + ' = ' + wrapper.toString().replace('$base()', 'permaTabs.utils.wrappedFunctions["' + name + '"].apply(this, arguments);'));
			
			return true;
		},

		patchFunction : function(name, func, search, replace)
		{
			eval(name + ' = ' + func.toString().replace(search, replace));
			return true;
		}
	}
}

window.addEventListener("load", function() { permaTabs.init(); }, false);
window.addEventListener("DOMContentLoaded", function() { permaTabs.init(); }, false);
window.addEventListener("unload", function() { permaTabs.deinit(); }, false);