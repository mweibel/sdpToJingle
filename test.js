/**
 * SDP To Jingle
 *
 * Unittest
 *
 * Author:
 *   Michael Weibel <michael.weibel+xmpp@gmail.com>
 *
 * Tested SDP Messages are from libjingle,
 * Copyright 2011, Google Inc.
 *
 * See LICENSE.md for libjingle Licence Information
 */
"use strict";

var test = (function() {
	var should = require('should'),
		SDPToJingle = require('./sdptojingle.js'),
		sdpFullString =
	 		"v=0\r\n"
			+ "o=- 123 1 IN IP4 127.0.0.1\r\n"
			+ "s=\r\n"
			+ "t=0 0\r\n"
			+ "a=group:BUNDLE audio video\r\n"
			+ "m=audio 36798 RTP/AVPF 103 104 110 107 9 102 108 0 8 106 105 13 127 126\r\n"
			+ "c=IN IP4 172.22.76.221\r\n"
			+ "a=rtcp:36798 IN IP4 172.22.76.221\r\n"
			+ "a=candidate:1 2 udp 1 172.22.76.221 47216 typ host generation 0\r\n"
			+ "a=candidate:1 1 udp 1 172.22.76.221 48235 typ host generation 0\r\n"
			+ "a=candidate:1 2 udp 0.9 172.22.76.221 36798 typ srflx generation 0\r\n"
			+ "a=candidate:1 1 udp 0.9 172.22.76.221 50102 typ srflx generation 0\r\n"
			+ "a=mid:audio\r\n"
			+ "a=rtcp-mux\r\n"
			+ "a=crypto:0 AES_CM_128_HMAC_SHA1_32 inline:keNcG3HezSNID7LmfDa9J4lfdUL8W1F7TNJKcbuy \r\n"
			+ "a=rtpmap:103 ISAC/16000\r\n"
			+ "a=rtpmap:104 ISAC/32000\r\n"
			+ "a=rtpmap:110 CELT/32000\r\n"
			+ "a=rtpmap:107 speex/16000\r\n"
			+ "a=rtpmap:9 G722/16000\r\n"
			+ "a=rtpmap:102 ILBC/8000\r\n"
			+ "a=rtpmap:108 speex/8000\r\n"
			+ "a=rtpmap:0 PCMU/8000\r\n"
			+ "a=rtpmap:8 PCMA/8000\r\n"
			+ "a=rtpmap:106 CN/32000\r\n"
			+ "a=rtpmap:105 CN/16000\r\n"
			+ "a=rtpmap:13 CN/8000\r\n"
			+ "a=rtpmap:127 red/8000\r\n"
			+ "a=rtpmap:126 telephone-event/8000\r\n"
			+ "a=ssrc:2570980487 cname:hsWuSQJxx7przmb8\r\n"
			+ "a=ssrc:2570980487 mslabel:stream_label\r\n"
			+ "a=ssrc:2570980487 label:audio_label\r\n"
			+ "m=video 39456 RTP/AVPF 100 101 102\r\n"
			+ "c=IN IP4 172.22.76.221\r\n"
			+ "a=rtcp:39456 IN IP4 172.22.76.221\r\n"
			+ "a=candidate:1 2 udp 1 172.22.76.221 40550 typ host generation 0\r\n"
			+ "a=candidate:1 1 udp 1 172.22.76.221 53441 typ host generation 0\r\n"
			+ "a=candidate:1 2 udp 0.9 172.22.76.221 46128 typ srflx generation 0\r\n"
			+ "a=candidate:1 1 udp 0.9 172.22.76.221 39456 typ srflx generation 0\r\n"
			+ "a=mid:video\r\n"
			+ "a=rtcp-mux\r\n"
			+ "a=crypto:0 AES_CM_128_HMAC_SHA1_80 inline:5ydJsA+FZVpAyqJMT/nW/UW+tcOmDvXJh/pPhNRe \r\n"
			+ "a=rtpmap:100 VP8/90000\r\n"
			+ "a=rtpmap:101 red/90000\r\n"
			+ "a=rtpmap:102 ulpfec/90000\r\n"
			+ "a=ssrc:43633328 cname:hsWuSQJxx7przmb8\r\n"
			+ "a=ssrc:43633328 mslabel:stream_label\r\n"
			+ "a=ssrc:43633328 label:video_label\r\n",
		sdpString = "",
		jingleStanza = "",
		jingleBefore = '<jingle',
		jingleAfter = '</jingle>';


	describe('SDPToJingle', function() {
		describe('#createJingleStanza #parseJingleStanza', function() {
			it('should convert sdp to jingle and correctly convert it back', function(done) {
				var toJingle = SDPToJingle.createJingleStanza(sdpFullString);
				toJingle.should.have.property('video');
				toJingle.should.have.property('audio');

				var jingle = jingleBefore + ' sid="' + toJingle.sid + '">' + toJingle.audio + toJingle.video + jingleAfter;
				var toSdp = SDPToJingle.parseJingleStanza(jingle);
				console.log(toSdp);
				console.log(sdpFullString);

				toSdp.should.equal(sdpFullString);

				done();
			});
			it('should convert sdp to jingle and match the expected output', function(done) {
				var toJingle = SDPToJingle.createJingleStanza(sdpFullString);

				done();
			});
			it('should convert jingle to sdp and match the expected output', function(done) {
				var toSdp = SDPToJingle.parseJingleStanza(sdpFullString);
				done();
			});
		});
	});
}());
