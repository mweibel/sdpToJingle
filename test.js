/**
 * SDP To Jingle
 *
 * Unittest
 *
 * Author:
 *   Michael Weibel <michael.weibel@gmail.com>
 *
 * Tested SDP Messages are from libjingle,
 * Copyright 2011, Google Inc.
 *
 * See LICENSE.md for libjingle Licence Information
 */

var should = require('should'),
	SDPToJingle = require('./sdptojingle.js');
var sdpFullString =
 "v=0\\r\\n"
 + "o=- 0 0 IN IP4 127.0.0.1\\r\\n"
 + "s=\\r\\n"
 + "t=0 0\\r\\n"
 + "c=IN IP4 127.0.0.1\\r\\n"
 + "m=audio 2345 RTP/AVPF 103 104\\r\\n"
 + "a=rtcp:2346 IN IP4 74.125.127.126\\r\\n"
 + "a=candidate:1 1 udp 1 127.0.0.1 1234 typ host name rtp network_name "
 + "eth0 username user_rtp password password_rtp generation 0\\r\\n"
 + "a=candidate:1 2 udp 1 127.0.0.1 1235 typ host name rtcp network_name "
 + "eth0 username user_rtcp password password_rtcp generation 0\\r\\n"
 + "a=candidate:1 1 udp 1 74.125.127.126 2345 typ srflx name rtp network_name "
 + "eth0 username user_rtp_stun password password_rtp_stun generation 0\\r\\n"
 + "a=candidate:1 2 udp 1 74.125.127.126 2346 typ srflx name rtcp network_name"
 + " eth0 username user_rtcp_stun password password_rtcp_stun generation 0\\r\\n"
 + "a=mid:audio\\r\\n"
 + "a=rtcp-mux\\r\\n"
 + "a=crypto:1 AES_CM_128_HMAC_SHA1_32 "
 + "inline:NzB4d1BINUAvLEw6UzF3WSJ+PSdFcGdUJShpX1Zj|2^20|1:32 \\r\\n"
 + "a=rtpmap:103 ISAC/16000\\r\\n"
 + "a=rtpmap:104 ISAC/32000\\r\\n"
 + "a=ssrc:1 cname:stream_1_cname\\r\\n"
 + "a=ssrc:1 mslabel:local_stream_1\\r\\n"
 + "a=ssrc:1 label:local_audio_1\\r\\n"
 + "a=ssrc:4 cname:stream_2_cname\\r\\n"
 + "a=ssrc:4 mslabel:local_stream_2\\r\\n"
 + "a=ssrc:4 label:local_audio_2\\r\\n"
 + "m=video 3457 RTP/AVPF 120\\r\\n"
 + "c=IN IP4 74.125.224.39\\r\\n"
 + "a=rtcp:3456 IN IP4 74.125.224.39\\r\\n"
 + "a=candidate:1 2 udp 1 127.0.0.1 1236 typ host name video_rtcp "
 + "network_name eth0 username user_video_rtcp password password_video_rtcp "
 + "generation 0\\r\\n"
 + "a=candidate:1 1 udp 1 127.0.0.1 1237 typ host name video_rtp "
 + "network_name eth0 username user_video_rtp password password_video_rtp "
 + "generation 0\\r\\n"
 + "a=candidate:1 2 udp 1 74.125.224.39 3456 typ relay name video_rtcp "
 + "network_name eth0 username user_video_rtcp_relay password "
 + "password_video_rtcp generation 0\\r\\n"
 + "a=candidate:1 1 udp 1 74.125.224.39 3457 typ relay name video_rtp "
 + "network_name eth0 username user_video_rtp_relay password "
 + "password_video_rtp generation 0\\r\\n"
 + "a=mid:video\\r\\n"
 + "a=crypto:1 AES_CM_128_HMAC_SHA1_80 "
 + "inline:d0RmdmcmVCspeEc3QGZiNWpVLFJhQX1cfHAwJSoj|2^20|1:32 \\r\\n"
 + "a=rtpmap:120 VP8/90000\\r\\n"
 + "a=ssrc:2 cname:stream_1_cname\\r\\n"
 + "a=ssrc:2 mslabel:local_stream_1\\r\\n"
 + "a=ssrc:2 label:local_video_1\\r\\n"
 + "a=ssrc:3 cname:stream_1_cname\\r\\n"
 + "a=ssrc:3 mslabel:local_stream_1\\r\\n"
 + "a=ssrc:3 label:local_video_2\\r\\n"
 + "a=ssrc:5 cname:stream_2_cname\\r\\n"
 + "a=ssrc:5 mslabel:local_stream_2\\r\\n"
 + "a=ssrc:5 label:local_video_3\\r\\n";

var jsonFullString =
 "SDP {\n"
 + "    \"messageType\": \"OFFER\",\n"
 + "    \"offererSessionId\": \"qJbHJjliPNvqG8rZQTAJzXwGVk4oDe3f\",\n"
 + "    \"sdp\": \""
 + sdpFullString
 + "\",\n"
 + "    \"seq\": 1,\n"
 + "    \"tieBreaker\": 1356048760\n"
 + "}";

var jingleBefore = '<jingle>',
	jingleAfter = '</jingle>';


describe('SDPToJingle', function() {
	describe('#createJingleStanza', function() {
		it('should convert sdp to jingle and correctly convert it back', function(done) {
			var toJingle = SDPToJingle.createJingleStanza(jsonFullString);
			toJingle.should.have.property('video');
			toJingle.should.have.property('audio');

			var jingle = jingleBefore + toJingle.audio + toJingle.video + jingleAfter;
			window = undefined;
			var toSdp = SDPToJingle.parseJingleStanza(jingle);
			console.log(toSdp);
			console.log(sdpFullString);

			toSdp.should.equal(sdpFullString);

			done();
		});
	});
});
