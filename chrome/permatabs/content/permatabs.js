// permatabs : 1.7.0
// contact   : david@donesmart.com
// copyright : 2006-2007 donesmart ltd

// modified to work in Firefox 3 by deos in June 2008 (or at least tried to do this)
// Added Permatab Home function and bump to version 1.8.0
// known issues: home button overwrites permatabs, sometimes there is no menue-entry for permatabbing, problems with opening a whole bookmark folder
// contact: deos.hab@freenet.de

var permaTabs =
{
  version : [1,7,0],
  prevVersion : false,
  prerequisites : false,
  initialized : false,
  permaTabs : [],
  prefs : null,
  tabContextMenu : null,
  tabMixInstalled : false,
  faviconizeTabInstalled : false,
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

  __init : function()
  {
    if(this.initialized)
      return;

    if(!this.delayedStartupCall)
    {
      this.delayedStartupCall = true;
      permaTabs.utils.patchFunction('window.delayedStartup', window.delayedStartup, 'AugmentTabs.init();', 'permaTabs.init(); AugmentTabs.init();');
      return;
    }

    var firstInit = this.firstInit;
    this.firstInit = false;

    var enumerator = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator).getEnumerator("navigator:browser");
    var currentWindow;
    while(enumerator.hasMoreElements() && (currentWindow = enumerator.getNext()))
    {
      if(!currentWindow)
        continue;

      if(firstInit && currentWindow != window)
        this.firstWindow = false;

      currentWindow.removeEventListener("focus", currentWindow.permaTabs.init, false);

      if(currentWindow.permaTabs && currentWindow.permaTabs.initialized)
        return;
    }

    if(!this.prerequisites)
    {
      this.prerequisites = true;

      this.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
      this.tabContextMenu = document.getElementById('content').mStrip.childNodes[1];
      this.OS = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime).OS;

      if(this.prefs.getPrefType("extensions.permatabs.permatabs.urls") != this.prefs.PREF_STRING ||
         this.prefs.getPrefType("extensions.permatabs.permatabs.titles") != this.prefs.PREF_STRING ||
         this.prefs.getPrefType("extensions.permatabs.permatabs.images") != this.prefs.PREF_STRING)
      {

        this.firstInstall = true;
        var sites = {
          news :            [{'url': 'http://news.google.com/',    'title': 'Google News',        'image': 'http://www.google.com/favicon.ico'},
                             {'url': 'http://news.bbc.co.uk/',     'title': 'BBC News',           'image': 'http://news.bbc.co.uk/favicon.ico'},
                             {'url': 'http://www.cnn.com/',        'title': 'CNN.com',            'image': 'http://www.cnn.com/favicon.ico'},
                             {'url': 'http://nytimes.com/',        'title': 'The New York Times', 'image': 'http://nytimes.com/favicon.ico'},
                             {'url': 'http://www.theonion.com/',   'title': 'The Onion',          'image': 'http://www.theonion.com/favicon.ico'}],
          socialBookmarks : [{'url': 'http://del.icio.us/',        'title': 'del.icio.us',        'image': 'http://del.icio.us/favicon.ico'},
                             {'url': 'http://reddit.com/',         'title': 'reddit.com',         'image': 'http://reddit.com/favicon.ico'},
                             {'url': 'http://www.technorati.com/', 'title': 'Technorati',         'image': 'http://www.technorati.com/favicon.ico'},
                             {'url': 'http://digg.com/',           'title': 'Digg',               'image': 'http://digg.com/favicon.ico'}],
          commerce :        [{'url': 'http://rover.ebay.com/rover/1/711-1751-2978-71/1?AID=5463217&PID=2027406&mpre=http%3A//www.ebay.com/',
                              'title': 'eBay', 'image': 'http://www.ebay.com/favicon.ico'}]};

        var indexes = {news: Math.floor(Math.random() * sites.news.length), social: Math.floor(Math.random() * sites.socialBookmarks.length), commerce: 0}

        var save = {ids : [1,2,3],
                    urls : [sites.socialBookmarks[indexes.social].url, sites.commerce[indexes.commerce].url, sites.news[indexes.news].url],
                    titles : [sites.socialBookmarks[indexes.social].title, sites.commerce[indexes.commerce].title, sites.news[indexes.news].title],
                    images : [sites.socialBookmarks[indexes.social].image, sites.commerce[indexes.commerce].image, sites.news[indexes.news].image],
                    faviconizeds : [0,0,0]};

        for(x in save)
          this.prefs.setCharPref('extensions.permatabs.permatabs.' + x, save[x].join('\n'));
      }

      var ss = Cc["@mozilla.org/browser/sessionstartup;1"].getService(Ci.nsISessionStartup);
      this.ssWillRestore = ss.doRestore() && this.firstWindow;

      ss = Components.classes["@mozilla.org/browser/sessionstore;1"].getService(Components.interfaces.nsISessionStore);
      ss.persistTabAttribute('isPermaTab');
      ss.persistTabAttribute('permaTabId');
      ss.persistTabAttribute('permaTabUrl');

      permaTabs.utils.patchFunction('getBrowser().removeTab', getBrowser().removeTab, 'var l = this.mTabContainer.childNodes.length;', 'if(aTab.hasAttribute("isPermaTab")) return; var l = this.mTabContainer.childNodes.length;');
      permaTabs.utils.patchFunction('getBrowser().warnAboutClosingTabs', getBrowser().warnAboutClosingTabs, 'var numTabs = this.mTabContainer.childNodes.length;', 'var numTabs = this.mTabContainer.childNodes.length - permaTabs.permaTabs.length; if(!aAll && getBrowser().mContextTab && permaTabs.isPermaTab(getBrowser().mContextTab)) numTabs++;');

	  //permaTabs.utils.patchFunction('BookmarksCommand.openGroupBookmark', BookmarksCommand.openGroupBookmark, 'var doReplace = PREF.getBoolPref("browser.tabs.loadFolderAndReplace");', 'var doReplace = false;');
	  this.prefs.setBoolPref("browser.tabs.loadFolderAndReplace",false); // <-- little trick because i dont know an other way...

	  permaTabs.utils.patchFunction('getBrowser().setTabTitle', getBrowser().setTabTitle, 'if (!title) {', 'var tabIndex = 0; var tabUrl = getBrowser().getBrowserForTab(aTab).currentURI.spec; if((tabUrl == "" || tabUrl == "about:blank") && (tabIndex = permaTabs.getPermaTabLocalIndex(aTab)) > -1) title = permaTabs.permaTabs[tabIndex].title; if (!title) {');
      if(typeof getBrowser().updateIcon == "function")
        permaTabs.utils.patchFunction('getBrowser().updateIcon', getBrowser().updateIcon, 'if (!aTab.hasAttribute("busy") && browser.mIconURL) {', 'var tabIndex = 0; var tabUrl = getBrowser().getBrowserForTab(aTab).currentURI.spec; if((tabUrl == "" || tabUrl == "about:blank") && (tabIndex = permaTabs.getPermaTabLocalIndex(aTab)) > -1) aTab.setAttribute("image", permaTabs.permaTabs[tabIndex].image); else if (!aTab.hasAttribute("busy") && browser.mIconURL) {');

      this.restorePermaTabs();

      var container = Components.classes["@mozilla.org/rdf/container;1"].getService(Components.interfaces.nsIRDFContainer);
      var RDFService = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
      var extManager = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager).datasource;

      container.Init(extManager, RDFService.GetResource("urn:mozilla:item:root"));

      for(var elements = container.GetElements(); elements.hasMoreElements();)
      {
        var element = elements.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
        var extId = element.Value.replace('urn:mozilla:item:', '');

        var target = extManager.GetTarget(element, RDFService.GetResource("http://www.mozilla.org/2004/em-rdf#userDisabled"), true);
        var disabled = false;
        if(target instanceof Components.interfaces.nsIRDFInt || target instanceof Components.interfaces.nsIRDFLiteral)
          disabled = target.Value;

        if(extId == '{dc572301-7619-498c-a57d-39143191b318}' && !disabled) this.tabMixInstalled = true;
        else if(extId == 'faviconizetab@espion.just-size.jp' && !disabled) this.faviconizeTabInstalled = true;
      }
    }

    if(this.tabMixInstalled && !window.__contentAreaClick)
      return permaTabs.utils.wrapFunction('window.TMP_miniT_init', TMP_miniT_init, function(){ if(typeof tablib == "undefined") return null; var ret = $base(); permaTabs.init(); return ret;});

    if(this.faviconizeTabInstalled && !document.getElementById('tabContextFaviconizeTab'))
      return permaTabs.utils.wrapFunction('faviconize.ui.init', faviconize.ui.init, function(){ var ret = $base(); permaTabs.init(); return ret; });

    if(this.ssWillRestore && !this.ssRestored)
      return;

    this.initialized = true;

    window.removeEventListener("load", function() { permaTabs.init(); }, false);
    window.removeEventListener("DOMContentLoaded", function() { permaTabs.init(); }, false);

    this.tabContextMenu.addEventListener("popupshowing", permaTabs.updateContextMenu, false);

    getBrowser().mTabContainer.addEventListener("select", function(e){ permaTabs.onTabSelected(); }, false);

    permaTabs.utils.wrapFunction('window.setColor', window.setColor, function(tab, tabClr){if(!permaTabs.isPermaTab(tab) || !permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish') || permaTabs.OS == 'Darwin') return $base();})
    permaTabs.utils.wrapFunction('window.contentAreaClick', window.contentAreaClick, this.patchedContentAreaClick);

    permaTabs.utils.wrapFunction('window.loadURI', window.loadURI, this.patchedLoadURI);
    permaTabs.utils.wrapFunction('window.BrowserLoadURL', window.BrowserLoadURL, this.patchedBrowserLoadURL);
    permaTabs.utils.wrapFunction('window.BrowserHome', window.BrowserHome, this.patchedBrowserHome);
    permaTabs.utils.wrapFunction('window.BrowserHomeClick', window.BrowserHomeClick, this.patchedBrowserHomeClick);

    var ver = false;
    if(((isset = this.prefs.getPrefType("extensions.permatabs.version")) != this.prefs.PREF_STRING) ||
       ((ver = this.prefs.getCharPref("extensions.permatabs.version")) != this.version.join('.')))
    {
      if(!this.firstInstall)
        this.prevVersion = ver ? ver.split('.') : [1,2,0];

      this.prefs.setCharPref("extensions.permatabs.version", this.version.join('.'));
    }

    this.showAllPermaTabs();

    if(this.faviconizeTabInstalled)
    {
      permaTabs.utils.wrapFunction('faviconize.toggle', faviconize.toggle,
        function(tab)
        {
          if(!tab || tab.localName != 'tab')
            tab = gBrowser.mCurrentTab;

          var ret = $base();

          if(permaTabs.isPermaTab(tab))
          {
            permaTabs.permaTabs[permaTabs.getPermaTabLocalIndex(tab)].faviconized = tab.hasAttribute('faviconized') ? 1 : 0;
            permaTabs.savePermaTabs();
          }

          return ret;
        });
    }
  },

  init : function()
  {
    permaTabs.__init();
  },

  deinit : function()
  {
    var enumerator = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator).getEnumerator("navigator:browser");
    var ffWindows = new Array();
    var currentWindow;
    while(enumerator.hasMoreElements() && (currentWindow = enumerator.getNext()))
      if(currentWindow && currentWindow != window)
        ffWindows.push(currentWindow);

    if(ffWindows.length == 1)
      ffWindows[0].permaTabs.init();
    else
      for(x in ffWindows)
        ffWindows[x].addEventListener("focus", ffWindows[x].permaTabs.init, false);
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
        getBrowser().getBrowserAtIndex(browserIndex).loadURI(this.permaTabs[localIndex].url);
    }

    getBrowser().mTabContainer.setAttribute('disableclose', isPermaTab);
  },

  updateContextMenu : function(e)
  {
    var closeTabText = document.getElementById("tabBrowserStrings").getString("tabs.closeTab");
    var closeMenuItem = permaTabs.tabContextMenu.lastChild;
    for(var x = 0; x < permaTabs.tabContextMenu.childNodes.length; x++)
      if(permaTabs.tabContextMenu.childNodes[x].label == closeTabText)
      {
        closeMenuItem =  permaTabs.tabContextMenu.childNodes[x];
        break;
      }

    if(!permaTabs.menuItemsAdded)
    {
      var togglePermText = document.getElementById("permatabStrings").getString("tab.togglePermanence.label");
      var togglePermHomeText = document.getElementById("permatabStrings").getString("tab.PermaHome.label");
      var togglePermKey = document.getElementById("permatabStrings").getString("tab.togglePermanence.accessKey");

      var menuItem = document.createElement("menuitem");
      menuItem.setAttribute("label", togglePermText);
      menuItem.setAttribute("accesskey", togglePermKey);
      menuItem.setAttribute("id", "permaTabContextMenuItemMakePermanent");
      menuItem.setAttribute("oncommand", "permaTabs.togglePermanence();");
      menuItem.setAttribute("type", "checkbox");
      menuItem.setAttribute("key", "permaTabAccel");
      permaTabs.tabContextMenu.insertBefore(menuItem, closeMenuItem.previousSibling);

	  if(!permaTabs.prefs.getBoolPref('extensions.permatabs.forceNewTabs') || permaTabs.prefs.getBoolPref('extensions.permatabs.forceNewTabsDomain'))
	  {
	      var menuItem2 = document.createElement("menuitem");
	      menuItem2.setAttribute("label", togglePermHomeText);
	      menuItem2.setAttribute("id", "permaTabContextMenuItemPermanentHome");
	      menuItem2.setAttribute("oncommand", "permaTabs.goHome();");
	      permaTabs.tabContextMenu.insertBefore(menuItem2, closeMenuItem.previousSibling);
	  }
	  
      if(!permaTabs.tabMixInstalled)
      {
        separator = document.createElement("menuseparator");
        separator.setAttribute("id", "permaTabContextMenuSeparator");
        permaTabs.tabContextMenu.insertBefore(separator, menuItem);
      }

      if(permaTabs.OS == 'Darwin')
      {
        var key = document.getElementById('permaTabAccel');
        key.setAttribute('modifiers', 'accel,shift');
      }

      permaTabs.menuItemsAdded = true;
    }

    var isPermaTab = (getBrowser().mContextTab && permaTabs.isPermaTab(getBrowser().mContextTab));
    document.getElementById("permaTabContextMenuItemMakePermanent").setAttribute("checked", isPermaTab);
    if(document.getElementById("permaTabContextMenuItemPermanentHome")){ document.getElementById("permaTabContextMenuItemPermanentHome").setAttribute("disabled", !isPermaTab); }
    closeMenuItem.setAttribute('disabled', isPermaTab);
  },

  getTabBrowserIndex : function(tab)
  {
    var tabs = getBrowser().mTabContainer.childNodes;

    for(var i = 0; i < tabs.length; i++)
      if(tabs[i] == tab)
        return i;

    return false;
  },

  getPermaTabLocalIndex : function(tab)
  {
    if(tab.hasAttribute("permaTabId"))
      for(var tabIndex = 0; tabIndex < permaTabs.permaTabs.length; tabIndex++)
        if(permaTabs.permaTabs[tabIndex].id == tab.getAttribute("permaTabId"))
          return tabIndex;

    return -1;
  },

  getPermaTabById : function(id)
  {
    for(var x = 0; x < permaTabs.permaTabs.length; x++)
      if(permaTabs.permaTabs[x].id == id)
        return permaTabs.permaTabs[x];

    return false;
  },

  isPermaTab : function(tab)
  {
    return tab.hasAttribute("isPermaTab");
  },

  colorPermaTabs : function()
  {
    var rule = permaTabs.prefs.getBoolPref('extensions.permatabs.distinguish') && permaTabs.OS != 'Darwin' ? 'background-color:' + permaTabs.prefs.getCharPref("extensions.permatabs.color") + ' !important;' : '';

    for(var x = 0; x < document.styleSheets.length; x++)
      if(document.styleSheets[x].href == 'chrome://permatabs/content/permatabs.css')
      {
        document.styleSheets[x].deleteRule(document.styleSheets[x].cssRules.length - 1);
        document.styleSheets[x].insertRule('.tabbrowser-tab[isPermaTab=true] {' + rule + '}', document.styleSheets[x].cssRules.length);
      }
  },

  togglePermanence : function(toggleCurrentTab)
  {
    if(toggleCurrentTab)
      var currentTab = getBrowser().mCurrentTab;
    else
      var currentTab = getBrowser().mContextTab;

    var url = getBrowser().getBrowserAtIndex(permaTabs.getTabBrowserIndex(currentTab)).currentURI.spec;
    var isPermaTab = permaTabs.isPermaTab(currentTab);

    if(!toggleCurrentTab)
      document.getElementById('permaTabContextMenuItemMakePermanent').setAttribute('checked', !isPermaTab);

    if(!isPermaTab)
    {
      if(currentTab.hasAttribute('permaTabUrl') && (url == '' || url == 'about:blank') &&
      getBrowser().getBrowserAtIndex(permaTabs.getTabBrowserIndex(currentTab)).sessionHistory.count == 0)
        url = currentTab.getAttribute('permaTabUrl');

      var id = permaTabs.getNextId();
      currentTab.setAttribute('isPermaTab', true);
      currentTab.setAttribute('permaTabId', id);
      currentTab.setAttribute('permaTabUrl', url);

      var faviconized = currentTab.hasAttribute('faviconized') ? 1 : 0;

      permaTabs.permaTabs[permaTabs.permaTabs.length] = {'id'          : id,
                                                         'title'       : currentTab.label,
                                                         'url'         : url,
                                                         'image'       : currentTab.getAttribute('image'),
                                                         'faviconized' : faviconized};

      if(window.setColor)
        for(var i= 0 ; i < document.getAnonymousNodes(currentTab).length; i++)
          document.getAnonymousNodes(currentTab)[i].style.setProperty("background-color", '' ,'');
    }
    else
    {
      currentTab.removeAttribute('isPermaTab');
      permaTabs.permaTabs.splice(permaTabs.getPermaTabLocalIndex(currentTab), 1);
    }

    if(currentTab == getBrowser().mCurrentTab)
      getBrowser().mTabContainer.setAttribute('disableclose', !isPermaTab);

    permaTabs.savePermaTabs();
  },

  goHome : function(toggleCurrentTab)
  {
    if(toggleCurrentTab)
      var currentTab = getBrowser().mCurrentTab;
    else
      var currentTab = getBrowser().mContextTab;

    getBrowser().selectedTab = currentTab;
	permaTabs.tempAllowed = true;

	openUILink(currentTab.getAttribute("permaTabUrl"),false,false,true);
  },

  restorePermaTabs : function()
  {
    var restore = {};
    for(var x in {'ids':'', 'urls':'', 'titles':'', 'images':'', 'faviconizeds':''})
      restore[x] = this.prefs.getCharPref('extensions.permatabs.permatabs.' + x).split("\n");

    var makeIds = restore.ids == '' && restore.urls != '';
    var makeFaviconizeds = restore.faviconizeds == '';

    this.colorPermaTabs();

    for(var i = (restore.urls.length - 1); i >= 0; i--)
    {
      if(restore.urls[i] == "")
        continue;

      var id = !makeIds ? restore.ids[i] : this.getNextId();

      this.permaTabs[this.permaTabs.length] = {
        'id'           : id,
        'title'        : restore.titles[i],
        'url'          : restore.urls[i],
        'image'        : restore.images[i],
        'faviconized'  : makeFaviconizeds ? 0 : parseInt(restore.faviconizeds[i])};
    }

    if(makeIds)
      this.savePermaTabs();

    if(permaTabs.ssWillRestore)
      document.addEventListener("SSTabRestoring", permaTabs.handleSessionStoreTabRestore, false);
  },

  showAllPermaTabs : function()
  {
    for(var i = 0; i < permaTabs.permaTabs.length; i++)
      permaTabs.showPermaTab(permaTabs.permaTabs[i].id);

    getBrowser().tabContainer.addEventListener("TabMove", function(){permaTabs.savePermaTabs();}, false);
  },

  savePermaTabs : function()
  {
    var order = [];
      for(var x = 0; x < getBrowser().mTabContainer.childNodes.length; x++)
        if((i = this.getPermaTabLocalIndex(getBrowser().mTabContainer.childNodes[x])) > -1)
          order.push(i);

    for(var x = 0; x < this.permaTabs.length; x++)
    {
      var cont = false;
        for(var i = 0; i < order.length; i++)
          if(order[i] == x)
            cont = true;

      if(!cont)
        order.push(x);
    }

    var save = {'id' : '', 'url' : '', 'title' : '', 'image' : '', 'faviconized' : ''};

    for(var i = 0; i < order.length; i++)
      for(x in save)
        save[x] += this.permaTabs[order[i]][x].toString() + ((i + 1 < order.length) ? "\n" : "");

    for(i in save)
      this.prefs.setCharPref("extensions.permatabs.permatabs." + i + "s", save[i]);

    this.prefs.savePrefFile(null);
  },

  getActualLinkNode : function(node)
  {
    if(!node.hasAttribute('href'))
    {
      var parent = node.parentNode;
      while(parent && parent.hasAttribute && !parent.hasAttribute('href'))
        parent = parent.parentNode;

      if(parent && parent.hasAttribute && parent.hasAttribute('href'))
        node = parent;
    }

    return node;
  },

  shouldOpenInNewTab : function(linkNode)
  {
    return (linkNode.hasAttribute('href') &&
            !/javascript\s*:/.test(linkNode.getAttribute('href').toLowerCase()) &&
            permaTabs.isPermaTab(getBrowser().mCurrentTab) &&
            permaTabs.prefs.getBoolPref('extensions.permatabs.forceNewTabs') &&
            !(linkNode.host && linkNode.host == getBrowser().mCurrentBrowser.currentURI.host &&
            permaTabs.prefs.getBoolPref('extensions.permatabs.forceNewTabsDomain')) &&
            (!linkNode.href || linkNode.getAttribute('href').indexOf('#') != 0))
  },

  patchedContentAreaClick : function(event, fieldNormalClicks)
  {
    if(!event.isTrusted)
      return true;

    var target = permaTabs.getActualLinkNode(event.target);

    if(!event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey && event.button != 1 && event.button != 2 && permaTabs.shouldOpenInNewTab(target) && !event.getPreventDefault())
    {
      var newEvent = document.createEvent("MouseEvents");

      if(permaTabs.OS != 'Darwin')
        newEvent.initMouseEvent("click", event.bubbles, event.cancelable, event.view, event.detail, event.screenX, event.screenY, event.clientX, event.clientY, true, event.altKey, event.shiftKey, event.metaKey, event.button, event.relatedTarget);
      else
        newEvent.initMouseEvent("click", event.bubbles, event.cancelable, event.view, event.detail, event.screenX, event.screenY, event.clientX, event.clientY, event.ctrlKey, event.altKey, event.shiftKey, true, event.button, event.relatedTarget);

      event.preventDefault();
      event.stopPropagation();

      event.target.dispatchEvent(newEvent);

      return false;
    }

    return $base();
  },

  patchedBrowserLoadURL : function(aTriggeringEvent, aPostData)
  {
    if(permaTabs.isPermaTab(getBrowser().mCurrentTab))
    {
      if(aTriggeringEvent instanceof MouseEvent && aTriggeringEvent.button == 2)
        return;

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
        gBrowser.loadOneTab(url, null, null, aPostData, false, true);

      content.focus();
    }
    else
      return $base();
  },

  patchedLoadURI : function(uri, referrer, postData, allowThirdPartyFixup)
  {
    if(permaTabs.isPermaTab(getBrowser().mCurrentTab) && !permaTabs.tempAllowed)
      gBrowser.loadOneTab(uri, referrer, null, postData, false, allowThirdPartyFixup);
    else
      permaTabs.tempAllowed = false;
      $base();
  },

  patchedBrowserHome : function()
  {
    if(permaTabs.isPermaTab(getBrowser().mCurrentTab))
    {
      try{ getBrowser().loadTabs(gHomeButton.getHomePage().split("|"), false, false); }catch(e){};
    }
    else
      $base();
  },

  patchedBrowserHomeClick : function(aEvent)
  {
    if(aEvent.button == 2)
      return;

    if(whereToOpenLink(aEvent) == 'current' && permaTabs.isPermaTab(getBrowser().mCurrentTab))
    {
      try{ getBrowser().loadTabs(gHomeButton.getHomePage().split("|"), false, false); }catch(e){};
    }
    else
      $base();
  },

  showPermaTab : function(id)
  {
    var props = permaTabs.getPermaTabById(id);
    var tabs = getBrowser().mTabContainer.getElementsByAttribute('permaTabId', id);
    var tab = null;

    if(!(tabs && (tab = tabs[0])))
    {
      tab = getBrowser().addTab();
      getBrowser().moveTabTo(tab, 0);

      tab.setAttribute('isPermaTab', true);
      tab.setAttribute('permaTabId', props.id);
      tab.setAttribute('permaTabUrl', props.url);
      tab.setAttribute('image', props.image);
      getBrowser().setTabTitle(tab);
      getBrowser().updateIcon(tab);
    }

    if(permaTabs.faviconizeTabInstalled && props.faviconized && !tab.hasAttribute('faviconized'))
      faviconize.toggle(tab);
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

  utils :
  {
    wrappedFunctions : {},

    wrapFunction : function(name, orig, wrapper)
    {
      if(permaTabs.utils.wrappedFunctions[name])
        return;

      permaTabs.utils.wrappedFunctions[name] = orig;
      eval(name + ' = ' + wrapper.toString().replace('$base()', 'permaTabs.utils.wrappedFunctions["' + name + '"].apply(this, arguments);'));
    },

    patchFunction : function(name, func, search, replace)
    {
      eval(name + ' = ' + func.toString().replace(search, replace));
    }
  }
}

window.addEventListener("load", function() { permaTabs.init(); }, false);
window.addEventListener("DOMContentLoaded", function() { permaTabs.init(); }, false);
window.addEventListener("unload", function() { permaTabs.deinit(); }, false);