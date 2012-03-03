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
				"video": "urn:xmpp:tmp:jingle:apps:video-rtp",
				"audio": "urn:xmpp:tmp:jingle:apps:rtp:1",
			},
			TRANSPORT: {
				ICE_UDP: "urn:xmpp:tmp:jingle:transports:ice-udp:1",
				RAW_UDP: "urn:xmpp:tmp:jingle:transports:raw-udp:1",
			}
		},
		
		_parseMessageInJSON = function(msg) {
			// Strip SDP-prefix and parse it as JSON
			console.log(msg.substring(SDP_PREFIX_LEN));
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
			ssrc = params.join(" ");
		},
		_generateJingleFromDescription = function(description) {
			return {
				video: _generateMediaContent("video", description.video),
				audio: _generateMediaContent("audio", description.audio)
			};
		},
		_generateMediaContent = function(name, media) {
			var str = "<content content='initiator' name='" + name + "'>",
				i = 0, len = 0;
			
			str += "<description xmlns='" + XMLNS.DESCRIPTION[name] + 
				"' profile='" + media.profile + "' media='" + name + "'";
			if (media.ssrc.length) {
				str += " ssrc='" + media.ssrc + "'";
			}
			str += '>';
			str += _serializeProperties('payload-type', media.rtpmap);
			
			if (media.crypto.length) {
				str += "<encryption required='1'>";
				str += _serializeProperties('crypto', media['crypto']);
				str += "</encryption>";
			}
			
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
			if (window.DOMParser) {
				parser = new DOMParser();
				return parser.parseFromString(text,"text/xml");
			} else if(window.ActiveXObject) { // Internet Explorer
				parser = new ActiveXObject("Microsoft.XMLDOM");
				parser.async = false;
				parser.loadXML(text);
				return parser;
			}
			throw "Not implemented";
		},
		_generateEmptyDescription = function() {
			return {
				"video": {
					candidates: [],
					crypto: [],
					rtpmap: [],
					ssrc: "",
					profile: ""
				},
				"audio": {
					candidates: [],
					crypto: [],
					rtpmap: [],
					ssrc: "",
					profile: ""
				}
			};
		},
		_parseDescriptionStanza = function(stanza) {
			
		},
		_parseTransportStanza = function(stanza) {
			
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
				content = doc.childNodes[0],
				child,
				description = _generateEmptyDescription();
			for(var i = 0; i < content.childNodes.length; i++) {
				child = content.childNodes[i];
				switch(child.tagName) {
					case 'description':
						_parseDescriptionStanza(child);
						break;
					case 'transport':
						_parseTransportStanza(child);
						break;
				}
			}
		}
	};
}());

new window.webkitPeerConnection("STUN stun.l.google.com:19302", function(msg) {
	var jingle = SDPToJingle.createJingleStanza(msg);
	console.log(jingle);
	console.log(SDPToJingle.parseJingleStanza(jingle.video));
})