'use strict';
/**
 * @TODO:
 * - On install Open page with change log
 * - Settings Page
 * - Custom response
 */

//chrome.browserAction.setBadgeText({text: '(o_O)|")'});

var DefaultSettings = {
	'active': false,
	'urls': ['*://*/*'],
	'exposedHeaders': '',
	'Origin': 'http://evil.com/'
},
	accessControlRequests = {};
/**
 * url : https://developer.chrome.com/extensions/webRequest
 * Starting from Chrome 72, the following request headers are not provided and cannot be modified or removed without specifying 'extraHeaders' in opt_extraInfoSpec:
 * Accept-Language
 * Accept-Encoding
 * Referer
 * Cookie
 */
var request_opt_extraInfoSpec = ['blocking', 'requestHeaders', "extraHeaders"],
	response_opt_extraInfoSpec = ['blocking', 'responseHeaders'];

var exposedHeaders;

var requestRules = [
	// {
	// 	'data': {
	// 		'name': 'Origin',
	// 		'value': 'http://evil.com/'
	// 	},
	// 	'mandatory': false,
	// 	'fn': null
	// },
	// {
	// 	'data': {
	// 		'name': 'Access-Control-Request-Headers',
	// 		'value': null
	// 	},
	// 	'mandatory': false,
	// 	'fn': function (rule, header, details) {
	// 		if (accessControlRequests[details.requestId] === void 0) {
	// 			accessControlRequests[details.requestId] = {};
	// 		}
	// 		accessControlRequests[details.requestId].headers = header.value;
	// 	}
	// },
	// {
	// 	'data': {
	// 		'name': 'Referer',
	// 		'value': "http://baidu.com"
	// 	},
	// 	'mandatory': true,
	// 	'fn': null
	// }
];


var responseRules = [
	{
		'data': {
			'name': 'Access-Control-Allow-Origin',
			'value': '*'
		},
		'mandatory': true,
		'fn': function (rule, header, details) {
			/**
			 * fix bug
			 * The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's credentials mode is 'include'.
			 */
			var initiator = details.initiator;
			rule.value = initiator;
		}
	},
	{
		'data': {
			'name': 'Access-Control-Allow-Headers',
			'value': null
		},
		'mandatory': true,
		'fn': function (rule, header, details) {
			if (accessControlRequests[details.requestId] !== void 0) {
				header.value = accessControlRequests[details.requestId].headers;
			}

		}
	},
	/**
	 * https://segmentfault.com/q/1010000008636959/a-1020000008640047
	 */
	{
		'data': {
			'name': 'Access-Control-Allow-Credentials',
			'value': 'true'
		},
		'mandatory': true,
		'fn': null
	},
	{
		'data': {
			'name': 'Access-Control-Allow-Methods',
			'value': 'POST, GET, OPTIONS, PUT, DELETE'
		},
		'mandatory': true,
		'fn': null
	},
	{
		'data': {
			'name': 'Allow',
			'value': 'POST, GET, OPTIONS, PUT, DELETE'
		},
		'mandatory': true,
		'fn': null
	}
];

var requestListener = function (details) {
	// console.info('request details', details);
	requestRules.forEach(function (rule) {
		var flag = false;
		details.requestHeaders.forEach(function (header) {
			if (header.name === rule.data.name) {
				flag = true;
				if (rule.fn) {
					rule.fn.call(null, rule, header, details);
				} else {
					header.value = rule.data.value;
				}
			}
		});

		//add this rule anyway if it's not present in request headers
		if (!flag && rule.mandatory) {
			if (rule.data.value) {
				details.requestHeaders.push(rule.data);
			}
		}
	});

	//@todo REMOVE test
	// console.groupCollapsed("%cRequest", "color:red;");
	// console.log(JSON.stringify(details, null, 2));
	// console.groupEnd('Request');

	return {
		requestHeaders: details.requestHeaders
	};
};

var responseListener = function (details) {
	// console.info('response details', details);
	/*  var headers = responseRules.filter(function (rule) {
		console.info('rule filter', rule);
		return rule.value !== void 0 && rule.value !== null;
	  });*/

	responseRules.forEach(function (rule) {
		var flag = false;

		details.responseHeaders.forEach(function (header) {
			// if rule exist in response - rewrite value
			if (header.name === rule.data.name) {
				flag = true;
				if (rule.fn) {
					rule.fn.call(null, rule.data, header, details);
				} else {
					if (rule.data.value) {
						header.value = rule.data.value;
					} else {
						//@TODO DELETE this header
					}
				}
			}
		});

		//add this rule anyway if it's not present in request headers
		if (!flag && rule.mandatory) {
			if (rule.fn) {
				rule.fn.call(null, rule.data, rule.data, details);
			}

			if (rule.data.value) {
				details.responseHeaders.push(rule.data);
			}
		}

		//remove The 'Access-Control-Allow-Origin' header contains multiple values
		for (var i = details.responseHeaders.length - 1; i > 0; i--) {
			var header = details.responseHeaders[i];

			if (rule.data.name.toLowerCase() == header.name) {
				var detail = details.responseHeaders.splice(i, 1);
			}
		}
	});

	//details.responseHeaders = details.responseHeaders.concat(headers);


	//@todo REMOVE test
	// console.groupCollapsed('Response');
	// console.log(JSON.stringify(details, null, 2));
	// console.groupEnd('Response');
	return {
		responseHeaders: details.responseHeaders
	};
};

/*Reload settings*/
var reload = function () {
	console.info("reload");
	chrome.storage.local.get(DefaultSettings,
		function (result) {
			exposedHeaders = result.exposedHeaders;
			console.info("get localStorage", result);

			/*Remove Listeners*/
			chrome.webRequest.onHeadersReceived.removeListener(responseListener);
			chrome.webRequest.onBeforeSendHeaders.removeListener(requestListener);
			if (result.active) {
				chrome.browserAction.setIcon({
					path: 'assets/images/on.png'
				});

				if (result.urls.length) {
					/*Add Listeners*/
					chrome.webRequest.onHeadersReceived.addListener(responseListener, {
						urls: result.urls
					}, response_opt_extraInfoSpec);

					chrome.webRequest.onBeforeSendHeaders.addListener(requestListener, {
						urls: result.urls
					}, request_opt_extraInfoSpec);

				}
			} else {
				chrome.browserAction.setIcon({
					path: 'assets/images/off.png'
				});
			}
		});
};

/*On install*/
chrome.runtime.onInstalled.addListener(function (details) {
	console.log('previousVersion', JSON.stringify(details, null, 2));

	chrome.storage.local.set({
		'active': true
	});
	chrome.storage.local.set({
		'urls': ['*://*/*']
	});
	chrome.storage.local.set({
		'exposedHeaders': ''
	});
	reload();
});
