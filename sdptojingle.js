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
			MID_VIDEO: "mid:audio",
			RTCP_MUX: "rtcp-muc",
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
			RTPMAP: "rtpmap"
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
		HARDCODED_SDP = "v=0\\r\\no=- 0 0 IN IP4 127.0.0.1\\r\\ns=\\r\\nc=IN IP4 0.0.0.0\\r\\nt=0 0",

		_parseMessageInJSON = function(msg) {
			// Strip SDP-prefix and parse it as JSON
			return JSON.parse(msg.substring(SDP_PREFIX_LEN));
		},
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
				case LINE_PREFIXES.ATTRIBUTES:
					_parseAttributes(description[state], keyAndParams.params);
					break;
				case LINE_PREFIXES.MEDIA:
					state = _parseStateFromMedia(keyAndParams.params);
					_parseMedia(description[state], keyAndParams.params);
					break;
			}
			return state;
		},
		_parseStateFromMedia = function(params) {
			return params[0];
		},
		_parseMedia = function(media, params) {
			media.profile = params[2];
		},
		_parseAttributes = function(attrs, params) {
			var key = params[0].split(KEY_DELIMITER);
			switch(key[0]) {
				case ATTRIBUTES.CANDIDATE:
					_parseCandidates(attrs.candidates, key, params);
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
			}

			return attrs;
		},
		_parseCandidates = function(candidates, key, params) {
			candidates.push({
				component: params[1],
				foundation: key[1],
				protocol: params[2],
				priority: params[3],
				ip: params[4],
				port: params[5],
				type: params[7],
				name: params[9],
				network: params[11],
				ufrag: params[13],
				pwd: params[15],
				generation: params[17]
			});
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
			ssrc[key[1]][nameValue[0]] = nameValue[1];
		},
		_generateJingleFromDescription = function(description) {
			return {
				video: _generateMediaContent("video", description.video),
				audio: _generateMediaContent("audio", description.audio)
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

			str += "<transport xmlns='" + XMLNS.TRANSPORT.ICE_UDP + "'";
			str += media.candidates.length ? '>' : '/>';
			if (media.candidates.length) {
				str += _serializeProperties('candidate', media.candidates);
			}
			str += media.candidates.length ? '</transport>' : '';

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
				parser = new DOMParser();
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
					candidates: [],
					crypto: [],
					rtpmap: [],
					ssrc: {},
					profile: ""
				},
				"video": {
					candidates: [],
					crypto: [],
					rtpmap: [],
					ssrc: {},
					profile: ""
				}
			};
		},
		_parseStanza = function(description, stanza) {
			var child;
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
							description.candidates.push(_unserializeAttributes(child));
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
			var sdp = HARDCODED_SDP;
			for(var media in description) {
				if(description.hasOwnProperty(media)) {
					sdp += _generateMediaSdp(media, description[media]);
				}
			}
			return sdp + "\\r\\n";
		},
		_generateMediaSdp = function(media, description) {
			// TODO: Remove hardcoded values like "1" which is the mediaport placeholder
			var m = "\\r\\nm=" + media + " 1 " + description.profile,
				rtpmapStr = "a=mid:" + media + "\\r\\na=rtcp-mux",
				cryptoStr = "",
				candidateStr = "",
				ssrcStr = "";
			for (var i = 0, len = description.candidates.length; i < len; i++) {
				var candidate = description.candidates[i],
					attrs = [
						candidate.component,
						candidate.protocol,
						candidate.priority,
						candidate.ip,
						candidate.port,
						// TODO: Remove hardcoded values
						"typ",
						candidate.type,
						"name",
						candidate.name,
						"network_name",
						candidate.network,
						"username",
						candidate.ufrag,
						"password",
						candidate.pwd,
						"generation",
						candidate.generation
					];
				candidateStr += "a=candidate:" + candidate.foundation
					+ " " + attrs.join(" ") + "\\r\\n";
			}
			for (var i = 0, len = description.crypto.length; i < len; i++) {
				var crypto = description.crypto[i];
				cryptoStr += "\\r\\na=crypto:" + crypto.tag + " " + crypto['crypto-suite'] +
					" " + crypto['key-params'] + " ";
				if(crypto['session-params'].length) {
					cryptoStr += crypto['session-params'];
				}
			}
			rtpmapStr += cryptoStr;
			for (var i = 0, len = description.rtpmap.length; i < len; i++) {
				var type = description.rtpmap[i];
				m += " " + type.id;
				rtpmapStr += "\\r\\na=rtpmap:" + type.id + " " + type.name + "/" + type.clockrate;
			}
			for (var key in description.ssrc) {
				if (description.ssrc.hasOwnProperty(key)) {
					var ssrc = description.ssrc[key];
					for (var subkey in ssrc) {
						ssrcStr += "\\r\\na=ssrc:" + key;
						if (ssrc.hasOwnProperty(subkey)) {
							ssrcStr += " " + subkey + ":" + ssrc[subkey];
						}
					}
				}
			}

			return m + "\\r\\n" + candidateStr + rtpmapStr + ssrcStr;
		};

	return {
		createJingleStanza: function(sdpMsg) {
			sdpMsg = _parseMessageInJSON(sdpMsg);

			var description = _generateEmptyDescription(),
				state = null,
				sdp = _splitSdpMessage(sdpMsg.sdp),
				sessionId = sdpMsg.offererSessionId,
				seq = sdpMsg.seq,
				tieBreaker = sdpMsg.tieBreaker;
			for(var i = 0, len = sdp.length; i < len; i++) {
				state = _parseLine(description, state, sdp[i]);
			}
			return _generateJingleFromDescription(description);
		},
		parseJingleStanza: function(stanza) {
			var doc = _getXmlDoc(stanza),
				children = doc.childNodes[0].childNodes,
				child,
				media = null,
				description = _generateEmptyDescription(),
				hasSdpMessage = false;
			for(var y = 0, len = children.length; y < len; y++) {
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
if (module !== undefined && module.exports !== undefined) {
	module.exports = SDPToJingle;
}
