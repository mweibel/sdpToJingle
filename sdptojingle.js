/**
 * SDP To Jingle parsing and Jingle to SDP parsing
 *
 * Author: Michael Weibel <michael.weibel+xmpp@gmail.com>
 * Copyright: 2012 Michael Weibel
 *
 * License: MIT
 */
"use strict";

var SDPToJingle = (function() {
	// most of the constants are from libjingle webrtcsdp.cc
	var LINE_PREFIXES = {
			VERSION: "v",
			ORIGIN: "o",
			SESSION_NAME: "s",
			SESSION_INFO: "i",
			SESSION_URI: "u",
			SESSION_EMAIL: "e",
			SESSION_PHONE: "p",
			SESSION_CONNECTION: "c",
			SESSION_BANDWIDTH: "b",
			TIMING: "t",
			REPEAT_TIMES: "r",
			TIME_ZONE: "z",
			ENCRYPTION_KEY: "k",
			MEDIA: "m",
			ATTRIBUTES: "a"
		},
		LINE_PREFIX_LEN = 2,
		ATTRIBUTES = {
			GROUP: "group",
			MID: "mid",
			MID_AUDIO: "mid:audio",
			MID_VIDEO: "mid:video",
			RTCP_MUX: "rtcp-mux",
			SSRC: "ssrc",
			CNAME: "cname",
			MSLABEL: "mslabel",
			LABEL: "label",
			CRYPTO: "crypto",
			CANDIDATE: "candidate",
			CANDIDATE_TYP: "typ",
			CANDIDATE_NAME: "name",
			CANDIDATE_NETWORK_NAME: "network_name",
			CANDIDATE_USERNAME: "username",
			CANDIDATE_PASSWORD: "password",
			CANDIDATE_GENERATION: "generation",
			RTPMAP: "rtpmap",
			ICE_UFRAG: "ice-ufrag",
			ICE_PWD: "ice-pwd"
		},
		CANDIDATES = {
			HOST: "host",
			SRFLX: "srflx",
			RELAX: "relay"
		},
		DELIMITER = " ",
		KEY_DELIMITER = ":",
		PAYLOAD_DELIMITER = "/",
		LINE_BREAK = "\r\n",
		SDP_PREFIX_LEN = 3,
		XMLNS = {
			DESCRIPTION: {
				"video": "urn:xmpp:jingle:apps:video-rtp",
				"audio": "urn:xmpp:jingle:apps:rtp:1",
			},
			TRANSPORT: {
				ICE_UDP: "urn:xmpp:jingle:transports:ice-udp:1",
				RAW_UDP: "urn:xmpp:jingle:transports:raw-udp:1",
			}
		},
		// TODO: Remove hardcoding. This is copied from libjingle webrtcsdp.cc
		HARDCODED_SDP_P1 = "v=0\r\no=- ",
		HARDCODED_SDP_P2 = " 1 IN IP4 127.0.0.1\r\ns=\r\nt=0 0",

		_splitSdpMessage = function(msg) {
			return msg.split(LINE_BREAK);
		},
		_splitLine = function(line) {
			var keyAndParams = line.split("=");
			if (keyAndParams.length <= 1) {
				return {};
			}
			return {
				key: keyAndParams[0],
				params: keyAndParams[1].split(DELIMITER)
			}
		},
		_parseLine = function(description, state, line) {
			var keyAndParams = _splitLine(line);

			switch(keyAndParams.key) {
				case LINE_PREFIXES.ORIGIN:
					_parseOrigin(description, keyAndParams.params);
					break;
				case LINE_PREFIXES.ATTRIBUTES:
					_parseAttributes(description[state], keyAndParams.params);
					break;
				case LINE_PREFIXES.MEDIA:
					state = _parseStateFromMedia(keyAndParams.params);
					_parseMedia(description[state], keyAndParams.params);
					break;
				case LINE_PREFIXES.SESSION_CONNECTION:
					_parseSessionConnection(description[state], keyAndParams.params);
			}
			return state;
		},
		_parseStateFromMedia = function(params) {
			return params[0];
		},
		_parseOrigin = function(description, params) {
			description.sid = params[1];
		},
		_parseMedia = function(media, params) {
			media.profile = params[2];
			media.port = params[1];
		},
		_parseAttributes = function(attrs, params) {
			var key = params[0].split(KEY_DELIMITER);
			switch(key[0]) {
				case ATTRIBUTES.CANDIDATE:
					_parseCandidates(attrs['ice-candidates'], key, params);
					break;
				case ATTRIBUTES.CRYPTO:
					_parseCrypto(attrs['crypto'], key, params);
					break;
				case ATTRIBUTES.RTPMAP:
					_parseRtpMap(attrs.rtpmap, key, params);
					break;
				case ATTRIBUTES.SSRC:
					// ssrc is only a string, but split ssrc: first
					_parseSsrc(attrs.ssrc, key, params);
					break;
				case ATTRIBUTES.ICE_UFRAG:
					_parseIceParams(attrs, key);
					break;
				case ATTRIBUTES.ICE_PWD:
					_parseIceParams(attrs, key);
					break;
			}

			return attrs;
		},
		_parseSessionConnection = function(attrs, params) {
			attrs['udp-candidates'].push({
				ip: params[2],
				port: attrs['port'],
				generation: 0
			});
		},
		_parseIceParams = function(attrs, key) {
			attrs[key[0]] = key[1];
		},
		_parseCandidates = function(candidates, key, params) {
			var candidate = {
				component: params[1],
				foundation: key[1],
				protocol: params[2],
				priority: params[3],
				ip: params[4],
				port: params[5],
				type: params[7],
				generation: params[9]
			};
			/*
			name: params[9],
			network: params[11],
			ufrag: params[13],
			pwd: params[15],*/

			candidates.push(candidate);
		},
		_parseCrypto = function(crypto, key, params) {
			crypto.push({
				'crypto-suite': params[1],
				'key-params': params[2],
				'session-params': params[3],
				'tag': key[1]
			});
		},
		_parseRtpMap = function(rtpmap, key, params) {
			var nameAndRate = params[1].split(PAYLOAD_DELIMITER)
			rtpmap.push({
				'id': key[1],
				'name': nameAndRate[0],
				'clockrate': nameAndRate[1]
			});
		},
		_parseSsrc = function(ssrc, key, params) {
			var nameValue = params[1].split(KEY_DELIMITER);
			if (ssrc[key[1]] === undefined) {
				ssrc[key[1]] = {};
			}
			if (nameValue[0] == 'label') {
				// ugly hack to circumvent the fact that DELIMITER splitting is not the best way to parse SDP.
				// Otherwise, the label for certain cameras would be incomplete.
				// TODO: Fix this ugly piece of code
				var paramLength = params.length;
				for(var i = 2; i < paramLength; i++) {
					nameValue[1] += " " + params[i];
				}
			}
			ssrc[key[1]][nameValue[0]] = nameValue[1];
		},
		_generateJingleFromDescription = function(description) {
			return {
				video: _generateMediaContent("video", description.video),
				audio: _generateMediaContent("audio", description.audio),
				sid: description.sid
			};
		},
		_generateMediaContent = function(name, media) {
			var str = "<content creator='initiator' name='" + name + "'>",
				i = 0, len = 0;

			str += "<description xmlns='" + XMLNS.DESCRIPTION[name] +
				"' profile='" + media.profile + "' media='" + name + "'";
			str += '>';
			str += _serializeProperties('payload-type', media.rtpmap);

			if (media.crypto.length) {
				str += "<encryption required='1'>";
				str += _serializeProperties('crypto', media['crypto']);
				str += "</encryption>";
			}

			str += '<streams>';
			for (var streamId in media.ssrc) {
				if (media.ssrc.hasOwnProperty(streamId)) {
					var stream = media.ssrc[streamId];
					str += '<stream';
					for (var attr in stream) {
						str += " " + attr + "='" + stream[attr] + "'";
					}
					str += '>';
					str += '<ssrc>' + streamId + '</ssrc></stream>';
				}
			}
			str += '</streams>';

			str += "</description>";

			if(media['udp-candidates'].length) {
				str += "<transport xmlns='" + XMLNS.TRANSPORT.RAW_UDP + "'>";
				str += _serializeProperties('candidate', media['udp-candidates']);
				str += '</transport>';
			}

			str += "<transport xmlns='" + XMLNS.TRANSPORT.ICE_UDP + "'";

			if (media['ice-pwd'] !== "") {
				str += ' pwd="' + media['ice-pwd'] + '"';
			}
			if (media['ice-ufrag'] !== "") {
				str += ' ufrag="' + media['ice-ufrag'] + '"';
			}

			str += media['ice-candidates'].length ? '>' : '/>';
			if (media['ice-candidates'].length) {
				str += _serializeProperties('candidate', media['ice-candidates']);
			}
			str += media['ice-candidates'].length ? '</transport>' : '';

			str += "</content>";
			return str;
		},
		_serializeProperties = function(tag, properties) {
			var str = "", i = 0, len = 0, property, attr;
			for(i = 0, len = properties.length; i < len; i++) {
				property = properties[i];
				str += '<' + tag;
				for(attr in property) {
					if (property.hasOwnProperty(attr)) {
						str += " " + attr + "='" + property[attr] + "'";
					}
				}
				str += '/>';
			}
			return str;
		},
		_getXmlDoc = function(text) {
			var parser;
			if (typeof window !== 'undefined' && window.DOMParser) {
				parser = new window.DOMParser();
				return parser.parseFromString(text,"text/xml");
			} else if(typeof window !== 'undefined' && window.ActiveXObject) { // Internet Explorer
				parser = new ActiveXObject("Microsoft.XMLDOM");
				parser.async = false;
				parser.loadXML(text);
				return parser;
			} else if (typeof require === 'function') { // node.js
				var DOMParser = require('xmldom').DOMParser;
				parser = new DOMParser();
				return parser.parseFromString(text,"text/xml");
			}
			throw "Not implemented";
		},
		_generateEmptyDescription = function() {
			return {
				"audio": {
					"udp-candidates": [],
					"ice-candidates": [],
					crypto: [],
					rtpmap: [],
					ssrc: {},
					profile: "",
					"ice-ufrag": "",
					"ice-pwd": ""
				},
				"video": {
					"udp-candidates": [],
					"ice-candidates": [],
					crypto: [],
					rtpmap: [],
					ssrc: {},
					profile: "",
					"ice-ufrag": "",
					"ice-pwd": ""
				},
				"sid": ""
			};
		},
		_parseStanza = function(description, stanza) {
			var child,
				pwd = stanza.getAttribute('pwd'),
				ufrag = stanza.getAttribute('ufrag'),
				xmlns = stanza.getAttribute('xmlns');
			if (pwd) {
				description['ice-pwd'] = pwd;
			}
			if (ufrag) {
				description['ice-ufrag'] = ufrag;
			}

			for(var i = 0, len = stanza.childNodes.length; i < len; i++) {
				if (stanza.childNodes.hasOwnProperty(i)) {
					child = stanza.childNodes[i];
					switch(child.tagName) {
						case 'payload-type':
							description.rtpmap.push(_unserializeAttributes(child));
							break;
						case 'encryption':
							for(var c = 0, clen = child.childNodes.length; c < clen; c++) {
								description.crypto.push(_unserializeAttributes(child.childNodes[c]));
							}
							break;
						case 'candidate':
							if (xmlns == XMLNS.TRANSPORT.RAW_UDP) {
								description['udp-candidates'].push(_unserializeAttributes(child));
								description['port'] = child.getAttribute('port');
							} else if (xmlns == XMLNS.TRANSPORT.ICE_UDP) {
								description["ice-candidates"].push(_unserializeAttributes(child));
							}
							break;
						case 'streams':
							for(var c = 0, clen = child.childNodes.length; c < clen; c++) {
								var stream = child.childNodes[c],
									attrs = _unserializeAttributes(stream),
									ssrc = stream.childNodes[0];
								description.ssrc[ssrc.firstChild.nodeValue] = attrs;
							}
					}
				}
			}
		},
		_unserializeAttributes = function(element) {
			var res = {},
				attr;
			for(var i = 0, len = element.attributes.length; i < len; i++) {
				if(element.attributes.hasOwnProperty(i)) {
					attr = element.attributes[i];
					res[attr.name] = attr.value;
				}
			}
			return res;
		},
		_generateSdpFromDescription = function(description) {
			var baseSdp = HARDCODED_SDP_P1 + description.sid + HARDCODED_SDP_P2,
				sdp = "",
				bundleSdp = "\r\na=group:BUNDLE";
			delete description.sid;


			for(var media in description) {
				if(description.hasOwnProperty(media)) {
					sdp += _generateMediaSdp(media, description[media]);
				}
				bundleSdp += " " + media;
			}
			return baseSdp + bundleSdp + sdp + "\r\n";
		},
		_generateMediaSdp = function(media, description) {
			// TODO: Remove hardcoded values like "1" which is the mediaport placeholder
			var m = "\r\nm=" + media + " " + description.port + " " + description.profile,
				rtpmapStr = "a=mid:" + media + "\r\na=rtcp-mux",
				rtcpStr = "a=rtcp:" + description.port + " IN IP4 " + description['udp-candidates'][0].ip + "\r\n",
				cryptoStr = "",
				udpCandidateStr = "",
				iceCandidateStr = "",
				ssrcStr = "",
				iceStr = "";

			for (var i = 0, len = (description['udp-candidates'] ? description['udp-candidates'].length : 0); i < len; i++) {
				var candidate = description['udp-candidates'][i];
				udpCandidateStr += "c=IN IP4 " + candidate.ip + "\r\n";
			}

			if (description['ice-ufrag']) {
				iceStr += "a=ice-ufrag:" + description['ice-ufrag'] + "\r\n";
			}
			if (description['ice-pwd']) {
				iceStr += "a=ice-pwd:" + description['ice-pwd'] + "\r\n";
			}

			for (var i = 0, len = (description['ice-candidates'] ? description['ice-candidates'].length : 0); i < len; i++) {
				var candidate = description['ice-candidates'][i],
					attrs = [
						candidate.component,
						candidate.protocol,
						candidate.priority,
						candidate.ip,
						candidate.port,
						// TODO: Remove hardcoded values
						"typ",
						candidate.type,
						/*"name",
						candidate.name,
						"network_name",
						candidate.network,
						"username",
						candidate.ufrag,
						"password",
						candidate.pwd,*/
						"generation",
						candidate.generation
					];
				iceCandidateStr += "a=candidate:" + candidate.foundation
					+ " " + attrs.join(" ") + "\r\n";
			}
			for (var i = 0, len = (description.crypto ? description.crypto.length : 0); i < len; i++) {
				var crypto = description.crypto[i];
				cryptoStr += "\r\na=crypto:" + crypto.tag + " " + crypto['crypto-suite'] +
					" " + crypto['key-params'] + " ";
				if(crypto['session-params'].length) {
					cryptoStr += crypto['session-params'];
				}
			}
			rtpmapStr += cryptoStr;
			for (var i = 0, len = (description.rtpmap ? description.rtpmap.length : 0); i < len; i++) {
				var type = description.rtpmap[i];
				m += " " + type.id;
				rtpmapStr += "\r\na=rtpmap:" + type.id + " " + type.name + "/" + type.clockrate;
			}
			for (var key in description.ssrc) {
				if (description.ssrc.hasOwnProperty(key)) {
					var ssrc = description.ssrc[key];
					for (var subkey in ssrc) {
						ssrcStr += "\r\na=ssrc:" + key;
						if (ssrc.hasOwnProperty(subkey)) {
							ssrcStr += " " + subkey + ":" + ssrc[subkey];
						}
					}
				}
			}

			return m + "\r\n" + udpCandidateStr + rtcpStr + iceCandidateStr + iceStr + rtpmapStr + ssrcStr;
		};

	return {
		createJingleStanza: function(sdp) {
			var description = _generateEmptyDescription(),
				state = null,
				sdp = _splitSdpMessage(sdp);
			for(var i = 0, len = sdp.length; i < len; i++) {
				state = _parseLine(description, state, sdp[i]);
			}
			return _generateJingleFromDescription(description);
		},
		parseJingleStanza: function(stanza) {
			var doc = _getXmlDoc(stanza),
				jingle = doc.childNodes.length ? doc.childNodes[0] : undefined,
				children = jingle ? jingle.childNodes : undefined,
				child,
				media = null,
				description = _generateEmptyDescription(),
				hasSdpMessage = false;

			if (!children) {
				throw "Error: Invalid Stanza given";
			}

			description.sid = jingle.getAttribute('sid');

			for(var y = 0, len = children.length; y < len; y++) {
				if (!children[y]) {
					continue;
				}
				if (children[y].tagName === 'content') {
					hasSdpMessage = true;
					var content = children[y];
					for(var i = 0, len = content.childNodes.length; i < len; i++) {
						child = content.childNodes[i];
						switch(child.tagName) {
							case 'description':
								media = child.getAttribute('media');
								description[media].profile = child.getAttribute('profile');
								// fall through, parseStanza needs to be done for both tags
							case 'transport':
								_parseStanza(description[media], child);
								break;
						}
					}
				}
			}
			if (!hasSdpMessage) {
				return null;
			}
			return _generateSdpFromDescription(description);
		}
	};
}());

// for node.js
try {
	if (module !== undefined && module.exports !== undefined) {
		module.exports = SDPToJingle;
	}
} catch(e) {}
