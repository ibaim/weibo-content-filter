// ==UserScript==
// @name			眼不见心不烦（新浪微博）
// @namespace		http://weibo.com/salviati
// @license			MIT License
// @description		在新浪微博（weibo.com）用户主页隐藏包含指定关键词的微博。
// @features		修正了从部分页面返回首页时脚本失效的问题
// @version			0.73
// @created			2011.08.15
// @modified		2012.04.06
// @author			@富平侯(/salviati)
// @thanksto		@牛肉火箭(/sunnylost)；@JoyerHuang_悦(/collger)
// @include			http://weibo.com/*
// @include			http://www.weibo.com/*
// ==/UserScript==

var $version = 0.73;
var $uid;
var $blocks = [ // 模块屏蔽设置
		['Fun', 'pl_common_fun'],
		['Topic', 'pl_content_promotetopic'],
		['InterestUser', 'pl_content_homeInterest'],
		['PopularUser', 'pl_relation_recommendPopularUsers'],
		// 2012年2月27日起，新浪微博“可能感兴趣的微群”模块ID发生变化
		['InterestGroup', 'pl_common_thirdmodule_1005'],
		['InterestApp', 'pl_content_allInOne'],
		['Notice', 'pl_common_noticeboard'],
		['HelpFeedback', ['pl_common_help', 'pl_common_feedback']],
		['Ads'],
		['BottomAds', 'ads_bottom_1'],
		['PullyList', 'pl_content_pullylist'],
		['RecommendedTopic'],
		['Mood', 'pl_content_mood'],
		['Medal'],
		['Game', 'pl_leftNav_game'],
		['App', 'pl_leftNav_app'],
		['Tasks', 'pl_content_tasks']
	];

var _ = function (s) {
	return document.getElementById(s);
};

var __ = function (s) {
	return document.querySelector(s);
};
// 绑定事件
var bind = function (el, eventName, handler) {
	if (el) {el.addEventListener(eventName, handler, false); }
};
// click事件快捷方式
var click = function (el, handler) {
	bind(el, 'click', handler);
};

// Chrome提供的GM_getValue()等有问题（早期版本则不支持），需要使用localStorage重新定义
// Firefox 2+, Internet Explorer 8+, Safari 4+和Chrome均支持DOM Storage (HTML5)
if (window.localStorage) {
	var keyRoot = 'weiboPlus.';

	var GM_deleteValue = function (name) {
		localStorage.removeItem(keyRoot + name);
	};

	var GM_getValue = function (name, defval) {
		return localStorage.getItem(keyRoot + name) || defval;
	};

	var GM_setValue = function (name, value) {
		localStorage.setItem(keyRoot + name, value);
	};
}

if (!window.chrome) {
	// 非Chrome浏览器，优先使用unsafeWindow获取全局变量
	// 由于varname中可能包括'.'，因此使用eval()获取变量值
	var getGlobalVar = function (varname) {
		return eval('unsafeWindow.' + varname);
	};
} else {
	// Chrome原生不支持unsafeWindow，脚本运行在沙箱中，因此不能访问全局变量。
	// 但用户脚本与页面共享DOM，所以可以设法将脚本注入host页
	// 详见http://voodooattack.blogspot.com/2010/01/writing-google-chrome-extension-how-to.html
	var getGlobalVar = function (varname) {
		var elem = document.createElement('script'), id = '';
		// 生成脚本元素的随机索引
		while (id.length < 16) {
			id += String.fromCharCode(((!id.length || Math.random() > 0.5) ? 0x61 + Math.floor(Math.random() * 0x19) : 0x30 + Math.floor(Math.random() * 0x9)));
		}
		// 生成脚本
		elem.id = id;
		elem.type = 'text/javascript';
		elem.innerHTML = '(function(){document.getElementById("' + id + '").innerText=' + varname + '; }());';
		// 将元素插入DOM（马上执行脚本）
		document.head.appendChild(elem);
		// 获取返回值
		var ret = elem.innerText;
		// 移除元素
		document.head.removeChild(elem);
		elem = null;
		return ret;
	};
}

function getScope() {
	return "B_index" === document.body.className ? 1 : "B_my_profile_other" === document.body.className ? 2 : 0;
}

// 搜索指定文本中是否包含列表中的关键词
function searchKeyword(str, key) {
	var keywords = GM_getValue($uid + '.' + key, '').split(';');
	for (var i = 0, len = keywords.length; i < len; ++i) {
		if (keywords[i] && str.indexOf(keywords[i]) > -1) {return keywords[i]; }
	}
	return '';
}

function hideFeed(node) {
	if (node.firstChild.tagName === 'A') {node.removeChild(node.firstChild); } // 已被屏蔽过
	var content, scope = getScope();
	switch (scope) {
	case 1:
		content = node.childNodes[3];
		break;
	case 2:
		content = node.childNodes[1]; // 他人主页的微博没有用户信息
		break;
	default:
		return false;
	}
	if (content.tagName !== 'DD' || !content.classList.contains('content')) {return false; }
	// 在微博内容中搜索屏蔽关键词
	if (searchKeyword(content.textContent, 'whiteKeywords')) {
		node.style.display = '';
		node.childNodes[1].style.display = '';
		node.childNodes[3].style.display = '';
		node.childNodes[1].style.opacity = 1;
		node.childNodes[3].style.opacity = 1;
		return false;
	}
	if (searchKeyword(content.textContent, 'hideKeywords')) {
		node.style.display = 'none'; // 直接隐藏，不显示屏蔽提示
		return true;
	}
	var links = content.getElementsByTagName('A');
	for (var i = 0, len = links.length; i < len; ++i) {
		if (links[i].href.substring(0,12) === 'http://t.cn/' && searchKeyword(links[i].title, 'URLKeywords')) {
			node.style.display = 'none';
			return true;	
		}
	}
	node.style.display = '';
	var keyword = searchKeyword(content.textContent, 'censoredKeywords');
	if (!keyword) {
		node.childNodes[1].style.display = '';
		node.childNodes[3].style.display = '';
		node.childNodes[1].style.opacity = 1;
		node.childNodes[3].style.opacity = 1;
		return false;
	}
	var authorClone;
	if (scope === 1) {
		// 2011年11月15日起，新浪微博提供了屏蔽功能，由于屏蔽按钮的存在，微博发布者链接的位置发生了变化
		var author = content.childNodes[3].childNodes[1];
		if (author.tagName !== 'A') {return false; } // 不要屏蔽自己的微博
		node.childNodes[3].style.display = 'none';
		// 添加隐藏提示链接
		authorClone = author.cloneNode(false);
		// 默认的用户链接中多了一个换行符和两个tab
		authorClone.innerHTML = '@' + author.innerHTML.slice(3);
	}
	// 找到了待隐藏的微博
	node.childNodes[1].style.display = 'none';
	var tipBackColor = GM_getValue($uid + '.tipBackColor', '#FFD0D0');
	var tipTextColor = GM_getValue($uid + '.tipTextColor', '#FF8080');
	var showFeed = document.createElement('a');
	showFeed.href = 'javascript:void(0)';
	showFeed.className = 'notes';
	showFeed.style.cssText = 'background-color: ' + tipBackColor + '; border-color: ' + tipTextColor + '; color: ' + tipTextColor + '; margin-bottom: 0px';
	var keywordLink = document.createElement('a');
	keywordLink.href = 'javascript:void(0)';
	keywordLink.innerHTML = keyword;
	click(keywordLink, function (event) {
		showSettingsWindow(event);
		event.stopPropagation(); // 防止事件冒泡触发屏蔽提示的onclick事件
	});
	if (scope === 1) {
		showFeed.appendChild(document.createTextNode('本条来自'));
		showFeed.appendChild(authorClone);
		showFeed.appendChild(document.createTextNode('的微博因包含关键词“'));
	} else if (scope === 2) {
		showFeed.appendChild(document.createTextNode('本条微博因包含关键词“'));
	}
	showFeed.appendChild(keywordLink);
	showFeed.appendChild(document.createTextNode('”而被隐藏，点击显示'));
	click(showFeed, function () {
		this.parentNode.childNodes[2].style.opacity = 1;
		this.parentNode.childNodes[4].style.opacity = 1;
		this.parentNode.removeChild(this);
	});
	bind(showFeed, 'mouseover', function () {
		this.parentNode.childNodes[2].style.display = '';
		this.parentNode.childNodes[4].style.display = '';
		this.parentNode.childNodes[2].style.opacity = 0.5;
		this.parentNode.childNodes[4].style.opacity = 0.5;
		this.style.cssText = 'background-color: #D0FFD0; border-color: #40D040; color: #40D040;';
	});
	bind(showFeed, 'mouseout', function () {
		if (!this.parentNode) {return; }
		this.parentNode.childNodes[2].style.display = 'none';
		this.parentNode.childNodes[4].style.display = 'none';
		this.parentNode.style.cssText = '';
		this.style.cssText = 'background-color: ' + tipBackColor + '; border-color: ' + tipTextColor + '; color: ' + tipTextColor + '; margin-bottom: 0px';
	});
	node.insertBefore(showFeed, node.firstChild);
	return true;
}

var $reloadTimerID = null;

// 处理动态载入内容
function onDOMNodeInsertion(event) {
	if (getScope() === 0) {return false; }
	var node = event.target;
	if (node.tagName === 'DL' && node.classList.contains('feed_list')) {
		// 处理动态载入的微博
		return hideFeed(node);
	}
	if (node.tagName === 'DIV' && node.getAttribute('node-type') === 'feed_nav') {
		// 由于新浪微博使用了BigPipe技术，从"@我的微博"等页面进入时只载入部分页面
		// 需要重新载入设置页面、按钮及刷新微博列表
		if ($reloadTimerID != null) {
			clearTimeout($reloadTimerID);
			$reloadTimerID = null;
		}
		loadSettingsWindow();
		showSettingsBtn();
	} else if (node.tagName === 'DIV' && node.classList.contains('feed_lists')) {
		// 微博列表作为pagelet被一次性载入
		applySettings();
	} else if ($reloadTimerID == null && !_('wbpShowSettings')) {
		// 由于各版块载入顺序不定，有时设置窗口及按钮未载入，使用定时器保险
		$reloadTimerID = setTimeout(reloadTimer, 1000);
	}
	return false;
}

function reloadTimer() {
	if (getScope() === 0 || (loadSettingsWindow() && showSettingsBtn())) {
		$reloadTimerID = null;
	} else {
		$reloadTimerID = setTimeout(reloadTimer, 1000);
	}
}

function checkUpdate() {
	GM_xmlhttpRequest({
		method: 'GET',
		url: 'http://userscripts.org/scripts/source/114087.meta.js',
		onload: function (result) {
			if (!result.responseText.match(/@version\s+(\d+\.\d+)/)) {return; }
			var ver = RegExp.$1;
			if (parseFloat(ver) <= $version) { // 已经是最新版
				alert('脚本已经是最新版。');
				return;
			}
			var features = '';
			if (result.responseText.match(/@features\s+(.*)/)) {
				features = '- ' + RegExp.$1.split('；').join('\n- ') + '\n\n';
			}
			// 显示更新提示
			if (confirm('“眼不见心不烦”新版本v' + ver + '可用。\n\n' + features + '如果您希望更新，请点击“确认”打开脚本页面。')) {
				window.open('http://userscripts.org/scripts/show/114087');
			}
		}
	});
}

function showSettingsWindow(event) {
	_('wbpSettingsBack').style.cssText = 'background-image: initial; background-attachment: initial; background-origin: initial; background-clip: initial; background-color: black; opacity: 0.3; position: fixed; top: 0px; left: 0px; z-index: 10001; width: ' + window.innerWidth + 'px; height: '+ window.innerHeight + 'px;';
	var block = _('wbpSettings');
	// Chrome与Firefox的scrollLeft, scrollTop储存于不同位置
	var left = document.body.scrollLeft === 0 ? document.documentElement.scrollLeft : document.body.scrollLeft;
	var top = document.body.scrollTop === 0 ? document.documentElement.scrollTop : document.body.scrollTop;
	block.style.left = (left + event.clientX) + 'px';
	block.style.top = (top + event.clientY + 10) + 'px';
	block.style.display = '';
}

function showSettingsBtn() {
	// 设置标签已经置入页面
	if (_('wbpShowSettings')) {return true; }
	var groups = __('#pl_content_homeFeed .nfTagB, #pl_content_hisFeed .nfTagB');
	// Firefox的div#pl_content_homeFeed载入时是空的，此时无法置入页面，稍后由onDOMNodeInsertion()处理
	if (!groups) {return false; }
	var showSettingsTab = document.createElement('li');
	showSettingsTab.innerHTML = '<span><em><a id="wbpShowSettings" href="javascript:void(0)">眼不见心不烦</a></em></span>';
	groups.childNodes[1].appendChild(showSettingsTab);
	click(_('wbpShowSettings'), showSettingsWindow);
	return true;
}

// 根据当前设置屏蔽/显示所有内容
function applySettings() {
	// 处理非动态载入内容
	var feeds = document.querySelectorAll('.feed_list'), i, len, j, l;
	for (i = 0, len = feeds.length; i < len; ++i) {hideFeed(feeds[i]); }
	// 屏蔽版面内容
	for (i = 0, len = $blocks.length; i < len; ++i) {
		var isBlocked = (GM_getValue($uid + '.block' + $blocks[i][0], 'false') === 'true');
		if ($blocks[i].length === 2) {
			var block;
			if (typeof $blocks[i][1] === 'string') {
				block = _($blocks[i][1]);
				if (block) {block.style.display = isBlocked ? 'none' : ''; }
			} else { // 数组
				for (j = 0, l = $blocks[i][1].length; j < l; ++j) {
					block = _($blocks[i][1][j]);
					if (block) {block.style.display = isBlocked ? 'none' : ''; }
				}
			}
			continue;
		}
		// 单独处理广告
		if ($blocks[i][0] === 'Ads') {
			var sideBar = __('#plc_main .W_main_r');
			if (sideBar) {
				for (j = 0, l = sideBar.childNodes.length; j < l; ++j) {
					var elem = sideBar.childNodes[j];
					if (elem.tagName === 'DIV' && (elem.id.substring(0,4) === 'ads_' || elem.hasAttribute('ad-data'))) {
						elem.style.display = isBlocked ? 'none' : '';
					}
				}
			}
		} else if ($blocks[i][0] === 'RecommendedTopic') {
			// 单独处理推荐话题
			var recommendedTopic = __('#pl_content_publisherTop .key');
			if (recommendedTopic && recommendedTopic.getAttribute('node-type') === 'recommendTopic') {
				recommendedTopic.style.visibility = isBlocked ? 'hidden' : '';
			}
		} else if ($blocks[i][0] === 'Medal') { // 单独处理勋章
			// 传统版
			var medalList = _('pl_content_medal');
			if (medalList) {
				medalList.style.display = isBlocked ? 'none' : '';
			} else { // 体验版
				medalList = __('.declist');
				if (medalList) {medalList.style.display = isBlocked ? 'none' : ''; }
			}
		}
	}
}

function getKeywords(id) {
	if (!_(id).hasChildNodes()) {return ''; }
	var keywords = _(id).childNodes, list = [];
	for (var i = 0, len = keywords.length; i < len; ++i) {
		if (keywords[i].tagName === 'A') {list.push(keywords[i].innerHTML); }
	}
	return list.join(';');
}

function addKeywords(id, str) {
	var keywords = str.split(';'),
		currentKeywords = ';' + getKeywords(id) + ';';
	for (var i = 0, len = keywords.length; i < len; ++i) {
		if (keywords[i] && currentKeywords.indexOf(';' + keywords[i] + ';') === -1) {
			var keywordLink = document.createElement('a');
			keywordLink.title = '删除关键词';
			keywordLink.href = 'javascript:void(0)';
			keywordLink.innerHTML = keywords[i];
			_(id).appendChild(keywordLink);
		}
	}
}

// 点击删除关键词（由上级div冒泡事件处理）
function deleteKeyword(event) {
	if (event.target.tagName === 'A') {
		event.target.parentNode.removeChild(event.target);
		event.stopPropagation();
	}
}

function reloadSettings() {
	_('wbpWhiteKeywordList').innerHTML = '';
	_('wbpHideKeywordList').innerHTML = '';
	_('wbpCensoredKeywordList').innerHTML = '';
	_('wbpURLKeywordList').innerHTML = '';
	addKeywords('wbpWhiteKeywordList', GM_getValue($uid + '.whiteKeywords', ''));
	addKeywords('wbpHideKeywordList', GM_getValue($uid + '.hideKeywords', ''));
	addKeywords('wbpCensoredKeywordList', GM_getValue($uid + '.censoredKeywords', ''));
	addKeywords('wbpURLKeywordList', GM_getValue($uid + '.URLKeywords', ''));
	_('wbpWhiteKeywords').value = '';
	_('wbpHideKeywords').value = '';
	_('wbpCensoredKeywords').value = '';
	_('wbpURLKeywords').value = '';
	var tipBackColor = GM_getValue($uid + '.tipBackColor', '#FFD0D0');
	var tipTextColor = GM_getValue($uid + '.tipTextColor', '#FF8080');
	_('wbpTipBackColor').value = tipBackColor;
	_('wbpTipTextColor').value = tipTextColor;
	var tipSample = _('wbpTipSample');
	tipSample.style.backgroundColor = tipBackColor;
	tipSample.style.borderColor = tipTextColor;
	tipSample.style.color = tipTextColor;
	for (var i = 0, len = $blocks.length; i < len; ++i) {
		if (GM_getValue($uid + '.block' + $blocks[i][0], 'false') === 'true') {
			_('wbpBlock' + $blocks[i][0]).checked = true;
		}
	}
}

function loadSettingsWindow() {
	if (_('wbpSettings')) {return true; }
	$uid = getGlobalVar('$CONFIG.uid');
	if (!$uid) {return false; }

	// 加入选项设置
	GM_addStyle('#settings.css#');
	var keywordBack = document.createElement('div');
	keywordBack.id = 'wbpSettingsBack';
	keywordBack.style.display = 'none';
	var keywordBlock = document.createElement('div');
	keywordBlock.className = 'W_layer';
	keywordBlock.id = 'wbpSettings';
	keywordBlock.style.cssText = 'width: 500px; margin-left: -250px; z-index: 10001; position: absolute; display: none;';
	keywordBlock.innerHTML = '#settings.html#';
	document.body.appendChild(keywordBack);
	document.body.appendChild(keywordBlock);
	_('wbpSettingsTitle').innerHTML = '“眼不见心不烦”(v' + $version + ')设置';
	// 修改屏蔽提示颜色事件
	bind(_('wbpTipBackColor'), 'blur', function () {
		_('wbpTipSample').style.backgroundColor = this.value;
	});
	bind(_('wbpTipTextColor'), 'blur', function () {
		var wbpTipSample = _('wbpTipSample');
		wbpTipSample.style.borderColor = this.value;
		wbpTipSample.style.color = this.value;
	});
	// 添加关键词按钮点击事件
	click(_('wbpAddWhiteKeyword'), function () {
		var wbpWhiteKeywords = _('wbpWhiteKeywords');
		addKeywords('wbpWhiteKeywordList', wbpWhiteKeywords.value);
		wbpWhiteKeywords.value = '';
	});
	click(_('wbpAddHideKeyword'), function () {
		addKeywords('wbpHideKeywordList', _('wbpHideKeywords').value);
		_('wbpHideKeywords').value = '';
	});
	click(_('wbpAddCensoredKeyword'), function () {
		addKeywords('wbpCensoredKeywordList', _('wbpCensoredKeywords').value);
		_('wbpCensoredKeywords').value = '';
	});
	click(_('wbpAddURLKeyword'), function () {
		addKeywords('wbpURLKeywordList', _('wbpURLKeywords').value);
		_('wbpURLKeywords').value = '';
	});
	// 删除关键词事件
	click(_('wbpWhiteKeywordList'), deleteKeyword);
	click(_('wbpHideKeywordList'), deleteKeyword);
	click(_('wbpCensoredKeywordList'), deleteKeyword);
	click(_('wbpURLKeywordList'), deleteKeyword);
	// 标签点击事件
	click(_('wbpTabHeaders'), function (event) {
		var node = event.target;
		if (node && node.tagName === 'A') {
			var i = node.getAttribute('order');
			for (var j = 1; j <= 4; ++j) {
				if (i == j) {
					_('wbpTabHeader' + j).className = 'current W_texta';
					_('wbpTab' + j).style.display = '';
				} else {
					_('wbpTabHeader' + j).className = '';
					_('wbpTab' + j).style.display = 'none';
				}
			}
			event.stopPropagation();
		}
	});
	click(_('wbpBlockAll'), function () {
		for (var i = 0, len = $blocks.length; i < len; ++i) {
			_('wbpBlock' + $blocks[i][0]).checked = true;
		}
	});
	click(_('wbpBlockInvert'), function () {
		for (var i = 0, len = $blocks.length; i < len; ++i) {
			var item = _('wbpBlock' + $blocks[i][0]);
			item.checked = !item.checked;
		}
	});
	// 对话框按钮点击事件
	click(_('wbpOKBtn'), function () {
		GM_setValue($uid + '.whiteKeywords', getKeywords('wbpWhiteKeywordList'));
		GM_setValue($uid + '.censoredKeywords', getKeywords('wbpCensoredKeywordList'));
		GM_setValue($uid + '.hideKeywords', getKeywords('wbpHideKeywordList'));
		GM_setValue($uid + '.URLKeywords', getKeywords('wbpURLKeywordList'));
		GM_setValue($uid + '.tipBackColor', _('wbpTipBackColor').value);
		GM_setValue($uid + '.tipTextColor', _('wbpTipTextColor').value);
		for (var i = 0, len = $blocks.length; i < len; ++i) {
			GM_setValue($uid + '.block' + $blocks[i][0], _('wbpBlock' + $blocks[i][0]).checked);
		}
		_('wbpSettingsBack').style.display = 'none';
		_('wbpSettings').style.display = 'none';
		applySettings();
	});
	click(_('wbpCancelBtn'), function () {
		reloadSettings();
		_('wbpSettingsBack').style.display = 'none';
		_('wbpSettings').style.display = 'none';
	});
	click(_('wbpCloseBtn'), function () {
		reloadSettings();
		_('wbpSettingsBack').style.display = 'none';
		_('wbpSettings').style.display = 'none';
	});

	reloadSettings();
	click(_('wbpCheckUpdate'), checkUpdate);
	return true;
}

// 仅在个人首页与他人页面生效
if (getScope() !== 0) {
	loadSettingsWindow();
	showSettingsBtn();
	applySettings();
}

// 处理动态载入内容
document.addEventListener('DOMNodeInserted', onDOMNodeInsertion, false);