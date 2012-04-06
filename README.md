SDP To Jingle
=============

Converts a PeerConnection SDP Message to Jingle and vice-versa.

Feel free to contribute.

Unit Test
---------
The unit test is currently failing due to some things I can't parse (or I don't know how to parse it for now) to jingle.
Requirements for running are:
  - node.js
  - mocha (installable via npm)
  - should (installable via npm)
  - xmldom (installable via npm)
You can run it using:
```
mocha -r should -r xmldom -R spec test.js --globals window
```

Or when you're developing you can automatically run it on save by using:
```
mocha -r should -r xmldom -R spec -w test.js --globals window
```

License
-------
See LICENSE.md
